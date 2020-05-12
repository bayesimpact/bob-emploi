"""Helper for all scoring modules."""

import datetime
import functools
import logging
import random
import re
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Pattern, Set, Tuple, \
    Union
from urllib import parse

from google.protobuf import message
from pymongo import database as pymongo_database
import unidecode

from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import proto


# Score for each percent of additional job offers that an advice enables. We
# want to have a score of 3 for 30% increase.
_SCORE_PER_JOB_OFFERS_PERCENT = .1

# Score per interview ratio. E.g. a value of 1/5 would make us recommend a
# small impact advice (1 impact point) if a user gets an interview for every
# 5 applications they do; a value of 1/15 would make us recommend a large
# impact advice (3 impact points) or 3 small ones if auser gets an interview
# for every 15 applications.
_SCORE_PER_INTERVIEW_RATIO = 1 / 5

# Average number of days per month.
_DAYS_PER_MONTH = 365.25 / 12

# Average number of weeks per month.
_WEEKS_PER_MONTH = 52 / 12

# Maximum of the estimation scale for English skills, or office tools.
_ESTIMATION_SCALE_MAX = 3

_APPLICATION_TIPS: proto.MongoCachedCollection[application_pb2.ApplicationTip] = \
    proto.MongoCachedCollection(application_pb2.ApplicationTip, 'application_tips')

_REGIONS: proto.MongoCachedCollection[geo_pb2.Region] = \
    proto.MongoCachedCollection(geo_pb2.Region, 'regions')

_SPECIFIC_TO_JOB_ADVICE: proto.MongoCachedCollection[advisor_pb2.DynamicAdvice] = \
    proto.MongoCachedCollection(advisor_pb2.DynamicAdvice, 'specific_to_job_advice')

_EXPERIENCE_DURATION = {
    project_pb2.INTERN: 'peu',
    project_pb2.JUNIOR: 'peu',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}
# Matches variables that need to be replaced by populate_template.
TEMPLATE_VAR_PATTERN = re.compile('%[a-zA-Z]{3,}')
# Pattern to skip when looking for variables not replaced. Matches URLs with query strings, can be
# used with a sub(r'\1') to drop the query string:
# https://www.google.com?search=foo => https://www.google.com?
_SKIP_VAR_PATTERN = re.compile(r'(https?://[^\?\s]*\?)\S+')
# Matches tutoiement choices to be replaced by populate_template.
_YOU_PATTERN = re.compile('%you<(.*?)/(.*?)>')

# Keep in sync with frontend/client/src/store/project.ts
_TO_GROSS_ANNUAL_FACTORS: Dict[int, float] = {
    # net = gross x 80%
    job_pb2.ANNUAL_GROSS_SALARY: 1,
    job_pb2.HOURLY_NET_SALARY: 52 * 35 / 0.8,
    job_pb2.MONTHLY_GROSS_SALARY: 12,
    job_pb2.MONTHLY_NET_SALARY: 12 / 0.8,
}

ASSOCIATIONS: proto.MongoCachedCollection[association_pb2.Association] = \
    proto.MongoCachedCollection(association_pb2.Association, 'associations')

# This is to be put in a sentence related to several people:
# "Les gens trouvent surtout un emploi grâce à ..."
APPLICATION_MODES = {
    job_pb2.SPONTANEOUS_APPLICATION: 'une candidature spontanée',
    job_pb2.PLACEMENT_AGENCY: 'un intermédiaire du placement',
    job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS: 'leur réseau personnel ou professionnel',
}

_AType = typing.TypeVar('_AType')


# TODO(cyrille): Drop once all old users are migrated from can_tutoie to locale.
def get_user_locale(profile: user_pb2.UserProfile) -> str:
    """
    Get the locale for a given profile,
    assuming it might be for a user that comes from the can_tutoie era.
    """

    locale = '' if profile.locale == 'fr' else profile.locale
    return locale or ('fr@tu' if profile.can_tutoie else 'fr')


def _keep_only_departement_filters(
        association: association_pb2.Association) -> Iterator[str]:
    for association_filter in association.filters:
        if association_filter.startswith('for-departement'):
            yield association_filter


def _add_left_pad_to_message(text: str, tab: str = '\t') -> str:
    return '\n'.join(tab + line if line else line for line in text.split('\n'))


class ScoringProject(object):
    """The project and its environment for the scoring.

    When deciding whether an advice is useful or not for a given project we
    need the project itself but also a lot of other factors. This object is
    responsible to make them accessible to the scoring function.
    """

    def __init__(
            self,
            project: project_pb2.Project,
            user: user_pb2.User,
            database: pymongo_database.Database,
            now: Optional[datetime.datetime] = None):
        self.details = project
        self.user_profile = user.profile
        self.features_enabled = user.features_enabled
        self.user = user
        self._db = database
        self.now = now or datetime.datetime.utcnow()

        # Cache for scoring models.
        self._scores: Dict[str, Union[Exception, float]] = {}

        # Cache for DB data.
        self._job_group_info: Optional[job_pb2.JobGroup] = None
        self._local_diagnosis: Optional[job_pb2.LocalJobStats] = None
        self._application_tips: List[application_pb2.ApplicationTip] = []
        self._region: Optional[geo_pb2.Region] = None
        self._trainings: Optional[List[training_pb2.Training]] = None
        self._mission_locale_data: Optional[association_pb2.MissionLocaleData] = None

        # Cache for modules.
        self._module_cache: Dict[str, Any] = {}

        # Cache for template variables
        self._template_variables: Dict[str, str] = {}

    def __str__(self) -> str:
        return 'Profile:\n{profile}Project:\n{project}Features:\n{features}'.format(**{
            k: _add_left_pad_to_message(str(privacy.get_redacted_copy(v))) for k, v in {
                'features': self.features_enabled,
                'profile': self.user_profile,
                'project': self.details,
            }.items()
        })

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
    def database(self) -> pymongo_database.Database:
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
    def get_trainings(self) -> List[training_pb2.Training]:
        """Get the training opportunities from our partner's API."""

        if self._trainings is not None:
            return self._trainings
        self._trainings = carif.get_trainings(
            self.details.target_job.job_group.rome_id, self.details.city.departement_id)
        return self._trainings

    def _translate_tip(self, tip: application_pb2.ApplicationTip) -> application_pb2.ApplicationTip:
        new_tip = application_pb2.ApplicationTip()
        new_tip.CopyFrom(tip)
        new_tip.ClearField('content_masculine')

        content = tip.content
        if tip.content_masculine and self.user_profile.gender == user_pb2.MASCULINE:
            content = tip.content_masculine
        content = self.translate_string(content)
        new_tip.content = content
        return new_tip

    def list_application_tips(self) -> List[application_pb2.ApplicationTip]:
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

    def translate_string(self, string: str, is_genderized: bool = False) -> str:
        """Translate a string to a language and locale defined by the project."""

        locale = get_user_locale(self.user_profile)

        keys = [string]
        if is_genderized and self.user_profile.gender:
            keys.insert(0, f'{string}_{user_pb2.Gender.Name(self.user_profile.gender)}')

        try:
            return i18n.translate_string(keys, locale, self._db)
        except i18n.TranslationMissingException:
            if locale != 'fr':
                logging.exception('Falling back to French on "%s"', string)

        return string

    def get_search_length_at_creation(self) -> float:
        """Compute job search length (in months) relatively to a project creation date."""

        if self.details.WhichOneof('job_search_length') != 'job_search_started_at':
            # TODO(sil): Check if it still makes sense to prioritize this field.
            if self.details.job_search_length_months:
                return self.details.job_search_length_months
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


def _a_job_name(scoring_project: ScoringProject) -> str:
    is_feminine = scoring_project.user_profile.gender == user_pb2.FEMININE
    genderized_determiner = 'une' if is_feminine else 'un'
    return f'{genderized_determiner} {_job_name(scoring_project)}'


def _an_application_mode(scoring_project: ScoringProject) -> str:
    best_mode = scoring_project.get_best_application_mode()
    best_mode_enum = best_mode.mode if best_mode else job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS
    try:
        return APPLICATION_MODES[best_mode_enum]
    except KeyError:
        return APPLICATION_MODES[job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS]


def _in_city(scoring_project: ScoringProject) -> str:
    return french.in_city(scoring_project.details.city.name)


def _in_region(scoring_project: ScoringProject) -> str:
    region = scoring_project.get_region()
    return region.prefix + region.name if region else 'dans la région'


def _in_departement(scoring_project: ScoringProject) -> str:
    try:
        return geo.get_in_a_departement_text(
            scoring_project.database,
            scoring_project.details.city.departement_id)
    except KeyError:
        return 'dans le département'


def _in_area_type(scoring_project: ScoringProject) -> str:
    area_type = scoring_project.details.area_type
    if area_type == geo_pb2.CITY:
        return _in_city(scoring_project)
    elif area_type == geo_pb2.DEPARTEMENT:
        return geo.get_in_a_departement_text(
            scoring_project.database,
            scoring_project.details.city.departement_id)
    elif area_type == geo_pb2.REGION:
        return _in_region(scoring_project)
    else:
        return 'dans le pays'


def _job_name(scoring_project: ScoringProject) -> str:
    return french.genderize_job(
        scoring_project.details.target_job, scoring_project.user_profile.gender, is_lowercased=True)


def _job_search_length_months_at_creation(scoring_project: ScoringProject) -> str:
    count = round(scoring_project.get_search_length_at_creation())
    if count < 0:
        logging.warning(
            'Trying to show negative job search length at creation:\n%s', scoring_project)
        return 'quelques'
    try:
        return french.try_stringify_number(count)
    except NotImplementedError:
        return 'quelques'


def _a_required_diploma(scoring_project: ScoringProject) -> str:
    diplomas = ', '.join(
        sorted(diploma.name for diploma in scoring_project.requirements().diplomas))
    if not diplomas:
        logging.warning(
            'Trying to show required diplomas when there are none.\n%s', scoring_project)
        return 'un diplôme'
    return f'un {diplomas} ou équivalent'


def _total_interview_count(scoring_project: ScoringProject) -> str:
    number = scoring_project.details.total_interview_count
    try:
        return french.try_stringify_number(number)
    except NotImplementedError:
        return str(number)


def _postcode(scoring_project: ScoringProject) -> str:
    city = scoring_project.details.city
    return city.postcodes.split('-')[0] or (
        city.departement_id + '0' * (5 - len(city.departement_id)))


def _what_i_love_about(project: ScoringProject) -> str:
    return project.user_profile.gender == user_pb2.FEMININE and \
        project.job_group_info().what_i_love_about_feminine or \
        project.job_group_info().what_i_love_about


def _url_encode(name: str) -> Callable[[ScoringProject], str]:
    def _wrapped(project: ScoringProject) -> str:
        return parse.quote(project._get_template_variable(name))  # pylint: disable=protected-access
    return _wrapped


def _of_job_name(project: ScoringProject) -> str:
    translated = project.translate_string('de {job_name}').format(job_name=_job_name(project))
    if translated.startswith('de '):
        return french.maybe_contract_prefix('de ', "d'", _job_name(project))
    return translated


_TEMPLATE_VARIABLES: Dict[str, Callable[[ScoringProject], str]] = {
    '%aJobName': _a_job_name,
    # This is a comma separated list of diplomas. Make sure before-hand that there's at least one.
    # Can be used as "nécessite %aRequiredDiploma".
    # TODO(cyrille): Make it smarter, especially when it's a list of Bac+N levels.
    '%aRequiredDiploma': _a_required_diploma,
    '%anApplicationMode': _an_application_mode,
    '%cityId':
    lambda scoring_project: scoring_project.details.city.city_id,
    # TODO(pascal): Investigate who's using that template and rename it to someting with URL in it.
    '%cityName': lambda scoring_project: parse.quote(scoring_project.details.city.name),
    '%departementId':
    lambda scoring_project: scoring_project.details.city.departement_id,
    '%eFeminine': lambda scoring_project: (
        'e' if scoring_project.user_profile.gender == user_pb2.FEMININE else ''),
    '%experienceDuration': lambda scoring_project: _EXPERIENCE_DURATION.get(
        scoring_project.details.seniority, ''),
    '%feminineJobName': lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.feminine_name),
    '%inAreaType': _in_area_type,
    '%inAWorkplace': lambda scoring_project: scoring_project.job_group_info().in_a_workplace,
    '%inCity': _in_city,
    '%inDepartement': _in_departement,
    '%inDomain': lambda scoring_project: scoring_project.job_group_info().in_domain,
    '%inRegion': _in_region,
    # TODO(pascal): Don't use Url as a prefix, as this makes %jobGroupName forbidden (no variable
    # can be the prefix of another variable).
    '%jobGroupNameUrl': lambda scoring_project: parse.quote(unidecode.unidecode(
        scoring_project.details.target_job.job_group.name.lower().replace(' ', '-').replace(
            "'", '-'))),
    '%jobId': lambda scoring_project: scoring_project.details.target_job.code_ogr,
    '%jobName': _job_name,
    # This in only the **number** of months, use as '%jobSearchLengthMonthsAtCreation mois'.
    '%jobSearchLengthMonthsAtCreation': _job_search_length_months_at_creation,
    '%language': lambda scoring_project: scoring_project.user_profile.locale[:2] or 'fr',
    '%latin1CityName': lambda scoring_project: parse.quote(
        scoring_project.details.city.name.encode('latin-1', 'replace')),
    '%latin1MasculineJobName': lambda scoring_project: parse.quote(
        scoring_project.details.target_job.masculine_name.encode('latin-1', 'replace')),
    '%lastName': lambda scoring_project: scoring_project.user_profile.last_name,
    '%likeYourWorkplace': lambda scoring_project: (
        scoring_project.job_group_info().like_your_workplace),
    '%masculineJobName': lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.masculine_name),
    '%name': lambda scoring_project: scoring_project.user_profile.name,
    '%ofCity': lambda scoring_project: french.of_city(scoring_project.details.city.name),
    '%ofJobName': _of_job_name,
    '%placePlural': lambda scoring_project: scoring_project.job_group_info().place_plural,
    '%postcode': _postcode,
    '%regionId': lambda scoring_project: scoring_project.details.city.region_id,
    '%romeId': lambda scoring_project: scoring_project.details.target_job.job_group.rome_id,
    '%totalInterviewCount': _total_interview_count,
    '%urlEncodeJobName': _url_encode('%jobName'),
    '%whatILoveAbout': _what_i_love_about,
}


class NotEnoughDataException(Exception):
    """Exception raised while scoring if there's not enough data to compute a score."""

    def __init__(
            self, msg: str = '',
            fields: Optional[Set[str]] = None,
            reasons: Optional[List[str]] = None) -> None:
        super().__init__(msg, fields, reasons)
        self.fields = fields or set()
        self.reasons = reasons or []


class ExplainedScore(typing.NamedTuple):
    """Score for a metric and its explanations."""

    score: float
    explanations: List[str]


NULL_EXPLAINED_SCORE = ExplainedScore(0, [])


class ModelBase(object):
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

    def _explain(self, unused_project: ScoringProject) -> List[str]:
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
        raise TypeError(f'Unexpected relevance: {diagnostic_pb2.CategoryRelevance.Name(relevance)}')

    # TODO(cyrille): Restrict the output type
    # so that it cannot be other than one of the three above.
    def score_relevance(self, unused_project: ScoringProject) -> diagnostic_pb2.CategoryRelevance:
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
            reasons: Optional[List[str]] = None):
        self.filter_func = filter_func
        self._reasons = reasons

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        if self.filter_func(project):
            return 3
        return 0

    def _explain(self, unused_project: ScoringProject) -> List[str]:
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


SCORING_MODEL_REGEXPS: List[
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


SCORING_MODELS: Dict[str, ModelBase] = {
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
