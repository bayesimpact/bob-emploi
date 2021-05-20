"""Upload strings from a POT or a JSON file to Airtable to translate."""

import argparse
import json
import logging
import os
from os import path
import sys
import typing
from typing import Iterable, Optional, Sequence, TextIO

import polib
import tqdm

from bob_emploi.data_analysis.i18n import collect_strings


class _TranslatableString(typing.NamedTuple):
    message: str
    origin: str
    origin_id: str
    translation: str


def _iter_strings_from_file(filename: str, should_skip_unknown: bool = False) \
        -> Iterable[_TranslatableString]:

    if path.isdir(filename):
        for root, unused_dirs, files in os.walk(filename):
            for name in files:
                try:
                    yield from _iter_strings_from_file(
                        path.join(root, name), should_skip_unknown=True)
                except Exception as error:
                    raise ValueError(f'Could not upload strings from {name}') from error
        return

    basename = path.basename(filename)

    if filename.endswith('.pot'):
        for msg in polib.pofile(filename):
            if all(f.endswith('_test.py') for f, unused_line in msg.occurrences):
                # Do not upload strings that are only in test files.
                continue

            yield _TranslatableString(
                f'{msg.msgid}_{msg.msgctxt}' if msg.msgctxt else msg.msgid,
                origin=basename,
                origin_id='\n'.join(f'{file}#{line}' for file, line in msg.occurrences),
                translation=msg.msgstr,
            )
        return

    if filename.endswith('.json'):
        with open(filename, 'rt') as json_file:
            messages = json.load(json_file)
        for line, (message, translation) in enumerate(messages.items()):
            yield _TranslatableString(
                message, origin=basename, origin_id=str(line), translation=translation)
        return

    if not should_skip_unknown:
        raise NotImplementedError(f'This script cannot parse this file yet: "{filename}"')


def _iter_strings_from_files(filenames: Iterable[str]) -> Iterable[_TranslatableString]:
    for filename in filenames:
        try:
            yield from _iter_strings_from_file(filename)
        except Exception as error:
            raise ValueError(f'Could not upload strings from {filename}') from error


def main(
        string_args: Optional[Sequence[str]] = None,
        progress_file: TextIO = sys.stderr) -> None:
    """Collect all the strings in Airtable to translate."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--api-key', default=os.getenv('AIRTABLE_API_KEY'), nargs='?',
        help='Airtable API key to access the base')
    parser.add_argument(
        'filenames', nargs='+',
        help='POT or JSON files containing strings to translate. Can also be a folder containing '
        'such files.',
        type=str)
    parser.add_argument('--lang', nargs='?', help='The language of the translations to uploads')
    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')

    if not args.api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    iterate_on_files = tqdm.tqdm(args.filenames, file=progress_file)

    collector = collect_strings.StringCollector(args.api_key)
    for message, origin, origin_id, translation in _iter_strings_from_files(iterate_on_files):
        collector.collect_string(
            message, origin, origin_id,
            {args.lang: translation} if args.lang and translation else None)


if __name__ == '__main__':
    main()
