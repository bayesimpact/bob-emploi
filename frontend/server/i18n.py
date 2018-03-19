"""Module to translate strings on the frontend server."""

from bob_emploi.frontend.server import proto


class TranslationMissingException(Exception):
    """Exception raised when a translation is missing for a string."""


class _MongoCachedTranslations(object):

    def __init__(self):
        self._cache = None
        self._database = None

    def get_dict(self, database):
        """Get the translations dictionary from the database."""

        if database != self._database:

            def _populate_cache(cache):
                for document in database.translations.find():
                    cache[document.get('string')] = document

            self._cache = proto.CachedCollection(_populate_cache)

        return self._cache


_TRANSLATIONS = _MongoCachedTranslations()


def translate_string(string, locale, database):
    """Translate a string in a given locale."""

    translated_string = _TRANSLATIONS.get_dict(database).get(string, {}).get(locale)
    if translated_string is None:
        raise TranslationMissingException(
            'Could not find a translation in "{}" for "{}".'.format(locale, string))
    return translated_string
