"""Unit tests for the i18n.translation module."""

import os
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import translation


@mock.patch(translation.__name__ + '.LOCALES_TO_CHECK', {'en_UK'})
@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'api-key'})
class FallbackTests(airtablemock.TestCase):
    """Unit tests for locales fallback."""

    def setUp(self) -> None:
        super().setUp()
        translation.clear_cache()
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('tblQL7A5EgRJWhQFo', {
            'string': 'country',
            'en_UK': 'United Kingdom',
            'en': 'United States of America'
        })
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('tblQL7A5EgRJWhQFo', {
            'string': 'my language',
            'en': 'English',
        })
        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('tblQL7A5EgRJWhQFo', {
            'string': 'sacrebleu',
            'fr@tu': 'sacrebleu',
        })

    def test_get_translation_fallback(self) -> None:
        """Get a translation with a simple fallback."""

        self.assertEqual('English', translation.get_translation('my language', 'en_UK'))

    def test_get_translation_dont_fallback(self) -> None:
        """Do not fallback on another locale if we have data."""

        self.assertEqual('United Kingdom', translation.get_translation('country', 'en_UK'))

    def test_fetch_missing_translation_locales_fallback(self) -> None:
        """Use fallback to avoid missing translations."""

        self.assertFalse(translation.fetch_missing_translation_locales('my language'))

    def test_fetch_missing_translation_locales(self) -> None:
        """Missing translations despite fallback."""

        self.assertEqual({'en_UK'}, translation.fetch_missing_translation_locales('sacrebleu'))


if __name__ == '__main__':
    unittest.main()
