"""Download translations from Airtable to a JSON file."""

import argparse
import json
import logging
import os
from typing import Iterator, Mapping, Optional, Sequence, Tuple

from airtable import airtable

# Translations base: https://airtable.com/appkEc8N0Bw4Uok43
_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'

_DOWNLOAD_LANGUAGES = {'en', 'en_UK', 'fr', 'fr@tu'}


def _list_valid_translations(api_key: str) -> Iterator[Tuple[str, Mapping[str, str]]]:
    i18n_base = airtable.Airtable(_I18N_BASE_ID, api_key)
    for record in i18n_base.iterate('translations'):
        fields = record['fields']
        key = fields.get('string', '')
        if not key:
            continue
        translations = {
            lang: translation
            for lang, translation in fields.items()
            if lang in _DOWNLOAD_LANGUAGES
        }
        if translations:
            yield key, translations


def main(string_args: Optional[Sequence[str]] = None) -> None:
    """Download translations from Airtable for static server strings."""

    # Parse arguments.
    parser = argparse.ArgumentParser(
        description='Download translations from Airtable for static server strings.')
    parser.add_argument('--api-key', default=os.getenv('AIRTABLE_API_KEY'))
    parser.add_argument(
        '--output', help='File in which to save the translations.',
        required=True)
    args = parser.parse_args(string_args)

    if not args.api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    logging.info('Downloading translations from Airtable…')
    translations = dict(_list_valid_translations(args.api_key))

    logging.info('Creating the translations file…')
    with open(args.output, 'wt', encoding='utf-8') as output_file:
        json.dump(translations, output_file, ensure_ascii=False, sort_keys=True)

    logging.info('Downloaded %d strings.', len(translations))


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
