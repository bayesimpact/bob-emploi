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
import requests
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
        'mjml-as-xml': {'mailjetTemplate': 9999},
        'not-translatable': {'mailjetTemplate': 69, 'noI18n': True},
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
        with open(self._mailjet_json_path, 'wt', encoding='utf-8') as map_file:
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
            'donnees@bob-emploi.fr.',
            'en':
            'This message was sent after collecting your data on BOB EMPLOI. The email '
            'frequency is limited but may be more important depending on the activity of our '
            'organization. You can exercise your rights to access, modify or delete by sending an '
            'email at: donnes@bob-emploi.fr.',
            'es': '...',
            'it': '...',
            'fr@tu': "Ce message t'a été envoyé",
        })
        client.create('tblQL7A5EgRJWhQFo', {
            'string': 'https://t.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png',
            'en': 'https://t.bob-emploi.fr/en-image.png',
            'es': '...',
            'fr@tu': 'https://t.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png',
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
        self.assertIn('src="https://t.bob-emploi.fr/en-image.png"', detail_content['Html-part'])
        self.assertIn('a href="https://twitter.com/hellobob"', detail_content['Html-part'])
        self.assertIn(
            '>Update the password<',
            detail_content['MJMLContent'],
        )
        self.assertIn(
            'src="https://t.bob-emploi.fr/en-image.png"',
            detail_content['MJMLContent'],
        )
        self.assertIn(
            'href="https://twitter.com/hellobob"',
            detail_content['MJMLContent'],
        )

        with open(self._mailjet_json_path, 'rt', encoding='utf-8') as map_file:
            map_content = map_file.read()
        self.assertEqual(textwrap.dedent('''\
            [
              {
                "i18n": {
                  "en": 5678
                },
                "mailjetTemplate": 71254,
                "name": "reset-password"
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

        with self.assertRaises(requests.exceptions.HTTPError):
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
            'donnees@bob-emploi.fr.',
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

    # pylint: disable=line-too-long
    _english_translations = {
        "<0>Astuce 🇫🇷 Si les sous-titres en français ne sont pas activés sur la vidéo, cliquez sur l'icône </0><0><1>réglages</1></0><0> en bas de la vidéo, puis sur </0><0><1>subtitles</1></0><0> et choisissez </0><0><1>français ☕️</1></0>": '...',
        "<0>Comment allez-vous ?</0><0>Lors de votre inscription sur Bob, vous nous avez dit que {1}vous manquez parfois de confiance en vous{2}vous avez l'impression de ne pas réussir vos entretiens{3}vous avez l'impression de ne pas rentrer dans les cases des recruteurs{4}. Est-ce toujours le cas ?</0>": '...',
        "<0>Je suis tombée, il y a quelque temps, sur </0><1><2><3>cette vidéo</3></2></1><0> de 20 min qui m'a fait penser à vous. Du coup je voulais vous la partager car je trouve que le petit conseil est utile à essayer (ne serait-ce que pour l'effet placebo) : <4>et si travailler sur votre langage corporel pouvait vous aider à vous rendre plus confiant{5}e{6}{7}{6}·e{8}{8} ?</4></0>": '...',
        "Car même si ça fait un peu bâteau, une chose que j'ai apprise dans la vie, c'est que l'important c'est d'être vous-même et d'être fi{0}ère{1}{2}er{1}er·e{3}{3} de qui vous êtes. Souvenez-vous lorsque vous postulez, c'est avant tout l'<4>entreprise</4> qui a besoin de <4>vous</4> !": '...',
        "J'espère que cette vidéo vous inspirera aussi !": '...',
        "Joanna et l'équipe de Bob": 'Joanna and the Bob team',
        "Une petite vidéo que j'aimerais vous partager": 'A video that I wanted to show you',
        '<0>Vous recevez cet email car vous êtes inscrit{1}e{2}{3}{2}·e{4}{4} sur </0><5><6><7><8><7>Bob</7></8></7></6></5><0> et avez demandé des emails de coaching. </0><9><6><7><8><7>Cliquez ici</7></8></7></6></9><0> si vous ne souhaitez plus en recevoir ou moins souvent. Vous avez arrêté de chercher du travail et souhaitez mettre votre compte Bob en veille ? </0><10><6><7><8><7>cliquez ici</7></8></7></6></10><0>.</0>': '<0>Vous recevez cet email car vous êtes inscrit{1}e{2}{3}{2}·e{4}{4}</0>',
        'Bonjour {0},': 'Hi {0}',
        'https://t.bob-emploi.fr/tplimg/6u2u/b/4psz/24mpu.png': 'https://t.bob-emploi.fr/tplimg/6u2u/b/4psz/24mpu-english.png',
        'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1.png': 'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1-english.png',
        'https://www.bob-emploi.fr?utm_source=bob-emploi&amp;utm_medium=email': 'https://www.bob-emploi.fr?utm_source=bob-emploi&amp;utm_medium=email',
        'https://www.ted.com/talks/amy_cuddy_your_body_language_shapes_who_you_are?language=fr': 'https://www.ted.com/talks/amy_cuddy_your_body_language_shapes_who_you_are?language=en',
        'PS : Si le cœur vous en dit, vous pouvez me donner votre avis en répondant directement à ce mail.': '...',
    }
    # pylint: enable=line-too-long

    def test_mjml_as_xml(self, mock_requests: requests_mock.Mocker) -> None:
        """Test with a source file where the MJML is in XML format."""

        client = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        for string, en_string in self._english_translations.items():
            client.create('tblQL7A5EgRJWhQFo', {
                'string': string,
                'en': en_string,
            })

        mock_requests.post(
            'https://api.mailjet.com/v3/REST/template',
            json={'Count': 1, 'Data': [{'ID': 5678}], 'Total': 1})
        mock_requests.post('https://api.mailjet.com/v3/REST/template/5678/detailcontent')

        translate_mailjet.main(('--lang', 'en', 'mjml-as-xml'))

        create_template_req = mock_requests.request_history[0].json()
        self.assertEqual('DO NOT EDIT mjml-as-xml (en)', create_template_req['Name'])
        self.assertEqual('en_US', create_template_req['Locale'])

        detail_content = mock_requests.request_history[1].json()
        self.assertEqual(
            {'Headers', 'Text-part', 'Html-part', 'MJMLContent'}, detail_content.keys())
        self.assertFalse(detail_content['Text-part'])
        self.assertEqual({
            'From': 'Joanna <joanna@bob-emploi.fr>',
            'Reply-To': '',
            'ReplyEmail': '',
            'SenderName': 'Joanna',
            'SenderEmail': 'joanna@bob-emploi.fr',
            'Subject': 'A video that I wanted to show you',
        }, detail_content['Headers'])
        mjml_content = detail_content['MJMLContent']
        self.assertIsInstance(mjml_content, str)
        self.assertRegex(
            mjml_content,
            '<mj-image [^>]* src="https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1-english.png"')
        self.assertNotIn("Joanna et l'équipe de Bob", mjml_content)
        self.assertIn('>Joanna and the Bob team<', mjml_content)

    def test_mustache_error_in_translation(
            self, unused_mock_requests: requests_mock.Mocker) -> None:
        """Check that the translation fails if a string translation breaks mustaches."""

        client = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        translations = self._english_translations | {
            # pylint: disable=line-too-long
            '<0>Vous recevez cet email car vous êtes inscrit{1}e{2}{3}{2}·e{4}{4} sur </0><5><6><7><8><7>Bob</7></8></7></6></5><0> et avez demandé des emails de coaching. </0><9><6><7><8><7>Cliquez ici</7></8></7></6></9><0> si vous ne souhaitez plus en recevoir ou moins souvent. Vous avez arrêté de chercher du travail et souhaitez mettre votre compte Bob en veille ? </0><10><6><7><8><7>cliquez ici</7></8></7></6></10><0>.</0>':
            '<0>Vous recevez cet email car vous êtes inscrit{1}e{2}{3}{2}·e{4}</0>',
        }
        for string, en_string in translations.items():
            client.create('tblQL7A5EgRJWhQFo', {
                'string': string,
                'en': en_string,
            })

        with self.assertRaises(ValueError) as error:
            translate_mailjet.main(('--lang', 'en', 'mjml-as-xml'))

        self.assertIn('Missing "endif"', str(error.exception))

    def test_not_translatable(self, unused_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Error when trying to translate an untranslatable template."""

        with self.assertRaises(ValueError):
            translate_mailjet.main(('--lang', 'en', 'not-translatable'))

    @mock.patch.dict(translate_mailjet._MAILJET_LOCALES, {'es': 'es_ES'})  # pylint: disable=protected-access
    def test_too_many_requests(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Mailjet API rate is limiting our ability to get an existing template."""

        get_template_request = mock_requests.get(
            'https://api.mailjet.com/v3/REST/template/123456/detailcontent',
            status_code=429,
            text='Too Many Requests',
        )
        with self.assertRaises(requests.exceptions.HTTPError):
            translate_mailjet.main(('--lang', 'es', 'reset-password'))

        self.assertTrue(get_template_request.called)


if __name__ == '__main__':
    unittest.main()
