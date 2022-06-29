"""Sanity checks on Mailjet templates."""

import json
import os
from os import path
import re
from typing import Any, Mapping, Set
import unittest

import polib
import xmltodict

from bob_emploi.common.python import checker
from bob_emploi.common.python import mustache
from bob_emploi.frontend.server.asynchronous.i18n import extract_mailjet_strings

_TEMPLATE_PATH = path.join(path.dirname(path.dirname(__file__)), 'templates')

_HTTP_URLS = re.compile(r'http://[^ "/]+')

_UNSUBSCRIPTION_TEXT_PROMPT = 'Vous recevez cet email car vous êtes inscrit'
# Regexp to match unsubscription text.
_UNSUBSCRIPTION_TXT_PATTERN = re.compile(rf'(?<={_UNSUBSCRIPTION_TEXT_PROMPT}).+(?= sur)')

# Regexp to match MJML tags e.g. {{var:foo}}, {%endif%} etc.
_MJML_TAG_PATTERN = re.compile(r'([ \n]*\n[ \n]*|{{[^}]*}}|{[^{}]*})', re.MULTILINE)


# TODO(sil): Make sure the bottom of the email is entirely genderized (e.g. "inscrit").
class MailjetTemplatesTest(unittest.TestCase):
    """Sanity checks on Mailjet templates."""

    templates: Set[str]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.templates = {
            dirname for dirname in os.listdir(_TEMPLATE_PATH)
            if dirname != '__pycache__' and os.path.isdir(os.path.join(_TEMPLATE_PATH, dirname))
        }

    def test_xml(self) -> None:
        """Check that all .mjml are valid XMLs."""

        for template in self.templates:
            mjml_file = path.join(_TEMPLATE_PATH, template, 'template.mjml')
            try:
                with open(mjml_file, 'r', encoding='utf-8') as mjml:
                    mjml_text = mjml.read()
                    mjml_content = xmltodict.parse(mjml_text)
                    mjml_tag_name = list(mjml_content.keys())[0]
                    mjml_version = mjml_content[mjml_tag_name]['@version']
                    self.assertEqual('mjml', mjml_tag_name)
                    self.assertGreaterEqual(mjml_version, '4.')
                    self.assertLessEqual(mjml_version, '5.')
            except Exception as error:
                raise ValueError(
                    f'Email "{template}" does not have a correct XML format for the MJML '
                    f'file ({mjml_file}):\n{error}') from error

    def test_mustache_in_html(self) -> None:
        """Check that all .html and .mjml (using XML format) contain valid mustache tags."""

        for template in self.templates:
            context: Mapping[str, Any]
            vars_file_path = path.join(_TEMPLATE_PATH, template, 'vars-example.json')
            with open(vars_file_path, 'r', encoding='utf-8') as vars_file:
                context = json.load(vars_file)
            headers_file_path = path.join(_TEMPLATE_PATH, template, 'headers.json')
            with open(headers_file_path, 'r', encoding='utf-8') as headers_file:
                headers = json.load(headers_file)
            context = {'senderName': headers['SenderName']} | context

            # Check the HTML file.
            html_file = path.join(_TEMPLATE_PATH, template, 'template.html')
            with open(html_file, 'r', encoding='utf-8') as html_handle:
                html_soup = html_handle.read()
            try:
                mustache.instantiate(html_soup, context, use_strict_syntax=True)
            except Exception as err:
                raise ValueError(f'Error in file {html_file}') from err

            # Check the MJML file.
            mjml_file = path.join(_TEMPLATE_PATH, template, 'template.mjml')
            with open(mjml_file, 'r', encoding='utf-8') as mjml_handle:
                mjml_soup = mjml_handle.read()
            if mjml_soup.startswith('{'):
                continue
            try:
                mustache.instantiate(mjml_soup, context, use_strict_syntax=True)
            except Exception as err:
                raise ValueError(f'Error in file {mjml_file}') from err

    def test_no_unsecure_link(self) -> None:
        """Check for unsecure links in template.mjml."""

        for campaign_id in self.templates:
            mjml_filename = os.path.join(_TEMPLATE_PATH, campaign_id, 'template.mjml')
            with open(mjml_filename, 'r', encoding='utf-8') as mjml_handle:
                mjml_as_text = mjml_handle.read()
            urls = set(_HTTP_URLS.findall(mjml_as_text))
            self.assertLessEqual(
                # TODO(pascal): Drop those links as the website is dead anyway.
                urls, {'http://dessinetoiunemploi.com'},
                msg=f'Mailjet template "{campaign_id}" contains unsecure http links.')

    def test_extracted_strings(self) -> None:
        """Checks on extracted strings."""

        checkers = (
            checker.SpacesChecker(),
            checker.QuotesChecker(),
        )
        # Forbidden keywords, with the designed replacement.
        forbidden_keywords = {
            'https://www.bob-emploi.fr': 'baseUrl',
            'Bob': 'productName',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/44ky/2vvvu.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/4r7v/2oshq.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/ng6k/2vv3r.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/p43g/2vros.png': 'productLogoUrl',
            'https://t.bob-emploi.fr/tplimg/6u2u/b/xows6/vzmh5.png': 'productLogoUrl',
        }
        errors: list[tuple[str, polib.POEntry, ValueError]] = []
        for campaign_id in self.templates:
            folder = os.path.join(_TEMPLATE_PATH, campaign_id)
            for entry in extract_mailjet_strings.extract_from_mailjet(folder):
                for each_checker in checkers:
                    try:
                        each_checker.check_value(entry.msgid, 'fr')
                    except ValueError as error:
                        errors.append((campaign_id, entry, error))
                for keyword, replacement in forbidden_keywords.items():
                    if keyword in entry.msgid:
                        errors.append((campaign_id, entry, ValueError(
                            f'The string contains {keyword}, use var:{replacement} instead')))
        if not errors:
            return
        if len(errors) > 1:
            print(f'{len(errors)} errors:\n')
            for campaign_id, entry, exception in errors:
                print(f'{campaign_id}: {exception}\n\n')
        for campaign_id, entry, exception in errors:
            raise ValueError(
                f'Mailjet template "{campaign_id}" has an error at {entry.occurrences}\n',
            ) from exception

    def test_unsubscription_text_genderification(self) -> None:
        """Check for gender use in unsubscription text."""

        for campaign_id in self.templates:
            mjml_filename = os.path.join(_TEMPLATE_PATH, campaign_id, 'template.mjml')
            with open(mjml_filename, 'r', encoding='utf-8') as mjml_handle:
                mjml_as_text = mjml_handle.read()

            # The unsuscription text is missing or different.
            if _UNSUBSCRIPTION_TEXT_PROMPT not in mjml_as_text:
                continue

            unsubscription_texts = _UNSUBSCRIPTION_TXT_PATTERN.findall(mjml_as_text)
            self.assertIn(
                'var:gender', unsubscription_texts[0],
                msg=f'Mailjet template "{campaign_id}" unsubscription text is not genderized.')


if __name__ == '__main__':
    unittest.main()
