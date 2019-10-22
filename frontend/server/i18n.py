"""Module to translate strings on the frontend server."""

from typing import Dict, Optional

from pymongo import database as pymongo_database

from bob_emploi.frontend.server import proto


class TranslationMissingException(Exception):
    """Exception raised when a translation is missing for a string."""


class _MongoCachedTranslations(object):

    def __init__(self) -> None:
        self._cache: Optional[proto.CachedCollection[Dict[str, str]]] = None
        self._database: Optional[pymongo_database.Database] = None

    def get_dict(self, database: pymongo_database.Database) \
            -> proto.CachedCollection[Dict[str, str]]:
        """Get the translations dictionary from the database."""

        if self._cache is None or database != self._database:

            def _populate_cache(cache: Dict[str, Dict[str, str]]) -> None:
                for document in database.translations.find():
                    cache[document.get('string', '')] = document

            self._cache = proto.CachedCollection(_populate_cache)

        return self._cache


_TRANSLATIONS = _MongoCachedTranslations()


def translate_string(string: str, locale: str, database: pymongo_database.Database) -> str:
    """Translate a string in a given locale."""

    if not string:
        return ''

    try:
        return _TRANSLATIONS.get_dict(database)[string][locale]
    except KeyError:
        raise TranslationMissingException(
            f'Could not find a translation in "{locale}" for "{string}".')


def make_translatable_string(string: str) -> str:
    """Mark a literal string for translation.

    If a string needs to be translated at runtime but is defined as a literal in our code
    far from where we have enough context to translate it, use this function to wrap it.
    """

    return string
