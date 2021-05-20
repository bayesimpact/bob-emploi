"""Unit tests for the i18n.collect_strings module."""

import datetime
import typing
from typing import List, Set, Tuple
import unittest
from unittest import mock

from airtable import airtable
import airtablemock
import requests_mock

from bob_emploi.data_analysis.i18n import collect_strings
from bob_emploi.data_analysis.importer import import_status
from bob_emploi.data_analysis.importer.test import airtable_to_protos_test
from bob_emploi.frontend.api import network_pb2


_TABLES_TO_MOCK: Set[Tuple[str, str, str]] = {
    (i.args.get('base_id', ''), i.args.get('table', ''), i.args.get('view', ''))
    for i in import_status.get_importers().values()
    if i.script == 'airtable_to_protos' and i.args
} | {
    (base_id, table, view or '')
    for base_id, table, unused_fields, unused_namespace, unused_id, view, alt_table
    in collect_strings.CLIENT_COLLECTIBLES
}


class CollectStringsTest(airtablemock.TestCase):
    """Unit tests for the main function."""

    def setUp(self) -> None:
        super().setUp()
        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')
        for base_id, table, view in _TABLES_TO_MOCK:
            airtablemock.create_empty_table(base_id, table)
            if view:
                airtablemock.create_view(base_id, table, view, 'unused != 3')

    def _assert_all_translations(self, expected: List[str]) -> None:
        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        actual = [t.get('fields', {}).get('string') for t in translations]
        self.assertCountEqual(expected, actual)

    def test_client_collectibles(self) -> None:
        """Sanity check on CLIENT_COLLECTIBLES."""

        self.assertGreaterEqual(len(collect_strings.CLIENT_COLLECTIBLES), 4)

    @requests_mock.mock()
    @mock.patch(
        collect_strings.__name__ + '._SLACK_IMPORT_URL', 'https://slack.example.com/webhook')
    def test_collect_all(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Test collection of strings in various tables and fields."""

        mock_requests.post('https://slack.example.com/webhook')

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'static_explanations': 'my explanation',
            'title': 'First Advice',
            'trigger_scoring_model': 'constant(0)',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'Second Advice',
            'trigger_scoring_model': 'constant(1)',
        })
        bob_advice_base.create('diagnostic_main_challenges', {
            'category_id': 'my-category',
            'description': 'My category description',
            'metric_title': 'A category metric title',
            'order': 1,
        })
        collect_strings.main(['apikey'])

        self._assert_all_translations(
            [
                'A category metric title',
                'First Advice',
                'My category description',
                'Second Advice',
                'adviceModules:first-advice:static_explanations',
                'adviceModules:first-advice:title',
                'adviceModules:second-advice:title',
                'diagnosticMainChallenges:my-category:description',
                'diagnosticMainChallenges:my-category:metric_title',
            ])
        self.assertEqual(0, mock_requests.call_count)

    def test_duplicates(self) -> None:
        """Avoid creating duplicate rows for the same translation."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Already translated',
            'explanations': 'New translation',
            'trigger_scoring_model': 'constant(2)',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'New translation',
            'trigger_scoring_model': 'constant(2)',
        })
        collect_strings.main(['apikey'])

        self._assert_all_translations([
            'Already translated', 'New translation',
            'adviceModules:first-advice:title',
            'adviceModules:second-advice:title',
        ])

    @requests_mock.mock()
    @mock.patch(
        collect_strings.__name__ + '._SLACK_IMPORT_URL', 'https://slack.example.com/webhook')
    def test_exsting_duplicates(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Detect existing duplicate rows for the same translation."""

        mock_requests.post('https://slack.example.com/webhook')

        record_1 = airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })
        id_1 = record_1['id']
        record_2 = airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })
        id_2 = record_2['id']
        collect_strings.main(['apikey'])

        self._assert_all_translations([
            'Already translated',
            'Already translated',
        ])

        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'attachments': [{
                    'mrkdwn_in': ['text'],
                    'title': 'Automatic String Collect',
                    'text':
                        'Here is the report:\nDuplicate records found for 1 string:\n' +
                        f' * <https://airtable.com/tblQL7A5EgRJWhQFo/{id_1}|{id_1}>, '
                        f'<https://airtable.com/tblQL7A5EgRJWhQFo/{id_2}|{id_2}>\n'
                }],
            },
            mock_requests.request_history[0].json(),
        )

    def test_generator(self) -> None:
        """Generate several strings to translate from a single Airtable field."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('specific_to_job_advice', {
            'id': 'baker',
            'expanded_card_items':
                'Nous avons réuni quelques idées pour vous aider à réussir '
                'votre approche\u00a0:\n* Se présenter aux boulangers entre 4h et 7h du matin.\n* '
                'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.',
            'short_title': 'Un court titre à traduire',
            'fr:for-job-group': 'NOT_INTERESTING',
            'card_text': 'Un texte de carte à traduire',
            'title': 'Un titre à traduire',
            'diagnostic_topics': ['PROFILE_DIAGNOSTIC'],
        })

        collect_strings.main(['apikey'])

        self._assert_all_translations([
            'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.',
            'Nous avons réuni quelques idées pour vous aider à réussir votre approche\u00a0:',
            'Se présenter aux boulangers entre 4h et 7h du matin.',
            'Un court titre à traduire',
            'Un texte de carte à traduire',
            'Un titre à traduire',
            'specificToJobAdvice:baker:title',
            'specificToJobAdvice:baker:card_text',
            'specificToJobAdvice:baker:expanded_card_header',
            'specificToJobAdvice:baker:short_title',
        ])

    def test_collection(self) -> None:
        """Test collecting strings for a given collection from importer."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': 'Translation needed',
            'email_template': 'This is a templated email',
            'filters': ['constant(2)'],
            'name': 'I need to be translated',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Title to translate',
            'static_explanations': 'New translation',
            'explanations': 'No translation needed',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations(
            ['I need to be translated', 'This is a templated email', 'Translation needed'])

    @mock.patch(
        collect_strings.__name__ + '._SLACK_IMPORT_URL', 'https://slack.example.com/webhook')
    @mock.patch(
        collect_strings.airtable_to_protos.__name__ + '.PROTO_CLASSES',
        new={'ContactLead': airtable_to_protos_test.BrokenConverter(
            network_pb2.ContactLeadTemplate, None, [])})
    @mock.patch('logging.error')
    @requests_mock.mock()
    def test_invalid_converter(
            self, mock_logging: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Test collecting strings with a broken converter."""

        mock_requests.post('https://slack.example.com/webhook')
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations([])
        mock_logging.assert_called_once()
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'attachments': [{
                    'mrkdwn_in': ['text'],
                    'title': 'Automatic String Collect',
                    'text':
                        'Here is the report:\nAll the collections have been collected.' +
                        '\nErrors in collection:\ncontact_lead: 1\n'
                }],
            },
            mock_requests.request_history[0].json(),
        )

    @mock.patch(
        collect_strings.__name__ + '._SLACK_IMPORT_URL', 'https://slack.example.com/webhook')
    @mock.patch('logging.error')
    @requests_mock.mock()
    def test_invalid_record(
            self, mock_logging: mock.MagicMock,
            mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Test collecting strings with a record not passing checks."""

        mock_requests.post('https://slack.example.com/webhook')
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': ' Translation needed ',
            'email_template': "This is a templated email that doesn't need translation",
            'name': 'I need to be translated',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations([])
        self.assertTrue(mock_logging.call_count, msg=mock_logging.call_args_list)
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'attachments': [{
                    'mrkdwn_in': ['text'],
                    'title': 'Automatic String Collect',
                    'text':
                        'Here is the report:\nAll the collections have been collected.' +
                        '\nErrors in collection:\ncontact_lead: 1\n'
                }],
            },
            mock_requests.request_history[0].json(),
        )

    def test_client_collections(self) -> None:
        """Test collecting strings for all client-side translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': 'Translation needed',
            'email_template': "This is a templated email that doesn't need translation",
            'name': 'I need to be translated',
        })
        bob_advice_base.create('strategy_goals', {
            'content': "That's why",
            'goal_id': 'one-goal',
            'step_title': 'Please, translate me',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Title to translate',
            'static_explanations': 'New translation',
            'explanations': 'No translation needed',
        })
        collect_strings.main(['apiKey', '--collection', 'client'])
        self._assert_all_translations([
            'adviceModules:first-advice:static_explanations',
            'adviceModules:first-advice:title',
            'goals:one-goal:content',
            'goals:one-goal:step_title'])

    def test_client_collection(self) -> None:
        """Test collecting strings for client-side translation from a specific table."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': 'Translation needed',
            'email_template': "This is a templated email that doesn't need translation",
            'name': 'I need to be translated',
        })
        bob_advice_base.create('email_templates', {
            'reason': "That's why",
            'title': 'Please, translate me',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Title to translate',
            'static_explanations': 'New translation',
            'explanations': 'No translation needed',
        })
        collect_strings.main(['apiKey', '--collection', 'client-advice_modules'])
        self._assert_all_translations([
            'adviceModules:first-advice:static_explanations',
            'adviceModules:first-advice:title'])

    @mock.patch('logging.warning')
    def test_list_unused(self, mock_warning: mock.MagicMock) -> None:
        """List unused translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertFalse(mock_warning.called)

        bob_advice_base.delete('advice_modules', module['id'])
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertEqual(1, mock_warning.call_count, msg=mock_warning.call_args_list)
        warning_text = mock_warning.call_args[0][0] % mock_warning.call_args[0][1]
        self.assertIn('adviceModules', warning_text)
        self.assertIn('title', warning_text)
        self.assertIn('"first-advice"', warning_text)

        self._assert_all_translations([
            'adviceModules:other:title',
            'adviceModules:first-advice:title',
            'adviceModules:second-advice:title',
        ])

    @mock.patch('logging.warning')
    def test_list_unused_replaced(self, mock_warning: mock.MagicMock) -> None:
        """List unused translations including replaced translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'title': 'Other module',
            'advice_id': 'other',
            'trigger_scoring_model': 'constant(2)',
        })
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'trigger_scoring_model': 'constant(1)',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'advice_modules', '--unused', 'list'])
        self.assertFalse(mock_warning.called)

        bob_advice_base.update(
            'advice_modules', module['id'], {'title': 'Updated title to translate'})
        collect_strings.main(['apiKey', '--collection', 'advice_modules', '--unused', 'list'])
        self.assertEqual(1, mock_warning.call_count, msg=mock_warning.call_args_list)
        warning_text = mock_warning.call_args[0][0] % mock_warning.call_args[0][1]
        self.assertIn('advice_modules', warning_text)
        self.assertIn('title', warning_text)
        self.assertIn('first-advice', warning_text)
        self.assertIn('"Title to translate"', warning_text)
        self.assertIn('"Updated title to translate"', warning_text)
        self.assertNotIn('"Other module"', warning_text)

        self._assert_all_translations([
            'Other module', 'Title to translate', 'Updated title to translate',
            'adviceModules:first-advice:title',
            'adviceModules:other:title',
        ])

    def test_delete_unused(self) -> None:
        """Delete unused translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'static_explanations': 'Original text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client'])

        bob_advice_base.delete('advice_modules', module['id'])
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'static_explanations': 'New text',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'delete'])

        self._assert_all_translations([
            'adviceModules:other:title',
            'adviceModules:second-advice:static_explanations',
        ])

    def test_delete_unused_with_generator(self) -> None:
        """Delete unused translations including ones dropped from generators."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        piece_of_advice = bob_advice_base.create('specific_to_job_advice', {
            'id': 'baker',
            'expanded_card_items':
                'A list of items to translate in multiple piece:\n'
                '* first item (will be removed)\n'
                '* second item (is kept)',
            'short_title': 'Un court titre à traduire',
            'fr:for-job-group': 'NOT_INTERESTING',
            'card_text': 'Un texte de carte à traduire',
            'title': 'Un titre à traduire',
            'diagnostic_topics': ['PROFILE_DIAGNOSTIC'],
        })

        collect_strings.main(['apikey'])

        bob_advice_base.delete('specific_to_job_advice', piece_of_advice['id'])
        bob_advice_base.create('specific_to_job_advice', {
            'id': 'baker',
            'expanded_card_items':
                'A list of items to translate in multiple pieces:\n'
                '* second item (is kept)',
            'short_title': 'Un court titre à traduire',
            'fr:for-job-group': 'NOT_INTERESTING',
            'card_text': 'Un texte de carte à traduire',
            'title': 'Un titre à traduire',
            'diagnostic_topics': ['PROFILE_DIAGNOSTIC'],
        })

        collect_strings.main(['apiKey', '--unused', 'delete'])

        self._assert_all_translations([
            'A list of items to translate in multiple pieces:',
            'second item (is kept)',
            'Un court titre à traduire',
            'Un texte de carte à traduire',
            'Un titre à traduire',
            'specificToJobAdvice:baker:title',
            'specificToJobAdvice:baker:card_text',
            'specificToJobAdvice:baker:expanded_card_header',
            'specificToJobAdvice:baker:short_title',
        ])

    def test_delete_replaced(self) -> None:
        """Delete replaced translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'title': 'Other module',
            'advice_id': 'other',
            'trigger_scoring_model': 'constant(1)',
        })
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'eshort_title': 'Original text',
            'title': 'Title to translate',
            'trigger_scoring_model': 'constant(1)',
        })
        collect_strings.main(['apiKey', '--collection', 'advice_modules'])

        module = bob_advice_base.update_all('advice_modules', module['id'], {
            'advice_id': 'first-advice',
            'short_title': 'New text',
            'trigger_scoring_model': 'constant(1)',
        })
        collect_strings.main([
            'apiKey', '--collection', 'advice_modules', '--unused', 'delete-replaced'])

        self._assert_all_translations([
            'New text', 'Other module', 'Title to translate',
            'adviceModules:first-advice:short_title',
            'adviceModules:first-advice:title',
            'adviceModules:other:title',
        ])

    @mock.patch(collect_strings.now.__name__ + '.get')
    def test_last_used(self, mock_now: mock.MagicMock) -> None:
        """Check the behavior of last_used."""

        mock_now.return_value = datetime.datetime(2021, 2, 4, 21, 55)

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Very old translation',
        })
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Old translation',
            'last_used': '2018-09-12T14:35:43.000Z',
        })
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
            'last_used': '2018-09-12T14:35:43.000Z',
        })
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'trigger_scoring_model': 'constant(0)',
            'title': 'Already translated',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'trigger_scoring_model': 'constant(0)',
            'title': 'New translation',
        })

        collect_strings.main(['apikey'])

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        actual = {
            t.get('fields', {}).get('string'): t.get('fields', {}).get('last_used')
            for t in translations
        }
        self.assertEqual(None, actual['Very old translation'])
        self.assertEqual('2018-09-12T14:35:43.000Z', actual['Old translation'])
        last_used = typing.cast(str, actual['New translation'])
        self.assertTrue(last_used)
        self.assertEqual(last_used, actual['Already translated'])
        self.assertRegex(last_used, r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d*)?Z$')
        self.assertEqual('2021-02-04T21:55:00Z', last_used)

        # Wait two hours.
        mock_now.return_value = datetime.datetime(2021, 2, 4, 23, 55)

        collect_strings.main(['apikey'])

        actual = {
            t.get('fields', {}).get('string'): t.get('fields', {}).get('last_used')
            for t in translations
        }
        self.assertEqual(
            last_used, actual['Already translated'],
            msg="The last_used field should not be updated as it's on the same day")

        # Wait for the next day.
        mock_now.return_value = datetime.datetime(2021, 2, 5, 6, 55)

        collect_strings.main(['apikey'])

        actual = {
            t.get('fields', {}).get('string'): t.get('fields', {}).get('last_used')
            for t in translations
        }
        self.assertEqual(
            '2021-02-05T06:55:00Z', actual['Already translated'],
            msg="The last_used field should be updated as it's on a new day")


if __name__ == '__main__':
    unittest.main()
