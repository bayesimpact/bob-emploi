"""Unit tests for the i18n.translation module."""

# TODO(cyrille): Consider moving to a common/test folder.

import os
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.common.python.i18n import translation


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


@mock.patch(translation.__name__ + '.LOCALES_TO_CHECK', {'en_UK'})
@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'api-key'})
class EnsureTranslateTests(airtablemock.TestCase):
    """Unit tests for ensure_translate."""

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

    def test_ensure_translate(self) -> None:
        """Basic usage of ensure_translate."""

        with translation.Translator() as translator:
            self.assertEqual('United Kingdom', translator.ensure_translate('country', 'en_UK'))

    def test_fallback(self) -> None:
        """Fallback locale on ensure_translate."""

        with translation.Translator() as translator:
            self.assertEqual('English', translator.ensure_translate('my language', 'en_UK'))

    def test_missing_key(self) -> None:
        """Missing translation on ensure_translate."""

        with self.assertRaises(KeyError):
            with translation.Translator() as translator:
                translator.ensure_translate('sacrebleu', 'en_UK')

    def test_missing_several_keys(self) -> None:
        """Missing several translations on ensure_translate."""

        with self.assertRaises(KeyError) as error:
            with translation.Translator() as translator:
                translator.ensure_translate('country', 'en_UK')
                translator.ensure_translate('sacrebleu', 'en_UK')
                translator.ensure_translate('fully missing key', 'en_UK')

        self.assertIn('sacrebleu', str(error.exception))
        self.assertIn('fully missing key', str(error.exception))

    def test_translate_fieldss(self) -> None:
        """Translate fields of a mapping."""

        with translation.Translator() as translator:
            translated = translator.ensure_translate_fields(
                {'a': 'country', 'b': 'untranslated', 'c': 'my language'},
                locale='en_UK',
                fields=('a', 'c', 'unknown'))
            self.assertEqual({'a': 'United Kingdom', 'c': 'English'}, translated)


if __name__ == '__main__':
    unittest.main()
