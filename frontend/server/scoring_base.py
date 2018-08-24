"""Helper for all scoring modules."""

import collections
import datetime
import functools
import logging
import random
import re
from urllib import parse

import unidecode

from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
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

_APPLICATION_TIPS = proto.MongoCachedCollection(application_pb2.ApplicationTip, 'application_tips')

_REGIONS = proto.MongoCachedCollection(geo_pb2.Region, 'regions')

_SPECIFIC_TO_JOB_ADVICE = proto.MongoCachedCollection(
    advisor_pb2.DynamicAdvice, 'specific_to_job_advice')

_EXPERIENCE_DURATION = {
    project_pb2.INTERNSHIP: 'peu',
    project_pb2.JUNIOR: 'peu',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}
# Matches variables that need to be replaced by populate_template.
_TEMPLATE_VAR = re.compile('.*%[a-z]+')
# Matches tutoiement choices to be replaced by populate_template.
_YOU_PATTERN = re.compile('%you<(.*?)/(.*?)>')

_TO_GROSS_ANNUAL_FACTORS = {
    # net = gross x 80%
    job_pb2.ANNUAL_GROSS_SALARY: 1,
    job_pb2.HOURLY_NET_SALARY: 52 * 35 / 0.8,
    job_pb2.MONTHLY_GROSS_SALARY: 12,
    job_pb2.MONTHLY_NET_SALARY: 12 / 0.8,
}

ASSOCIATIONS = proto.MongoCachedCollection(association_pb2.Association, 'associations')


def _keep_only_departement_filters(association):
    for association_filter in association.filters:
        if association_filter.startswith('for-departement'):
            yield association_filter


class ScoringProject(object):
    """The project and its environment for the scoring.

    When deciding whether an advice is useful or not for a given project we
    need the project itself but also a lot of other factors. This object is
    responsible to make them accessible to the scoring function.
    """

    def __init__(self, project, user_profile, features_enabled, database, now=None):
        self.details = project
        self.user_profile = user_profile
        self.features_enabled = features_enabled
        self._db = database
        self.now = now or datetime.datetime.utcnow()

        # Cache for DB data.
        self._job_group_info = None
        self._local_diagnosis = None
        self._application_tips = None
        self._region = None
        self._trainings = None
        self._mission_locale_data = None

        # Cache for modules.
        self._module_cache = {}

        # Cache for template variables
        self._template_variables = {}

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def local_diagnosis(self):
        """Get local stats for the project's job group and département."""

        if self._local_diagnosis is not None:
            return self._local_diagnosis

        local_id = '{}:{}'.format(
            self.details.city.departement_id or self.details.mobility.city.departement_id,
            self.details.target_job.job_group.rome_id)
        self._local_diagnosis = proto.create_from_mongo(
            self._db.local_diagnosis.find_one({'_id': local_id}),
            job_pb2.LocalJobStats)

        return self._local_diagnosis

    def imt_proto(self):
        """Get IMT data for the project's job and département."""

        return self.local_diagnosis().imt

    # TODO(cyrille): Account for seniority, workload, and maybe other parameters...
    def salary_estimation(self, unit=job_pb2.ANNUAL_GROSS_SALARY):
        """Get salary data from IMT for the project's job and département."""

        salary = self.local_diagnosis().salary
        base_value = salary.median_salary
        return base_value * _TO_GROSS_ANNUAL_FACTORS[salary.unit] / _TO_GROSS_ANNUAL_FACTORS[unit] \
            if salary.unit else base_value

    def market_stress(self):
        """Get the ratio of # applicants / # job offers for the project."""

        imt = self.imt_proto()
        if not imt.yearly_avg_offers_denominator:
            return None
        offers = imt.yearly_avg_offers_per_10_candidates
        if not offers:
            # No job offers at all, ouch!
            return 1000
        return imt.yearly_avg_offers_denominator / offers

    def _rome_id(self):
        return self.details.target_job.job_group.rome_id

    @classmethod
    def cached(cls, cache_key):
        """Decorator to cache the result of a function inside the project."""

        def _decorator(func):
            def _project_decorated_func(self, project):
                # TODO(cyrille): Find a way to make this work inside class definition also.
                if not isinstance(project, cls):
                    raise TypeError(
                        'The project parameter must be of type {}, found {}.'
                        .format(cls.__name__, type(project)))
                module_cache = project._module_cache  # pylint: disable=protected-access
                if cache_key in module_cache:
                    return module_cache[cache_key]
                value = func(self, project)
                module_cache[cache_key] = value
                return value
            return functools.wraps(func)(_project_decorated_func)
        return _decorator

    @property
    def database(self):
        """Access to the MongoDB behind this project."""

        return self._db

    def job_group_info(self):
        """Get the info for job group info."""

        if self._job_group_info is not None:
            return self._job_group_info

        self._job_group_info = proto.create_from_mongo(
            self._db.job_group_info.find_one({'_id': self._rome_id()}),
            job_pb2.JobGroup)
        return self._job_group_info

    def requirements(self):
        """Get the project requirements."""

        return self.job_group_info().requirements

    def get_trainings(self):
        """Get the training opportunities from our partner's API."""

        if self._trainings is not None:
            return self._trainings
        self._trainings = carif.get_trainings(
            self.details.target_job.job_group.rome_id,
            self.details.city.departement_id or self.details.mobility.city.departement_id)
        return self._trainings

    def list_application_tips(self):
        """List all application tips available for this project."""

        if self._application_tips:
            return self._application_tips

        all_application_tips = _APPLICATION_TIPS.get_collection(self._db)
        self._application_tips = list(filter_using_score(
            all_application_tips, lambda j: j.filters, self))
        return self._application_tips

    def specific_to_job_advice_config(self):
        """Find the first specific to job advice config that matches this project."""

        _configs = _SPECIFIC_TO_JOB_ADVICE.get_collection(self._db)
        return next(filter_using_score(_configs, lambda c: c.filters, self), None)

    def _can_tutoie(self):
        return self.user_profile.can_tutoie

    def get_region(self):
        """The region proto for this project."""

        if self._region:
            return self._region
        all_regions = _REGIONS.get_collection(self._db)
        try:
            self._region = all_regions[
                self.details.city.region_id or self.details.mobility.city.region_id]
        except KeyError:
            logging.warning(
                'Region "%s" is missing in the database.',
                self.details.city.region_id or self.details.mobility.city.region_id)
        return self._region

    def _fetch_mission_locale_data(self):

        if not self.details.city.departement_id and not self.details.mobility.city.departement_id:
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
                self.details.city.departement_id or self.details.mobility.city.departement_id)
            return association_pb2.MissionLocaleData()

        return association_pb2.MissionLocaleData(
            agencies_list_link=my_mission_locale.link,
        )

    def mission_locale_data(self):
        """The information about the most relevant mission locale for this project."""

        if self._mission_locale_data:
            return self._mission_locale_data

        self._mission_locale_data = self._fetch_mission_locale_data()
        return self._mission_locale_data

    def _get_template_variable(self, name, constructor):
        if name in self._template_variables:
            return self._template_variables[name]
        cache = constructor(self)
        self._template_variables[name] = cache
        return cache

    def populate_template(self, template, raise_on_missing_var=False):
        """Populate a template with project variables.

        Args:
            template: a string that may or may not contain placeholders e.g.
                %romeId, %departementId.
        Returns:
            A string with the placeholder replaced by actual values.
        """

        if '%' not in template:
            return template
        pattern = re.compile('|'.join(_TEMPLATE_VARIABLES.keys()))
        vars_template = pattern.sub(
            lambda v: self._get_template_variable(v.group(0), _TEMPLATE_VARIABLES[v.group(0)]),
            template)
        new_template = _YOU_PATTERN.sub(
            lambda v: v.group(1) if self._can_tutoie() else v.group(2), vars_template)
        if _TEMPLATE_VAR.match(new_template):
            msg = 'One or more template variables have not been replaced in:\n' + new_template
            if raise_on_missing_var:
                raise ValueError(msg)  # pragma: no cover
            logging.warning(msg)
        return new_template

    def translate_string(self, string):
        """Translate a string to a language and locale defined by the project."""

        if self.user_profile.can_tutoie:
            try:
                return i18n.translate_string(string, 'fr_FR@tu', self._db)
            except i18n.TranslationMissingException:
                logging.exception('Falling back to vouvoiement')

        return string

    def get_search_length_at_creation(self):
        """Compute job search length (in months) relatively to a project creation date."""

        if self.details.job_search_has_not_started\
                or not self.details.HasField('job_search_started_at'):
            if self.details.job_search_length_months:
                return self.details.job_search_length_months
            return -1
        delta = self.details.created_at.ToDatetime()\
            - self.details.job_search_started_at.ToDatetime()
        return delta.days / 30.5

    def get_search_length_now(self):
        """Compute job search length (in months) until now."""

        if self.details.job_search_has_not_started\
                or not self.details.HasField('job_search_started_at'):
            return -1
        delta = self.now - self.details.job_search_started_at.ToDatetime()
        return delta.days / 30.5

    def get_user_age(self):
        """Returns the age of the user.

        As we have only the user's year of birth, this number can be 1 more
        than the user age, e.g. if it returns 25, the user can be 25 or 24
        years old.
        """

        return self.now.year - self.user_profile.year_of_birth


def _a_job_name(scoring_project):
    is_feminine = scoring_project.user_profile.gender == user_pb2.FEMININE
    genderized_determiner = 'une' if is_feminine else 'un'
    return '{} {}'.format(genderized_determiner, _job_name(scoring_project))


def _in_region(scoring_project):
    region = scoring_project.get_region()
    return region.prefix + region.name if region else 'dans la région'


def _job_name(scoring_project):
    return french.lower_first_letter(french.genderize_job(
        scoring_project.details.target_job, scoring_project.user_profile.gender))


def _job_search_length_months_at_creation(scoring_project):
    count = round(scoring_project.get_search_length_at_creation())
    if count < 0:
        logging.warning('Trying to show negative job search length at creation.')
        return 'quelques'
    try:
        return french.try_stringify_number(count)
    except NotImplementedError:
        return 'quelques'


def _total_interview_count(scoring_project):
    number = scoring_project.details.total_interview_count
    try:
        return french.try_stringify_number(number)
    except NotImplementedError:
        return str(number)


def _postcode(scoring_project):
    if scoring_project.details.city.postcodes:
        city = scoring_project.details.city
    else:
        city = scoring_project.details.mobility.city
    return city.postcodes.split('-')[0] or (
        city.departement_id + '0' * (5 - len(city.departement_id)))


_TEMPLATE_VARIABLES = {
    '%aJobName': _a_job_name,
    '%cityId':
    lambda scoring_project:
        scoring_project.details.city.city_id or scoring_project.details.mobility.city.city_id,
    '%cityName': lambda scoring_project: parse.quote(
        scoring_project.details.city.name or scoring_project.details.mobility.city.name),
    '%departementId':
    lambda scoring_project:
        scoring_project.details.city.departement_id or
        scoring_project.details.mobility.city.departement_id,
    '%eFeminine': lambda scoring_project: (
        'e' if scoring_project.user_profile.gender == user_pb2.FEMININE else ''),
    '%experienceDuration': lambda scoring_project: _EXPERIENCE_DURATION.get(
        scoring_project.details.seniority),
    '%feminineJobName': lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.feminine_name),
    '%inAWorkplace': lambda scoring_project: scoring_project.job_group_info().in_a_workplace,
    '%inCity': lambda scoring_project: french.in_city(
        scoring_project.details.city.name or scoring_project.details.mobility.city.name),
    '%inDomain': lambda scoring_project: scoring_project.job_group_info().in_domain,
    '%inRegion': _in_region,
    '%jobGroupNameUrl': lambda scoring_project: parse.quote(unidecode.unidecode(
        scoring_project.details.target_job.job_group.name.lower().replace(' ', '-').replace(
            "'", '-'))),
    '%jobId': lambda scoring_project: scoring_project.details.target_job.code_ogr,
    '%jobName': _job_name,
    # This in only the **number** of months, use as '%jobSearchLengthMonthsAtCreation mois'.
    '%jobSearchLengthMonthsAtCreation': _job_search_length_months_at_creation,
    '%latin1CityName': lambda scoring_project: parse.quote(
        scoring_project.details.city.name.encode('latin-1', 'replace') or
        scoring_project.details.mobility.city.name.encode('latin-1', 'replace')),
    '%latin1MasculineJobName': lambda scoring_project: parse.quote(
        scoring_project.details.target_job.masculine_name.encode('latin-1', 'replace')),
    '%lastName': lambda scoring_project: scoring_project.user_profile.last_name,
    '%likeYourWorkplace': lambda scoring_project: (
        scoring_project.job_group_info().like_your_workplace),
    '%masculineJobName': lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.masculine_name),
    '%name': lambda scoring_project: scoring_project.user_profile.name,
    '%ofCity': lambda scoring_project: french.of_city(
        scoring_project.details.city.name or scoring_project.details.mobility.city.name),
    '%ofJobName': lambda scoring_project: french.maybe_contract_prefix(
        'de ', "d'", _job_name(scoring_project)),
    '%placePlural': lambda scoring_project: scoring_project.job_group_info().place_plural,
    '%postcode': _postcode,
    '%regionId':
    lambda scoring_project:
        scoring_project.details.city.region_id or scoring_project.details.mobility.city.region_id,
    '%romeId': lambda scoring_project: scoring_project.details.target_job.job_group.rome_id,
    '%totalInterviewCount': _total_interview_count,
    '%whatILoveAbout': lambda scoring_project: scoring_project.job_group_info().what_i_love_about,
}


class NotEnoughDataException(Exception):
    """Exception raised while scoring if there's not enough data to compute a score."""

    pass


ExplainedScore = collections.namedtuple('ExplainedScore', ['score', 'explanations'])
NULL_EXPLAINED_SCORE = ExplainedScore(0, [])


class ModelBase(object):
    """A base scoring model.

    The sub classes must override either `score` or `score_and_explain` methods.
    If neither is overriden, both will raise a NotImplementedError.
    """

    # If we do standard computation across models, add it here and use this one
    # as a base class.

    def score(self, project):
        """Compute a score for the given ScoringProject.

        If not overriden, will return the score part of score_and_explain.
        """

        if self.score_and_explain.__code__ == ModelBase.score_and_explain.__code__:
            return NotImplementedError()
        return self.score_and_explain(project).score

    def _explain(self, unused_project):
        """Compute the explanations for the score of the given ScoringProject.

        It should be overriden if explanations are independant from the score. Otherwise override
        `score_and_explain`.
        """

        return []

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject, and with why it's received this score.

        It should return an `ExplainedScore`.
        If not overriden, will return the outputs from `score` and `_explain`
        """

        return ExplainedScore(self.score(project), self._explain(project))


class ModelHundredBase(ModelBase):
    """A base/default scoring model to help rescale scores from (0, 100) range.

    The sub classes should override the score_to_hundred method.
    """

    # Do smarter overrides if and when we want to start giving reasons for those scoring models.
    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""

        hundred_score = self.score_to_hundred(unused_project)
        return max(0, min(hundred_score, 100)) * 3 / 100

    def score_to_hundred(self, unused_project):
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score_to_hundred`
        to avoid the fallback to a random value.
        """

        return random.random() * 100


class ConstantScoreModel(ModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score):
        self.constant_score = float(constant_score)

    def score(self, unused_project):
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

    def __init__(self, filter_func, reasons=None):
        self.filter_func = filter_func
        self._reasons = reasons

    def score(self, project):
        """Compute a score for the given ScoringProject."""

        if self.filter_func(project):
            return 3
        return 0

    def _explain(self, unused_project):
        return self._reasons if self._reasons else []


class LowPriorityAdvice(ModelBase):
    """A base advice scoring model that keeps a low priority.

    The priority can go up to 2 if the user has a specific frustration.
    A reason can be given in the frustrated case.
    """

    def __init__(self, main_frustration):
        super(LowPriorityAdvice, self).__init__()
        self._main_frustration = main_frustration

    def score(self, project):
        """Compute a score for the given ScoringProject."""

        if self._main_frustration in project.user_profile.frustrations:
            return 2
        return 1


_ScoringModelRegexp = collections.namedtuple('ScoringModelRegexp', ['regexp', 'constructor'])


SCORING_MODEL_REGEXPS = []


def get_scoring_model(scoring_model_name, cache_generated_model=True):
    """Get a scoring model by its name, may generate it if needed and possible."""

    if scoring_model_name in SCORING_MODELS:
        return SCORING_MODELS[scoring_model_name]

    for regexp, constructor in SCORING_MODEL_REGEXPS:
        regexp_match = regexp.match(scoring_model_name)
        if regexp_match:
            scoring_model = constructor(regexp_match.group(1))
            if scoring_model and cache_generated_model:
                SCORING_MODELS[scoring_model_name] = scoring_model
            return scoring_model

    return None


class RandomModel(ModelBase):
    """A ScoringModel which returns a random score without any reason."""

    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""

        return random.random() * 3


SCORING_MODELS = {
    '': RandomModel(),
}


class _Scorer(object):
    """Helper to compute the scores of multiple models for a given project."""

    def __init__(self, project):
        self._project = project
        # A cache of scores keyed by scoring model names.
        self._scores = {}

    def _get_score(self, scoring_model_name):
        if scoring_model_name in self._scores:
            return self._scores[scoring_model_name]

        scoring_model = get_scoring_model(scoring_model_name)
        if scoring_model is None:
            logging.warning(
                'Scoring model "%s" unknown, falling back to default.', scoring_model_name)
            score = self._get_score('')
            self._scores[scoring_model_name] = score
            return score

        score = scoring_model.score(self._project)
        if scoring_model_name:
            self._scores[scoring_model_name] = score
        return score


class _FilterHelper(_Scorer):
    """A helper object to cache scoring in the filter function."""

    def apply(self, filters):
        """Apply all filters to the project.

        Returns:
            False if any of the filters returned a negative value for the
            project. True if there are no filters.
        """

        return all(self._get_score(f) > 0 for f in filters)


def filter_using_score(iterable, get_scoring_func, project):
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

    helper = _FilterHelper(project)
    for item in iterable:
        if helper.apply(get_scoring_func(item)):
            yield item


def register_model(model_name, model):
    """Register a scoring model."""

    if model_name in SCORING_MODELS:
        raise ValueError('The model "{}" already exists.'.format(model_name))
    SCORING_MODELS[model_name] = model


def register_regexp(regexp, constructor, example):
    """Register regexp based scoring models."""

    if not regexp.match(example):
        raise ValueError(
            'The example "{}" does not match the pattern "{}".'.format(example, regexp))
    if get_scoring_model(example, cache_generated_model=False):
        raise ValueError('The pattern "{}" is probably already used'.format(regexp))
    SCORING_MODEL_REGEXPS.append(_ScoringModelRegexp(regexp, constructor))
