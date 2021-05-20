"""Unit tests for the i18n module."""

import os
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo


class TranslateStringTestCase(unittest.TestCase):
    """Unit tests for the translate_string function."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        i18n.cache.clear()

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

    def test_locale_fallback(self) -> None:
        """String exists in translation table, but only for a simpler verison of the locale."""

        self._db.translations.insert_one({
            'string': 'my text',
            'en': 'my text in English',
        })
        self.assertEqual('my text in English', i18n.translate_string('my text', 'en_UK', self._db))

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


_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


class TranslateStaticStringTestCase(unittest.TestCase):
    """Unit tests for the translate_string function for static strings."""

    def tearDown(self) -> None:
        i18n.cache.clear()
        super().tearDown()

    def test_no_data(self) -> None:
        """Absolutely no data."""

        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'fr')

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_translate_string(self) -> None:
        """Basic usage."""

        self.assertEqual('mon texte', i18n.translate_string('my text', 'fr'))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_locale_missing_for_string(self) -> None:
        """String exists in translation table, but no value for the given locale."""

        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'en')

    def test_translate_empty_string(self) -> None:
        """Translation of the empty string does not raise an error."""

        self.assertEqual('', i18n.translate_string('', 'fr'))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_translate_strings(self) -> None:
        """Using fallback strings."""

        self.assertEqual(
            'mon texte',
            i18n.translate_string(['my text_plural', 'my text'], 'fr'),
        )

    def test_translate_strings_fail(self) -> None:
        """Using fallback strings and failing on all of them."""

        with self.assertRaises(i18n.TranslationMissingException) as error:
            i18n.translate_string(['my text_plural', 'my text'], 'fr')
        self.assertIn('my text_plural', str(error.exception))


if __name__ == '__main__':
    unittest.main()
