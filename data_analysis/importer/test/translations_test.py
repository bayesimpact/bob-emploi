"""Tests for the translations importer."""

import os
import unittest
from unittest import mock

import airtablemock

from bob_emploi.data_analysis.importer import translations


@airtablemock.patch(translations.__name__ + '.airtable')
@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'apikey42'})
class ImporterTestCase(unittest.TestCase):
    """Tests for the importer."""

    def test_airtable2dicts(self):
        """Basic usage of the translations importer."""

        base = airtablemock.Airtable('base_t123', 'apikey42')
        base.create('table456', {
            'string': 'String to translate',
            'fr': 'La string in French',
            'de': 'Die String in German',
        })

        dicts = list(translations.airtable2dicts('base_t123', 'table456'))

        self.assertEqual(
            [{
                'string': 'String to translate',
                'fr': 'La string in French',
                'de': 'Die String in German',
            }],
            dicts)


if __name__ == '__main__':
    unittest.main()
