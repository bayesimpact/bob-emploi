"""Unit tests for the translate_mailjet module."""

import json
import os
from os import path
import textwrap
from typing import Callable, Mapping
import unittest
from unittest import mock

from airtable import airtable
import airtablemock
import requests_mock

from bob_emploi.data_analysis.i18n import translate_mailjet


def _create_translate_func(translations: Mapping[str, str]) -> Callable[[str], str]:
    return lambda string: translations[string]


class TranslateHtmlTagsTests(unittest.TestCase):
    """Unit tests for the translate_html_tags function."""

    def test_no_html(self) -> None:
        """Translate HTML tags with no tags."""

        translate = _create_translate_func({'No tags': 'Pas de tags'})
        self.assertEqual(
            'Pas de tags', translate_mailjet.translate_html_tags('No tags', translate))

    def test_simple_html_tag(self) -> None:
        """Translate HTML tags with one tag."""

        translate = _create_translate_func({'One <0>tag</0>': 'Un seul <0>tag</0>'})
        self.assertEqual(
            'Un seul <span style="font-weight: 500">tag</span>',
            translate_mailjet.translate_html_tags(
                'One <span style="font-weight: 500">tag</span>', translate))

    def test_self_closing_tag(self) -> None:
        """Translate HTML tags with a self closing tag."""

        translate = _create_translate_func({'One <0/>self closing tag': 'Un <0/>tag autofermant'})
        self.assertEqual(
            'Un <br />tag autofermant',
            translate_mailjet.translate_html_tags(
                'One <br />self closing tag', translate))

    def test_br_tag(self) -> None:
        """Translate HTML tags with a br implicitely self closing tag."""

        translate = _create_translate_func({'One <0/>self closing tag': 'Un <0/>tag autofermant'})
        self.assertEqual(
            'Un <br>tag autofermant',
            translate_mailjet.translate_html_tags(
                'One <br>self closing tag', translate))

    def test_multiple_tags(self) -> None:
        """Translate HTML tags with multiple nested tags."""

        translate = _create_translate_func({
            'Multiple <0>nested</0><1/>tags': 'Plusieurs tags <0>imbriqués</0>'})
        self.assertEqual(
            '<p>Plusieurs tags <strong>imbriqués</strong></p>',
            translate_mailjet.translate_html_tags(
                '<p>Multiple <strong>nested</strong><br />tags</p>', translate))

    def test_external_attributes(self) -> None:
        """Translate HTML attributes even in the outside tags."""

        translate = _create_translate_func({
            'https://uk.hellobob.com': 'https://www.bob-emploi.fr',
            'Bob': 'Bob',
        })
        self.assertEqual(
            '<a href="https://www.bob-emploi.fr">Bob</a>',
            translate_mailjet.translate_html_tags(
                '<a href="https://uk.hellobob.com">Bob</a>', translate))

    def test_attributes_i18n(self) -> None:
        """Translate HTML attributes if they need it."""

        translate = _create_translate_func({
            '<0>Bob</0> is cool': '<0>Bob</0> est frais',
            '{0}/home': '{0}/accueil',
        })
        self.assertEqual(
            '<a href="{{var:deepBobUrl}}/accueil">Bob</a> est frais',
            translate_mailjet.translate_html_tags(
                '<a href="{{var:deepBobUrl}}/home">Bob</a> is cool', translate))

    def test_attributes_no_i18n(self) -> None:
        """Do not translate HTML attributes if they don't need it."""

        translate = _create_translate_func({'<0>Bob</0> is cool': '<0>Bob</0> est frais'})
        self.assertEqual(
            '<a href="{{var:deepBobUrl}}">Bob</a> est frais',
            translate_mailjet.translate_html_tags(
                '<a href="{{var:deepBobUrl}}">Bob</a> is cool', translate))

    def test_identical_tags(self) -> None:
        """Translate HTML tags with multiple identical tags."""

        translate = _create_translate_func({
            'Multiple <0>identical</0><1/><0>tags</0>':
            'Plusieurs <0>tags</0><1/><0>identiques</0>'})
        self.assertEqual(
            'Plusieurs <strong>tags</strong><br /><strong>identiques</strong>',
            translate_mailjet.translate_html_tags(
                'Multiple <strong>identical</strong><br /><strong>tags</strong>', translate))

    def test_translation_contains_extra_tag(self) -> None:
        """The translation contains an MJML tag that wasn't in the initial string."""

        translate = _create_translate_func({
            'https://www.facebook.com/pg/Wantedcommunity/': '{{var:baseUrl}}/covid-19',
            'Contact Wanted': 'See our recommendations',
        })
        self.assertEqual(
            '<a href="{{var:baseUrl}}/covid-19">See our recommendations</a>',
            translate_mailjet.translate_html_tags(
                '<a href="https://www.facebook.com/pg/Wantedcommunity/">Contact Wanted</a>',
                translate))

    def test_translation_contains_wrong_extra_tag(self) -> None:
        """The translation references an tag that wasn't in the initial string."""

        translate = _create_translate_func({
            '{0}/accueil': '{1}/home',
            'Bob': 'Bob',
        })
        with self.assertRaises(KeyError):
            translate_mailjet.translate_html_tags(
                '<a href="{{var:baseUrl}}/accueil">Bob</a>', translate)


@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'fake-api-key'})
@mock.patch(
    translate_mailjet.mailjet_templates.__name__ + '.PATH',
    path.join(path.dirname(__file__), 'testdata'),
)
@mock.patch.dict(
    translate_mailjet.mailjet_templates.MAP,
    {
        'reset-password': {
            'mailjetTemplate': 12345,
            'i18n': {
                'es': 123456,
                'it': 123,
            },
        },
        'reset-password2': {'mailjetTemplate': 4242},
    },
    clear=True,
)
@requests_mock.mock()
class TranslateTests(airtablemock.TestCase):
    """Unit tests for the main function of the translate_mailjet module."""

    def setUp(self) -> None:
        """Common setup for all tests for this class."""

        super().setUp()

        self._mailjet_json_path = path.join(path.dirname(__file__), 'testdata', 'mailjet.json')
        with open(self._mailjet_json_path, 'wt') as map_file:
            json.dump([{'mailjetTemplate': 71254, 'name': 'reset-password'}], map_file)
            map_file.write('\n')

        client = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        client.create('tblQL7A5EgRJWhQFo', {
            'string': 'Modifiez votre mot de passe Bob Emploi',
            'en': 'Update your Bob password',
            'es': '...',
            'fr@tu': 'Modifie ton mot de passe Bob Emploi',
            'it': '...',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string':
            '<0>Bonjour\xa0{1},</0><0>Vous avez demandé à changer votre mot de passe, vous pouvez '
            'maintenant le modifier en cliquant sur le bouton suivant.</0>',
            'en':
            '<0>Hi\xa0{1},</0><0>You have requested a password change, you can now modify it by '
            'clicking on the button below.</0>',
            'es': '...',
            'fr@tu':
            '<0>Bonjour\xa0{1},</0><0>Tu as demandé à changer ton mot de passe, tu peux maintenant '
            'le modifier en cliquant sur le bouton suivant.</0>',
            'it': '...',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string': 'Modifier le mot de passe',
            'en': 'Update the password',
            'es': '...',
            'fr@tu': 'Modifier le mot de passe',
            'it': '...',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string': 'Bob',
            'en': 'Bob',
            'es': '...',
            'fr@tu': 'Bob',
            'it': '...',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string':
            'Ce message vous a été envoyé à la suite du recueil de vos données sur BOB '
            'EMPLOI. La fréquence des envois est limitée, mais peut être plus importante en '
            'fonction de l’action de l’association. Vous avez la possibilité d’exercer vos droits '
            'd’accès, de rectification et de suppression en écrivant à l’adresse suivante : '
            'donnees@bobemploi.fr.',
            'en':
            'This message was sent after collecting your data on BOB EMPLOI. The email '
            'frequency is limited but may be more important depending on the activity of our '
            'organization. You can exercise your rights to access, modify or delete by sending an '
            'email at: donnes@bobemploi.fr.',
            'es': '...',
            'it': '...',
            'fr@tu': "Ce message t'a été envoyé",
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string': 'http://r.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png',
            'en': 'http://r.bob-emploi.fr/en-image.png',
            'es': '...',
            'fr@tu': 'http://r.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png',
            'it': '...',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'en': 'https://twitter.com/hellobob',
            'es': '...',
            'fr@tu': 'https://twitter.com/bobemploi',
            'it': '...',
            'string': 'https://twitter.com/bobemploi',
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'en': 'https://www.facebook.com/hellobob/?fref=ts',
            'es': '...',
            'fr@tu': 'https://www.facebook.com/bobemploi/?fref=ts',
            'it': '...',
            'string': 'https://www.facebook.com/bobemploi/?fref=ts',
        })

    def tearDown(self) -> None:
        """Common cleanup for all tests for this class."""

        translate_mailjet.translation.clear_cache()
        os.remove(self._mailjet_json_path)

        super().tearDown()

    def test_simple_usage(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Basic usage of the translate tool."""

        mock_requests.post(
            'https://api.mailjet.com/v3/REST/template',
            json={'Count': 1, 'Data': [{'ID': 5678}], 'Total': 1})
        mock_requests.post('https://api.mailjet.com/v3/REST/template/5678/detailcontent')

        translate_mailjet.main(('--lang', 'en', 'reset-password'))

        create_template_req = mock_requests.request_history[0].json()
        self.assertEqual('DO NOT EDIT reset-password (en)', create_template_req['Name'])
        self.assertEqual('en_US', create_template_req['Locale'])

        detail_content = mock_requests.request_history[1].json()
        self.assertEqual(
            {'Headers', 'Text-part', 'Html-part', 'MJMLContent'}, detail_content.keys())
        self.assertFalse(detail_content['Text-part'])
        self.assertEqual({
            'From': 'Bob Emploi <bob@bob-emploi.fr>',
            'Reply-To': '',
            'Subject': 'Update your Bob password',
        }, detail_content['Headers'])
        self.assertIn(
            '<p style="margin: 10px 0;color:#000000;font-family:Arial; font-size:14.6667px">'
            'Hi\xa0{{var:firstname}},</p><p style="margin: 10px 0;color:#000000;font-family:Arial; '
            'font-size:14.6667px">You have requested a password change, you can now modify it by '
            'clicking on the button below.</p>',
            detail_content['Html-part'],
        )
        self.assertIn(
            '<a href=\"{{var:resetLink}}\" style=\"background:#58BBFB;color:#ffffff;font-family:Ubu'
            'ntu, Helvetica, Arial, sans-serif;font-size:13px;font-weight:normal;line-height:120%;'
            'Margin:0;text-decoration:none;text-transform:none;\" target=\"_blank\">Update the '
            'password</a>',
            detail_content['Html-part'],
        )
        self.assertIn('src="http://r.bob-emploi.fr/en-image.png"', detail_content['Html-part'])
        self.assertIn('a href="https://twitter.com/hellobob"', detail_content['Html-part'])
        self.assertEqual(
            'Update the password',
            detail_content['MJMLContent']['children'][0]['children'][1]['children'][0]
            ['children'][3]['content'],
        )
        self.assertEqual(
            'http://r.bob-emploi.fr/en-image.png',
            detail_content['MJMLContent']['children'][0]['children'][1]['children'][0]
            ['children'][0]['attributes']['src'],
        )
        self.assertEqual(
            'https://twitter.com/hellobob',
            detail_content['MJMLContent']['children'][0]['children'][1]['children'][0]
            ['children'][8]['children'][1]['attributes']['href'],
        )

        with open(self._mailjet_json_path, 'rt') as map_file:
            map_content = map_file.read()
        self.assertEqual(textwrap.dedent('''\
            [
              {
                "mailjetTemplate": 71254,
                "name": "reset-password",
                "i18n": {
                  "en": 5678
                }
              }
            ]
        '''), map_content)

    def test_template_exists(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Trying the tool when the template already exists but is not in the map."""

        mock_requests.post(
            'https://api.mailjet.com/v3/REST/template',
            status_code=400,
            json={
                'ErrorCode': 'ps-0015',
                'StatusCode': 400,
                'ErrorMessage': 'A template with "name": "reset-password (en)" already exists.',
                'ErrorRelatedTo': ['template'],
            })

        with self.assertRaises(translate_mailjet.requests.exceptions.HTTPError):
            translate_mailjet.main(('--lang', 'en', 'reset-password'))

    @mock.patch.dict(translate_mailjet._MAILJET_LOCALES, {'es': 'es_ES'})  # pylint: disable=protected-access
    def test_template_exists_map(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Trying the tool when the template already exists in the map and has changes."""

        get_template_request = mock_requests.get(
            'https://api.mailjet.com/v3/REST/template/123456/detailcontent',
            json={'Count': 1, 'Total': 1, 'Data': [{
                'Headers': {}, 'Text-part': '', 'Html-part': '<html/>', 'MJMLContent': {},
            }]})
        update_template_request = mock_requests.post(
            'https://api.mailjet.com/v3/REST/template/123456/detailcontent')

        translate_mailjet.main(('--lang', 'es', 'reset-password'))

        self.assertTrue(get_template_request.called)
        self.assertTrue(update_template_request.called)

    def test_multiple(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Translate several templates to several languages in one call."""

        create_template_request = mock_requests.post(
            'https://api.mailjet.com/v3/REST/template',
            json={'Count': 1, 'Data': [{'ID': 5678}], 'Total': 1})
        update_template_request = mock_requests.post(
            'https://api.mailjet.com/v3/REST/template/5678/detailcontent')

        translate_mailjet.main(
            ('--lang', 'en', '--lang', 'fr@tu', 'reset-password', 'reset-password2'))

        self.assertEqual(
            4, create_template_request.call_count,
            [(r.url, r.body and r.body[:30]) for r in create_template_request.request_history])

        self.assertEqual(
            4, update_template_request.call_count,
            [(r.url, r.body and r.body[:30]) for r in create_template_request.request_history])

    def test_space_checks(self, unused_mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check that translations are checked for whitespaces before being used."""

        client = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        record_id = next(
            record['id'] for record in client.iterate('tblQL7A5EgRJWhQFo')
            if record['fields']['string'].startswith('Ce message vous a été envoyé')
        )
        client.delete('tblQL7A5EgRJWhQFo', record_id)
        client.create('tblQL7A5EgRJWhQFo', {
            'string':
            'Ce message vous a été envoyé à la suite du recueil de vos données sur BOB '
            'EMPLOI. La fréquence des envois est limitée, mais peut être plus importante en '
            'fonction de l’action de l’association. Vous avez la possibilité d’exercer vos droits '
            'd’accès, de rectification et de suppression en écrivant à l’adresse suivante : '
            'donnees@bobemploi.fr.',
            'en': 'This message contains a space before an exclamation mark !',
            'fr@tu': "Ce message t'a été envoyé",
        })

        with self.assertRaises(ValueError) as error:
            translate_mailjet.main(('--lang', 'en', 'reset-password'))

        self.assertIn(
            'a space before an exclamation mark** **!',
            str(error.exception) + str(error.exception.__cause__))

    def test_existing(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Translate all existing i18n templates in one call."""

        expected_requests = [
            mock_requests.get(
                'https://api.mailjet.com/v3/REST/template/123456/detailcontent',
                json={'Count': 1, 'Data': [{}], 'Total': 1}),
            mock_requests.get(
                'https://api.mailjet.com/v3/REST/template/123/detailcontent',
                json={'Count': 1, 'Data': [{}], 'Total': 1}),
            mock_requests.post('https://api.mailjet.com/v3/REST/template/123456/detailcontent'),
            mock_requests.post('https://api.mailjet.com/v3/REST/template/123/detailcontent'),
        ]

        translate_mailjet.main(('existing',))

        self.assertEqual([True] * 4, [r.called for r in expected_requests])

    @mock.patch('logging.info')
    def test_existing_dry_run(
            self, mock_requests: 'requests_mock._RequestObjectProxy',
            mock_logging: mock.MagicMock) -> None:
        """Dry run for translating existing i18n templates."""

        expected_requests = [
            mock_requests.get(
                'https://api.mailjet.com/v3/REST/template/123456/detailcontent',
                json={'Count': 1, 'Data': [{}], 'Total': 1}),
            mock_requests.get(
                'https://api.mailjet.com/v3/REST/template/123/detailcontent',
                json={'Count': 1, 'Data': [{}], 'Total': 1}),
            mock_requests.post('https://api.mailjet.com/v3/REST/template/123456/detailcontent'),
            mock_requests.post('https://api.mailjet.com/v3/REST/template/123/detailcontent'),
        ]

        translate_mailjet.main(('existing', '--dry-run'))

        self.assertEqual([True] * 2 + [False] * 2, [r.called for r in expected_requests])

        mock_logging.assert_any_call(
            'Data would be updated for "%s" in "%s".', 'reset-password', 'es')
        mock_logging.assert_any_call(
            'Data would be updated for "%s" in "%s".', 'reset-password', 'it')

    def test_fallback_language(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Check that translations fallback to available language."""

        mock_requests.post(
            'https://api.mailjet.com/v3/REST/template',
            json={'Count': 1, 'Data': [{'ID': 5678}], 'Total': 1})
        mock_requests.post('https://api.mailjet.com/v3/REST/template/5678/detailcontent')

        translate_mailjet.main(('--lang', 'en_UK', 'reset-password'))

        create_template_req = mock_requests.request_history[0].json()
        self.assertEqual('DO NOT EDIT reset-password (en_UK)', create_template_req['Name'])
        self.assertEqual('en_GB', create_template_req['Locale'])

        detail_content = mock_requests.request_history[1].json()
        self.assertEqual(
            {'Headers', 'Text-part', 'Html-part', 'MJMLContent'}, detail_content.keys())
        self.assertFalse(detail_content['Text-part'])
        self.assertEqual({
            'From': 'Bob Emploi <bob@bob-emploi.fr>',
            'Reply-To': '',
            'Subject': 'Update your Bob password',
        }, detail_content['Headers'])


if __name__ == '__main__':
    unittest.main()
