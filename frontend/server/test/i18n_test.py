"""Unit tests for the i18n module."""

import unittest

import mongomock

from bob_emploi.frontend.server import i18n


class TranslateStringTestCase(unittest.TestCase):
    """Unit tests for the translate_string function."""

    def setUp(self):
        super(TranslateStringTestCase, self).setUp()
        self._db = mongomock.MongoClient().test

    def test_translate_string(self):
        """Basic usage."""

        self._db.translations.insert_one({
            'string': 'my text',
            'fr': 'mon texte',
        })
        self.assertEqual('mon texte', i18n.translate_string('my text', 'fr', self._db))

    def test_no_data(self):
        """Absolutely no data."""

        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'fr', self._db)

    def test_locale_missing_for_string(self):
        """String exists in translation table, but no value for the given locale."""

        self._db.translations.insert_one({
            'string': 'my text',
            'en': 'my text',
        })
        with self.assertRaises(i18n.TranslationMissingException):
            i18n.translate_string('my text', 'fr', self._db)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
