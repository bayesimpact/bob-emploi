"""Translate strings using the translation table from AirTable."""

import os
import typing

from airtable import airtable

# The airtable api key.
_AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')

# Locales we want to ensure we have a translation for.
LOCALES_TO_CHECK = frozenset({'fr_FR@tu'})

# Airtable cache for the translation table as a dict.
_TRANSLATION_TABLE: typing.List[typing.Dict[str, typing.Dict[str, str]]] = []


def _get_all_translations() -> typing.Dict[str, typing.Dict[str, str]]:
    if not _TRANSLATION_TABLE:
        translations = {
            record['fields']['string']: record['fields']
            for record in airtable.Airtable(
                'appkEc8N0Bw4Uok43', _AIRTABLE_API_KEY).iterate(
                    'tblQL7A5EgRJWhQFo', view='viwLyQNlJtyD4l45k')
            if 'string' in record['fields']
        }
        _TRANSLATION_TABLE.append(translations)
    return _TRANSLATION_TABLE[0]


def get_translation(string: str, locale: str) -> typing.Optional[str]:
    """Get a translation from the table for a non-translated string in the desired locale."""

    return _get_all_translations().get(string, {}).get(locale)


def fetch_missing_translation_locales(string: str) -> typing.Set[str]:
    """The set of needed translations missing for a given sentence."""

    available_translations = {
        key for key, value in _get_all_translations().get(string, {}).items() if value}
    return set(LOCALES_TO_CHECK) - available_translations
