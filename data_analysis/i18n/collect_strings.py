"""Collect the strings to translate.

docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" data-analysis-prepare \
    python bob_emploi/data_analysis/i18n/collect_strings.py
"""

import argparse
import collections
import datetime
import logging
import os
import typing
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple

from airtable import airtable
import requests

from bob_emploi.frontend.api import options_pb2
from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.importer import import_status
from bob_emploi.data_analysis.lib import checker

_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'
_BOB_ADVICE_BASE_ID = 'appXmyc7yYj0pOcae'
_ROME_BASE_ID = 'appMRMtWV61Kibt37'

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_IMPORT_URL = os.getenv('SLACK_IMPORT_URL')


class _Collectible(typing.NamedTuple):
    base_id: str
    table: str
    fields: Iterable[str]
    id_field: Optional[str] = None
    view: Optional[str] = None


# List of Airtable fields to collect for translation that will be used client-side.
# Please keep in sync with translatable fields in frontend/client/download.js
CLIENT_COLLECTIBLES = [
    _Collectible(_BOB_ADVICE_BASE_ID, 'advice_modules', (
        'explanations (for client)',
        'goal',
        'title',
        'title_3_stars',
        'title_2_stars',
        'title_1_star',
        'user_gain_details',
    ), view='Ready to Import', id_field='advice_id'),
    _Collectible(_BOB_ADVICE_BASE_ID, 'email_templates', (
        'reason',
        'title',
    ), view='Ready to Import'),
    _Collectible(_ROME_BASE_ID, 'Event Types', (
        'event_location_prefix',
        'event_location')),
    _Collectible(_BOB_ADVICE_BASE_ID, 'strategy_goals', ('content',), view='Ready to Import'),
    _Collectible(_BOB_ADVICE_BASE_ID, 'strategy_testimonials', (
        'job',
        'content'), view='Ready to Import'),
    _Collectible(_BOB_ADVICE_BASE_ID, 'diagnostic_categories', (
        'metric_details',
        'metric_details_feminine'), view='Ready to Import'),
]


class StringCollector(object):
    """A helper to collect string to translate."""

    def __init__(self, api_key: str) -> None:
        self._i18n_base = airtable.Airtable(_I18N_BASE_ID, api_key)
        self._existing_translations = {
            typing.cast(Dict[str, Any], record['fields']).get('string'): record
            for record in self._i18n_base.iterate('translations')
        }
        self._api_key = api_key
        self.bases: Dict[str, airtable.Airtable] = {}
        self._collected: Dict[str, Dict[str, str]] = \
            collections.defaultdict(lambda: collections.defaultdict(str))
        self._used_translations: Set[str] = set()
        self._now = datetime.datetime.utcnow().isoformat() + 'Z'

    def _get_base(self, base_id: str) -> airtable.Airtable:
        if base_id not in self.bases:
            self.bases[base_id] = airtable.Airtable(base_id, self._api_key)
        return self.bases[base_id]

    def collect_string(self, text: str, origin: str, origin_id: str) -> None:
        """Collect a string to translate."""

        self._collected[origin or ''][origin_id or ''] = text
        is_already_used = text in self._used_translations
        self._used_translations.add(text)
        if text in self._existing_translations:
            if not is_already_used:
                self._i18n_base.update(
                    'translations', self._existing_translations[text]['id'],
                    {'last_used': self._now})
            # TODO(pascal): Keep track of all places where it is used.
            return
        fields = {
            'origin': origin,
            'origin_id': origin_id,
            'string': text,
            'last_used': self._now,
        }
        logging.info('Uploading text: %s', text)
        record = self._i18n_base.create('translations', fields)
        self._existing_translations[text] = record

    def collect_from_table(
            self, base_id: str, table: str, fields: Iterable[str],
            id_field: Optional[str] = None, view: Optional[str] = None) -> None:
        """Collect strings to translate from an Airtable.

        Args:
            base_id: the airtable id of the base.
            table: the name of the table.
            fields: a set of fields which contain strings to translate. Fields can either be given
                    as a string or as a RepeatedCollector if several values can be extracted
                    at once.
            id_field: name of the field to use as ID (otherwise just use the recxxxx).
        """

        base = self._get_base(base_id)
        for record in base.iterate(table, view=view):
            record_fields = typing.cast(Dict[str, Any], record['fields'])
            record_id = typing.cast(str, record['id'])
            for field in fields:
                text = record_fields.get(field)
                if not text:
                    continue
                origin_id = record_id
                if id_field:
                    origin_id = record_fields.get(id_field) or origin_id
                self.collect_string(text, f'{table}:{field}', origin_id)

    def collect_for_airtable_importer(
            self, base_id: str, table: str, proto: str,
            view: Optional[str] = None) -> int:
        """Collect all strings needed for a given import.

        Return:
            The number of errors occured when converting the records.
        """

        converter = airtable_to_protos.PROTO_CLASSES[proto]

        # Check whether the proto type has any translatable fields.
        for field in converter.proto_type.DESCRIPTOR.fields_by_name.values():
            field_string_formats = field.GetOptions().Extensions[options_pb2.string_format]
            if options_pb2.NATURAL_LANGUAGE in field_string_formats:
                break
            # TODO(cyrille): Detect fields needing translations even if they are nested.
        else:
            # No translatable field in the proto.
            return 0

        num_errors = 0
        for record in self._get_base(base_id).iterate(table, view=view):
            try:
                message, _id = converter.convert_record_to_proto(record)
            except (KeyError, ValueError) as error:
                logging.error('An error occurred while converting the record:\n\t%s', str(error))
                num_errors += 1
                continue
            for value, path, string_format in checker.collect_formatted_strings(message):
                if string_format == options_pb2.NATURAL_LANGUAGE:
                    self.collect_string(value, f'{table}:{path}', _id)
        return num_errors

    def collect_for_client(self, table: str = '') -> None:
        """Collect all strings needed client-side."""

        tables_to_collect = [coll for coll in CLIENT_COLLECTIBLES if coll.table == table] or \
            CLIENT_COLLECTIBLES
        for collectible in tables_to_collect:
            self.collect_from_table(*collectible)

    def list_unused_translations(self) -> Iterator[Tuple[Dict[str, Any], Optional[str]]]:
        """List all the translations that are in the DB but have not been collected in this run.

        We will only list translations that have the same origin as one of the origins used
        when collecting.
        Yield:
            for each unused translation, a tuple with the translation record
            field (whose keys are whithin string, origin and origin_id) and the
            new value if any.
        """

        unused_translations = self._existing_translations.keys() - self._used_translations
        for unused_translation in unused_translations:
            record = self._existing_translations[unused_translation]
            fields = typing.cast(Dict[str, Any], record['fields'])
            if fields.get('origin') not in self._collected:
                continue
            new_value = self._collected.get(typing.cast(str, fields.get('origin', '')), {})\
                .get(fields.get('origin_id', ''))
            yield record, new_value

    def remove(self, record: Dict[str, Any]) -> None:
        """Remove a translation record."""

        del self._existing_translations[record['fields']['string']]
        record_id = record.get('id')
        if record_id is None:
            logging.error('Missing ID in record: %s', record)
            return
        self._i18n_base.delete('translations', record_id)


def _handle_unused_translations(collector: StringCollector, action: str = 'list') -> None:
    if action == 'ignore':
        return

    unused_translations = collector.list_unused_translations()
    for record, new_value in unused_translations:
        if action == 'list':
            fields: Dict[str, Any] = collections.defaultdict(str)
            fields.update(record['fields'])
            if new_value is None:
                logging.warning(
                    'A string from "%(origin)s" - "%(origin_id)s" is unused: "%(string)s"',
                    fields)
            else:
                logging.warning(
                    'A string from "%(origin)s" - "%(origin_id)s" has been replaced: '
                    '"%(string)s" ⇨  "%(new_value)s"', dict(fields, new_value=new_value))
            continue

        if action == 'delete' or action == 'delete-replaced' and new_value is not None:
            logging.info(
                'Removing %s translation: "%s"',
                'unused' if new_value is None else 'replaced',
                record['fields']['string'])
            collector.remove(record)


_CLIENT_PREFIX = 'client-'

_ALL_COLLECTIONS = ('client',) + tuple(
    collection
    for collection, importer in import_status.IMPORTERS.items()
    if importer.script == 'airtable_to_protos')

_ALL_COLLECTION_NAMES = _ALL_COLLECTIONS + tuple(
    f'{_CLIENT_PREFIX}{coll.table}' for coll in CLIENT_COLLECTIBLES)


def _print_report(text: str) -> None:
    if _SLACK_IMPORT_URL and text:
        requests.post(_SLACK_IMPORT_URL, json={'attachments': [{
            'mrkdwn_in': ['text'],
            'title': 'Automatic String Collect',
            'text': f'{text}\n',
        }]})


def main(string_args: Optional[List[str]] = None) -> None:
    """Collect all the strings in Airtable to translate."""

    parser = argparse.ArgumentParser(
        description='Collect strings to be translated from Airtable.')
    parser.add_argument('api_key', default=os.getenv('AIRTABLE_API_KEY'), nargs='?')
    parser.add_argument(
        '--collection', action='append', choices=_ALL_COLLECTION_NAMES,
        help='Name of the importer to specifically collect for. This is either "client" or '
        'the name of an importer in import_status.py using airtable_to_protos script.\n'
        'If no collection is specified, all collectible strings will be collected.')
    parser.add_argument(
        '--unused', default='list', choices=['ignore', 'list', 'delete', 'delete-replaced'],
        help='How to treat existing unused translations.')
    args = parser.parse_args(string_args)

    if not args.api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    logging.info('Loading existing translations…')
    collector = StringCollector(args.api_key)

    if not args.collection:
        logging.info('Collecting all possible strings:')

    collection_errors = {}
    collections_not_collected = []
    for collection in args.collection or _ALL_COLLECTIONS:
        if collection.startswith('client'):
            table = collection[len(_CLIENT_PREFIX):]
            logging.info(
                'Collecting strings for client%s…', f' table "{table}"' if table else '')
            collector.collect_for_client(table)
            continue
        try:
            importer = import_status.IMPORTERS[collection]
        except KeyError:
            logging.warning('The collection "%s" does not have an importer.', collection)
            collections_not_collected.append(collection)
            continue
        if importer.script != 'airtable_to_protos':
            logging.warning(
                'The collection "%s" does not import from Airtable', collection)
            collections_not_collected.append(collection)
            continue
        logging.info('Collecting strings for importer "%s"…', collection)
        num_failed_records = collector.collect_for_airtable_importer(**(importer.args or {}))
        if num_failed_records:
            collection_errors[collection] = num_failed_records

    _handle_unused_translations(collector, args.unused)
    error_text = ''
    if collections_not_collected:
        error_text += f'Strings not collected for {collections_not_collected}.'
    if collection_errors:
        errors = '\n'.join([f'{coll}: {collection_errors[coll]}' for coll in collection_errors])
        if not error_text:
            error_text += 'All the collections have been collected.\n'
        error_text += f'Errors in collection:\n{errors}'
    if error_text:
        _print_report(f'Here is the report:\n{error_text}')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
