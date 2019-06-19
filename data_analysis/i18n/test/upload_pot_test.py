"""Unit tests for the upload_pot module."""

from os import path
import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import upload_pot


class UploadTestCase(airtablemock.TestCase):
    """Unit tests for the main function."""

    def test_main(self) -> None:
        """Basic usage."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_pot.main(
            path.join(path.dirname(__file__), 'testdata/frontend-server-strings.pot'),
            'api-key')

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

    def test_strings_from_test_files(self) -> None:
        """Do not upload strings from test files."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })

        upload_pot.main(
            path.join(path.dirname(__file__), 'testdata/frontend-server-strings-test.pot'),
            'api-key')

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New message to translate in test and in prod'],
            sorted(t.get('fields', {}).get('string') for t in translations))


if __name__ == '__main__':
    unittest.main()
