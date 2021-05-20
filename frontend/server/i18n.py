"""Module to translate strings on the frontend server."""

import json
import logging
import os
import typing
from typing import Callable, Dict, Iterator, Mapping, Optional, Sequence, Union

from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto

try:
    import flask
except ImportError:
    # If flask is missing the translate_flask function won't work but the rest will.
    pass


class TranslationMissingException(Exception):
    """Exception raised when a translation is missing for a string."""


class _MongoCachedTranslations:

    def __init__(self) -> None:
        self._cache: Optional[proto.CachedCollection[Dict[str, str]]] = None
        self._database: Optional[mongo.NoPiiMongoDatabase] = None
        cache.register_clear_func(self.clear_cache)

    def clear_cache(self) -> None:
        """Clear the current cache."""

        self._cache = None
        self._database = None

    def get_dict(self, database: mongo.NoPiiMongoDatabase) \
            -> proto.CachedCollection[Dict[str, str]]:
        """Get the translations dictionary from the database."""

        if self._cache is None or database is not self._database:

            def _get_values() -> Dict[str, Dict[str, str]]:
                return {
                    document.get('string', ''): document
                    for document in database.translations.find()
                }

            self._cache = proto.CachedCollection(_get_values)
            self._database = database

        return self._cache


_TRANSLATIONS = _MongoCachedTranslations()


_T = typing.TypeVar('_T')


class _LazyJsonDict(Mapping[str, _T]):

    def __init__(self, get_path: Callable[[], str]) -> None:
        self._get_path = get_path
        self._cache: Optional[Mapping[str, _T]] = None
        cache.register_clear_func(self.clear_cache)

    def _ensure_cache(self) -> Mapping[str, _T]:
        if self._cache:
            return self._cache
        with open(self._get_path(), 'r') as translations_file:
            cache_value = typing.cast(Mapping[str, _T], json.load(translations_file))
        self._cache = cache_value
        return cache_value

    def __getitem__(self, key: str) -> _T:
        return self._ensure_cache()[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._ensure_cache())

    def __len__(self) -> int:
        return len(self._ensure_cache())

    def clear_cache(self) -> None:
        """Clear the current cache."""

        self._cache = None


_STATIC_TRANSLATIONS = _LazyJsonDict[Mapping[str, str]](
    lambda: os.getenv(
        'I18N_TRANSLATIONS_FILE',
        os.path.join(os.path.dirname(__file__), 'translations.json')))


def flask_translate(string: str) -> str:
    """Translate a string in host locale (from flask request)."""

    if not flask or not flask.current_app:
        raise ValueError('flask_translate called outside of a flask request context.')

    host_language = flask.request.accept_languages.best_match(('en', 'fr')) or 'fr'
    try:
        return translate_string(string, host_language)
    except TranslationMissingException:
        if host_language != 'fr':
            logging.exception('Falling back to French on "%s"', string)

    return string


def translate_string(
        string: Union[str, Sequence[str]], locale: str,
        database: Optional[mongo.NoPiiMongoDatabase] = None) -> str:
    """Translate a string in a given locale."""

    full_locale = locale
    strings: Sequence[str]
    if isinstance(string, str):
        strings = [string]
    else:
        strings = string

    translations: Mapping[str, Mapping[str, str]]
    if database:
        translations = typing.cast(
            Mapping[str, Mapping[str, str]], _TRANSLATIONS.get_dict(database))
    else:
        translations = _STATIC_TRANSLATIONS

    while locale:
        for key in strings:
            if not key:
                return ''
            try:
                return translations[key][locale]
            except KeyError:
                pass

        if '@' in locale:
            locale, unused_dialect = locale.split('@', 1)
        elif '_' in locale:
            locale, unused_country = locale.split('_', 1)
        else:
            break

    raise TranslationMissingException(
        f'Could not find a translation in "{full_locale}" for "{string}".')


def make_translatable_string(string: str) -> str:
    """Mark a literal string for translation.

    If a string needs to be translated at runtime but is defined as a literal in our code
    far from where we have enough context to translate it, use this function to wrap it.
    """

    return string


def make_translatable_string_with_context(string: str, unused_context: str) -> str:
    """Mark a literal string for translation.

    If a string needs to be translated at runtime but is defined as a literal in our code
    far from where we have enough context to translate it, use this function to wrap it.
    """

    return string
