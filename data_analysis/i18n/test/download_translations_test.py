"""Unit tests for the download_translations module."""

import json
import os
import tempfile
import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import download_translations


class DownloadTranslationsTests(airtablemock.TestCase):
    """Unit tests for downloading translations."""

    def setUp(self) -> None:
        super().setUp()

        temp_fd, self._tmp_json_file = tempfile.mkstemp(suffix='.json')
        os.close(temp_fd)

        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'translations')

    def tearDown(self) -> None:
        os.unlink(self._tmp_json_file)

    def test_download_all(self) -> None:
        """Download all translations (not limiting to PO files)."""

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

        download_translations.main([
            '--api-key', 'my-own-api-key',
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
            'Another string not in the server extraction': {
                'fr': 'Another string to translate',
            },
            'Modifiez votre mot de passe {{var:productName}}': {
                'en': 'Update your {{var:productName}} password',
            }
        }, output_json)


if __name__ == '__main__':
    unittest.main()
