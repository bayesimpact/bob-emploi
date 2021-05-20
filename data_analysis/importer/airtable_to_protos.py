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
import re
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, \
    Set, Tuple, Type, Union

from airtable import airtable
from google.protobuf import json_format
from google.protobuf import message
import requests

from bob_emploi.data_analysis.i18n import translation
from bob_emploi.data_analysis.lib import checker
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import driving_license_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import network_pb2
from bob_emploi.frontend.api import online_salon_pb2
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import skill_pb2
from bob_emploi.frontend.api import strategy_pb2
from bob_emploi.frontend.api import testimonial_pb2
from bob_emploi.frontend.api import training_pb2


_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def _get_bob_deployment() -> str:
    return os.getenv('BOB_DEPLOYMENT', 'fr')


def _group_filter_fields(
        record: Mapping[str, Any], field: str = 'filters',
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
            If a field exist with the same name prefixed by the BOB_DEPLOYMENT environment variable,
            it will override the default field, e.g.
            "usa:for-job-group" with value "43,60" would add a filter
            "for-job-group(43,60)" even if the "for-job-group" field is set to another value.
    Returns:
        A list of valid filters.
    Raises:
        ValueError: if one the filter is not implemented.
    """

    # TODO(cyrille): Consider adding deployment specific filters.
    filters = typing.cast(List[str], record.get(field, []))
    if others:
        for filter_type in others:
            filter_value = record.get(
                f'{_get_bob_deployment()}:{filter_type}',
                record.get(filter_type))
            if filter_value:
                filters.append(f'{filter_type}({filter_value})')
    unique_filters: Set[str] = set()
    duplicated_filters: Set[str] = set()
    for filter_value in filters:
        if filter_value in unique_filters:
            duplicated_filters.add(filter_value)
        else:
            unique_filters.add(filter_value)
    if duplicated_filters:
        raise ValueError(f'Duplicated filters: {duplicated_filters}')
    return filters


class _FilterSetSorter:
    """A class to compare filter lists to make sure a more restrictive filter list is not
    pre-empted by a looser one.

    It gets completly useless if sorting in airtable2dicts is implemented otherwise.
    """

    def __init__(self, record: Mapping[str, Any]) -> None:
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


_BEFORE_TRANSLATION_CHECKERS: Dict['options_pb2.StringFormat.V', checker.ValueChecker] = {
    options_pb2.LIST_OPTION: checker.ListOptionChecker(),
    options_pb2.MARKUP_LANGUAGE: checker.MarkupChecker(),
    options_pb2.PARTIAL_SENTENCE: checker.PartialSentenceChecker(),
    options_pb2.SCORING_MODEL_ID: checker.ScorerChecker(),
    options_pb2.SCORING_PROJECT_TEMPLATE: checker.MissingTemplateVarsChecker(),
    options_pb2.URL_FORMAT: checker.UrlChecker(),
    options_pb2.MAILING_CAMPAIGN: checker.MailingCampaignChecker(),
    options_pb2.SINGLE_LINER: checker.SingleLinerChecker(),
}


class _RecordId(typing.NamedTuple):
    id: str
    is_airtable_id: bool


ConverterType = typing.TypeVar('ConverterType', bound='ProtoAirtableConverter')


# Pattern to locate just before words in a camel case string.
_CAMEL_CASE_WORDS_RE = re.compile('(?=[A-Z])')


def _convert_to_snake_case(camel_case: str) -> str:
    words = _CAMEL_CASE_WORDS_RE.split(camel_case)
    return '_'.join(word.lower() for word in words)


class ProtoAirtableConverter:
    """A converter for Airtable records to proto-JSON formatted dict.

    Args:
    - proto_type: The type of the Proto we want to save.
    - id_field: A field in the proto where we want to save Airtable record ID
    - required_fields: Fields that cannot be left empty
    - unique_field_tuples: Lists of lists of fields to check for unicity.
        For instance, if it's [('name', 'lastName')], it will check that no two records
        have the same name and lastName. If there's a unique ID in a single field, it should be
        the first item e.g. [('personId',), ('name', 'lastName')].
    """

    def __init__(
            self, proto_type: Type[message.Message],
            id_field: Optional[str] = None,
            required_fields: Union[List[str], Tuple[str, ...]] = (),
            unique_field_tuples: Iterable[Sequence[str]] = ()) -> None:
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

    @property
    def unique_id_field(self) -> Optional[str]:
        """Returns a proto field containing a unique ID if any."""

        if self._unique_field_tuples and len(self._unique_field_tuples[0]) == 1:
            return _convert_to_snake_case(self._unique_field_tuples[0][0])
        return None

    def convert_record(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready.

        Returns:
            - A dict proto-JSON ready
        Raises:
            - ValueError, KeyError if unexpected behavior is met.
        """

        fields = self._record2dict(airtable_record)
        split = self._split_fields(fields)
        return self._get_array_heads(split)

    def convert_record_to_proto(self, airtable_record: airtable.Record[Mapping[str, Any]]) \
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
            raise ValueError(f'Error while parsing:\n{json.dumps(fields, indent=2)}') from error
        if _has_any_check_error(
                proto, _id, self.checkers, _BEFORE_TRANSLATION_CHECKERS, locale='fr'):
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

    def add_split_fields(self: ConverterType, fields: Mapping[str, str]) -> ConverterType:
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

    def _split_fields(self, fields: Mapping[str, Any]) -> Dict[str, Any]:
        return dict(fields, **{
            field: [s.strip() for s in fields[field].split(separator)]
            for field, separator in self._split_fields_separators.items()
            if field in fields
        })

    def _get_array_heads(self, fields: Mapping[str, Any]) -> Dict[str, Any]:
        return dict(fields, **{
            field: fields[field][0]
            for field in self._unarray_fields
            if field in fields and fields[field]
        })

    def _sort_key(self, unused_record: airtable.Record[Mapping[str, Any]]) -> Any:
        """Function to compute the sort key of a record before it's been converted.

        It is only used to check that the sorting is properly done on Airtable.
        """

        return 0

    def unique_keys(self, proto_record: Mapping[str, Any]) -> Sequence[Any]:
        """Function to return keys that should be unique among other records."""

        try:
            return tuple(
                tuple(proto_record[field] for field in unique_field)
                for unique_field in self._unique_field_tuples
            )
        except KeyError as error:
            if '_' in error.args[0]:
                raise ValueError('Use camelCased field names in unique_field_tuples') from error
            raise

    def set_fields_sorter(
            self: ConverterType, sort_lambda: Callable[[Mapping[str, Any]], Any]) \
            -> ConverterType:
        """Set the sorter for this converter."""

        self.sort_key = lambda airtable_record: sort_lambda(airtable_record['fields'])
        return self

    def _record2dict(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
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

    def has_validation_errors(
            self,
            collection_name: str,
            values: Iterable[Mapping[str, Any]]) -> bool:
        """validates that the values have the right format.

        Args:
            values: an iterable of dict with the JSON values of proto. They may
                have an additional "_id" field that will be ignored.
            proto_class: the Python class of the proto that should be contained in
                the values.
        Returns:
            True if at least an error was found
        """

        namespace = translation.get_collection_namespace(collection_name)
        translation_checker = checker.TranslationChecker(namespace, self.unique_id_field)
        has_error = False
        for value in values:
            _id = typing.cast(str, value['_id'])
            # Enforce Proto schema.
            proto = self.proto_type()
            prepared_value = {k: v for k, v in value.items() if k != '_id' and k != '_order'}
            try:
                json_format.ParseDict(prepared_value, proto)
            except json_format.ParseError as error:
                has_error = True
                logging.error('Error while parsing:\n%s\n%s', json.dumps(value, indent=2), error)
                continue
            has_error |= _has_any_check_error(
                proto, _id, self.checkers + [translation_checker], _BEFORE_TRANSLATION_CHECKERS,
                locale='fr')
            for locale, translated_proto in self._translate_proto(namespace, proto):
                has_error |= _has_any_check_error(
                    translated_proto,
                    f'{_id}:{locale}',
                    self.checkers,
                    _BEFORE_TRANSLATION_CHECKERS,
                    locale=locale)
        return has_error

    def _translate_proto(self, namespace: str, proto: _ProtoType) \
            -> Iterator[Tuple[str, _ProtoType]]:
        unique_id_field = self.unique_id_field
        proto_id = getattr(proto, unique_id_field) if unique_id_field else None

        for locale in translation.LOCALES_TO_CHECK:

            def _field_translator(
                    sentence: str, path: str, string_format: 'options_pb2.StringFormat.V') \
                    -> str:
                if string_format == options_pb2.NATURAL_LANGUAGE:
                    if proto_id:
                        sentence = translation.create_translation_key(namespace, proto_id, path)
                    translated = translation.get_translation(sentence, locale)  # pylint: disable=cell-var-from-loop
                    if translated is None:
                        raise ValueError()
                    return translated
                return sentence

            translated = type(proto)()
            translated.CopyFrom(proto)
            try:
                # Consume the whole iterator,
                # see https://docs.python.org/3/library/itertools.html#itertools-recipes.
                collections.deque(checker.collect_formatted_strings(
                    translated, field_modifier=_field_translator
                ), maxlen=0)
            except ValueError:
                # No point in trying to translate in this locale if some translations are missing.
                # We assume TranslationChecker has been run first, so no need for logging an error.
                continue
            yield locale, translated


# TODO(cyrille): Make sure the filters field may be required.
class _ProtoAirtableFiltersConverter(ProtoAirtableConverter):

    def __init__(
            self, proto_type: Type[message.Message],
            id_field: Optional[str] = None,
            required_fields: Union[List[str], Tuple[str, ...]] = (),
            unique_field_tuples: Iterable[Sequence[str]] = ()) -> None:
        super().__init__(proto_type, id_field, required_fields, unique_field_tuples)
        self.add_checkers(checker.TemplateVarsChecker())

    def _record2dict(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super()._record2dict(airtable_record)

        # Populate filters.
        filters = _group_filter_fields(airtable_record['fields'])
        if filters:
            fields['filters'] = filters

        return fields


class _ActionTemplateConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        updated_airtable_record = airtable_record
        if 'image' in airtable_record['fields'] and airtable_record['fields']['image']:
            updated_airtable_record = typing.cast(
                airtable.Record[Mapping[str, Any]], dict(
                    typing.cast(Mapping[str, Any], airtable_record),
                    fields=dict(
                        airtable_record['fields'],
                        image_url=airtable_record['fields']['image'][0]['url'])))
        fields = super()._record2dict(updated_airtable_record)

        return fields


class _CampaignConverter(ProtoAirtableConverter):

    def _record2dict(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super()._record2dict(airtable_record)

        # Favor strategy.
        strategies = airtable_record['fields'].get('favor-strategy', [])
        if strategies:
            existing_scoring_model = fields.get('scoringModel')
            if existing_scoring_model and existing_scoring_model != 'favor-strategy':
                raise ValueError('Conflict between "favor-strategy" and "scoring_model" fields')
            fields['scoringModel'] = f'favor-strategy({",".join(strategies)})'

        return fields


def generate_dynamic_advices_changes(
        markdown_list: Optional[str], prefix: str = '', suffix: str = '') \
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
    lines = [line.strip() for line in items.split('\n')]
    if not all(line.startswith('* ') for line in lines):
        raise ValueError(
            f'Error in field {prefix + suffix}, it should be a markdown list with one line per '
            f'item\n{markdown_list}')
    result[f'{prefix}Items{suffix}'] = [line[len('* '):] for line in lines]
    return result


class _DynamicAdviceConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
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
        required_fields=['advice_id', 'trigger_scoring_model'],
        unique_field_tuples=(('adviceId',),),
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
            'title', 'short_title', 'card_text', 'id',
            'diagnostic_topics', 'expanded_card_items', f'{_get_bob_deployment()}:for-job-group'],
        unique_field_tuples=(('id',),)),
    'ContactLead': _ProtoAirtableFiltersConverter(
        network_pb2.ContactLeadTemplate, None, required_fields=('name', 'email_template')
    ),
    'DiagnosticMainChallenge': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticMainChallenge, None,
        required_fields=['category_id', 'order', 'description'],
        unique_field_tuples=(('categoryId',),),
    ).set_fields_sorter(
        lambda record: (_FilterSetSorter(record), record.get('order'))),
    'DiagnosticResponse': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticResponse, None,
        required_fields=[
            'response_id', 'self_main_challenge_id', 'bob_main_challenge_id', 'text'],
        unique_field_tuples=(('responseId',), ('selfMainChallengeId', 'bobMainChallengeId')),),
    'DiagnosticTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'score', 'order', 'text_template', 'category_id']
    ).set_fields_sorter(
        lambda record: (record.get('category_id', []), _FilterSetSorter(record), record['order'])
    ).set_first_only_fields('categoryId'),
    'Campaign': _CampaignConverter(email_pb2.Campaign, required_fields=('campaign_id',)),
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
        required_fields=('trigger_scoring_model', 'title', 'category_ids'),
        unique_field_tuples=(('strategyId',),)),
    'StrategyAdviceTemplate': ProtoAirtableConverter(
        strategy_pb2.StrategyAdviceTemplate, None, required_fields=('advice_id', 'strategy_id'),
        unique_field_tuples=(('strategyId', 'adviceId'),),
    ).set_fields_sorter(lambda record: record.get('strategy_id')).set_first_only_fields(
        'adviceId', 'strategyId'),
    'Training': _ProtoAirtableFiltersConverter(
        training_pb2.Training, None, required_fields=['name', 'url']),
}


def airtable2dicts(
        *, collection_name: str,
        base_id: str, table: str, proto: str, view: Optional[str] = None,
        alt_table: Optional[str] = None) -> List[Dict[str, Any]]:
    """Import the suggestions in MongoDB.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
        alt_table: an alternative name of the table if the main one is not available (useful for
            renaming).
        proto: the name of the proto type.
        view: optional - the name of the view to import.
    Returns:
        an iterable of dict with the JSON values of the proto.
    """

    api_key = os.getenv('AIRTABLE_API_KEY')
    converter = PROTO_CLASSES[proto]
    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, api_key)
    try:
        records = list(client.iterate(table, view=view))
    # TODO(pascal): Clean that weird block once Airtable raises the proper error.
    except AttributeError as error:
        if not isinstance(error.__context__, requests.exceptions.HTTPError):
            raise error
        if not alt_table:
            raise error.__context__ from None
        records = list(client.iterate(alt_table, view=view))
    except requests.exceptions.HTTPError:
        if not alt_table:
            raise
        records = list(client.iterate(alt_table, view=view))

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

    all_unique_keys: Optional[Sequence[Set[Any]]] = None

    proto_records = []
    for order, record in enumerate(records):
        try:
            converted = dict(converter.convert_record(record), _order=order)
        except (ValueError, KeyError) as error:
            has_error = True
            logging.error(
                'An error happened while converting the record %s:\n%s', record.get('id'), error)
            continue
        proto_records.append(converted)

        unique_keys = converter.unique_keys(converted)
        if all_unique_keys is None:
            all_unique_keys = [set((key,)) for key in unique_keys]
            continue
        if len(unique_keys) != len(all_unique_keys):
            logging.error(
                'The record "%s" with unique keys "%r" does not have the same number of '
                'unique keys than the others (%d).',
                record['id'], unique_keys, len(all_unique_keys))
            has_error = True
            continue
        for index, key in enumerate(unique_keys):
            if key in all_unique_keys[index]:
                logging.error(
                    'There are duplicate records for the %d key: "%r" (see record "%s")',
                    index, key, record['id'])
                has_error = True
            all_unique_keys[index].add(key)

    has_error |= converter.has_validation_errors(collection_name, proto_records)
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
    logging.error('Check error "%s"%s:\n%s', checker_name, record_ref, error)


def _has_any_check_error(
        proto: message.Message, _id: str, proto_checkers: Iterable[checker.Checker],
        string_format_checkers: Mapping['options_pb2.StringFormat.V', checker.ValueChecker],
        *, locale: str) -> bool:
    has_error = False
    # Enforce specific checkers for this proto.
    for proto_checker in proto_checkers:
        try:
            proto_checker.check(proto, locale)
        except ValueError as error:
            has_error = True
            _log_error(error, proto_checker.name, record_id=_id)
    # Enforce string format from Proto option.
    for field_value, path, string_format in checker.collect_formatted_strings(proto):
        value_checker = string_format_checkers.get(string_format)
        if value_checker is None:
            continue
        try:
            value_checker.check_value(field_value, locale)
        except ValueError as error:
            has_error = True
            _log_error(error, value_checker.name, record_id=_id, path=path)
    return has_error


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
