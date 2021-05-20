"""Tests for the translations importer."""

import os
import unittest
from unittest import mock

import airtablemock

from bob_emploi.data_analysis.importer import translations


@airtablemock.patch(translations.translation.__name__ + '.airtable')
@mock.patch(translations.translation.__name__ + '._TRANSLATION_TABLE', new=[])
@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'apikey42'})
class ImporterTestCase(unittest.TestCase):
    """Tests for the importer."""

    @mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': ''})
    def test_missing_key(self) -> None:
        """No import possible without an API key."""

        self.assertRaises(ValueError, translations.airtable2dicts)

    def test_airtable2dicts(self) -> None:
        """Basic usage of the translations importer."""

        base = airtablemock.Airtable('appkEc8N0Bw4Uok43', 'apikey42')
        base.create('tblQL7A5EgRJWhQFo', {
            'string': 'String to translate',
            'fr': 'La string in French',
            'de': 'Die String in German',
            'quick_de': 'Das String aus Deutsch',
        })

        dicts = list(translations.airtable2dicts())

        self.assertEqual(
            [{
                'string': 'String to translate',
                'fr': 'La string in French',
                'de': 'Die String in German',
            }],
            dicts)


if __name__ == '__main__':
    unittest.main()
