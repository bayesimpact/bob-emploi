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
        python bob_emploi/data_analysis/importer/airtable_to_protos.py \
        --table action_templates \
        --proto ActionTemplate \
        --mongo_collection action_templates \
        --base_id appXmyc7yYj0pOcae \
        --view viweTj15LzsyrvNqu
"""

import collections
import json
import logging
import os
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Sequence, Set, Tuple, \
    Type, Union

from airtable import airtable
from google.protobuf import json_format
from google.protobuf import message

from bob_emploi.data_analysis.i18n import translation
from bob_emploi.data_analysis.lib import checker
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import driving_license_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import network_pb2
from bob_emploi.frontend.api import online_salon_pb2
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import skill_pb2
from bob_emploi.frontend.api import strategy_pb2
from bob_emploi.frontend.api import testimonial_pb2


# The airtable api key.
_AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')

_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def _group_filter_fields(
        record: Dict[str, Any], field: str = 'filters',
        others: Iterable[str] = ('for-departement', 'for-job-group')) -> List[str]:
    """Group multiple fields to specify filters.

    Args:
        record: the record to convert.
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

    filters = typing.cast(List[str], record.get(field, []))
    if others:
        for filter_type in others:
            filter_value = record.get(filter_type)
            if filter_value:
                filters.append(f'{filter_type}({filter_value})')
    return filters


class _FilterSetSorter(object):
    """A class to compare filter lists to make sure a more restrictive filter list is not
    pre-empted by a looser one.

    It gets completly useless if sorting in airtable2dicts is implemented otherwise.
    """

    def __init__(self, record: Dict[str, Any]) -> None:
        self._filters: Set[str] = set(_group_filter_fields(record))

    def __repr__(self) -> str:
        return f"_FilterSetSorter({{'filters': {list(self._filters)!r}}})"

    def __eq__(self, other: Any) -> bool:
        """This does not check equality, but rather incomparability.

        `self == other` means, we have neither `self < other` nor `other < self`.
        This is useful for tuples comparison: when comparing
        (_FilterSetSorter(record1), otherField1) and (_FilterSetSorter(record2), otherField2),
        if the filters sets sorters are incomparable, we want to compare the other field.
        """

        return bool(self._filters - other._filters and other._filters - self._filters)

    def __lt__(self, other: Any) -> bool:
        return not other._filters - self._filters


_BEFORE_TRANSLATION_CHECKERS: Dict['options_pb2.StringFormat', checker.ValueChecker] = {
    options_pb2.SCORING_MODEL_ID: checker.ScorerChecker(),
    options_pb2.URL_FORMAT: checker.UrlChecker(),
    options_pb2.SCORING_PROJECT_TEMPLATE: checker.MissingTemplateVarsChecker(),
    options_pb2.PARTIAL_SENTENCE: checker.PartialSentenceChecker(),
}


ConverterType = typing.TypeVar('ConverterType', bound='ProtoAirtableConverter')


class ProtoAirtableConverter(object):
    """A converter for Airtable records to proto-JSON formatted dict."""

    def __init__(
            self, proto_type: Type[message.Message],
            id_field: Optional[str] = None,
            required_fields: Iterable[str] = (),
            unique_field_tuples: Iterable[Iterable[str]] = ()) -> None:
        self._proto_type = proto_type
        self._id_field = id_field
        self._required_fields_set = set(required_fields)
        self._snake_to_camelcase = {
            name: field.camelcase_name for name, field in
            self.proto_type.DESCRIPTOR.fields_by_name.items()}
        if id_field:
            assert self.snake_to_camelcase[id_field]
        self.checkers: List[checker.Checker] = []
        self.add_checkers(
            checker.QuotesChecker(),
            checker.SpacesChecker())
        self._split_fields_separators: Dict[str, str] = {}
        # Sort key shouldn't be used anywhere else than airtable2dicts, since some implementations
        # depend on how it's used there.
        self.sort_key = self._sort_key
        self._unarray_fields: Iterable[str] = ()
        self._unique_field_tuples = list(unique_field_tuples)

    proto_type = property(lambda self: self._proto_type)
    id_field = property(lambda self: self._id_field)
    required_fields_set = property(lambda self: self._required_fields_set)
    snake_to_camelcase = property(lambda self: self._snake_to_camelcase)

    def convert_record(self, airtable_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready.

        Returns:
            - A dict proto-JSON ready
        Raises:
            - ValueError, KeyError if unexpected behavior is met.
        """

        fields = self._record2dict(airtable_record)
        split = self._split_fields(fields)
        return self._get_array_heads(split)

    def convert_record_to_proto(self, airtable_record: Dict[str, Any]) \
            -> Tuple[message.Message, str]:
        """Convert an airtable record to an actual proto message.

        Also runs all the necessary checks on it.
        """

        fields = self.convert_record(airtable_record)
        proto = self.proto_type()
        _id = fields.pop('_id', None)
        try:
            json_format.ParseDict(fields, proto)
        except json_format.ParseError as error:
            raise ValueError(f'Error while parsing:\n{json.dumps(fields, indent=2)}\n{error}')
        if _has_any_check_error(proto, _id, self.checkers, _BEFORE_TRANSLATION_CHECKERS):
            # Errors messages are already logged in the function.
            raise ValueError()
        return proto, _id

    def add_checkers(self: ConverterType, *checkers: checker.Checker) -> ConverterType:
        """Add checkers to this converter.

        Returns the updated converter.
        """

        for new_checker in checkers:
            self.checkers.append(new_checker)
        return self

    def add_split_fields(self: ConverterType, fields: Dict[str, str]) -> ConverterType:
        """Add fields to split after import.

        Split fields are string fields in Airtable, which return an array in the respective proto.
        Args:
            - field_separators: a dict whose keys are the fields to be split, and values are the
                relevant separator.
        Returns:
            The updated converter, for chaining.
        """

        self._split_fields_separators = dict(self._split_fields_separators, **fields)
        return self

    def _split_fields(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        return dict(fields, **{
            field: [s.strip() for s in fields[field].split(separator)]
            for field, separator in self._split_fields_separators.items()
            if field in fields
        })

    def _get_array_heads(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        return dict(fields, **{
            field: fields[field][0]
            for field in self._unarray_fields
            if field in fields and fields[field]
        })

    def _sort_key(self, unused_record: Dict[str, Any]) -> Any:
        """Function to compute the sort key of a record before it's been converted.

        It is only used to check that the sorting is properly done on Airtable.
        """

        return 0

    def unique_keys(self, record: Dict[str, Any]) -> Sequence[Any]:
        """Function to return keys that should be unique among other records."""

        return tuple(
            tuple(record[field] for field in unique_field)
            for unique_field in self._unique_field_tuples
        )

    def set_fields_sorter(
            self: ConverterType, sort_lambda: Callable[[Dict[str, Any]], Any]) \
            -> ConverterType:
        """Set the sorter for this converter."""

        self.sort_key = lambda airtable_record: sort_lambda(airtable_record['fields'])
        return self

    def _record2dict(self, airtable_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready.

        When overriding this method, if some exceptions are triggered because of bad input,
        please raise a ValueError without referencing the record's ID.
        """

        record_id = airtable_record['id']
        proto_fields = set(self.snake_to_camelcase)
        airtable_fields = set(airtable_record['fields'].keys())
        if not airtable_fields & proto_fields:
            raise KeyError(
                f'None of the AirTable fields ({airtable_fields}) correspond to the proto '
                f'fields ({proto_fields})')
        if not airtable_fields >= self.required_fields_set:
            raise KeyError(
                f'Some require fields are missing ({self.required_fields_set - airtable_fields})')

        # Convert all existing fields in the AirTable record to their proto
        # equivalent if they have one. The key (k) is converted to camelCase
        # and the value (v) is untouched.
        fields = {
            self.snake_to_camelcase[k]: v for k, v in airtable_record['fields'].items()
            if k in proto_fields}
        fields['_id'] = record_id
        if self.id_field:
            fields[self.snake_to_camelcase[self.id_field]] = record_id
        return fields

    def set_first_only_fields(self: ConverterType, *fields: str) -> ConverterType:
        """Set fields that need to be changed from list to string, keeping only the first element.
        """

        self._unarray_fields = fields
        return self


# TODO(cyrille): Add check that the list of filters does not contain the same value twice.
class _ProtoAirtableFiltersConverter(ProtoAirtableConverter):

    def __init__(
            self, proto_type: Type[message.Message],
            id_field: Optional[str] = None,
            required_fields: Iterable[str] = ()) -> None:
        super().__init__(proto_type, id_field, required_fields)
        self.add_checkers(checker.TemplateVarsChecker())

    def _record2dict(self, airtable_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super()._record2dict(airtable_record)

        # Populate filters.
        filters = _group_filter_fields(airtable_record['fields'])
        if filters:
            fields['filters'] = filters

        return fields


class _ActionTemplateConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        if 'image' in airtable_record['fields'] and airtable_record['fields']['image']:
            airtable_record['fields']['image_url'] = airtable_record['fields']['image'][0]['url']
        fields = super()._record2dict(airtable_record)

        return fields


def generate_dynamic_advices_changes(markdown_list: str, prefix: str = '', suffix: str = '') \
        -> Dict[str, Union[str, List[str]]]:
    """Generate a list of changes to apply to a dynamic advice record before saving it."""

    if not markdown_list:
        return {}
    result: Dict[str, Union[str, List[str]]] = {}
    if markdown_list.startswith('*'):
        parts: List[str] = ['', markdown_list[1:]]
    else:
        parts = markdown_list.split('\n*', 1)

    if parts[0]:
        result[f'{prefix}Header{suffix}'] = parts[0]

    if len(parts) == 1:
        return result

    items = '*' + parts[1]
    lines = [l.strip() for l in items.split('\n')]
    if not all(l.startswith('* ') for l in lines):
        raise ValueError(
            f'Error in field {prefix + suffix}, it should be a markdown list with one line per '
            f'item\n{markdown_list}')
    result[f'{prefix}Items{suffix}'] = [l[len('* '):] for l in lines]
    return result


class _DynamicAdviceConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super()._record2dict(airtable_record)

        for key, value in generate_dynamic_advices_changes(
                airtable_record['fields'].get('expanded_card_items'),
                prefix='expandedCard').items():
            fields[key] = value
        for key, value in generate_dynamic_advices_changes(
                airtable_record['fields'].get('expanded_card_items_feminine'),
                prefix='expandedCard', suffix='Feminine').items():
            fields[key] = value

        return fields


PROTO_CLASSES: Dict[str, ProtoAirtableConverter] = {
    'ActionTemplate': _ActionTemplateConverter(
        action_pb2.ActionTemplate, 'action_template_id', required_fields=[]),
    'AdviceModule': ProtoAirtableConverter(
        advisor_pb2.AdviceModule, 'airtable_id',
        required_fields=['advice_id', 'trigger_scoring_model']
    ).add_split_fields({'emailFacts': ','}),
    'ApplicationTip': _ProtoAirtableFiltersConverter(
        application_pb2.ApplicationTip, None, required_fields=['content', 'type']),
    'JobBoard': _ProtoAirtableFiltersConverter(
        jobboard_pb2.JobBoard, None, required_fields=['title', 'link']),
    'Association': _ProtoAirtableFiltersConverter(
        association_pb2.Association, None, required_fields=['name', 'link']),
    'DynamicAdvice': _DynamicAdviceConverter(
        advisor_pb2.DynamicAdvice, None,
        required_fields=[
            'title', 'short_title', 'card_text',
            'diagnostic_topics', 'expanded_card_items', 'for-job-group']),
    'ContactLead': _ProtoAirtableFiltersConverter(
        network_pb2.ContactLeadTemplate, None, required_fields=('name', 'email_template')
    ),
    'DiagnosticCategory': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticCategory, None, required_fields=['category_id', 'order']
    ).set_fields_sorter(
        lambda record: (_FilterSetSorter(record), record.get('order'))),
    'DiagnosticSentenceTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'order']
    ).set_fields_sorter(
        lambda record: (record.get('order'), _FilterSetSorter(record), -record.get('priority', 0))),
    # TODO(cyrille): Add a check to avoid paragraphs (\n\n) in sentence_template.
    'DiagnosticTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'score', 'order', 'text_template']
    ).set_fields_sorter(
        lambda record: (record.get('category_id', []), _FilterSetSorter(record), record['order'])
    ).set_first_only_fields('categoryId'),
    'DiagnosticSubmetricSentenceTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'topic']
    ).set_fields_sorter(lambda record: (
        record.get('topic'),
        _FilterSetSorter(record),
        -record.get('priority', 0),
    )),
    'DiagnosticObservation': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=('order', 'sentence_template', 'topic')
    ).set_fields_sorter(lambda record: (record.get('topic'), record['order'])),
    'DiagnosticSubmetricScorer': ProtoAirtableConverter(
        diagnostic_pb2.DiagnosticSubmetricScorer, None,
        required_fields=['submetric', 'weight', 'trigger_scoring_model']
    ).set_fields_sorter(lambda record: (record.get('submetric'))),
    'OneEuroProgramPartnerBank': ProtoAirtableConverter(
        driving_license_pb2.OneEuroProgramPartnerBank,
        None, required_fields=['link', 'logo', 'name']),
    'DrivingSchool': _ProtoAirtableFiltersConverter(
        driving_license_pb2.DrivingSchool, None, required_fields=[]),
    'Testimonial': _ProtoAirtableFiltersConverter(
        testimonial_pb2.Testimonial, None,
        required_fields=['author_name', 'author_job_name', 'description']
    ).add_split_fields({'preferredJobGroupIds': ','}),
    'SalonFilterRule': _ProtoAirtableFiltersConverter(
        online_salon_pb2.SalonFilterRule, None, required_fields=['regexp', 'fields']
    ).add_split_fields({f: ',' for f in ('fields', 'locationIds', 'jobGroupIds')}),
    'Skill': ProtoAirtableConverter(
        skill_pb2.Skill, None, required_fields=('name', 'description')
    ),
    'StrategyModule': ProtoAirtableConverter(
        strategy_pb2.StrategyModule, None,
        required_fields=('trigger_scoring_model', 'title', 'category_ids')),
    'StrategyAdviceTemplate': ProtoAirtableConverter(
        strategy_pb2.StrategyAdviceTemplate, None, required_fields=('advice_id', 'strategy_id'),
        unique_field_tuples=(('strategyId', 'adviceId'),),
    ).set_fields_sorter(lambda record: record.get('strategy_id')).set_first_only_fields(
        'adviceId', 'strategyId'),
}


def airtable2dicts(base_id: str, table: str, proto: str, view: Optional[str] = None) \
        -> List[Dict[str, Any]]:
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
    if not _AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, _AIRTABLE_API_KEY)
    records = list(client.iterate(table, view=view))

    has_error = False
    # If sorting implementation changes, please also change implementation for _FilterSetSorter.
    previous_keys: Dict[str, Any] = {}
    for record in records:
        sort_key = converter.sort_key(record)
        record_id = record['id']
        for previous_id, previous_key in previous_keys.items():
            if sort_key < previous_key:
                logging.error(
                    'Records are not sorted properly: record "%s" with key "%r" should be before '
                    'record "%s" with key "%r".\nGo to Airtable and apply the sorting '
                    'for the view.', record_id, sort_key, previous_id, previous_key)
                has_error = True
        previous_keys[record_id] = sort_key

    proto_records = []
    for record in records:
        try:
            converted = converter.convert_record(record)
        except (ValueError, KeyError) as error:
            has_error = True
            logging.error(
                'An error happened while converting the record %s:\n%s', record.get('id'), error)
            continue
        proto_records.append(converted)

        # Check for records unicity.
    all_unique_keys: Optional[Sequence[Set[Any]]] = None
    for record in proto_records:
        unique_keys = converter.unique_keys(record)
        if all_unique_keys is None:
            all_unique_keys = [set((key,)) for key in unique_keys]
            continue
        if len(unique_keys) != len(all_unique_keys):
            logging.error(
                'The record "%s" with unique keys "%r" does not have the same number of '
                'unique keys than the others (%d).',
                record_id, unique_keys, len(all_unique_keys))
            has_error = True
            continue
        for index, key in enumerate(unique_keys):
            if key in all_unique_keys[index]:
                logging.error(
                    'There are duplicate records for the %d key: "%r" (see record "%s")',
                    index, key, record_id)
                has_error = True
            all_unique_keys[index].add(key)

    has_error |= _has_validation_errors(proto_records, converter.proto_type, converter.checkers)
    if has_error:
        raise mongo.InvalidValueError(
            proto_records, 'Please fix the previous errors before re-importing')
    return proto_records


def _log_error(
        error: Exception, checker_name: str, record_id: str, path: Optional[str] = None) -> None:
    if record_id is None:
        record_ref = ''
    else:
        record_ref = f' in record "{record_id}{f".{path}" if path else ""}"'
    if isinstance(error, checker.FixableValueError):
        logging.error(
            'Check error "%s"%s: %s\nErrors in string: %r\nFixed string:\n%s',
            checker_name, record_ref, error, error.marked_value, error.fixed_value)
    logging.error('Check error "%s"%s:\n%s', checker_name, record_ref, error)


def _has_any_check_error(
        proto: message.Message, _id: str, proto_checkers: List[checker.Checker],
        string_format_checkers: Dict['options_pb2.StringFormat', checker.ValueChecker]) \
        -> bool:
    has_error = False
    # Enforce specific checkers for this proto.
    for proto_checker in proto_checkers:
        try:
            proto_checker.check(proto)
        except ValueError as error:
            has_error = True
            _log_error(error, proto_checker.name, record_id=_id)
    # Enforce string format from Proto option.
    for field_value, path, string_format in checker.collect_formatted_strings(proto):
        value_checker = string_format_checkers.get(string_format)
        if value_checker is None:
            continue
        try:
            value_checker.check_value(field_value)
        except ValueError as error:
            has_error = True
            _log_error(error, value_checker.name, record_id=_id, path=path)
    return has_error


def _get_field_translator(locale: str) -> Callable[[str, str, 'options_pb2.StringFormat'], str]:
    def field_translator(
            sentence: str, unused_path: str, string_format: 'options_pb2.StringFormat') -> str:
        if string_format == options_pb2.NATURAL_LANGUAGE:
            translated = translation.get_translation(sentence, locale)
            if translated is None:
                raise ValueError()
            return translated
        return sentence
    return field_translator


def _translate_proto(proto: _ProtoType) -> Iterator[Tuple[str, _ProtoType]]:
    serialized_proto = proto.SerializeToString()
    for locale in translation.LOCALES_TO_CHECK:
        translated = type(proto)()
        translated.CopyFrom(proto)
        try:
            # Consume the whole iterator,
            # see https://docs.python.org/3/library/itertools.html#itertools-recipes.
            collections.deque(checker.collect_formatted_strings(
                translated, field_modifier=_get_field_translator(locale)
            ), maxlen=0)
        except ValueError:
            # No point in trying to translate in this locale if some translations are missing.
            # We assume TranslationChecker has been run first, so no need for logging an error.
            continue
        # No need to keep a translation if it's identical to the original proto.
        if serialized_proto != translated.SerializeToString():
            yield locale, translated


def _has_validation_errors(
        values: List[Dict[str, Any]],
        proto_class: Type[message.Message],
        proto_checkers: List[checker.Checker]) -> bool:
    """validates that the values have the right format.

    Args:
        values: an iterable of dict with the JSON values of proto. They may
            have an additional "_id" field that will be ignored.
        proto_class: the Python class of the proto that should be contained in
            the values.
    Returns:
        True if at least an error was found
    """

    format_field_checkers = dict(_BEFORE_TRANSLATION_CHECKERS)
    format_field_checkers[options_pb2.NATURAL_LANGUAGE] = checker.TranslationChecker()
    has_error = False
    for value in values:
        proto = proto_class()
        _id = typing.cast(str, value.pop('_id'))
        # Enforce Proto schema.
        try:
            json_format.ParseDict(value, proto)
        except json_format.ParseError as error:
            has_error = True
            logging.error('Error while parsing:\n%s\n%s', json.dumps(value, indent=2), error)
            continue
        has_error |= _has_any_check_error(proto, _id, proto_checkers, format_field_checkers)
        for locale, translated_proto in _translate_proto(proto):
            has_error |= _has_any_check_error(
                translated_proto,
                f'{_id}:{locale}',
                proto_checkers,
                _BEFORE_TRANSLATION_CHECKERS)
        value['_id'] = _id
    return has_error


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
