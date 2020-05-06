"""Unit tests for the i18n module."""

import unittest

import mongomock

from bob_emploi.frontend.server import i18n


class TranslateStringTestCase(unittest.TestCase):
    """Unit tests for the translate_string function."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test

    def test_translate_string(self) -> None:
        """Basic usage."""

        self._db.translations.insert_one({
            'string': 'my text',
            'fr': 'mon texte',
        })
        self.assertEqual('mon texte', i18n.translate_string('my text', 'fr', self._db))

    def test_no_data(self) -> None:
        """Absolutely no data."""

        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'fr', self._db)

    def test_locale_missing_for_string(self) -> None:
        """String exists in translation table, but no value for the given locale."""

        self._db.translations.insert_one({
            'string': 'my text',
            'en': 'my text',
        })
        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'fr', self._db)

    def test_translate_empty_string(self) -> None:
        """Translation of the empty string does not raise an error."""

        self.assertEqual('', i18n.translate_string('', 'fr', self._db))

    def test_translate_strings(self) -> None:
        """Using fallback strings."""

        self._db.translations.insert_one({
            'string': 'my text',
            'fr': 'mon texte',
        })
        self.assertEqual(
            'mon texte',
            i18n.translate_string(['my text_plural', 'my text'], 'fr', self._db),
        )

    def test_translate_strings_fail(self) -> None:
        """Using fallback strings and failing on all of them."""

        with self.assertRaises(i18n.TranslationMissingException) as error:
            i18n.translate_string(['my text_plural', 'my text'], 'fr', self._db)
        self.assertIn('my text_plural', str(error.exception))

    def test_translate_string_use_cache(self) -> None:
        """Make sure that the translate_string is using the cache."""

        self._db.translations.insert_one({
            'string': 'my text',
            'fr': 'mon texte',
        })
        self.assertEqual(
            'mon texte',
            i18n.translate_string('my text', 'fr', self._db),
        )

        self._db.translations.update_one({'string': 'my text'}, {'$set': {'fr': 'updated text'}})
        self.assertEqual(
            'mon texte',
            i18n.translate_string('my text', 'fr', self._db),
        )


if __name__ == '__main__':
    unittest.main()
