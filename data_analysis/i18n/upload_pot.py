"""Upload strings from a POT file to Airtable to translate."""

import logging
import os
from os import path
import sys
from typing import Optional

import polib

from bob_emploi.data_analysis.i18n import collect_strings

_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'


def main(pot_filename: str, api_key: Optional[str]) -> None:
    """Collect all the strings in Airtable to translate."""

    logging.basicConfig(level='INFO')

    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    collector = collect_strings.StringCollector(api_key)

    pot_basename = path.basename(pot_filename)

    for msg in polib.pofile(pot_filename):
        if all(filename.endswith('_test.py') for filename, unused_line in msg.occurrences):
            # Do not upload strings that are only in test files.
            continue

        collector.collect_string(
            msg.msgid,
            origin=pot_basename,
            origin_id='\n'.join(f'{filename}#{line}' for filename, line in msg.occurrences),
        )


if __name__ == '__main__':
    main(sys.argv[1], os.getenv('AIRTABLE_API_KEY'))
