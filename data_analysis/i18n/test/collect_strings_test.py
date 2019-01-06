"""Unit tests for the i18n.collect_strings module."""

import logging
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import collect_strings
from bob_emploi.data_analysis.importer.test import airtable_to_protos_test
from bob_emploi.frontend.api import network_pb2


class CollectStringsTest(airtablemock.TestCase):
    """Unit tests for the main function."""

    def setUp(self):
        super(CollectStringsTest, self).setUp()
        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'advice_modules')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'application_tips')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'contact_lead')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'diagnostic_overall')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'diagnostic_observations')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'diagnostic_sentences')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'diagnostic_submetrics_scorers')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'diagnostic_submetric_sentences_new')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'email_templates')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'specific_to_job_advice')
        airtablemock.create_empty_table('appXmyc7yYj0pOcae', 'tip_templates')
        airtablemock.create_empty_table('appMRMtWV61Kibt37', 'Event Types')

    def _assert_all_translations(self, expected):
        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        actual = [t.get('fields', {}).get('string') for t in translations]
        self.assertCountEqual(expected, actual)
        return actual

    def test_collect_all(self):
        """Test collection of strings in various tables and fields."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'my explanation',
            'title': 'First Advice',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'Second Advice',
        })
        bob_advice_base.create('diagnostic_sentences', {
            'sentence_template': 'A sentence template',
            'order': 1,
        })
        collect_strings.main(['apikey'])

        self._assert_all_translations(
            ['A sentence template', 'First Advice', 'Second Advice', 'my explanation'])

    def test_duplicates(self):
        """Avoid creating duplicate rows for the same translation."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Already translated',
            'explanations': 'New translation',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'New translation',
        })
        collect_strings.main(['apikey'])

        self._assert_all_translations(['Already translated', 'New translation'])

    def test_generator(self):
        """Generate several strings to translate from a single Airtable field."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('specific_to_job_advice', {
            'expanded_card_items':
                'Nous avons réuni quelques idées pour vous aider à réussir ' +
                'votre approche :\n* Se présenter aux boulangers entre 4h et 7h du matin.\n* ' +
                'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.',
            'short_title': 'Un court titre à traduire',
            'for-job-group': 'NOT_INTERESTING',
            'card_text': 'Un texte de carte à traduire',
            'title': 'Un titre à traduire',
            'diagnostic_topics': ['PROFILE_DIAGNOSTIC'],
        })

        collect_strings.main(['apikey'])

        self._assert_all_translations([
            'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.',
            'Nous avons réuni quelques idées pour vous aider à réussir votre approche :',
            'Se présenter aux boulangers entre 4h et 7h du matin.',
            'Un court titre à traduire',
            'Un texte de carte à traduire',
            'Un titre à traduire',
        ])

    def test_collection(self):
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
            'explanations (for client)': 'New translation',
            'explanations': 'No translation needed',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations(
            ['I need to be translated', 'This is a templated email', 'Translation needed'])

    @mock.patch(
        collect_strings.airtable_to_protos.__name__ + '.PROTO_CLASSES',
        new={'ContactLead': airtable_to_protos_test.BrokenConverter(
            network_pb2.ContactLeadTemplate, None, [])})
    @mock.patch(collect_strings.logging.__name__ + '.error')
    def test_invalid_converter(self, mock_logging):
        """Test collecting strings with a broken converter."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations([])
        mock_logging.assert_called_once()

    @mock.patch(collect_strings.logging.__name__ + '.error')
    def test_invalid_record(self, mock_logging):
        """Test collecting strings with a record not passing checks."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': ' Translation needed ',
            'email_template': "This is a templated email that doesn't need translation",
            'name': 'I need to be translated',
        })
        collect_strings.main(['apiKey', '--collection', 'contact_lead'])
        self._assert_all_translations([])
        self.assertTrue(mock_logging.call_count, msg=mock_logging.call_args_list)

    def test_client_collection(self):
        """Test collecting strings for client-side translation."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('contact_lead', {
            'card_content': 'Translation needed',
            'email_template': "This is a templated email that doesn't need translation",
            'name': 'I need to be translated',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Title to translate',
            'explanations (for client)': 'New translation',
            'explanations': 'No translation needed',
        })
        collect_strings.main(['apiKey', '--collection', 'client'])
        self._assert_all_translations(['New translation', 'Title to translate'])

    @mock.patch(logging.__name__ + '.warning')
    def test_list_unused(self, mock_warning):
        """List unused translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'Original text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertFalse(mock_warning.called)

        bob_advice_base.delete('advice_modules', module['id'])
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'Original text',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertEqual(1, mock_warning.call_count, msg=mock_warning.call_args_list)
        warning_text = mock_warning.call_args[0][0] % mock_warning.call_args[0][1]
        self.assertIn('advice_modules', warning_text)
        self.assertIn('title', warning_text)
        self.assertIn('"Title to translate"', warning_text)

        self._assert_all_translations(['Original text', 'Other module', 'Title to translate'])

    @mock.patch(logging.__name__ + '.warning')
    def test_list_unused_replaced(self, mock_warning):
        """List unused translations including replaced translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'Original text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertFalse(mock_warning.called)

        bob_advice_base.delete('advice_modules', module['id'])
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'New text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'list'])
        self.assertEqual(1, mock_warning.call_count, msg=mock_warning.call_args_list)
        warning_text = mock_warning.call_args[0][0] % mock_warning.call_args[0][1]
        self.assertIn('advice_modules', warning_text)
        self.assertIn('explanations (for client)', warning_text)
        self.assertIn('first-advice', warning_text)
        self.assertIn('"Original text"', warning_text)
        self.assertIn('"New text"', warning_text)
        self.assertNotIn('"Title to translate"', warning_text)

        self._assert_all_translations(
            ['New text', 'Original text', 'Other module', 'Title to translate'])

    def test_delete_unused(self):
        """Delete unused translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'Original text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client'])

        bob_advice_base.delete('advice_modules', module['id'])
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'New text',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'delete'])

        self._assert_all_translations(['New text', 'Other module'])

    def test_delete_unused_with_generator(self):
        """Delete unused translations including ones dropped from generators."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        piece_of_advice = bob_advice_base.create('specific_to_job_advice', {
            'expanded_card_items':
                'A list of items to translate in multiple piece:\n'
                '* first item (will be removed)\n'
                '* second item (is kept)',
            'short_title': 'Un court titre à traduire',
            'for-job-group': 'NOT_INTERESTING',
            'card_text': 'Un texte de carte à traduire',
            'title': 'Un titre à traduire',
            'diagnostic_topics': ['PROFILE_DIAGNOSTIC'],
        })

        collect_strings.main(['apikey'])

        bob_advice_base.delete('specific_to_job_advice', piece_of_advice['id'])
        bob_advice_base.create('specific_to_job_advice', {
            'expanded_card_items':
                'A list of items to translate in multiple pieces:\n'
                '* second item (is kept)',
            'short_title': 'Un court titre à traduire',
            'for-job-group': 'NOT_INTERESTING',
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
        ])

    def test_delete_replaced(self):
        """Delete replaced translations."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {'title': 'Other module', 'advice_id': 'other'})
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'Original text',
            'title': 'Title to translate',
        })
        collect_strings.main(['apiKey', '--collection', 'client'])

        bob_advice_base.delete('advice_modules', module['id'])
        module = bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'New text',
        })
        collect_strings.main(['apiKey', '--collection', 'client', '--unused', 'delete-replaced'])

        self._assert_all_translations(['New text', 'Other module', 'Title to translate'])


if __name__ == '__main__':
    unittest.main()
