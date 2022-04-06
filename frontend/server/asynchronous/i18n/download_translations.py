"""Download translations from Airtable for static server strings."""

import argparse
import collections
import json
import logging
import os
import typing
from typing import Any, Optional, Sequence, Set, Tuple

from airtable import airtable
import polib

from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail.templates import mailjet_templates


# Translations base: https://airtable.com/appkEc8N0Bw4Uok43
_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'

_REQUIRED_LANGUAGES = {'en'}
_DOWNLOAD_LANGUAGES = {'en', 'en_UK', 'fr', 'fr@tu'}


# TODO(cyrille): Separate the test for missing translations.
def main(string_args: Optional[Sequence[str]] = None) -> None:
    """Download translations from Airtable for static server strings."""

    # Parse arguments.
    parser = argparse.ArgumentParser(
        description='Download translations from Airtable for static server strings.')
    parser.add_argument('--api-key', default=os.getenv('AIRTABLE_API_KEY'))
    parser.add_argument(
        '--strings', help='Path to the PO file containing the extracted strings to translate.',
        required=True)
    parser.add_argument(
        '--output', help='File in which to save the translations.',
        required=True)
    args = parser.parse_args(string_args)

    if not args.api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    logging.info('Loading extracted strings…')
    extracted_strings = {
        msg.msgid for msg in polib.pofile(args.strings)
        # Do not keep strings that are only in test files.
        if not msg.occurrences or
        not all(f.endswith('_test.py') for f, unused_line in msg.occurrences)
    }

    logging.info('Loading extra strings from Mailjet templates…')
    mailjet_strings = {
        campaign.get_campaign_subject(campaign_id)
        for campaign_id in mailjet_templates.MAP
    }

    logging.info('Downloading translations from Airtable…')
    i18n_base = airtable.Airtable(_I18N_BASE_ID, args.api_key)
    translations = {
        typing.cast(dict[str, Any], record['fields']).get('string', ''): {
            lang: translation
            for lang, translation in record['fields'].items()
            if lang in _DOWNLOAD_LANGUAGES
        }
        for record in i18n_base.iterate('translations')
    }

    logging.info('Mapping keys with context to their base keys…')
    contexts = collections.defaultdict(list)
    for translation in translations:
        parts = translation.split('_')
        for index in range(1, len(parts)):
            key = '_'.join(parts[0: index])
            contexts[key].extend([
                '_'.join(parts[0: split_index + 1])
                for split_index in range(index, len(parts))])

    logging.info('Filtering translations of extracted strings…')
    extracted_translations: dict[str, dict[str, str]] = {}
    should_raise_on_missing = bool(os.getenv('FAIL_ON_MISSING_TRANSLATIONS', ''))
    missing_translations: Set[Tuple[Optional[str], str]] = set()
    for key in extracted_strings | mailjet_strings:
        if key not in translations:
            if key in extracted_strings:
                missing_translations.add((None, key))
            continue
        for language in _REQUIRED_LANGUAGES - translations[key].keys():
            missing_translations.add((language, key))
        extracted_translations[key] = translations[key]
        for key_with_context in contexts.get(key, []):
            try:
                extracted_translations[key_with_context] = translations[key_with_context]
            except KeyError:
                pass

    if missing_translations:
        missing_translations_string = 'Missing translations:\n' + '\n'.join(
            f'{language if language else "all"}: {key}' for language, key in missing_translations)
        if should_raise_on_missing:
            raise KeyError(missing_translations_string)
        logging.info(missing_translations_string)

    logging.info('Creating the translations file…')
    with open(args.output, 'wt', encoding='utf-8') as output_file:
        json.dump(extracted_translations, output_file, ensure_ascii=False, sort_keys=True)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
