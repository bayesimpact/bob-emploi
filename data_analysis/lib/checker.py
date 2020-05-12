"""Module defining the checker API for airtable_to_protos, and its implementations."""

import datetime
import logging
import re
from typing import Any, Callable, List, Iterator, Tuple

from google.protobuf import message
import mongomock

from bob_emploi.data_analysis.i18n import translation
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


# Regular expression to validate links, e.g http://bayesimpact.org. Keep in
# sync with frontend/src/store/link.js.
_LINK_REGEXP = re.compile(r'^[^/]+://[^/]*[^/.](?:/|$)')

# Matches a space at first or end of a line (in a possibly multiline string).
_STRIPABLE_SPACE_REGEX = re.compile(r'(^ +| +$)', re.MULTILINE)

# Matches a space that should be unbreakable in a French sentence.
_SPACE_TO_MAKE_UNBREAKABLE_REGEX = re.compile(r'( )(?=[?;:!])')


class FixableValueError(ValueError):
    """A value error reporting an error in a string with a way to fix that string."""

    def __init__(self, short_message: str, marked_value: str, fixed_value: str) -> None:
        super().__init__(short_message)
        self.marked_value = marked_value
        self.fixed_value = fixed_value


def _get_all_values(field_value: Any, field_name: str) -> Iterator[Tuple[Any, str]]:
    if isinstance(field_value, str):
        yield field_value, field_name
        return
    try:
        indexed_values = enumerate(field_value[:])
    except TypeError:
        yield field_value, field_name
        return
    for index, value in indexed_values:
        yield value, f'{field_name}.{index:d}'


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
            f'The checker "{self.name}" has no implementation for its check method.')


class ValueChecker(object):
    """Base class for value checkers.

    A value checker is a simple wrapper for a function wich takes a single value as input and
    returns True if the check is satisfied.
    """

    # The name of the checker, for logging purposes.
    name: str = 'basic value checker'

    def check_value(self, unused_value: Any) -> bool:
        """Whether this specific value passes the check or not."""

        raise NotImplementedError(
            f'The checker "{self.name}" has no implementation for its check_value method.')


class _AllStringFieldsChecker(Checker, ValueChecker):  # pylint: disable=abstract-method
    """Abstract class to inherit when all string fields should be checked by the check_value method.
    """

    def _check_value_augmented(self, field_value: Any, field: str) -> bool:
        try:
            return self.check_value(field_value)
        except ValueError as err:
            raise ValueError(f'{err!s} in the field "{field}"')

    def check(self, proto: message.Message) -> bool:
        errors: List[ValueError] = []
        res = True
        for field in proto.DESCRIPTOR.fields_by_name:
            for value, field_with_index in _get_all_values(getattr(proto, field), field):
                if not isinstance(value, str):
                    continue
                try:
                    res &= self._check_value_augmented(value, field_with_index)
                except ValueError as err:
                    errors.append(err)
        if errors:
            raise ValueError('\n'.join(str(err) for err in errors))
        return res


class QuotesChecker(_AllStringFieldsChecker):
    """Checking that imported string fields don't have any forbidden quotes."""

    name = 'quotes checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        # TODO(cyrille): Check both errors and report one error only.
        if '’' in field_value:
            raise FixableValueError(
                'Curly quotes ’ are not allowed',
                field_value.replace('’', '**’**'),
                field_value.replace('’', "'"))
        if '""' in field_value:
            raise FixableValueError(
                'Double double quotes "" are not allowed',
                field_value.replace('""', '**""**'),
                field_value.replace('""', '"'))
        return True


class SpacesChecker(_AllStringFieldsChecker):
    """Checking that imported string fields don't have strippable spaces."""

    name = 'spaces checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        # TODO(cyrille): Check both errors and report one error only.
        if _STRIPABLE_SPACE_REGEX.search(field_value):
            raise FixableValueError(
                'Extra spaces at the beginning or end',
                _STRIPABLE_SPACE_REGEX.sub(r'**\1**', field_value),
                _STRIPABLE_SPACE_REGEX.sub('', field_value))
        # TODO(cyrille): Do this only for fr_FR locales.
        if _SPACE_TO_MAKE_UNBREAKABLE_REGEX.search(field_value):
            raise FixableValueError(
                'Breakable space before a French double punctuation mark.\n'
                'Use "alt + shift + space" in Airtable to make a non-breakable space.',
                _SPACE_TO_MAKE_UNBREAKABLE_REGEX.sub(r'**\1**', field_value),
                _SPACE_TO_MAKE_UNBREAKABLE_REGEX.sub('\xa0', field_value))
        return True


def _create_mock_scoring_project() -> scoring.ScoringProject:
    """Create a mock scoring_project."""

    _db = mongomock.MongoClient().test
    _db.job_group_info.insert_one({
        '_id': 'A1234',
        'requirements': {
            'diplomas': [{'name': 'Bac+2'}],
        },
    })
    user = user_pb2.User()
    project = project_pb2.Project()
    project.target_job.job_group.rome_id = 'A1234'
    project.created_at.FromDatetime(datetime.datetime.now())
    project.job_search_started_at.FromDatetime(
        datetime.datetime.now() - datetime.timedelta(days=30))
    return scoring.ScoringProject(project, user, database=_db)


class MissingTemplateVarsChecker(ValueChecker):
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
        missing_templates = scoring.TEMPLATE_VAR_PATTERN.findall(new_sentence)
        if missing_templates:
            raise ValueError(
                'One or more template variables have not been replaced: '
                f'{", ".join(missing_templates)}\n')
        return True


class TemplateVarsChecker(Checker):
    """Checking that imported templates satisfy all necessary conditions."""

    def __init__(self, filters_field: str = 'filters') -> None:
        self._filters_field = filters_field

    # TODO(cyrille): Check for %aRequiredDiploma too.
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
                        f'String at path "{path}" uses the template variable '
                        '"%jobSearchLengthMonthsAtCreation" '
                        'without the necessary filter "for-active-search"')
        return True


class TranslationChecker(ValueChecker):
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
                '    docker-compose run --rm'
                '    -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY '
                '    -e MONGO_URL=mongodb://frontend-db/test '
                'data-analysis-prepare \\\n'
                '        python bob_emploi/data_analysis/importer/import_status.py \\\n'
                '        --run translations')
        if not field_value:
            return True
        missing_translations = translation.fetch_missing_translation_locales(field_value)
        if not missing_translations:
            return True
        is_plural = len(missing_translations) != 1
        raise ValueError(
            'Please collect all strings by running:\n'
            'docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" '
            'data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/i18n/collect_strings.py\n'
            'Then fill the table at https://airtable.com/tblQL7A5EgRJWhQFo/viwBe1ySNM4IvXCsN.\n'
            f'{"Some" if is_plural else "One"} translation{"s are" if is_plural else " is"} '
            f'missing for the string\n"{field_value}": {", ".join(missing_translations)}\n'
        )


class UrlChecker(ValueChecker):
    """Check that URL fields are well-formed."""

    name = 'URL format checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if not _LINK_REGEXP.match(field_value):
            raise ValueError(f'Found an irregular link: "{field_value}"\n')
        return True


class ScorerChecker(ValueChecker):
    """Checks that the required fields contain only implemented scorers."""

    name = 'scorer checker'

    def check_value(self, field_value: str) -> bool:
        """Whether this specific value passes the check or not."""

        if not scoring.get_scoring_model(field_value):
            raise ValueError(
                f'The scoring model "{field_value}" is not implemented yet')
        return True


class PartialSentenceChecker(ValueChecker):
    """Checks that the required value is neither capitalized nor punctuated."""

    name = 'partial sentence checker'

    def check_value(self, field_value: str) -> bool:
        """Whether the field passes the check or not."""

        # TODO(cyrille): Check both errors and report one error only.
        if field_value[0].lower() != field_value[0]:
            raise FixableValueError(
                'The sentence must not be capitalized',
                f'**{field_value[0]}**{field_value[1:]}',
                f'{field_value[0].lower()}{field_value[1:]}')
        if field_value[-1] in {'.', '!'}:
            raise FixableValueError(
                'The sentence must not end with a punctuation mark',
                f'{field_value[:-1]}**{field_value[-1]}**',
                field_value[:-1].strip())
        return True


class ListOptionChecker(ValueChecker):
    """Checks that the required value is capitalized and not punctuated."""

    name = 'list option checker'

    def check_value(self, field_value: str) -> bool:
        """Whether the field passes the check or not."""

        # TODO(cyrille): Check both errors and report one error only.
        if field_value[0].upper() != field_value[0]:
            raise FixableValueError(
                'The sentence must be capitalized',
                f'**{field_value[0]}**{field_value[1:]}',
                f'{field_value[0].upper()}{field_value[1:]}')
        if field_value[-1] in {'.', '!'}:
            raise FixableValueError(
                'The sentence must not end with a punctuation mark',
                f'{field_value[:-1]}**{field_value[-1]}**',
                field_value[:-1].strip())
        return True


# TODO(cyrille): Test this function for nested protos, or drop the TYPE_MESSAGE branch entirely.
def collect_formatted_strings(
        proto: message.Message,
        field_modifier: Callable[[str, str, 'options_pb2.StringFormat'], str] = lambda s, p, f: s,
        path: Tuple[str, ...] = ()) \
        -> Iterator[Tuple[str, str, 'options_pb2.StringFormat']]:
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
        this_string_formats = \
            field_descriptor.GetOptions().Extensions[options_pb2.string_format]
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
