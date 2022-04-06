"""Helper for all scoring modules."""

import datetime
import functools
import logging
import os
import random
import re
import threading
import typing
from typing import Any, Callable, Iterable, Iterator, Mapping, Optional, Pattern, Set, Tuple, \
    Union

from google.protobuf import message

from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import proto


# Environment variable stating which deployment is used.
_BOB_DEPLOYMENT = os.getenv('BOB_DEPLOYMENT', 'fr')

_APPLICATION_TIPS: proto.MongoCachedCollection[application_pb2.ApplicationTip] = \
    proto.MongoCachedCollection(application_pb2.ApplicationTip, 'application_tips')

_REGIONS: proto.MongoCachedCollection[geo_pb2.Region] = \
    proto.MongoCachedCollection(geo_pb2.Region, 'regions')

_SPECIFIC_TO_JOB_ADVICE: proto.MongoCachedCollection[advisor_pb2.DynamicAdvice] = \
    proto.MongoCachedCollection(advisor_pb2.DynamicAdvice, 'specific_to_job_advice')

_TRAININGS: proto.MongoCachedCollection[training_pb2.Training] = \
    proto.MongoCachedCollection(training_pb2.Training, 'trainings')

# Matches variables that need to be replaced by populate_template.
TEMPLATE_VAR_PATTERN = re.compile('%[a-zA-Z]{3,}')
# Pattern to skip when looking for variables not replaced. Matches URLs with query strings, can be
# used with a sub(r'\1') to drop the query string:
# https://www.google.com?search=foo => https://www.google.com?
_SKIP_VAR_PATTERN = re.compile(r'(https?://[^\?\s]*\?)\S+')

# Keep in sync with frontend/client/src/store/project.ts
# TODO(pascal): Use deployment factors for the gross/net ratio.
_TO_GROSS_ANNUAL_FACTORS: dict[int, float] = {
    # net = gross x 80%
    job_pb2.ANNUAL_GROSS_SALARY: 1,
    job_pb2.HOURLY_GROSS_SALARY: 52 * 35,
    job_pb2.HOURLY_NET_SALARY: 52 * 35 / 0.8,
    job_pb2.MONTHLY_GROSS_SALARY: 12,
    job_pb2.MONTHLY_NET_SALARY: 12 / 0.8,
}

ASSOCIATIONS: proto.MongoCachedCollection[association_pb2.Association] = \
    proto.MongoCachedCollection(association_pb2.Association, 'associations')

_AType = typing.TypeVar('_AType')


class _Scores(typing.NamedTuple):
    scores: Mapping[str, float]
    reasons: Mapping[str, tuple[str, ...]]
    missing_fields: Mapping[str, frozenset[str]]


def _keep_only_departement_filters(
        association: association_pb2.Association) -> Iterator[str]:
    for association_filter in association.filters:
        if association_filter.startswith('for-departement'):
            yield association_filter


def _add_left_pad_to_message(text: str, tab: str = '\t') -> str:
    return '\n'.join(tab + line if line else line for line in text.split('\n'))


class ScoringProject:
    """The project and its environment for the scoring.

    When deciding whether an advice is useful or not for a given project we
    need the project itself but also a lot of other factors. This object is
    responsible to make them accessible to the scoring function.
    """

    def __init__(
            self,
            project: project_pb2.Project,
            user: user_pb2.User,
            database: mongo.NoPiiMongoDatabase,
            now: Optional[datetime.datetime] = None):
        self.details = project
        self.user_profile = user.profile
        self.features_enabled = user.features_enabled
        self.user = user
        self._db = database
        self.now = now or datetime.datetime.utcnow()

        # Cache for scoring models.
        self._scores: dict[str, Union[Exception, float]] = {}

        # Cache for DB data.
        self._job_group_info: Optional[job_pb2.JobGroup] = None
        self._local_diagnosis: Optional[job_pb2.LocalJobStats] = None
        self._application_tips: list[application_pb2.ApplicationTip] = []
        self._region: Optional[geo_pb2.Region] = None
        self._trainings: Optional[list[training_pb2.Training]] = None
        self._mission_locale_data: Optional[association_pb2.MissionLocaleData] = None

        # Cache for modules.
        self._module_cache: dict[str, Any] = {}

        # Cache for template variables
        self._template_variables: dict[str, str] = {}

    def __str__(self) -> str:
        padded = {
            k: _add_left_pad_to_message(str(privacy.get_redacted_copy(v))) for k, v in {
                'features': self.features_enabled,
                'profile': self.user_profile,
                'project': self.details,
            }.items()
        }
        return (
            f'Profile:\n{padded["profile"]}'
            f'Project:\n{padded["project"]}'
            f'Features:\n{padded["features"]}'
        )

    def get_other_project(self, project: project_pb2.Project) -> 'ScoringProject':
        """Get a ScoringProject for a secondary project for the same user."""

        if project == self.details:
            return self
        return self.__class__(project, self.user, self._db, self.now)

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def local_diagnosis(self) -> job_pb2.LocalJobStats:
        """Get local stats for the project's job group and département.

        If the project is missing either a job group or a departement,
        it will return an empty proto.
        """

        if self._local_diagnosis is not None:
            return self._local_diagnosis

        if self.details.HasField('local_stats'):
            self._local_diagnosis = self.details.local_stats
            return self._local_diagnosis

        local_diagnosis = jobs.get_local_stats(
            self.database, self.details.city.departement_id, self._rome_id())
        self._local_diagnosis = local_diagnosis
        return local_diagnosis

    def add_local_diagnosis(self) -> None:
        """Add local stats to the project local_stats field."""

        self.details.local_stats.CopyFrom(self.local_diagnosis())

    def imt_proto(self) -> job_pb2.ImtLocalJobStats:
        """Get IMT data for the project's job and département."""

        return self.local_diagnosis().imt

    # TODO(cyrille): Account for seniority, workload, and maybe other parameters...
    def salary_estimation(self, unit: int = job_pb2.ANNUAL_GROSS_SALARY) -> float:
        """Get salary data from IMT for the project's job and département."""

        salary = self.local_diagnosis().salary
        base_value = salary.median_salary
        return base_value * _TO_GROSS_ANNUAL_FACTORS[salary.unit] / _TO_GROSS_ANNUAL_FACTORS[unit] \
            if salary.unit else base_value

    def market_stress(self) -> Optional[float]:
        """Get the ratio of # applicants / # job offers for the project."""

        imt = self.imt_proto()
        offers = imt.yearly_avg_offers_per_10_candidates
        if not offers:
            return None
        if offers == -1:
            # No job offers at all, ouch!
            return 1000
        return 10 / offers

    def _rome_id(self) -> str:
        return self.details.target_job.job_group.rome_id

    @classmethod
    def cached(cls, cache_key: str) \
            -> Callable[[Callable[..., _AType]], Callable[..., _AType]]:
        """Decorator to cache the result of a function inside the project."""

        def _decorator(func: Callable[..., _AType]) -> Callable[..., _AType]:
            def _project_decorated_func(self: Any, project: 'ScoringProject') -> Any:
                # TODO(cyrille): Find a way to make this work inside class definition also.
                if not isinstance(project, cls):
                    raise TypeError(
                        f'The project parameter must be of type {cls.__name__}, '
                        f'found {type(project)}.')
                module_cache = project._module_cache  # pylint: disable=protected-access
                if cache_key in module_cache:
                    return module_cache[cache_key]
                value = func(self, project)
                module_cache[cache_key] = value
                return value
            return functools.wraps(func)(_project_decorated_func)
        return _decorator

    @property
    def database(self) -> mongo.NoPiiMongoDatabase:
        """Access to the MongoDB behind this project."""

        return self._db

    def job_group_info(self) -> job_pb2.JobGroup:
        """Get the info for job group info."""

        if self._job_group_info is not None:
            return self._job_group_info

        self._job_group_info = jobs.get_group_proto(
            self.database, self._rome_id(), self.user_profile.locale) or job_pb2.JobGroup()
        return self._job_group_info

    def requirements(self) -> job_pb2.JobRequirements:
        """Get the project requirements."""

        return self.job_group_info().requirements

    # TODO(cyrille): Add trainings from fagerh.fr for for-handicapped.
    # TODO(sil): Add tests for UK.
    def get_trainings(self) -> list[training_pb2.Training]:
        """Get the training opportunities from our partner's API."""

        if self._trainings is not None:
            return self._trainings
        if _BOB_DEPLOYMENT == 'uk':
            all_trainings = _TRAININGS.get_collection(self._db)
            self._trainings = list(
                filter_using_score(all_trainings, lambda t: t.filters, self))
        else:
            self._trainings = carif.get_trainings(
                self.details.target_job.job_group.rome_id, self.details.city.departement_id)
        return self._trainings

    def _translate_tip(self, tip: application_pb2.ApplicationTip) -> application_pb2.ApplicationTip:
        new_tip = application_pb2.ApplicationTip()
        new_tip.CopyFrom(tip)
        new_tip.ClearField('content_masculine')

        content = tip.content
        if tip.content_masculine and self.user_profile.gender == user_profile_pb2.MASCULINE:
            content = tip.content_masculine
        content = self.translate_string(content)
        new_tip.content = content
        return new_tip

    def list_application_tips(self) -> list[application_pb2.ApplicationTip]:
        """List all application tips available for this project."""

        if self._application_tips:
            return self._application_tips

        all_application_tips = _APPLICATION_TIPS.get_collection(self._db)
        self._application_tips = [
            self._translate_tip(tip)
            for tip in filter_using_score(all_application_tips, lambda j: j.filters, self)
        ]
        return self._application_tips

    def specific_to_job_advice_config(self) -> Optional[advisor_pb2.DynamicAdvice]:
        """Find the first specific to job advice config that matches this project."""

        _configs = _SPECIFIC_TO_JOB_ADVICE.get_collection(self._db)
        possible_configs = filter_using_score(_configs, lambda c: c.filters, self)
        return next(possible_configs, None)

    def get_region(self) -> Optional[geo_pb2.Region]:
        """The region proto for this project."""

        if self._region:
            return self._region
        all_regions = _REGIONS.get_collection(self._db)
        try:
            self._region = all_regions[self.details.city.region_id]
        except KeyError:
            logging.warning(
                'Region "%s" is missing in the database.', self.details.city.region_id)
        return self._region

    def _fetch_mission_locale_data(self) -> association_pb2.MissionLocaleData:

        if not self.details.city.departement_id:
            # Do not even try finding a Mission Locale.
            return association_pb2.MissionLocaleData()

        all_associations = ASSOCIATIONS.get_collection(self.database)
        my_associations = filter_using_score(
            all_associations, _keep_only_departement_filters, self)

        try:
            my_mission_locale = next(
                association for association in my_associations
                if association.name == 'Missions locales')
        except StopIteration:
            logging.warning(
                'Could not find a mission locale for département "%s"',
                self.details.city.departement_id)
            return association_pb2.MissionLocaleData()

        return association_pb2.MissionLocaleData(
            agencies_list_link=my_mission_locale.link,
        )

    def mission_locale_data(self) -> association_pb2.MissionLocaleData:
        """The information about the most relevant mission locale for this project."""

        if self._mission_locale_data:
            return self._mission_locale_data

        self._mission_locale_data = self._fetch_mission_locale_data()
        return self._mission_locale_data

    def _get_template_variable(self, name: str) -> str:
        if name in self._template_variables:
            return self._template_variables[name]
        try:
            cache = _TEMPLATE_VARIABLES[name](self)
        except KeyError:
            # name[0] should always be %.
            lower_name = name[0] + french.lower_first_letter(name[1:])
            if lower_name not in _TEMPLATE_VARIABLES:
                logging.info('Wrong case in template variable "%s", cannot replace it.', name)
                cache = name
            else:
                # Recursion cannot run in a loop thanks to the test just before.
                cache = french.upper_first_letter(self._get_template_variable(lower_name))
        self._template_variables[name] = cache
        return cache

    def populate_template(self, template: str, raise_on_missing_var: bool = False) -> str:
        """Populate a template with project variables.

        Args:
            template: a string that may or may not contain placeholders e.g.
                %romeId, %departementId.
        Returns:
            A string with the placeholder replaced by actual values.
        """

        if '%' not in template:
            return template
        pattern = re.compile('|'.join(_TEMPLATE_VARIABLES.keys()), flags=re.I)
        new_template = pattern.sub(
            lambda v: self._get_template_variable(v.group(0)),
            template)
        if TEMPLATE_VAR_PATTERN.search(_SKIP_VAR_PATTERN.sub(r'\1', new_template)):
            msg = 'One or more template variables have not been replaced in:\n' + new_template
            if raise_on_missing_var:
                raise ValueError(msg)  # pragma: no cover
            logging.warning(msg)
        return new_template

    def translate_string(
            self, string: str, is_genderized: bool = False, is_static: bool = False,
            context: str = '', can_log_exception: bool = True) -> str:
        """Translate a string to a language and locale defined by the project."""

        locale = self.user_profile.locale or 'fr'

        keys = [string]
        if context:
            keys.insert(0, f'{string}_{context}')
        if is_genderized and self.user_profile.gender:
            gender = user_profile_pb2.Gender.Name(self.user_profile.gender)
            keys.insert(0, f'{string}_{gender}')
            if context:
                keys.insert(0, f'{string}_{context}_{gender}')
        try:
            return i18n.translate_string(keys, locale, None if is_static else self._db)
        except i18n.TranslationMissingException:
            if not locale.startswith('fr') and can_log_exception:
                logging.exception('Falling back to French on "%s"', string)

        return string

    def translate_static_string(
            self, string: str, is_genderized: bool = False, context: str = '',
            can_log_exception: bool = True) -> str:
        """Translate a static string to a language and locale defined by the project."""

        return self.translate_string(
            string, is_genderized, is_static=True, context=context,
            can_log_exception=can_log_exception)

    def translate_airtable_string(
            self, collection: str, record_id: str, field_name: str, hint: str = '',
            is_genderized: bool = False, context: str = '') -> str:
        """Translate a string from Airtable to a language and locale defined by the project."""

        return self.translate_key_string(
            f'{collection}:{record_id}:{field_name}' if record_id else '',
            hint=hint, is_genderized=is_genderized, context=context)

    def translate_key_string(
            self, key: str, *, hint: str = '',
            is_genderized: bool = False, is_hint_static: bool = False, context: str = '') -> str:
        """Translate a string from a given key to a language and locale defined by the project."""

        if key:
            translation = self.translate_string(
                key, is_genderized=is_genderized, can_log_exception=False, context=context)
            if translation != key:
                return translation

        if not hint:
            return ''

        return self.translate_string(
            hint, is_genderized=is_genderized, is_static=is_hint_static, context=context)

    # Dynamic strings that are never used but here to help pybabel to extract those keys as strings
    # to translate.
    _DYNAMIC_STRINGS = (
        i18n.make_translatable_string_with_context('1', 'AS_TEXT'),
        i18n.make_translatable_string_with_context('2', 'AS_TEXT'),
        i18n.make_translatable_string_with_context('3', 'AS_TEXT'),
        i18n.make_translatable_string_with_context('4', 'AS_TEXT'),
        i18n.make_translatable_string_with_context('5', 'AS_TEXT'),
    )

    def get_several_months_text(self, number_months: int) -> str:
        """Get the literal text for several months, e.g. "three months" in the proper locale."""

        if number_months < 0:
            logging.warning('Trying to show negative months:\n%s', str(self))
            return self.translate_static_string('quelques mois')

        number_as_str = self.translate_static_string(
            str(number_months), context='AS_TEXT', can_log_exception=False)
        if number_as_str == str(number_months):
            if number_months > 6:
                return self.translate_static_string('plus de six mois')
            return self.translate_static_string('quelques mois')
        count_months = self.translate_static_string(
            '{{count}} mois', context='' if number_months == 1 else 'plural')
        return count_months.replace('{{count}}', number_as_str)

    def get_search_length_at_creation(self) -> float:
        """Compute job search length (in months) relatively to a project creation date."""

        if self.details.WhichOneof('job_search_length') != 'job_search_started_at':
            return -1
        delta = self.details.created_at.ToDatetime() - \
            self.details.job_search_started_at.ToDatetime()
        return delta.days / 30.5

    def get_search_length_now(self) -> float:
        """Compute job search length (in months) until now."""

        if self.details.WhichOneof('job_search_length') != 'job_search_started_at':
            return -1
        delta = self.now - self.details.job_search_started_at.ToDatetime()
        return delta.days / 30.5

    def get_user_age(self) -> int:
        """Returns the age of the user.

        As we have only the user's year of birth, this number can be 1 more
        than the user age, e.g. if it returns 25, the user can be 25 or 24
        years old.
        """

        return self.now.year - self.user_profile.year_of_birth

    def get_best_application_mode(self) -> Optional[job_pb2.ModePercentage]:
        """Returns the best available recruiting mode, if it is known."""

        try:
            return max(
                (
                    mode for fap_mode in self.job_group_info().application_modes.values()
                    for mode in fap_mode.modes if mode.mode),
                key=lambda mode: mode.percentage)
        except ValueError:
            return None

    def score(self, scoring_model_name: str, force_exists: bool = False) -> float:
        """Returns the score for a given scoring model.

        This assumes the score can never change after it's been first computed.
        """

        if scoring_model_name in self._scores:
            score = self._scores[scoring_model_name]
            if isinstance(score, Exception):
                raise score
            return score
        model = get_scoring_model(scoring_model_name)
        if not model:
            if force_exists:
                raise KeyError(f'Scoring model "{scoring_model_name}" is unknown')
            logging.error(
                'Scoring model "%s" unknown, falling back to default.', scoring_model_name)
            return self.score('')
        try:
            score = model.score(self)
        except Exception as err:
            self._scores[scoring_model_name] = err
            raise
        self._scores[scoring_model_name] = score
        return score

    def check_filters(self, filters: Iterable[str], force_exists: bool = False) -> bool:
        """Whether the project satisfies all the given filters."""

        return all(self.score(f, force_exists=force_exists) > 0 for f in filters)

    def score_and_explain_all(
        self, iterable: Iterable[tuple[str, str]], scoring_timeout_seconds: float = 3,
    ) -> _Scores:
        """Score and explain many items (advice modules, action templates)."""

        scores: dict[str, float] = {}
        reasons: dict[str, list[str]] = {}
        missing_fields: dict[str, Set[str]] = {}
        for item_id, item_scoring_model in iterable:
            scoring_model = get_scoring_model(item_scoring_model)
            if scoring_model is None:
                logging.warning(
                    'Not able to score item "%s", the scoring model "%s" is unknown.',
                    item_id, item_scoring_model)
                continue
            if typing.TYPE_CHECKING:
                _compute_score_and_reasons(
                    scores, reasons, item_id, item_scoring_model, scoring_model, self,
                    missing_fields)
            else:
                thread = threading.Thread(
                    target=_compute_score_and_reasons,
                    args=(
                        scores, reasons, item_id, item_scoring_model, scoring_model, self,
                        missing_fields))
                thread.start()
                # TODO(pascal): Consider scoring different models in parallel.
                thread.join(timeout=scoring_timeout_seconds)
                if thread.is_alive():
                    logging.warning(
                        'Timeout while scoring item "%s" for:\n%s', item_scoring_model, str(self))
        return _Scores(
            scores,
            {key: tuple(values) for key, values in reasons.items()},
            {key: frozenset(values) for key, values in missing_fields.items()})


_TEMPLATE_VARIABLES: dict[str, Callable[[ScoringProject], str]] = {}


class NotEnoughDataException(Exception):
    """Exception raised while scoring if there's not enough data to compute a score."""

    def __init__(
            self, msg: str = '',
            fields: Optional[Set[str]] = None,
            reasons: Optional[list[str]] = None) -> None:
        super().__init__(msg, fields, reasons)
        self.fields = fields or set()
        self.reasons = reasons or []


class ExplainedScore(typing.NamedTuple):
    """Score for a metric and its explanations."""

    score: float
    explanations: list[str]


NULL_EXPLAINED_SCORE = ExplainedScore(0, [])


class ModelBase:
    """A base scoring model.

    The sub classes must override either `score` or `score_and_explain` methods.
    If neither is overriden, both will raise a NotImplementedError.
    """

    # If we do standard computation across models, add it here and use this one
    # as a base class.

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject.

        If not overriden, will return the score part of score_and_explain.
        """

        if self.score_and_explain.__code__ == ModelBase.score_and_explain.__code__:
            raise NotImplementedError(f'Score method not implemented in {self.__class__.__name__}')
        return self.score_and_explain(project).score

    def _explain(self, unused_project: ScoringProject) -> list[str]:
        """Compute the explanations for the score of the given ScoringProject.

        It should be overriden if explanations are independant from the score. Otherwise override
        `score_and_explain`.
        """

        return []

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject, and with why it's received this score.

        It should return an `ExplainedScore`.
        If not overriden, will return the outputs from `score` and `_explain`
        """

        return ExplainedScore(self.score(project), self._explain(project))

    def get_advice_override(
            self,
            unused_project: ScoringProject,
            unused_advice: project_pb2.Advice) -> Optional[project_pb2.Advice]:
        """Get override data for an advice."""

        return None

    def get_expanded_card_data(self, unused_project: ScoringProject) -> message.Message:
        """Retrieve data for the expanded card."""

        raise AttributeError(f'{self.__class__} does not have a get_expanded_card_data method')


class ModelHundredBase(ModelBase):
    """A base/default scoring model to help rescale scores from (0, 100) range.

    The sub classes should override the score_to_hundred method.
    """

    # Do smarter overrides if and when we want to start giving reasons for those scoring models.
    def score(self, unused_project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        hundred_score = self.score_to_hundred(unused_project)
        return max(0, min(hundred_score, 100)) * 3 / 100

    def score_to_hundred(self, unused_project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score_to_hundred`
        to avoid the fallback to a random value.
        """

        return random.random() * 100


class RelevanceModelBase(ModelBase):
    """A base scoring model to help define scoring models for relevance.

    The sub-classes should override the score_relevance method.
    """

    def score(self, project: ScoringProject) -> int:
        relevance = self.score_relevance(project)
        if relevance == diagnostic_pb2.NOT_RELEVANT:
            return 0
        if relevance == diagnostic_pb2.NEUTRAL_RELEVANCE:
            return 1
        if relevance == diagnostic_pb2.RELEVANT_AND_GOOD:
            return 3
        raise TypeError(
            f'Unexpected relevance: {diagnostic_pb2.MainChallengeRelevance.Name(relevance)}')

    # TODO(cyrille): Restrict the output type
    # so that it cannot be other than one of the three above.
    def score_relevance(self, unused_project: ScoringProject) \
            -> 'diagnostic_pb2.MainChallengeRelevance.V':
        """Compute a relevance for the given project.

        Default to RELEVANT_AND_GOOD,
        since this is the behaviour when no relevance model is present.
        """

        return diagnostic_pb2.RELEVANT_AND_GOOD


class ConstantScoreModel(ModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score: str) -> None:
        self.constant_score = float(constant_score)

    def score(self, unused_project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        return self.constant_score


class BaseFilter(ModelBase):
    """A scoring model to filter on any scoring project property.

    It takes a filter function that takes a scoring project as parameter. If
    this function returns true, the score for any project taken by the user
    would be 3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to users with a computer:
        BaseFilter(lambda scoring_project: scoring_project.user_profile.has_access_to_computer)"""

    def __init__(
            self,
            filter_func: Callable[[ScoringProject], bool],
            reasons: Optional[list[str]] = None):
        self.filter_func = filter_func
        self._reasons = reasons

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        if self.filter_func(project):
            return 3
        return 0

    def _explain(self, unused_project: ScoringProject) -> list[str]:
        return self._reasons if self._reasons else []


class LowPriorityAdvice(ModelBase):
    """A base advice scoring model that keeps a low priority.

    The priority can go up to 2 if the user has a specific frustration.
    A reason can be given in the frustrated case.
    """

    def __init__(self, main_frustration: int):
        super().__init__()
        self._main_frustration = main_frustration

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        if self._main_frustration in project.user_profile.frustrations:
            return 2
        return 1


class _ScoringModelRegexp(typing.NamedTuple):
    regexp: Pattern[str]
    constructor: Callable[..., ModelBase]


SCORING_MODEL_REGEXPS: list[
    Tuple[Pattern[str], Callable[..., ModelBase]]] = []


def get_scoring_model(
        scoring_model_name: str, cache_generated_model: bool = True) -> Optional[ModelBase]:
    """Get a scoring model by its name, may generate it if needed and possible."""

    if scoring_model_name in SCORING_MODELS:
        return SCORING_MODELS[scoring_model_name]

    for regexp, constructor in SCORING_MODEL_REGEXPS:
        regexp_match = regexp.match(scoring_model_name)
        if regexp_match:
            try:
                scoring_model = constructor(*regexp_match.groups())
            except ValueError as err:
                logging.error(
                    'Model ID "%s" raised an error for constructor "%s":\n%s',
                    scoring_model_name,
                    constructor.__name__,
                    err)
                return None
            if scoring_model and cache_generated_model:
                SCORING_MODELS[scoring_model_name] = scoring_model
            return scoring_model

    return None


class RandomModel(ModelBase):
    """A ScoringModel which returns a random score without any reason."""

    def score(self, unused_project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        return random.random() * 3


SCORING_MODELS: dict[str, ModelBase] = {
    '': RandomModel(),
}


def filter_using_score(
        iterable: Iterable[_AType],
        get_scoring_func: Callable[[_AType], Iterable[str]],
        project: ScoringProject) -> Iterator[_AType]:
    """Filter the elements of an iterable using scores.

    Args:
        iterable: an iterable of objects on which this function will iterate at
            most once.
        get_scoring_func: a function to apply on each object to get a list of
            scoring models.
        project: the project to score.

    Yield:
        an item from iterable if it passes the filters.
    """

    for item in iterable:
        if project.check_filters(get_scoring_func(item)):
            yield item


def register_model(model_name: str, model: ModelBase) -> None:
    """Register a scoring model."""

    if model_name in SCORING_MODELS:
        raise ValueError(f'The model "{model_name}" already exists.')
    SCORING_MODELS[model_name] = model


def register_regexp(
        regexp: Pattern[str],
        constructor: Callable[..., ModelBase], example: str) -> None:
    """Register regexp based scoring models."""

    if not regexp.match(example):
        raise ValueError(
            f'The example "{example}" does not match the pattern "{regexp}".')
    if get_scoring_model(example, cache_generated_model=False):
        raise ValueError(f'The pattern "{regexp}" is probably already used')
    SCORING_MODEL_REGEXPS.append(_ScoringModelRegexp(regexp, constructor))


def register_template_variable(
        variable_name: str, value_func: Callable[[ScoringProject], str]) -> None:
    """Register a template variable."""

    for existing_variable in _TEMPLATE_VARIABLES:
        if existing_variable.startswith(variable_name) or \
                variable_name.startswith(existing_variable):
            raise ValueError(
                f'The new variable "{variable_name}" might conflict with "{existing_variable}')
    _TEMPLATE_VARIABLES[variable_name] = value_func


def _compute_score_and_reasons(
        scores: dict[str, float],
        reasons: dict[str, list[str]],
        key: str,
        scoring_model_name: str,
        scoring_model: ModelBase,
        scoring_project: ScoringProject,
        missing_fields: dict[str, Set[str]]) -> None:
    try:
        scores[key], reasons[key] = scoring_model.score_and_explain(scoring_project)
    except NotEnoughDataException as err:
        if err.fields:
            # We don't know whether this is useful or not, so we give it anyway,
            # and ask for missing fields.
            scores[key] = .1
            reasons[key] = err.reasons
            missing_fields[key] = err.fields
            return
        logging.exception('Scoring "%s" crashed for:\n%s', scoring_model_name, str(scoring_project))
    except Exception:  # pylint: disable=broad-except
        logging.exception('Scoring "%s" crashed for:\n%s', scoring_model_name, str(scoring_project))
