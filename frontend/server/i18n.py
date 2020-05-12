"""Module to translate strings on the frontend server."""

import logging
from typing import Dict, Sequence, Optional, Union

from pymongo import database as pymongo_database

from bob_emploi.frontend.server import proto

try:
    import flask
except ImportError:
    # If flask is missing the translate_flask function won't work but the rest will.
    pass


class TranslationMissingException(Exception):
    """Exception raised when a translation is missing for a string."""


class _MongoCachedTranslations(object):

    def __init__(self) -> None:
        self._cache: Optional[proto.CachedCollection[Dict[str, str]]] = None
        self._database: Optional[pymongo_database.Database] = None

    def clear_cache(self) -> None:
        """Clear the current cache."""

        self._cache = None
        self._database = None

    def get_dict(self, database: pymongo_database.Database) \
            -> proto.CachedCollection[Dict[str, str]]:
        """Get the translations dictionary from the database."""

        if self._cache is None or database != self._database:

            def _get_values() -> Dict[str, Dict[str, str]]:
                return {
                    document.get('string', ''): document
                    for document in database.translations.find()
                }

            self._cache = proto.CachedCollection(_get_values)
            self._database = database

        return self._cache


_TRANSLATIONS = _MongoCachedTranslations()


def flask_translate(string: str) -> str:
    """Translate a string in host locale (from flask request)."""

    if not flask or not flask.current_app:
        raise ValueError('flask_translate called outside of a flask request context.')

    host_language = flask.request.accept_languages.best_match(('en', 'fr')) or 'fr'
    try:
        return translate_string(string, host_language, flask.current_app.config['DATABASE'])
    except TranslationMissingException:
        if host_language != 'fr':
            logging.exception('Falling back to French on "%s"', string)

    return string


def translate_string(
        string: Union[str, Sequence[str]], locale: str, database: pymongo_database.Database) -> str:
    """Translate a string in a given locale."""

    strings: Sequence[str]
    if isinstance(string, str):
        strings = [string]
    else:
        strings = string

    for key in strings:
        if not key:
            return ''
        try:
            return _TRANSLATIONS.get_dict(database)[key][locale]
        except KeyError:
            pass

    raise TranslationMissingException(
        f'Could not find a translation in "{locale}" for "{string}".')


def make_translatable_string(string: str) -> str:
    """Mark a literal string for translation.

    If a string needs to be translated at runtime but is defined as a literal in our code
    far from where we have enough context to translate it, use this function to wrap it.
    """

    return string


def clear_cache() -> None:
    """Clear the translations cache."""

    _TRANSLATIONS.clear_cache()
