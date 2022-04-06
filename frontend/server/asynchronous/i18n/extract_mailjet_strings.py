"""Extract translatable strings from MailJet templates."""

import json
import logging
from os import path
import re
import sys
from typing import Iterator, Literal, Mapping, Optional, Sequence, Set, Tuple

import polib

# Regexp to match HTML (actually XML) and MJML tags e.g. <p style="">, <br />, </a>, {%endif%} etc.
_HTML_AND_MJML_TAG_PATTERN = re.compile(
    r'(<[^>]*>|[ \n]*\n[ \n]*|{{[^}]*}}|{[^{}]*})', re.MULTILINE)
# Regexp to match HTML (actually XML) tags e.g. <p style="">, <br />, </a>, but not {%endif%} etc.
_HTML_TAG_PATTERN = re.compile(r'(<[^>]*>|[ \n]*\n[ \n]*)', re.MULTILINE)

# Regexp to match an HTML Table Cell, e.g. <td style="">...</td>
_HTML_TD_PATTERN = re.compile(r'<td[ >\n](?:[^<]|<[^t]|<t[^d])*?</td>', re.MULTILINE)
# Regexp to match a simple HTML div without inner tags, e.g. <div style="">...</div>
_HTML_DIV_PATTERN = re.compile(r'<div[ >\n](?:[^<])*?</div>', re.MULTILINE)
# Regexp to match the attributes inside an HTML tag, e.g. src="https://foo"
_HTML_ATTRS_PATTERN = re.compile(r'(?:^| )([a-z]+)="((?:[^"]|\\")*)"', re.MULTILINE)
# Regexp to match the HTML title, e.g. <title>...</title>
_HTML_TITLE_PATTERN = re.compile(r'<title>(?:[^<]|<[^t]|<t[^i])*?</title>')
# Regexp to match whitespace between HTML tags that can be dropped, e.g. </p>\n  \n<p>
_HTML_MEANINGLESS_PATTERN = re.compile(r'(?<=>)\s*(\n\s*)+|\s*(\n\s*)+(?=<)')
# Regexp to match a simple MJML XML end node without inner mj- child, e.g. <mj-text>...</mj-text>
_MJML_XML_NODE_PATTERN = re.compile(r'<mj-(?:[^>]*/>|(?:[^<]|<[^m]|<m[^j]|mj[^-])*?</mj-[^>]*>)')


# TODO(pascal): Move to a library.


_TokenType = Literal['content', 'opening', 'closing', 'self-closing', 'mjml']


def tokenize_html_and_mjml(html_soup: str) -> Iterator[Tuple[str, _TokenType]]:
    """Breaks an HTML and MJML template soup into token: tags and content."""

    try:
        tokens = _HTML_AND_MJML_TAG_PATTERN.split(html_soup)
    except TypeError:
        logging.debug(html_soup)
        raise
    for token in tokens:
        if not token:
            continue
        clean_token = token.strip()
        if clean_token.endswith('/>') or clean_token == '<br>' or clean_token.startswith('<img'):
            yield token, 'self-closing'
        elif clean_token.startswith('</'):
            yield token, 'closing'
        elif clean_token.startswith('<'):
            yield token, 'opening'
        elif clean_token.startswith('{'):
            yield token, 'mjml'
        else:
            yield token, 'content'


def breaks_outer_tags_html(html_soup: str) -> Tuple[str, str, str]:
    """Breaks all outer tags of an HTML string.

    e.g. "<p><a>Content</a></p>" => "<p><a>", "Content", "</a></p>" or
    "<p><a>this</a> is a <a>link</a></p>" => "<p>", "<a>this</a> is a <a>link</a>", "</p>"

    It also works on multiline HTML.
    e.g. '''<p>
      <a>
        Content
      </a>
    <p>''' => "<p>\n  <a>\n    ", "Content", "\n  </a>\n<p>"
    """

    outer_level = 0
    is_only_ascending = True
    level = 0
    tokens = list(tokenize_html_and_mjml(html_soup))
    for token, token_type in tokens:
        if '\n' in token:
            token = token.strip()

        if not token:
            continue

        # Content or self-closing tag.
        if token_type != 'closing' and token_type != 'opening':
            if outer_level > level:
                outer_level = level
            is_only_ascending = False
            continue

        # Closing tag.
        if token_type == 'closing':
            is_only_ascending = False
            level -= 1
            continue

        # Opening tag.
        level += 1
        if is_only_ascending:
            outer_level = level
        elif level - 1 < outer_level:
            outer_level = level - 1

    if not outer_level:
        return '', html_soup, ''

    start_size = 0
    level = 0
    is_breaking = False
    for token, token_type in tokens:
        clean_token = token.strip()
        if is_breaking and clean_token:
            break
        if token_type == 'opening':
            level += 1
        start_size += len(token)
        if level == outer_level:
            is_breaking = True

    end_index = len(html_soup)
    level = 0
    is_breaking = False
    for token, token_type in reversed(tokens):
        clean_token = token.strip()
        if is_breaking and clean_token:
            break
        if token_type == 'closing':
            level += 1
        end_index -= len(token)
        if level == outer_level:
            is_breaking = True
    return html_soup[:start_size], html_soup[start_size:end_index], html_soup[end_index:]


def itemize_html_and_mjml_tags(html_soup: str) -> Tuple[str, Mapping[str, str]]:
    """Replaces HTML ahd MJML Tags with identifiers (numbers) and return a dict of the content.

    e.g '<p style="f"><a>Cool {{var:foo}}</a><br />Beans</p>' =>
    '<0><1>Cool{2}</1><3/>Beans</0>' => {'0': 'p style="f"', '1':'a', '2': '{var:foo}', '3': 'br '}
    """

    items: dict[str, str] = {}
    reverse_items: dict[str, str] = {}
    context: list[str] = []
    simplified = ''
    for token, token_type in tokenize_html_and_mjml(html_soup):
        if not token:
            continue

        if token_type == 'content':
            simplified += token
            continue

        # Closing tag.
        if token_type == 'closing':
            try:
                item = context.pop()
            except IndexError as error:
                raise ValueError((html_soup, simplified, token)) from error
            simplified += f'</{item}>'
            continue

        item = token[1:-1]
        if token[1:-1] in reverse_items:
            item_index = reverse_items[item]
        else:
            item_index = str(len(items))
            items[item_index] = item
            reverse_items[item] = item_index

        # Self-closing tag.
        if token_type == 'self-closing':
            simplified += f'<{item_index}/>'
            continue

        # MJML tag.
        if token_type == 'mjml':
            simplified += f'{{{item_index}}}'
            continue

        # Opening tag.
        context.append(item_index)
        simplified += f'<{item_index}>'

    return simplified, items


# Attributes to extract.
_MAILJET_ATTRS_TO_EXTRACT = {
    'mj-button': ('href',),
    'mj-image': ('alt', 'href', 'src'),
    'mj-social': ('facebook-href', 'twitter-href'),
    'mj-social-element': ('href',),
}
_HTML_ATTRS_TO_EXTRACT = {
    'a': ('href',),
    'img': ('alt', 'src'),
    'mj-image': ('alt', 'href', 'src'),
} | _MAILJET_ATTRS_TO_EXTRACT


def extract_i18n_from_html_attrs_in_items(contents: Mapping[str, str]) \
        -> Iterator[Tuple[str, str, str]]:
    """Extracts HTML attrs that need to be translated from a list of HTML content.

    Args:
        contents: several inputs that are contents of HTML tags without the "<" and ">" signs keyed
            by any key.
    Yields:
        a string that needs to be translated, the key of the content and the attr of this string.
    """

    for item, content in contents.items():
        if ' ' not in content:
            continue
        tag, attributes = re.split(r'\s+', content, 1)
        if tag not in _HTML_ATTRS_TO_EXTRACT:
            continue
        for key, value in _HTML_ATTRS_PATTERN.findall(attributes):
            if key in _HTML_ATTRS_TO_EXTRACT[tag] and value:
                if 'https://www.mailjet.com/images/theme/v1/icons/ico-social/' in value:
                    continue
                if value in {'twitter', 'facebook'}:
                    continue
                yield value, item, key


def extract_i18n_from_html_attrs(content: str) -> Iterator[Tuple[str, str]]:
    """Extracts HTML attrs that need to be translated from an HTML soup.

    Args:
        content: an HTML soup.
    Yields:
        a string that needs to be translated and the attr of this string.
    """

    for token in _HTML_TAG_PATTERN.split(content):
        if not token.startswith('<') or not token.endswith('>'):
            continue
        for value, unused_, key in extract_i18n_from_html_attrs_in_items({'': token[1:-1]}):
            yield value, key


def iterate_html_contents(html_soup: str) -> Iterator[str]:
    """Iterates an HTML content and yield the substring representing meaningful content.

    In MailJet's HTML templates, meaningful content is only in <td> cells, or <div>.
    """

    for cell in _HTML_TD_PATTERN.findall(html_soup):
        yield cell
    for div in _HTML_DIV_PATTERN.findall(html_soup):
        yield div
    for mj_node in _MJML_XML_NODE_PATTERN.findall(html_soup):
        # TODO(pascal): Allow again once we only extract strings to translate from MJML, for now
        # it's difficult to locate the equivalent strings in HTML.
        if mj_node.startswith('<mj-raw>'):
            continue
        yield mj_node
    for title in _HTML_TITLE_PATTERN.findall(html_soup):
        yield title


def has_i18n_content(string: str) -> bool:
    """Checks whether an HTML soup has any content to be translated.

    "<br>" does not need any translation, "\n  <a> </a>" neither. However "<a>\nHello</a>" does.
    """

    if not string:
        return False
    return any(
        token_type == 'content' and token.strip()
        for token, token_type in tokenize_html_and_mjml(string)
    )


def clear_meaningless_spaces(html_soup: str) -> str:
    """Clear white spaces invisible to HTML."""

    return _HTML_MEANINGLESS_PATTERN.sub('', html_soup)


def _extract_from_mailjet_html(filename: str) -> Iterator[Tuple[str, str]]:
    with open(filename, 'rt', encoding='utf-8') as html_file:
        html_soup = html_file.read()
    yield from _extract_from_mailjet_html_content(html_soup)


def _extract_from_mailjet_html_content(html_content: str) -> Iterator[Tuple[str, str]]:
    html_soup = clear_meaningless_spaces(html_content)
    for html_cell in iterate_html_contents(html_soup):
        original_html_cell = html_cell
        cell_has_i18n_content = has_i18n_content(html_cell)
        html_cell = html_cell.replace('<style></style>', '')
        opening_tags, string, unused_closing_tags = breaks_outer_tags_html(html_cell)
        itemized_string, items = itemize_html_and_mjml_tags(string)
        raw_attribute_strings = {
            # Get attribute strings from inner tags.
            t[0] for t in extract_i18n_from_html_attrs_in_items(items)
        } | {
            # Add attribute strings from outside opening tags.
            t[0] for t in extract_i18n_from_html_attrs(opening_tags)
        }
        attribute_strings: Set[str] = set()
        for attr_string in raw_attribute_strings:
            itemized_attr_string, unused_items = itemize_html_and_mjml_tags(attr_string)
            if has_i18n_content(itemized_attr_string):
                attribute_strings.add(itemized_attr_string)

        cursor = 0
        while (cursor := html_soup.find(original_html_cell, cursor)) > 0:
            line_index = len(html_soup[:cursor].split('\n'))
            if cell_has_i18n_content:
                yield itemized_string, str(line_index)
            for attribute_string in attribute_strings:
                if has_i18n_content(attribute_string):
                    yield attribute_string, str(line_index)
            cursor += 1


def _extract_from_mjml(filename: str) -> Iterator[Tuple[str, str]]:
    with open(filename, 'rt', encoding='utf-8') as mjml_file:
        content = mjml_file.read()
    yield from _extract_from_mailjet_html_content(content)


def extract_from_mailjet(folder: str) -> Iterator[polib.POEntry]:
    """Extract all translatable strings from a MailJet template."""

    mjml_strings: Set[str] = set()
    for string, node in _extract_from_mjml(path.join(folder, 'template.mjml')):
        mjml_strings.add(string)
        yield polib.POEntry(msgid=string, occurrences=[(f'{folder}/template.mjml', node)])

    with open(path.join(folder, 'headers.json'), 'rt', encoding='utf-8') as headers_file:
        headers_content = json.load(headers_file)
    itemized_subject, unused_items = itemize_html_and_mjml_tags(headers_content['Subject'])
    yield polib.POEntry(
        msgid=itemized_subject, occurrences=[(f'{folder}/headers.json', '.Subject')])
    if has_i18n_content(itemized_subject):
        mjml_strings.add(itemized_subject)

    html_strings: Set[str] = set()
    for string, line in _extract_from_mailjet_html(path.join(folder, 'template.html')):
        html_strings.add(string)
        yield polib.POEntry(msgid=string, occurrences=[(f'{folder}/template.html', line)])
    if has_i18n_content(itemized_subject):
        html_strings.add(itemized_subject)

    if mjml_strings != html_strings:
        raise ValueError(
            f'In folder {folder},\nsome MJML strings are not in HTML:\n'
            f'{sorted(mjml_strings - html_strings)}\n'
            'and some HTML strings are not in MJML:\n'
            f'{sorted(html_strings - mjml_strings)}')


def _add_mailjet(pofile: polib.POFile, folder: str) -> None:
    for entry in extract_from_mailjet(folder):
        existing_entry = pofile.find(entry.msgid)
        if existing_entry:
            existing_entry.occurrences.extend(entry.occurrences)
        else:
            pofile.append(entry)


def main(string_args: Optional[Sequence[str]] = None) -> str:
    """Extract translatable strings from Mailjet template folders.

    Args:
        string_args: a list of folder to extract from. None to use the command line arguments.
    Returns:
        the POFile content with the extracted strings.
    """

    if string_args is None:
        string_args = sys.argv[1:]
    translations = polib.POFile()
    for arg in string_args:
        if arg.endswith('.json'):
            with open(arg, encoding='utf-8') as json_file:
                templates = json.load(json_file)
            for template in templates:
                if template.get('noI18n'):
                    continue
                folder = path.join(path.dirname(arg), template.get('name', ''))
                try:
                    _add_mailjet(translations, folder)
                except Exception as error:
                    raise ValueError(folder) from error
            continue

        folder = arg
        if path.isdir(folder) and '__pycache__' not in folder:
            try:
                _add_mailjet(translations, folder)
            except Exception as error:
                raise ValueError(folder) from error
    return str(translations)


if __name__ == '__main__':
    print(main())
