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
        --view viweTj15LzsyrvNqu \
        --mongo_url mongodb://frontend-db/test
"""

import collections
import json
import logging
import os
import re
import typing

from airtable import airtable
from google.protobuf import json_format
from google.protobuf import message
import mongomock

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.server import scoring
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
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import testimonial_pb2
from bob_emploi.frontend.api import user_pb2


# Regular expression to validate links, e.g http://bayesimpact.org. Keep in
# sync with frontend/src/store/link.js.
_LINK_REGEXP = re.compile(r'^[^/]+://[^/]*[^/.](?:/|$)')

# Matches variables that need to be replaced by populate_template.
_TEMPLATE_VAR = re.compile(r'%\w+')

# Locales we want to ensure we have a translation for.
_LOCALES_TO_CHECK = frozenset({'fr_FR@tu'})

# The airtable api key.
_AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')

# Airtable cache for the translation table as a dict.
_TRANSLATION_TABLE: typing.List[typing.Dict[str, typing.Dict[str, str]]] = []

_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def _get_all_values(field_value: typing.Any) -> typing.Iterator[typing.Any]:
    if isinstance(field_value, str):
        yield field_value
        return
    try:
        yield from field_value[:]
    except TypeError:
        yield field_value


def _get_all_translations() -> typing.Dict[str, typing.Dict[str, str]]:
    if not _TRANSLATION_TABLE:
        translations = {
            record['fields']['string']: record['fields']
            for record in airtable.Airtable(
                'appkEc8N0Bw4Uok43', _AIRTABLE_API_KEY).iterate(
                    'tblQL7A5EgRJWhQFo', view='viwLyQNlJtyD4l45k')
            if 'string' in record['fields']
        }
        _TRANSLATION_TABLE.append(translations)
    return _TRANSLATION_TABLE[0]


def _fetch_missing_translation_locales(string: str) -> typing.Set[str]:
    available_translations = {
        key for key, value in _get_all_translations().get(string, {}).items() if value}
    return set(_LOCALES_TO_CHECK) - available_translations


def _get_translation(string: str, locale: str) -> typing.Optional[str]:
    return _get_all_translations().get(string, {}).get(locale)


def _group_filter_fields(
        record: typing.Dict[str, typing.Any], field: str = 'filters',
        others: typing.Iterable[str] = ('for-departement', 'for-job-group')) -> typing.List[str]:
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

    filters = typing.cast(typing.List[str], record.get(field, []))
    if others:
        for filter_type in others:
            filter_value = record.get(filter_type)
            if filter_value:
                filters.append('{}({})'.format(filter_type, filter_value))
    return filters


class _FilterSetSorter(object):
    """A class to compare filter lists to make sure a more restrictive filter list is not
    pre-empted by a looser one.

    It gets completly useless if sorting in airtable2dicts is implemented otherwise.
    """

    def __init__(self, record: typing.Dict[str, typing.Any]) -> None:
        self._filters: typing.Set[str] = set(_group_filter_fields(record))

    def __eq__(self, other: typing.Any) -> bool:
        """This does not check equality, but rather incomparability.

        `self == other` means, we have neither `self < other` nor `other < self`.
        This is useful for tuples comparison: when comparing
        (_FilterSetSorter(record1), otherField1) and (_FilterSetSorter(record2), otherField2),
        if the filters sets sorters are incomparable, we want to compare the other field.
        """

        # pylint: disable=protected-access
        return bool(self._filters - other._filters and other._filters - self._filters)

    def __lt__(self, other: typing.Any) -> bool:
        # pylint: disable=protected-access
        return not other._filters - self._filters


class Checker(object):
    """Base class for checkers.

    A checker is a simple wrapper for a function which takes a proto message as input and returns
    True if the required check is satisfied.
    """

    # The name of the checker, for logging purposes.
    name: str = 'basic checker'

    # The actual checking function.
    def check(self, unused_proto: message.Message) -> bool:
        """Whether the input proto passes the check or not.

        Raises:
            ValueError - with meaningful message if the check fails
        Returns:
            False if the check fails without any additional information.
            True if the check passes.
        """

        raise NotImplementedError(
            'The checker "{}" has no implementation for its check method.'.format(self.name))


class _ValueChecker(object):
    """Base class for value checkers.

    A value checker is a simple wrapper for a function wich takes a single value as input and
    returns True if the check is satisfied.
    """

    # The name of the checker, for logging purposes.
    name: str = 'basic value checker'

    def check_value(self, unused_value: typing.Any) -> bool:
        """Whether this specific value passes the check or not."""

        raise NotImplementedError(
            'The checker "{}" has no implementation for its check_value method.'.format(self.name))


class _AllStringFieldsChecker(Checker, _ValueChecker):  # pylint: disable=abstract-method
    """Abstract class to inherit when all string fields should be checked by the check_value method.
    """

    def _check_value_augmented(self, field_value: typing.Any, field: str) -> bool:
        try:
            return self.check_value(field_value)
        except ValueError as err:
            raise ValueError(str(err) + ' in the field "{}"'.format(field))

    def check(self, proto: message.Message) -> bool:
        return all(
            self._check_value_augmented(value, field)
            for field in proto.DESCRIPTOR.fields_by_name
            for value in _get_all_values(getattr(proto, field))
            if isinstance(value, str)
        )


class CurlyQuotesChecker(_AllStringFieldsChecker):
    """Checking that imported string fields don't have any curly quotes."""

    name = 'curly quotes checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if '’' in field_value:
            raise ValueError('Curly quotes ’ are not allowed')
        return True


class SpacesChecker(_AllStringFieldsChecker):
    """Checking that imported string fields don't have strippable spaces."""

    name = 'spaces checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if field_value != field_value.strip():
            raise ValueError('Extra spaces at the beginning or end')
        return True


def _create_mock_scoring_project() -> scoring.ScoringProject:
    """Create a mock scoring_project."""

    _db = mongomock.MongoClient().test
    user_profile = user_pb2.UserProfile()
    project = project_pb2.Project()
    features = user_pb2.Features()
    return scoring.ScoringProject(project, user_profile, features, _db)


class MissingTemplateVarsChecker(_ValueChecker):
    """Checking that imported templates don't have undefined template variables."""

    name = 'template variables checker'

    def __init__(self) -> None:
        self._scoring_project = _create_mock_scoring_project()

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not.

        Raises:
            ValueError: if non-implemented template variables are found.
        """

        new_sentence = self._scoring_project.populate_template(field_value)
        missing_templates = _TEMPLATE_VAR.findall(new_sentence)
        if missing_templates:
            raise ValueError(
                'One or more template variables have not been replaced: {}\n'
                .format(', '.join(missing_templates)))
        return True


class TemplateVarsChecker(Checker):
    """Checking that imported templates satisfy all necessary conditions."""

    def __init__(self, filters_field: str = 'filters') -> None:
        self._filters_field = filters_field

    def check(self, proto: message.Message) -> bool:
        """Whether the output dict passes the check or not."""

        for value, path, string_format in collect_formatted_strings(proto):
            if string_format != options_pb2.SCORING_PROJECT_TEMPLATE:
                continue
            # %jobSearchLengthMonthsAtCreation must only appear with the for-active-search
            # filter.
            if '%jobSearchLengthMonthsAtCreation' in value:
                filters = getattr(proto, self._filters_field)
                if 'for-active-search' not in filters:
                    raise ValueError(
                        'String at path "{}" uses the template variable '
                        '"%jobSearchLengthMonthsAtCreation" '
                        'without the necessary filter "for-active-search"'.format(path))
        return True


class TranslationChecker(_ValueChecker):
    """Checking that translatable sentences do have translations."""

    name = 'translation checker'

    def __init__(self) -> None:
        self._has_warned = False

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not.

        Raises:
            ValueError: if a string is not translated in the translation table in Airtable.
        """

        if not self._has_warned:
            self._has_warned = True
            logging.warning(
                'Please, also import translations by running:\n'
                '    docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY '
                'data-analysis-prepare \\\n'
                '        python bob_emploi/data_analysis/importer/import_status.py \\\n'
                '        mongodb://frontend-db/test --run translations')
        if not field_value:
            return True
        missing_translations = _fetch_missing_translation_locales(field_value)
        if not missing_translations:
            return True
        is_plural = len(missing_translations) != 1
        raise ValueError(
            'Please collect all strings by running:\n'
            'docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" '
            'data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/i18n/collect_strings.py\n'
            'Then fill the table at {}.\n'
            '{} translation{} missing for the string\n"{}": {}\n'.format(
                'https://airtable.com/tblQL7A5EgRJWhQFo/viwBe1ySNM4IvXCsN',
                'Some' if is_plural else 'One',
                's are' if is_plural else ' is',
                field_value, ', '.join(missing_translations),
            )
        )


class UrlChecker(_ValueChecker):
    """Check that URL fields are well-formed."""

    name = 'URL format checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if not _LINK_REGEXP.match(field_value):
            raise ValueError('Found an irregular link: "{}"\n'.format(field_value))
        return True


class ScorerChecker(_ValueChecker):
    """Checks that the required fields contain only implemented scorers."""

    name = 'scorer checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if not scoring.get_scoring_model(field_value):
            raise ValueError(
                'The scoring model "{}" is not implemented yet'.format(field_value))
        return True


class _PartialSentenceChecker(_ValueChecker):

    name = 'partial sentence checker'

    def check_value(self, field_value: str) -> bool:
        """Whether the field passes the check or not."""

        if field_value[0].lower() != field_value[0]:
            raise ValueError('The sentence must not be capitalized: "{}"'.format(
                field_value))
        if field_value[-1] in {'.', '!'}:
            raise ValueError(
                'The sentence must not end with a punctuation mark: "{}"'.format(
                    field_value))
        return True


_BEFORE_TRANSLATION_CHECKERS: typing.Dict['options_pb2.StringFormat', _ValueChecker] = {
    options_pb2.SCORING_MODEL_ID: ScorerChecker(),
    options_pb2.URL_FORMAT: UrlChecker(),
    options_pb2.SCORING_PROJECT_TEMPLATE: MissingTemplateVarsChecker(),
    options_pb2.PARTIAL_SENTENCE: _PartialSentenceChecker(),
}


ConverterType = typing.TypeVar('ConverterType', bound='ProtoAirtableConverter')


class ProtoAirtableConverter(object):
    """A converter for Airtable records to proto-JSON formatted dict."""

    def __init__(
            self, proto_type: typing.Type[message.Message],
            id_field: typing.Optional[str] = None,
            required_fields: typing.Iterable[str] = ()) -> None:
        self._proto_type = proto_type
        self._id_field = id_field
        self._required_fields_set = set(required_fields)
        self._snake_to_camelcase = {
            name: field.camelcase_name for name, field in
            self.proto_type.DESCRIPTOR.fields_by_name.items()}
        if id_field:
            assert self.snake_to_camelcase[id_field]
        self.checkers: typing.List[Checker] = []
        self.add_checkers(
            CurlyQuotesChecker(),
            SpacesChecker())
        self._split_fields_separators: typing.Dict[str, str] = {}
        # Sort key shouldn't be used anywhere else than airtable2dicts, since some implementations
        # depend on how it's used there.
        self.sort_key = self._sort_key

    proto_type = property(lambda self: self._proto_type)
    id_field = property(lambda self: self._id_field)
    required_fields_set = property(lambda self: self._required_fields_set)
    snake_to_camelcase = property(lambda self: self._snake_to_camelcase)

    def convert_record(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
        """Convert an AirTable record to a dict proto-Json ready.

        Returns:
            - A dict proto-JSON ready
        Raises:
            - ValueError, KeyError if unexpected behavior is met.
        """

        fields = self._record2dict(airtable_record)
        return self._split_fields(fields)

    def convert_record_to_proto(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Tuple[message.Message, str]:
        """Convert an airtable record to an actual proto message.

        Also runs all the necessary checks on it.
        """

        fields = self.convert_record(airtable_record)
        proto = self.proto_type()
        _id = fields.pop('_id', None)
        try:
            json_format.ParseDict(fields, proto)
        except json_format.ParseError as error:
            raise ValueError('Error while parsing:\n{}\n{}'.format(
                json.dumps(fields, indent=2), error))
        if _has_any_check_error(proto, _id, self.checkers, _BEFORE_TRANSLATION_CHECKERS):
            # Errors messages are already logged in the function.
            raise ValueError()
        return proto, _id

    def add_checkers(self: ConverterType, *checkers: Checker) -> ConverterType:
        """Add checkers to this converter.

        Returns the updated converter.
        """

        for checker in checkers:
            self.checkers.append(checker)
        return self

    def add_split_fields(self: ConverterType, fields: typing.Dict[str, str]) -> ConverterType:
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

    def _split_fields(self, fields: typing.Dict[str, typing.Any]) -> typing.Dict[str, typing.Any]:
        return dict(fields, **{
            field: [s.strip() for s in fields[field].split(separator)]
            for field, separator in self._split_fields_separators.items()
            if field in fields
        })

    def _sort_key(self, unused_record: typing.Dict[str, typing.Any]) -> typing.Any:
        """Function to compute the sort key of a record before it's been converted.

        It is only used to check that the sorting is properly done on Airtable.
        """

        return 0

    def set_fields_sorter(
            self: ConverterType,
            sort_lambda: typing.Callable[[typing.Dict[str, typing.Any]], typing.Any]) \
            -> ConverterType:
        """Set the sorter for this converter."""

        self.sort_key = lambda airtable_record: sort_lambda(airtable_record['fields'])
        return self

    def _record2dict(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
        """Convert an AirTable record to a dict proto-Json ready.

        When overriding this method, if some exceptions are triggered because of bad input,
        please raise a ValueError without referencing the record's ID.
        """

        record_id = airtable_record['id']
        proto_fields = set(self.snake_to_camelcase)
        airtable_fields = set(airtable_record['fields'].keys())
        if not airtable_fields & proto_fields:
            raise KeyError(
                'None of the AirTable fields ({}) correspond to the proto '
                'fields ({})'.format(airtable_fields, proto_fields))
        if not airtable_fields >= self.required_fields_set:
            raise KeyError(
                'Some require fields are missing ({})'
                .format(self.required_fields_set - airtable_fields))

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


# TODO(cyrille): Add check that the list of filters does not contain the same value twice.
class _ProtoAirtableFiltersConverter(ProtoAirtableConverter):

    def __init__(
            self, proto_type: typing.Type[message.Message],
            id_field: typing.Optional[str] = None,
            required_fields: typing.Iterable[str] = ()) -> None:
        super(_ProtoAirtableFiltersConverter, self).__init__(proto_type, id_field, required_fields)
        self.add_checkers(TemplateVarsChecker())

    def _record2dict(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super(_ProtoAirtableFiltersConverter, self)._record2dict(airtable_record)

        # Populate filters.
        filters = _group_filter_fields(airtable_record['fields'])
        if filters:
            fields['filters'] = filters

        return fields


class _ActionTemplateConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        if 'image' in airtable_record['fields'] and airtable_record['fields']['image']:
            airtable_record['fields']['image_url'] = airtable_record['fields']['image'][0]['url']
        fields = super(_ActionTemplateConverter, self)._record2dict(airtable_record)

        return fields


def generate_dynamic_advices_changes(markdown_list: str, prefix: str = '', suffix: str = '') \
        -> typing.Dict[str, typing.Union[str, typing.List[str]]]:
    """Generate a list of changes to apply to a dynamic advice record before saving it."""

    if not markdown_list:
        return {}
    result: typing.Dict[str, typing.Union[str, typing.List[str]]] = {}
    if markdown_list.startswith('*'):
        parts: typing.List[str] = ['', markdown_list[1:]]
    else:
        parts = markdown_list.split('\n*', 1)

    if parts[0]:
        result['{}Header{}'.format(prefix, suffix)] = parts[0]

    if len(parts) == 1:
        return result

    items = '*' + parts[1]
    lines = [l.strip() for l in items.split('\n')]
    if not all(l.startswith('* ') for l in lines):
        raise ValueError(
            'Error in field {}, it should be a markdown list with one line per item\n{}'
            .format(prefix + suffix, markdown_list))
    result['{}Items{}'.format(prefix, suffix)] = [l[len('* '):] for l in lines]
    return result


class _DynamicAdviceConverter(_ProtoAirtableFiltersConverter):

    def _record2dict(self, airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
        """Convert an AirTable record to a dict proto-Json ready."""

        fields = super(_DynamicAdviceConverter, self)._record2dict(airtable_record)

        for key, value in generate_dynamic_advices_changes(
                airtable_record['fields'].get('expanded_card_items'),
                prefix='expandedCard').items():
            fields[key] = value
        for key, value in generate_dynamic_advices_changes(
                airtable_record['fields'].get('expanded_card_items_feminine'),
                prefix='expandedCard', suffix='Feminine').items():
            fields[key] = value

        return fields


PROTO_CLASSES: typing.Dict[str, ProtoAirtableConverter] = {
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
    'DiagnosticSentenceTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'order']
    ).set_fields_sorter(
        lambda record: (record.get('order'), _FilterSetSorter(record), -record.get('priority', 0))),
    # TODO(cyrille): Add a check to avoid paragraphs (\n\n) in sentence_template.
    'DiagnosticTemplate': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticTemplate, None,
        required_fields=['sentence_template', 'score', 'order', 'text_template']
    ).set_fields_sorter(lambda record: (_FilterSetSorter(record), record['order'])),
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
    # TODO(pascal): No need to check for filters.
    'DiagnosticSubmetricScorer': _ProtoAirtableFiltersConverter(
        diagnostic_pb2.DiagnosticSubmetricScorer, None,
        required_fields=['submetric', 'weight', 'trigger_scoring_model']
        ).set_fields_sorter(lambda record: (record.get('submetric'), _FilterSetSorter(record))),
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
    ).add_split_fields({f: ',' for f in ('fields', 'locationIds', 'jobGroupIds')})
}


def airtable2dicts(base_id: str, table: str, proto: str, view: typing.Optional[str] = None) \
        -> typing.List[typing.Dict[str, typing.Any]]:
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
    previous_keys: typing.Dict[str, typing.Any] = {}
    for record in records:
        sort_key = converter.sort_key(record)
        record_id = record['id']
        for previous_id, previous_key in previous_keys.items():
            if sort_key < previous_key:
                logging.error(
                    'Records are not sorted properly: record "%s" should be before record "%s".\n'
                    'go to Airtable and apply the sorting for the view.', record_id, previous_id)
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
    has_error |= _has_validation_errors(proto_records, converter.proto_type, converter.checkers)
    if has_error:
        raise ValueError('Please fix the previous errors before re-importing')
    return proto_records


# TODO(cyrille): Test this function for nested protos, or drop the TYPE_MESSAGE branch entirely.
def collect_formatted_strings(
        proto: message.Message,
        field_modifier: typing.Callable[
            [str, str, 'options_pb2.StringFormat'], str] = lambda s, p, f: s,
        path: typing.Tuple[str, ...] = ()) \
        -> typing.Iterator[typing.Tuple[str, str, 'options_pb2.StringFormat']]:
    """Iterate recursively through all fields of a proto message to find fields with
    specific string formats.

    Args:
    - proto, the proto message from which to collect strings
    - field_modifier, a function to modify fields in place in the proto:
        it is given a string, its path in the proto and its string_format, and should produce
        another string. If a field in the proto has several string_formats, the modifier is applied
        once for each string_format, in the order in which they were declared. Default is no-op.
    - path, a tuple to prepend to all output paths (needed for recursion).
    Yields:
    Triples (collected_string, path_in_object, string_format):
    - collected_string, a string found in a (possibly repeated) field in the proto
    - path, the path where the string can be found in the proto, as a dot-separated string. For
        repeated fields, the index is provided.
    - string_format an options_pb2.StringFormat value that is declared on this field.
    """

    for field_descriptor, value in proto.ListFields():
        next_path = path + (field_descriptor.name,)
        # TODO(pascal): Remove the getattr once
        # https://github.com/dropbox/mypy-protobuf/pull/54 is released.
        this_string_formats = \
            field_descriptor.GetOptions().Extensions[getattr(options_pb2, 'string_format')]
        if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
            if field_descriptor.label == field_descriptor.LABEL_REPEATED:
                try:
                    value.items()
                    # TODO(cyrille): Deal with map types.
                    logging.warning('Ignoring a map field: %s', '.'.join(next_path))
                    continue
                except TypeError:
                    pass
                for index, repeated_value in enumerate(value):
                    yield from collect_formatted_strings(
                        repeated_value, field_modifier, next_path + (str(index), ))
            else:
                yield from collect_formatted_strings(value, field_modifier, next_path)
            continue
        for string_format in this_string_formats:
            if field_descriptor.label == field_descriptor.LABEL_REPEATED:
                for index, repeated_value in enumerate(value):
                    to_yield = repeated_value, '.'.join(next_path + (str(index), )), string_format
                    value[index] = field_modifier(*to_yield)
                    yield to_yield
            else:
                to_yield = value, '.'.join(next_path), string_format
                updated_value = field_modifier(*to_yield)
                setattr(proto, field_descriptor.name, updated_value)
                yield to_yield
                # Pass the updated value to the next iteration of the this_string_formats loop.
                value = updated_value


def _log_error(
        error: Exception,
        checker_name: str,
        record_id: str,
        path: typing.Optional[str] = None) -> None:
    if record_id is None:
        record_ref = ''
    else:
        record_ref = ' in record "{}{}"'.format(record_id, '.{}'.format(path) if path else '')
    logging.error('Check error "%s"%s:\n%s', checker_name, record_ref, error)


def _has_any_check_error(
        proto: message.Message, _id: str, proto_checkers: typing.List[Checker],
        string_format_checkers: typing.Dict['options_pb2.StringFormat', _ValueChecker]) -> bool:
    has_error = False
    # Enforce specific checkers for this proto.
    for checker in proto_checkers:
        try:
            checker.check(proto)
        except ValueError as error:
            has_error = True
            _log_error(error, checker.name, record_id=_id)
    # Enforce string format from Proto option.
    for field_value, path, string_format in collect_formatted_strings(proto):
        value_checker = string_format_checkers.get(string_format)
        if value_checker is None:
            continue
        try:
            value_checker.check_value(field_value)
        except ValueError as error:
            has_error = True
            _log_error(error, value_checker.name, record_id=_id, path=path)
    return has_error


def _get_field_translator(locale: str) \
        -> typing.Callable[[str, str, 'options_pb2.StringFormat'], str]:
    def field_translator(
            sentence: str, unused_path: str, string_format: 'options_pb2.StringFormat') -> str:
        if string_format == options_pb2.NATURAL_LANGUAGE:
            translated = _get_translation(sentence, locale)
            if translated is None:
                raise ValueError()
            return translated
        return sentence
    return field_translator


def _translate_proto(proto: _ProtoType) -> typing.Iterator[typing.Tuple[str, _ProtoType]]:
    serialized_proto = proto.SerializeToString()
    for locale in _LOCALES_TO_CHECK:
        translation = type(proto)()
        translation.CopyFrom(proto)
        try:
            # Consume the whole iterator,
            # see https://docs.python.org/3/library/itertools.html#itertools-recipes.
            collections.deque(collect_formatted_strings(
                translation, field_modifier=_get_field_translator(locale)
            ), maxlen=0)
        except ValueError:
            # No point in trying to translate in this locale if some translations are missing.
            # We assume TranslationChecker has been run first, so no need for logging an error.
            continue
        # No need to keep a translation if it's identical to the original proto.
        if serialized_proto != translation.SerializeToString():
            yield locale, translation


def _has_validation_errors(
        values: typing.List[typing.Dict[str, typing.Any]],
        proto_class: typing.Type[message.Message],
        proto_checkers: typing.List[Checker]) -> bool:
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
    format_field_checkers[options_pb2.NATURAL_LANGUAGE] = TranslationChecker()
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
                '{}:{}'.format(_id, locale),
                proto_checkers,
                _BEFORE_TRANSLATION_CHECKERS)
        value['_id'] = _id
    return has_error


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
