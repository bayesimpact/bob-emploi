"""Translate strings using the translation table from AirTable."""

import os
import typing
from typing import Any, Optional, Mapping, Set

from airtable import airtable


# Locales we want to ensure we have a translation for.
LOCALES_TO_CHECK = frozenset(
    clean_locale
    for locale in os.getenv('REQUIRED_LOCALES', 'fr@tu').split(',')
    if (clean_locale := locale.strip()))

# Airtable cache for the translation table as a dict.
_TRANSLATION_TABLE: list[dict[str, dict[str, str]]] = []

# Locale fallbacks that are deemed acceptable.
_LOCALE_FALLBACKS = {'en_UK': 'en'}


def get_all_translations() -> dict[str, dict[str, str]]:
    """Get all translations from Airtable."""

    # The airtable api key.
    api_key = os.getenv('AIRTABLE_API_KEY')
    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    if not _TRANSLATION_TABLE:
        translations = {
            record['fields']['string']: {
                locale: value
                for locale, value in record['fields'].items()
                if not locale.startswith('quick_')
            }
            for record in airtable.Airtable(
                'appkEc8N0Bw4Uok43', api_key).iterate(
                    'tblQL7A5EgRJWhQFo', view='viwLyQNlJtyD4l45k')
            if 'string' in record['fields']
        }
        _TRANSLATION_TABLE.append(translations)
    return _TRANSLATION_TABLE[0]


_T = typing.TypeVar('_T')


def _dive_in_fallback(locale: str, values: Mapping[str, _T]) -> Optional[_T]:
    tested_locales: Set[str] = set()
    while True:
        if locale in values:
            return values[locale]
        tested_locales.add(locale)
        fallback_locale = _LOCALE_FALLBACKS.get(locale)
        if not fallback_locale or fallback_locale in tested_locales:
            return None
        locale = fallback_locale


def get_translation(string: str, locale: str) -> Optional[str]:
    """Get a translation from the table for a non-translated string in the desired locale."""

    translations = get_all_translations().get(string, {})
    return _dive_in_fallback(locale, translations)


class Translator:
    """A translator to translate multiple strings in various locales.

    It accumulates missing translations and can be used to raise only one error for all
    missing translations.
    """

    def __init__(self) -> None:
        self._missing_translations: Set[tuple[str, str]] = set()

    def ensure_translate(self, string: str, locale: str) -> str:
        """Translate a string or keep track of failure.

        See raise_on_error method.
        """

        translated = get_translation(string, locale)
        if translated is None:
            self._missing_translations.add((string, locale))
            return string
        return translated

    def ensure_translate_fields(
        self, source: Mapping[str, str], locale: str, fields: tuple[str, ...]
    ) -> Mapping[str, str]:
        """Translate fields of a mapping and keep track of failures."""

        return {
            field: self.ensure_translate(source[field], locale)
            for field in fields if field in source
        }

    def raise_on_error(self) -> None:
        """Raise if any missing translations was found while using ensure_translate."""

        if not self._missing_translations:
            return

        missing_translations = self._missing_translations
        self._missing_translations = set()
        raise KeyError('Could not find tranlsation for:\n' + '\n'.join(
            f'"{string}" in "{locale}"' for string, locale in missing_translations)
        )

    def __enter__(self) -> 'Translator':
        return self

    def __exit__(
            self, unused_type: type, unused_value: 'Translator', unused_traceback: Any) -> None:
        self.raise_on_error()


def fetch_missing_translation_locales(string: str) -> Set[str]:
    """The set of needed translations missing for a given sentence."""

    available_translations = {
        key: True for key, value in get_all_translations().get(string, {}).items() if value}
    return {
        locale for locale in set(LOCALES_TO_CHECK)
        if not _dive_in_fallback(locale, available_translations)
    }


def clear_cache() -> None:
    """Clear the internal cache of this module."""

    del _TRANSLATION_TABLE[:]


def get_collection_namespace(collection: str) -> str:
    """Get the namepsace of an imported collection."""

    words = collection.split('_')
    return words[0] + ''.join(word.title() for word in words[1:])


def create_translation_key(namespace: str, record_id: str, path: str) -> str:
    """Creates the translation key for a value in a record."""

    return f'{namespace}:{record_id}:{path}'
