"""Collect the strings to translate.

docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" data-analysis-prepare \
    python bob_emploi/data_analysis/i18n/collect_strings.py
"""

import argparse
import collections
import itertools
import logging
import os
import typing
from typing import Any, Dict, Iterable, Iterator, List, Optional, Mapping, Set, Tuple

from airtable import airtable
import json5
import requests

from bob_emploi.common.python import now
from bob_emploi.frontend.api import options_pb2
from bob_emploi.data_analysis.i18n import translation
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
    namespace: str
    id_field: Optional[str] = None
    view: Optional[str] = None
    alt_table: Optional[str] = None


def _get_client_collectibles(filename: str) -> Iterator[_Collectible]:
    with open(filename) as fields_file:
        fields = json5.load(fields_file)
    for namespace, collection in fields.items():
        yield _Collectible(
            base_id=collection['base'],
            table=collection['table'],
            fields=tuple(collection['translatableFields']),
            namespace=namespace,
            id_field=collection.get('idField'),
            view=collection['view'],
            alt_table=collection.get('altTable'),
        )


def _convert_snake_to_camel_case(snake: str) -> str:
    words = snake.split('_')
    return words[0] + ''.join(word.title() for word in words[1:])


# List of Airtable fields to collect for translation that will be used client-side.
CLIENT_COLLECTIBLES = tuple(_get_client_collectibles(
    'bob_emploi/frontend/client/airtable_fields.json5'))


def _airtable_fallback_iterate(
        base: airtable.Airtable,
        table: str, view: Optional[str], alt_table: Optional[str]) \
        -> Iterable[airtable.Record[Mapping[str, Any]]]:
    try:
        yield from base.iterate(table, view=view)
        return
    except AttributeError as error:
        if not alt_table:
            raise
        if not isinstance(error.__context__, requests.exceptions.HTTPError):
            raise
    except requests.exceptions.HTTPError:
        if not alt_table:
            raise
    yield from base.iterate(alt_table, view=view)


class StringCollector:
    """A helper to collect string to translate."""

    def __init__(self, api_key: str) -> None:
        self._i18n_base = airtable.Airtable(_I18N_BASE_ID, api_key)
        self._existing_translations: Dict[str, airtable.Record[Mapping[str, Any]]] = {}
        self._duplicate_strings: Dict[str, List[str]] = collections.defaultdict(list)
        for record in self._i18n_base.iterate('translations'):
            key = typing.cast(Dict[str, Optional[str]], record['fields']).get('string')
            if not key:
                continue
            if key in self._existing_translations:
                self._duplicate_strings[self._existing_translations[key]['id']].append(record['id'])
                continue
            self._existing_translations[key] = record
        self._api_key = api_key
        self.bases: Dict[str, airtable.Airtable] = {}
        self._collected: Dict[str, Dict[str, str]] = \
            collections.defaultdict(lambda: collections.defaultdict(str))
        self._used_translations: Set[str] = set()
        self._now = now.get().isoformat() + 'Z'
        self._today = self._now[:len('2020-12-09')]

    @property
    def duplicate_strings(self) -> Mapping[str, List[str]]:
        """Duplicate strings to translate."""

        return self._duplicate_strings

    def _get_base(self, base_id: str) -> airtable.Airtable:
        if base_id not in self.bases:
            self.bases[base_id] = airtable.Airtable(base_id, self._api_key)
        return self.bases[base_id]

    def collect_string(
            self, text: str, origin: str, origin_id: str,
            translations: Optional[Dict[str, str]] = None) -> None:
        """Collect a string to translate."""

        self._collected[origin or ''][origin_id or ''] = text
        is_already_used = text in self._used_translations
        self._used_translations.add(text)
        if text in self._existing_translations:
            if is_already_used:
                return

            existing_record = self._existing_translations[text]
            last_used_str = existing_record['fields'].get('last_used')
            new_translations = {
                lang: value
                for lang, value in translations.items()
                if not existing_record['fields'].get(lang)
            } if translations else {}
            if last_used_str and last_used_str > self._today and not new_translations:
                # Nothing to update.
                return

            update_fields = {'last_used': self._now, 'origin': origin, 'origin_id': origin_id}
            update_fields.update(new_translations)
            self._i18n_base.update('translations', existing_record['id'], update_fields)
            # TODO(pascal): Keep track of all places where it is used.
            return

        fields = {
            'origin': origin,
            'origin_id': origin_id,
            'string': text,
            'last_used': self._now,
        }
        if translations:
            fields.update(translations)
        logging.info('Uploading text: %s', text)
        record = self._i18n_base.create('translations', fields)
        self._existing_translations[text] = record

    def collect_from_table(
            self, base_id: str, table: str, fields: Iterable[str], namespace: str,
            id_field: Optional[str] = None, view: Optional[str] = None,
            alt_table: Optional[str] = None) -> None:
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
        for record in _airtable_fallback_iterate(base, table, view=view, alt_table=alt_table):
            record_fields = record['fields']
            record_id = record['id']
            for field in fields:
                text = record_fields.get(field)
                if not text:
                    continue
                origin_id = record_id
                if id_field:
                    origin_id = record_fields.get(id_field) or origin_id
                self.collect_string(
                    f'{namespace}:{origin_id}:{field}', f'{namespace}:{field}:key', origin_id,
                    translations={'fr': text})

    def collect_for_airtable_importer(
            self, collection: str, base_id: str, table: str, proto: str,
            view: Optional[str] = None, alt_table: Optional[str] = None) -> int:
        """Collect all strings needed for a given import.

        Return:
            The number of errors occured when converting the records.
        """

        namespace = translation.get_collection_namespace(collection)
        converter = airtable_to_protos.PROTO_CLASSES[proto]

        # Check whether the proto type has any translatable fields.
        for field in converter.proto_type.DESCRIPTOR.fields_by_name.values():
            field_string_formats = field.GetOptions().Extensions[options_pb2.string_format]
            if options_pb2.NATURAL_LANGUAGE in field_string_formats:
                break
            # TODO(cyrille): Detect fields needing translations even if they are nested.
        else:
            logging.info('No translatable field in the proto')
            return 0

        num_errors = 0
        base = self._get_base(base_id)
        for record in _airtable_fallback_iterate(base, table, view=view, alt_table=alt_table):
            try:
                message, _id = converter.convert_record_to_proto(record)
            except (KeyError, ValueError) as error:
                logging.error('An error occurred while converting the record:\n\t%s', str(error))
                num_errors += 1
                continue
            if converter.unique_id_field:
                record_id = getattr(message, converter.unique_id_field) or _id
            else:
                record_id = _id
            for value, path, string_format in checker.collect_formatted_strings(message):
                if string_format == options_pb2.NATURAL_LANGUAGE:
                    self.collect_string(value, f'{table}:{path}', record_id)
                    if record_id != _id and '.' not in path:
                        self.collect_string(
                            translation.create_translation_key(namespace, record_id, path),
                            f'{namespace}:{path}:key', record_id, {'fr': value})
        return num_errors

    def collect_for_client(self, table: str = '') -> None:
        """Collect all strings needed client-side."""

        tables_to_collect = [coll for coll in CLIENT_COLLECTIBLES if coll.table == table] or \
            CLIENT_COLLECTIBLES
        for collectible in tables_to_collect:
            self.collect_from_table(*collectible)

    def list_unused_translations(self) \
            -> Iterator[Tuple[airtable.Record[Mapping[str, Any]], Optional[str]]]:
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

    def remove(self, record: airtable.Record[Mapping[str, Any]]) -> None:
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
    for collection, importer in import_status.get_importers().items()
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
            importer = import_status.get_importers()[collection]
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
        num_failed_records = collector.collect_for_airtable_importer(
            collection=collection, **(importer.args or {}))
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
    if collector.duplicate_strings:
        maybe_s = 's' if len(collector.duplicate_strings) > 1 else ''
        error_text += \
            f'Duplicate records found for {len(collector.duplicate_strings)} string{maybe_s}:\n'
        error_text += '\n'.join(
            ' * ' + ', '.join(
                f'<https://airtable.com/tblQL7A5EgRJWhQFo/{rec}|{rec}>'
                for rec in [key] + dupes
            )
            for key, dupes in itertools.islice(collector.duplicate_strings.items(), 5)
        )
    if error_text:
        _print_report(f'Here is the report:\n{error_text}')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
