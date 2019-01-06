"""Collect the strings to translate.

docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" data-analysis-prepare \
    python bob_emploi/data_analysis/i18n/collect_strings.py
"""

import argparse
import collections
import logging
import os
import typing

from airtable import airtable

from bob_emploi.frontend.api import options_pb2
from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.importer import import_status

_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'
_BOB_ADVICE_BASE_ID = 'appXmyc7yYj0pOcae'
_ROME_BASE_ID = 'appMRMtWV61Kibt37'


class StringCollector(object):
    """A helper to collect string to translate."""

    def __init__(self, api_key: str) -> None:
        self._i18n_base = airtable.Airtable(_I18N_BASE_ID, api_key)
        self._existing_translations = {
            record['fields'].get('string'): record
            for record in self._i18n_base.iterate('translations')
        }
        self._api_key = api_key
        self.bases: typing.Dict[str, airtable.Airtable] = {}
        self._collected: typing.Dict[str, typing.Dict[str, str]] = \
            collections.defaultdict(lambda: collections.defaultdict(str))
        self._used_translations: typing.Set[str] = set()

    def _get_base(self, base_id: str) -> airtable.Airtable:
        if base_id not in self.bases:
            self.bases[base_id] = airtable.Airtable(base_id, self._api_key)
        return self.bases[base_id]

    def collect_string(self, text: str, origin: str, origin_id: str) -> None:
        """Collect a string to translate."""

        self._collected[origin or ''][origin_id or ''] = text
        self._used_translations.add(text)
        if text in self._existing_translations:
            # TODO(pascal): Keep track of all places where it is used.
            return
        fields = {
            'origin': origin,
            'origin_id': origin_id,
            'string': text,
        }
        logging.info('Uploading text: %s', text)
        record = self._i18n_base.create('translations', fields)
        self._existing_translations[text] = record

    def collect_from_table(
            self, base_id: str, table: str, fields: typing.Iterable[str],
            id_field: typing.Optional[str] = None) -> None:
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
        for record in base.iterate(table):
            for field in fields:
                text = record['fields'].get(field)
                if not text:
                    continue
                origin_id = record['id']
                if id_field:
                    origin_id = record['fields'].get(id_field) or origin_id
                self.collect_string(text, '{}:{}'.format(table, field), origin_id)

    def collect_for_airtable_importer(
            self, base_id: str, table: str, proto: str,
            view: typing.Optional[str] = None) -> None:
        """Collect all strings needed for a given import."""

        converter = airtable_to_protos.PROTO_CLASSES[proto]

        # Check whether the proto type has any translatable fields.
        for field in converter.proto_type.DESCRIPTOR.fields_by_name.values():
            field_string_formats = field.GetOptions().Extensions[options_pb2.string_format]
            if options_pb2.NATURAL_LANGUAGE in field_string_formats:
                break
            # TODO(cyrille): Detect fields needing translations even if they are nested.
        else:
            # No translatable field in the proto.
            return

        for record in self._get_base(base_id).iterate(table, view=view):
            try:
                message, _id = converter.convert_record_to_proto(record)
            except (KeyError, ValueError) as error:
                logging.error('An error occurred while converting the record:\n\t%s', str(error))
                continue
            for value, path, string_format in airtable_to_protos.collect_formatted_strings(message):
                if string_format == options_pb2.NATURAL_LANGUAGE:
                    self.collect_string(value, '{}:{}'.format(table, path), _id)

    def collect_for_client(self) -> None:
        """Collect all strings needed client-side.

        Developers, please keep in sync with translatable fields in frontend/client/download.js
        """

        self.collect_from_table(_BOB_ADVICE_BASE_ID, 'advice_modules', (
            'explanations (for client)',
            'goal',
            'title',
            'title_3_stars',
            'title_2_stars',
            'title_1_star',
            'user_gain_details',
        ), 'advice_id')
        self.collect_from_table(_BOB_ADVICE_BASE_ID, 'email_templates', (
            'reason',
            'title',
        ))
        self.collect_from_table(_ROME_BASE_ID, 'Event Types', (
            'event_location_prefix',
            'event_location',
        ))

    def list_unused_translations(
            self, is_restricted_to_same_origin: bool = True) \
            -> typing.Iterator[typing.Tuple[typing.Dict[str, typing.Any], typing.Optional[str]]]:
        """List all the translations that are in the DB but have not been collected in this run.

        Args:
            is_restricted_to_same_origin: if True, we will only list
            translations that have the same origin as one of the origins used
            when collecting.
        Yield:
            for each unused translation, a tuple with the translation record
            field (whose keys are whithin string, origin and origin_id) and the
            new value if any.
        """

        unused_translations = self._existing_translations.keys() - self._used_translations
        for unused_translation in unused_translations:
            record = self._existing_translations[unused_translation]
            fields = record['fields']
            if is_restricted_to_same_origin and not fields.get('origin') in self._collected:
                continue
            new_value = self._collected.get(fields.get('origin', ''), {})\
                .get(fields.get('origin_id'))
            yield record, new_value

    def remove(self, record: typing.Dict[str, typing.Any]) -> None:
        """Remove a translation record."""

        del self._existing_translations[record['fields']['string']]
        record_id = record.get('id')
        if record_id is None:
            logging.error('Missing ID in record: %s', record)
            return
        self._i18n_base.delete('translations', record_id)


def _handle_unused_translations(
        collector: StringCollector, action: str = 'list', has_collected_all: bool = False) -> None:
    if action == 'ignore':
        return

    unused_translations = collector.list_unused_translations(
        is_restricted_to_same_origin=not has_collected_all)
    for record, new_value in unused_translations:
        if action == 'list':
            fields: typing.Dict[str, typing.Any] = collections.defaultdict(str)
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


_ALL_COLLECTION_NAMES = ('client',) + tuple(
    collection
    for collection, importer in import_status.IMPORTERS.items()
    if importer.script == 'airtable_to_protos'
)


def main(string_args: typing.Optional[typing.List[str]] = None) -> None:
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

    for collection in args.collection or _ALL_COLLECTION_NAMES:
        if collection == 'client':
            logging.info('Collecting strings for client…')
            collector.collect_for_client()
            continue
        try:
            importer = import_status.IMPORTERS[collection]
        except KeyError:
            logging.warning('The collection "%s" does not have an importer.', collection)
            continue
        if importer.script != 'airtable_to_protos':
            logging.warning(
                'The collection "%s" does not import from Airtable', collection)
            continue
        logging.info('Collecting strings for importer "%s"…', collection)
        collector.collect_for_airtable_importer(**(importer.args or {}))

    _handle_unused_translations(collector, args.unused, not args.collection)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
