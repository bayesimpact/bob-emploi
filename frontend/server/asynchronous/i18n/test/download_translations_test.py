"""Unit tests for the download_translations module."""

import json
import os
import tempfile
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.frontend.server.asynchronous.i18n import download_translations


class DownloadTranslationsTests(airtablemock.TestCase):
    """Unit tests for downloading translations."""

    def setUp(self) -> None:
        super().setUp()

        temp_fd, self._tmp_json_file = tempfile.mkstemp(suffix='.json')
        os.close(temp_fd)

        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')

    def tearDown(self) -> None:
        os.unlink(self._tmp_json_file)

    def test_main(self) -> None:
        """Test basic download_translations call."""

        base = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        base.create('translations', {
            'en': 'A string to translate in English',
            'fr': 'A string to translate in French',
            'field': 'A custom field, not really a translation',
            'string': 'A string to translate',
        })
        base.create('translations', {
            'en': 'A string to translate feminine',
            'string': 'A string to translate_FEMININE',
        })
        base.create('translations', {
            'fr': 'Another string to translate',
            'string': 'Another string not in the server extraction',
        })
        # Translation for a Mailjet template subject.
        base.create('translations', {
            'en': 'Update your {{var:productName}} password',
            'string': 'Modifiez votre mot de passe {{var:productName}}',
        })

        pot_file = os.path.join(os.path.dirname(__file__), 'testdata/strings.pot')

        download_translations.main([
            '--api-key', 'my-own-api-key',
            '--strings', pot_file,
            '--output', self._tmp_json_file,
        ])

        with open(self._tmp_json_file, 'r', encoding='utf-8') as output_file:
            output_json = json.load(output_file)

        self.assertEqual({
            'A string to translate': {
                'en': 'A string to translate in English',
                'fr': 'A string to translate in French',
            },
            'A string to translate_FEMININE': {
                'en': 'A string to translate feminine',
            },
            'Modifiez votre mot de passe {{var:productName}}': {
                'en': 'Update your {{var:productName}} password',
            }
        }, output_json)

    @mock.patch.dict(os.environ, {'FAIL_ON_MISSING_TRANSLATIONS': '1'})
    def test_missing_keys(self) -> None:
        """Test download_translations when translations are missing."""

        base = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        base.create('translations', {
            'en': 'A string to translate in English',
            'fr': 'A string to translate in French',
            'field': 'A custom field, not really a translation',
            'string': 'A string to translate',
        })

        pot_file = os.path.join(os.path.dirname(__file__), 'testdata/many-strings.pot')

        with self.assertRaises(KeyError) as error:
            download_translations.main([
                '--api-key', 'my-own-api-key',
                '--strings', pot_file,
                '--output', self._tmp_json_file,
            ])

        self.assertIn('A string missing translation', str(error.exception))
        self.assertIn('Another string missing translation', str(error.exception))
        self.assertNotIn('A string to translate', str(error.exception))


if __name__ == '__main__':
    unittest.main()
