"""Module to translate strings on the frontend server."""

import typing

from pymongo import database as pymongo_database

from bob_emploi.frontend.server import proto


class TranslationMissingException(Exception):
    """Exception raised when a translation is missing for a string."""


class _MongoCachedTranslations(object):

    def __init__(self) -> None:
        self._cache: typing.Optional[proto.CachedCollection[typing.Dict[str, str]]] = None
        self._database: typing.Optional[pymongo_database.Database] = None

    def get_dict(self, database: pymongo_database.Database) \
            -> proto.CachedCollection[typing.Dict[str, str]]:
        """Get the translations dictionary from the database."""

        if self._cache is None or database != self._database:

            def _populate_cache(cache: typing.Dict[str, typing.Dict[str, str]]) -> None:
                for document in database.translations.find():
                    cache[document.get('string')] = document

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
            'Could not find a translation in "{}" for "{}".'.format(locale, string))
