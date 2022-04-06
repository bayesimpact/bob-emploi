"""Fix translations common errors directly on Airtable."""

import argparse
import logging
import os
import re
from typing import Mapping, Optional, Sequence

from airtable import airtable

# Translations base: https://airtable.com/appkEc8N0Bw4Uok43
_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'

_LANGUAGES = {'en', 'en_UK', 'fr', 'fr@tu'}

# Matches a space at first or end of a line (in a possibly multiline string).
_STRIPABLE_SPACE_REGEX = re.compile(r'(^ +| +$)', re.MULTILINE)

# Matches a space that should be unbreakable in a French sentence.
_FR_SPACE_TO_MAKE_UNBREAKABLE_REGEX = re.compile(r'( )(?=[?;:!])')


def _fix_translation_record(translations: Mapping[str, str]) -> Mapping[str, str]:
    has_stripable_space = _STRIPABLE_SPACE_REGEX.search(translations['string'])
    has_fr_bad_space = _FR_SPACE_TO_MAKE_UNBREAKABLE_REGEX.search(translations['string'])
    fixes: dict[str, str] = {}
    for language in _LANGUAGES:
        try:
            translation = translations[language]
        except KeyError:
            continue
        has_a_fix = False

        if not has_stripable_space and _STRIPABLE_SPACE_REGEX.search(translation):
            translation = _STRIPABLE_SPACE_REGEX.sub('', translation)
            has_a_fix = True
        if (
            not has_fr_bad_space and language.startswith('fr') and
            _FR_SPACE_TO_MAKE_UNBREAKABLE_REGEX.search(translation)
        ):
            translation = _FR_SPACE_TO_MAKE_UNBREAKABLE_REGEX.sub('\xa0', translation)
            has_a_fix = True

        if has_a_fix:
            fixes[language] = translation
    return fixes


def _confirm_diff() -> bool:
    while True:
        answer = input('Do you approve this diff? Y/N ').upper()
        if answer == 'Y':
            return True
        if answer == 'N':
            return False


def main(string_args: Optional[Sequence[str]] = None) -> None:
    """Download translations from Airtable for static server strings."""

    # Parse arguments.
    parser = argparse.ArgumentParser(
        description='Fix translations common errors directly on Airtable.')
    parser.add_argument('--api-key', default=os.getenv('AIRTABLE_API_KEY'))
    parser.add_argument('--accept-all', action='store_true')
    args = parser.parse_args(string_args)

    if not args.api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    i18n_base = airtable.Airtable(_I18N_BASE_ID, args.api_key)
    num_fixed = 0
    for record in i18n_base.iterate('translations'):
        fixes = _fix_translation_record(record['fields'])
        if not fixes:
            continue
        if not args.accept_all:
            for language, fixed_translation in fixes.items():
                print(f'- {record["fields"][language]}')
                print(f'+ {fixed_translation}')
            if not _confirm_diff():
                continue
        i18n_base.update('translations', record['id'], fixes)

        num_fixed += len(fixes)

    logging.info('Fixed %d strings.', num_fixed)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
