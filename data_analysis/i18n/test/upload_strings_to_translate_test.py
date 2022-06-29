"""Unit tests for the upload_strings_to_translate module."""

import io
from os import path
import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import upload_strings_to_translate


class UploadTestCase(airtablemock.TestCase):
    """Unit tests for the main function."""

    def setUp(self) -> None:
        super().setUp()
        self.progress_stream = io.StringIO()

    def test_strings_from_pot(self) -> None:
        """Upload translatable strings from POT file."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings/frontend-server-strings.pot'),
             '--api-key', 'api-key'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New message to translate'],
            sorted(t.get('fields', {}).get('string') for t in translations))

        new_message = next(
            t for t in translations if t['fields']['string'] == 'New message to translate')
        self.assertEqual('frontend-server-strings.pot', new_message['fields']['origin'])
        self.assertEqual(
            'bob_emploi/frontend/server/scoring.py#70', new_message['fields']['origin_id'])

    def test_strings_from_pot_with_context(self) -> None:
        """Upload translatable strings from POT file with their context."""

        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')

        upload_strings_to_translate.main(
            (path.join(
                path.dirname(__file__), 'testdata/strings/frontend-server-strings-context.pot'),
             '--api-key', 'api-key'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Another message_with context'],
            sorted(t.get('fields', {}).get('string') for t in translations))

    def test_strings_from_test_files(self) -> None:
        """Do not upload strings from test files."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings/frontend-server-strings-test.pot'),
             '--api-key', 'api-key'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New message to translate in test and in prod'],
            sorted(t.get('fields', {}).get('string') for t in translations))

    def test_unknown_file_format(self) -> None:
        """Cannot upload from an unknown file format."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        with self.assertRaises(ValueError) as caught:
            upload_strings_to_translate.main((__file__, '--api-key', 'api-key'))
        self.assertIsInstance(caught.exception.__cause__, NotImplementedError)

    def test_strings_from_json(self) -> None:
        """Upload translatable strings from JSON file."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings/frontend-client-strings.json'),
             '--api-key', 'api-key'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New message to translate'],
            sorted(t.get('fields', {}).get('string') for t in translations))

        new_message = next(
            t for t in translations if t['fields']['string'] == 'New message to translate')
        self.assertEqual('frontend-client-strings.json', new_message['fields']['origin'])
        self.assertEqual('1', new_message['fields']['origin_id'])

    def test_strings_from_folder(self) -> None:
        """Upload translatable strings from a folder."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings'),
             '--api-key', 'api-key'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            [
                'Already translated', 'Another message_with context', 'New message to translate',
                'New message to translate in test and in prod',
            ],
            sorted(t.get('fields', {}).get('string') for t in translations))

    def test_upload_translation(self) -> None:
        """Upload translations."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
            'en': 'Already translated in English',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings/frontend-client-strings.json'),
             '--api-key', 'api-key', '--lang', 'fr'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New message to translate'],
            sorted(t.get('fields', {}).get('string') for t in translations))

        old_message = next(
            t for t in translations if t['fields']['string'] == 'Already translated')
        self.assertEqual('Already translated in English', old_message['fields'].get('en'))
        self.assertEqual('Already translated in French', old_message['fields'].get('fr'))
        new_message = next(
            t for t in translations if t['fields']['string'] == 'New message to translate')
        self.assertEqual('New message to translate in French', new_message['fields'].get('fr'))

    def test_upload_same_translation(self) -> None:
        """Do not upload translations that are the same as the key."""

        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')
        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/same-translation/actionTemplates.json'),
             '--api-key', 'api-key', '--lang', 'fr'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['apprenticeship:resource_content'],
            sorted(t.get('fields', {}).get('string') for t in translations))

        new_message = next(
            t for t in translations if t['fields']['string'] == 'apprenticeship:resource_content')
        self.assertFalse(new_message['fields'].get('fr'))

    def test_namespace_prefix(self) -> None:
        """Add namespace prefix before uploading."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
            'en': 'Already translated in English',
        })
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'frontend-client-strings:Already translated',
            'en': 'Already translated in English',
        })

        upload_strings_to_translate.main(
            (path.join(path.dirname(__file__), 'testdata/strings/frontend-client-strings.json'),
             '--api-key', 'api-key', '--lang', 'fr', '--prefix-with-namespace'),
        )

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'frontend-client-strings:Already translated',
             'frontend-client-strings:New message to translate'],
            sorted(t.get('fields', {}).get('string') for t in translations))

        new_message = next(
            t for t in translations
            if t['fields']['string'] == 'frontend-client-strings:New message to translate')
        self.assertEqual('New message to translate in French', new_message['fields'].get('fr'))


if __name__ == '__main__':
    unittest.main(buffer=True)
