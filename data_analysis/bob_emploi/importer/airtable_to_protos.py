"""Importer for AirTable tables.

To use it:
 - Get an API key for you at https://airtable.com/account and set it in your
   environment as AIRTABLE_API_KEY.
 - Find the base ID of your tables (the first ID in the URL when you select it
   in https://airtable.com/api/).
 - Then start your local environment with `docker-compose up frontend-dev`.
 - Finally run this script:
    docker-compose run -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
        --rm data-analysis-prepare \
        python bob_emploi/importer/airtable_to_protos.py \
        --table chantiers \
        --proto Chantier \
        --mongo_collection chantiers \
        --base_id appXmyc7yYj0pOcae \
        --view viwbjlYBDlD1Fd7Ob \
        --mongo_url mongodb://frontend-db/test
    docker-compose run -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
        --rm data-analysis-prepare \
        python bob_emploi/importer/airtable_to_protos.py \
        --table action_templates \
        --proto ActionTemplate \
        --mongo_collection action_templates \
        --base_id appXmyc7yYj0pOcae \
        --view viweTj15LzsyrvNqu \
        --mongo_url mongodb://frontend-db/test
"""
import collections
import json
import os
import re

from airtable import airtable

from google.protobuf import json_format

from bob_emploi.lib import mongo
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import network_pb2

# Regular expression to validate links, e.g http://bayesimpact.org. Keep in
# sync with frontend/src/store/link.js.
_LINK_REGEXP = re.compile(r'^[^/]+://[^/]*[^/.](?:/|$)')


class _ProtoAirtableConverter(collections.namedtuple(
        'ProtoCsvDescriptor', ['proto_type', 'id_field', 'required_fields'])):

    def __new__(cls, *args, **kwargs):
        self = super(_ProtoAirtableConverter, cls).__new__(cls, *args, **kwargs)
        self.snake_to_camelcase = {
            name: field.camelcase_name for name, field in
            self.proto_type.DESCRIPTOR.fields_by_name.items()}
        if self.id_field:
            assert self.snake_to_camelcase[self.id_field]
        self.required_fields_set = set(self.required_fields)
        return self

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        record_id = airtable_record['id']
        proto_fields = set(self.snake_to_camelcase)
        airtable_fields = set(airtable_record['fields'].keys())
        if not airtable_fields & proto_fields:
            raise KeyError(
                'None of the AirTable fields ({}) correspond to the proto '
                'fields ({})'.format(airtable_fields, proto_fields))
        if not airtable_fields >= self.required_fields_set:
            raise KeyError(
                'Some require fields are missing ({}) in the record: {}'
                .format(self.required_fields_set - airtable_fields, airtable_record))

        # Convert all existing fields in the AirTable record to their proto
        # equivalent if they have one. The key (k) is converted to camelCase
        # and the value (v) is untouched.
        fields = {
            self.snake_to_camelcase[k]: v
            for k, v in airtable_record['fields'].items()
            if k in proto_fields}
        fields['_id'] = record_id
        if self.id_field:
            fields[self.snake_to_camelcase[self.id_field]] = record_id
        return fields

    def _group_filter_fields(self, record, record_name, field='filters', others=None):
        """Group multiple fields to specify filters.

        Args:
            record: the record to convert.
            record_name: the name of the type of record for error messages.
            field: the main field for filters, it should contain an array of
                filter IDs.
            others: a list of fields which, if not empty, create extra fields
                by combining the field name and their content, e.g.
                "for-departement" with value "75,69" would add a filter
                "for-departement(75,69)".
        Returns:
            A list of valid filters.
        Raises:
            ValueError: if one the filter is not implemented.
        """
        filters = record['fields'].get(field, [])
        if others:
            for filter_type in others:
                filter_value = record['fields'].get(filter_type)
                if filter_value:
                    filters.append('{}({})'.format(filter_type, filter_value))
        for one_filter in filters:
            if not scoring.get_scoring_model(one_filter):
                raise ValueError(
                    '{} uses the filter "{}" that is not implemented yet'
                    .format(record_name, one_filter))
        return filters


class _ActionTemplateConverter(_ProtoAirtableConverter):

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        if 'image' in airtable_record['fields'] and airtable_record['fields']['image']:
            airtable_record['fields']['image_url'] = airtable_record['fields']['image'][0]['url']
        fields = super(_ActionTemplateConverter, self).convert_record(airtable_record)
        link = fields.get('link')
        if link and not _LINK_REGEXP.match(link):
            raise ValueError(
                'Action template "{}" has an irregular link: {}.'.format(fields['_id'], link))

        # Populate filters.
        filters = self._group_filter_fields(
            airtable_record, 'Action template "{}"'.format(fields['_id']))
        if filters:
            fields['filters'] = filters

        return fields


class _AdviceModuleConverter(_ProtoAirtableConverter):

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        fields = super(_AdviceModuleConverter, self).convert_record(airtable_record)
        trigger_scoring_model = fields.get('triggerScoringModel')
        if not scoring.get_scoring_model(trigger_scoring_model):
            raise ValueError(
                'Advice module "{}" uses the scoring model "{}" that is not implemented yet'
                .format(fields['_id'], trigger_scoring_model))
        if 'emailFacts' in fields:
            fields['emailFacts'] = fields['emailFacts'].split('\n')
        return fields


class _FilteredLinkConverter(_ProtoAirtableConverter):

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        fields = super(_FilteredLinkConverter, self).convert_record(airtable_record)

        # Populate filters.
        filters = self._group_filter_fields(
            airtable_record, 'The link "{}"'.format(fields['_id']),
            others=('for-departement', 'for-job-group'))
        if filters:
            fields['filters'] = filters

        # Check link.
        link = fields.get('link')
        if link and not _LINK_REGEXP.match(link):
            raise ValueError(
                'Job Board "{}" has an irregular link: {}.'.format(fields['_id'], link))
        return fields


class _ContactLeadConverter(_ProtoAirtableConverter):

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        fields = super(_ContactLeadConverter, self).convert_record(airtable_record)

        # Populate filters.
        filters = self._group_filter_fields(
            airtable_record, 'The contact lead "{}"'.format(fields['_id']),
            others=('for-departement', 'for-job-group'))
        if filters:
            fields['filters'] = filters

        # TODO(pascal): Check that template vars are all implemented.

        return fields


class _DynamicAdviceConverter(_FilteredLinkConverter):

    def _split_list_field(self, markdown_list, fields, prefix, suffix=''):
        if not markdown_list:
            return
        if markdown_list.startswith('*'):
            parts = ('', markdown_list[1:])
        else:
            parts = markdown_list.split('\n*', 1)

        if parts[0]:
            fields['{}Header{}'.format(prefix, suffix)] = parts[0]

        if len(parts) == 1:
            return

        items = '*' + parts[1]
        lines = [l.strip() for l in items.split('\n')]
        if not all(l.startswith('* ') for l in lines):
            raise ValueError(
                'Error in field {}, it should be a markdown list with one line per item\n{}'
                .format(prefix + suffix, markdown_list))
        fields['{}Items{}'.format(prefix, suffix)] = [l[len('* '):] for l in lines]

    def convert_record(self, airtable_record):
        """Convert an AirTable record to a dict proto-Json ready."""
        fields = super(_DynamicAdviceConverter, self).convert_record(airtable_record)

        self._split_list_field(
            airtable_record['fields'].get('expanded_card_items'),
            fields, prefix='expandedCard')
        self._split_list_field(
            airtable_record['fields'].get('expanded_card_items_feminine'),
            fields, prefix='expandedCard', suffix='Feminine')

        return fields


PROTO_CLASSES = {
    'Chantier': _ProtoAirtableConverter(
        chantier_pb2.Chantier, 'chantier_id', required_fields=[]),
    'ActionTemplate': _ActionTemplateConverter(
        action_pb2.ActionTemplate, 'action_template_id', required_fields=[]),
    'AdviceModule': _AdviceModuleConverter(
        advisor_pb2.AdviceModule, 'airtable_id',
        required_fields=['advice_id', 'trigger_scoring_model']),
    'ApplicationTip': _FilteredLinkConverter(
        application_pb2.ApplicationTip, None, required_fields=['content', 'type']),
    'JobBoard': _FilteredLinkConverter(
        jobboard_pb2.JobBoard, None, required_fields=['title', 'link']),
    'Association': _FilteredLinkConverter(
        association_pb2.Association, None, required_fields=['name', 'link']),
    'DynamicAdvice': _DynamicAdviceConverter(
        advisor_pb2.DynamicAdvice, None,
        required_fields=['title', 'card_text', 'expanded_card_items', 'for-job-group']),
    'ContactLead': _ContactLeadConverter(
        network_pb2.ContactLeadTemplate, None, required_fields=('name', 'email_template')),
}


def airtable2dicts(base_id, table, proto, view=None):
    """Import the suggestions in MongoDB.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
        proto: the name of the proto type.
        view: optional - the name of the view to import.
    Returns:
        an iterable of dict with the JSON values of the proto.
    """
    converter = PROTO_CLASSES[proto]
    api_key = os.getenv('AIRTABLE_API_KEY')
    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, api_key)
    records = client.iterate(table, view=view)

    proto_records = [converter.convert_record(r) for r in records]
    return validate(proto_records, converter.proto_type)


def validate(values, proto_class):
    """Validate that the values have the right format.

    Args:
        values: an iterable of dict with the JSON values of proto. They may
            have an additional "_id" field that will be ignored.
        proto_class: the Python class of the proto that should be contained in
            the values.
    Returns:
        the input for chainability
    Raises:
        ValueError if one of the values doesn't have the right format.
    """
    for value in values:
        proto = proto_class()
        _id = value.pop('_id', None)
        # Enforce Proto schema.
        try:
            json_format.Parse(json.dumps(value), proto)
        except json_format.ParseError as error:
            raise ValueError('Error while parsing:\n{}\n{}'.format(
                json.dumps(value, indent=2), error))
        if _id is not None:
            value['_id'] = _id
    return values


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')  # pragma: no-cover
