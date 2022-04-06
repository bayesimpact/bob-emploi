"""Translatable MailJet templates."""

import argparse
import json
import logging
import os
from os import path
import typing
from typing import Any, Callable, Mapping, Optional, Sequence, Set, Tuple

import requests
from requests import adapters
from urllib3.util import retry
import sentry_sdk
from sentry_sdk.integrations import logging as sentry_logging

from bob_emploi.common.python import checker
from bob_emploi.common.python import mustache
from bob_emploi.common.python.i18n import translation
from bob_emploi.frontend.server.asynchronous.i18n import extract_mailjet_strings
from bob_emploi.frontend.server.mail.templates import mailjet_templates

# ID of the Airtable base containing translations.
_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'

_HTTP_ADAPTER = adapters.HTTPAdapter(max_retries=retry.Retry(
    total=10,
    status_forcelist=[429, 503],
    allowed_methods=['POST', 'GET', 'OPTIONS', 'PUT'],
    backoff_factor=2,
))


def translate_html_tags(
        html_soup: str, translate: Callable[[str], str], with_outer_tag: bool = True) -> str:
    """Translate an HTML soup.

    e.g. '<p style="foo"><a>Hello</a><br />World</p>', and
    '<1>Hello</1><2/>World' => '<1>Bonjour</1><2/>monde' =>
    ''<p style="foo"><a>Bonjour</a><br />monde</p>'
    """

    if with_outer_tag:
        before, content, after = extract_mailjet_strings.breaks_outer_tags_html(html_soup)
        if before:
            for value, attr in extract_mailjet_strings.extract_i18n_from_html_attrs(before):
                translated_value = translate_html_tags(value, translate, with_outer_tag=False)
                if translated_value != value:
                    before = before.replace(f'{attr}="{value}"', f'{attr}="{translated_value}"')
    else:
        before, content, after = '', html_soup, ''

    simplified, items = extract_mailjet_strings.itemize_html_and_mjml_tags(content)
    if extract_mailjet_strings.has_i18n_content(html_soup):
        translated_simplified = translate(simplified)
    else:
        translated_simplified = simplified
    tokens = extract_mailjet_strings.tokenize_html_and_mjml(translated_simplified)
    translated_items = dict(items)
    for string, item, attr in extract_mailjet_strings.extract_i18n_from_html_attrs_in_items(items):
        translated_value = translate_html_tags(string, translate, with_outer_tag=False)
        if translated_value != string:
            translated_items[item] = \
                items[item].replace(f'{attr}="{string}"', f'{attr}="{translated_value}"')
    translated = ''
    for token, token_type in tokens:
        if not token:
            continue

        if token_type == 'content':
            translated += token
            continue

        # Self-closing tag.
        if token_type == 'self-closing':
            item = token[1:-2]
            translated += f'<{translated_items[item]}>'
            continue

        # Closing tag.
        if token_type == 'closing':
            item = token[2:-1]
            translated += f'</{translated_items[item].split(" ")[0]}>'
            continue

        item = token[1:-1]

        # MJML tag.
        if token_type == 'mjml':
            if item in translated_items:
                translated += f'{{{translated_items[item]}}}'
            elif item.startswith('{') and item.endswith('}'):
                translated += f'{{{item}}}'
            else:
                raise KeyError(
                    f'The translation refers to {{{item}}} that is not in the original string')
            continue

        # Opening tag.
        translated += f'<{translated_items[item]}>'

    return before + translated + after


def _clean_and_translate_xml(html_soup: str, translate: Callable[[str], str]) -> str:
    html_soup = extract_mailjet_strings.clear_meaningless_spaces(html_soup)
    for html_cell in extract_mailjet_strings.iterate_html_contents(html_soup):
        try:
            translated_cell = translate_html_tags(
                html_cell.replace('<style></style>', ''), translate)
        except KeyError as error:
            raise ValueError(f'Impossible to translate {html_cell}') from error
        html_soup = html_soup.replace(html_cell, translated_cell)
    return html_soup


def _check_mustache(template: str, folder: str) -> None:
    with open(path.join(folder, 'vars-example.json'), 'rt', encoding='utf-8') as vars_file:
        template_vars = json.load(vars_file) | {'senderName': 'Sender Name'}
    mustache.instantiate(template, template_vars, use_strict_syntax=True)


def translate_mailjet_content(folder: str, translate: Callable[[str], str]) -> Mapping[str, Any]:
    """Translate a Mailjet template from a folder using a translate function."""

    # Headers.
    with open(path.join(folder, 'headers.json'), 'rt', encoding='utf-8') as headers_file:
        headers_content = json.load(headers_file)
    headers_content['Subject'] = translate_html_tags(headers_content['Subject'], translate)

    # HTML.
    with open(path.join(folder, 'template.html'), 'rt', encoding='utf-8') as html_file:
        html_soup = _clean_and_translate_xml(html_file.read(), translate)
    _check_mustache(html_soup, folder)

    # MJML.
    with open(path.join(folder, 'template.mjml'), 'rt', encoding='utf-8') as mjml_file:
        mjml_content = mjml_file.read()
    mjml_root = _clean_and_translate_xml(mjml_content, translate)
    _check_mustache(mjml_root, folder)

    return {
        'Headers': headers_content,
        'Text-part': '',
        'Html-part': html_soup,
        'MJMLContent': mjml_root,
    }


# Mailjet only supports locales including a country code.
_MAILJET_LOCALES = {
    'fr': 'fr_FR',
    'fr@tu': 'fr_FR',
    'en': 'en_US',
    'en_UK': 'en_GB',
}

_FALLBACK_LOCALES = {
    'fr@tu': ['fr'],
    'en_UK': ['en'],
}


class _TemplateTranslationError(ValueError):

    def __init__(
            self,
            missing_translations: Set[str], validation_errors: dict[str, ValueError]) -> None:
        errors = ''
        if missing_translations:
            errors += 'There are missing translations for:\n  ' + \
                '\n  '.join(sorted(missing_translations))
        if validation_errors:
            if missing_translations:
                errors += '\n'
            errors += 'There are validation errors:\n  ' + '\n'.join(
                f'  {string}: {error}' for string, error in validation_errors.items()
            )
        super().__init__(errors)
        self.missing_translations = missing_translations
        self.validation_errors = validation_errors


class _TranslationResult(typing.NamedTuple):
    has_been_updated: bool = False
    new_template_id: Optional[int] = None


class _MailTranslator:

    def __init__(self, mj_api_key: str, mj_api_secret: str):
        self._all_translations: dict[str, dict[str, str]] = {}
        self._auth = (mj_api_key, mj_api_secret)
        self._space_checker = checker.SpacesChecker()
        self._http = requests.Session()
        self._http.mount('https://', _HTTP_ADAPTER)

    def _post_mailjet(self, url: str, data: Any) -> requests.Response:
        return self._http.post(
            url,
            data=json.dumps(data),
            headers={'Content-Type': 'application/json'},
            auth=self._auth,
        )

    def _get_available_translation(self, string: str, locale: str) -> str:
        locales = [locale] + _FALLBACK_LOCALES.get(locale, [])
        for lang in locales:
            try:
                return self._all_translations[string][lang]
            except KeyError:
                pass
        raise KeyError(locale)

    def update_template(
            self, campaign_id: mailjet_templates.Id, lang: str, dry_run: bool = True)\
            -> _TranslationResult:
        """Update the Mailjet template for a given campaign in the given language.

        Returns:
            The ID of the template created if any.
        """

        folder = path.join(mailjet_templates.PATH, campaign_id)
        template_id = mailjet_templates.MAP[campaign_id].get('i18n', {}).get(lang)
        new_template_id: Optional[int] = None

        if not self._all_translations:
            self._all_translations |= translation.get_all_translations()

        missing_translations: Set[str] = set()
        validation_errors: dict[str, ValueError] = {}

        def _translate(string: str) -> str:
            try:
                translated_string = self._get_available_translation(string, lang)
            except KeyError:
                missing_translations.add(string)
                return string
            try:
                self._space_checker.check_value(translated_string, lang)
            except ValueError as error:
                validation_errors[translated_string] = error
            return translated_string

        data = translate_mailjet_content(folder, _translate)

        if missing_translations or validation_errors:
            exception = _TemplateTranslationError(missing_translations, validation_errors)
            raise exception

        if template_id:
            response = self._http.get(
                f'https://api.mailjet.com/v3/REST/template/{template_id}/detailcontent',
                headers={'Content-Type': 'application/json'},
                auth=self._auth,
            )
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as error:
                logging.error(response.text, exc_info=error)
                raise
            old_data = response.json()['Data'][0]
            if old_data == data:
                logging.info('Data is already up to date for "%s" in "%s".', campaign_id, lang)
                return _TranslationResult(has_been_updated=False)
        else:
            if dry_run:
                logging.info('Template for "%s" in "%s" would be created.', campaign_id, lang)
                return _TranslationResult(new_template_id=1)
            logging.info('Creating template for "%s" in "%s".', campaign_id, lang)
            response = self._post_mailjet(
                'https://api.mailjet.com/v3/REST/template',
                data={
                    'Name': f'DO NOT EDIT {campaign_id} ({lang})',
                    'EditMode': 1,
                    'Locale': _MAILJET_LOCALES[lang],
                },
            )
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as error:
                logging.error(response.text, exc_info=error)
                raise
            template_id = typing.cast(int, response.json()['Data'][0]['ID'])
            new_template_id = template_id

        if dry_run:
            logging.info('Data would be updated for "%s" in "%s".', campaign_id, lang)
        else:
            logging.info('Updating template for "%s" in "%s".', campaign_id, lang)
            response = self._post_mailjet(
                f'https://api.mailjet.com/v3/REST/template/{template_id}/detailcontent',
                data=data,
            )
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as error:
                logging.error(response.text, exc_info=error)
                raise

        return _TranslationResult(new_template_id=new_template_id)


def _update_mailjet_templates(
        map_filename: str, campaign_id: str, lang: str, template_id: int) -> None:
    with open(map_filename, 'rt', encoding='utf-8') as map_file:
        map_as_list = json.load(map_file)

    try:
        index = next(i for i, t in enumerate(map_as_list) if t['name'] == campaign_id)
    except StopIteration:
        # The campaign isn't in this template map.
        return
    if 'i18n' not in map_as_list[index]:
        map_as_list[index]['i18n'] = {}
    map_as_list[index]['i18n'] |= {lang: template_id}

    with open(map_filename, 'wt', encoding='utf-8') as map_file:
        json.dump(map_as_list, map_file, indent=2, ensure_ascii=False, sort_keys=True)
        map_file.write('\n')


def main(string_args: Optional[Sequence[str]] = None) -> None:
    """Translate a Mailjet template from a folder.

    Args:
        string_args: a list of folder to extract from. None to use the command line arguments.
    """

    logging.basicConfig(level='INFO')

    parser = argparse.ArgumentParser(description='Translate a MailJet template.')
    parser.add_argument(
        '--lang', action='append', choices=_MAILJET_LOCALES.keys(),
        help='The code of the language in which to translate the template (defaults to "en")')
    parser.add_argument(
        'campaign_id', choices=mailjet_templates.MAP.keys() | {'existing'}, nargs='+',
        help='The ID of the mailjet campaign to translate')
    parser.add_argument(
        '--mailjet-apikey', default=os.getenv('MAILJET_APIKEY_PUBLIC'),
        help='The public API key to access the MailJet API')
    parser.add_argument(
        '--mailjet-secret', default=os.getenv('MAILJET_SECRET'),
        help='The secret API key to access the MailJet API')
    parser.add_argument(
        '--template-map-file', default=os.path.join(mailjet_templates.PATH, 'mailjet.json'),
        help='The path to the json file containing the map of templates')
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Do not update any template nor files')
    args = parser.parse_args(string_args)

    sentry_dsn = os.getenv('SENTRY_DSN')
    if sentry_dsn:
        # TODO(pascal): Fix when https://github.com/getsentry/sentry-python/issues/1081 is solved.
        sentry_sdk.init(  # pylint: disable=abstract-class-instantiated
            dsn=sentry_dsn,
            integrations=[
                sentry_logging.LoggingIntegration(level=logging.INFO, event_level=logging.WARNING)])

    if 'existing' in args.campaign_id:
        actions = [
            (campaign_id, lang)
            for campaign_id, campaign in mailjet_templates.MAP.items()
            for lang in campaign.get('i18n', {}).keys()
        ]
    else:
        actions = [
            (campaign_id, lang)
            for campaign_id in args.campaign_id
            for lang in args.lang or ('en',)
        ]

    for campaign_id in {action[0] for action in actions}:
        if mailjet_templates.MAP[campaign_id].get('noI18n'):
            raise ValueError(f'{campaign_id} is marked as not translatable.')

    errors: list[Tuple[str, str, ValueError]] = []
    translator = _MailTranslator(args.mailjet_apikey, args.mailjet_secret)
    for campaign_id, lang in actions:
        try:
            result = translator.update_template(campaign_id, lang, dry_run=args.dry_run)
        except ValueError as error:
            errors.append((campaign_id, lang, error))
            continue
        if result.new_template_id and not args.dry_run:
            _update_mailjet_templates(
                args.template_map_file, campaign_id, lang, result.new_template_id)

    if errors:
        raise ValueError('Errors in translations:\n\n' + '\n\n'.join(
            f'In template "{campaign_id}" in language "{lang}":\n{error}'
            for campaign_id, lang, error in errors
        )) from errors[0][2]


if __name__ == '__main__':
    main()
