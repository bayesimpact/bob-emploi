# encoding: utf-8
"""Scoring module for advices and actions.

See design doc at http://go/bob:scoring-advices.
"""
import collections
import datetime
import functools
from importlib import util as importlib_util
import itertools
import logging
from os import path
import random
import re
from urllib import parse

import unidecode

from bob_emploi.frontend import companies
from bob_emploi.frontend import french
from bob_emploi.frontend import proto
from bob_emploi.frontend import carif
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2


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
        self._nearby_cities = None
        self._application_tips = None
        self._trainings = None
        self._best_departements = None
        self._seasonal_departements = None
        self._module_cache = {}

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def local_diagnosis(self):
        """Get local stats for the project's job group and département."""
        if self._local_diagnosis is not None:
            return self._local_diagnosis

        self._local_diagnosis = job_pb2.LocalJobStats()
        local_id = '{}:{}'.format(
            self.details.mobility.city.departement_id,
            self.details.target_job.job_group.rome_id)
        # TODO(pascal): Handle when return is False (no data).
        proto.parse_from_mongo(
            self._db.local_diagnosis.find_one({'_id': local_id}), self._local_diagnosis)

        return self._local_diagnosis

    def imt_proto(self):
        """Get IMT data for the project's job and département."""
        return self.local_diagnosis().imt

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

        self._job_group_info = job_pb2.JobGroup()
        proto.parse_from_mongo(
            self._db.job_group_info.find_one({'_id': self._rome_id()}),
            self._job_group_info)
        return self._job_group_info

    def requirements(self):
        """Get the project requirements."""
        return self.job_group_info().requirements

    def handcrafted_job_requirements(self):
        """Handcrafted job requirements for the target job."""
        handcrafted_requirements = job_pb2.JobRequirements()
        all_requirements = self.requirements()
        handcrafted_fields = [
            field for field in job_pb2.JobRequirements.DESCRIPTOR.fields_by_name.keys()
            if field.endswith('_short_text')]
        for field in handcrafted_fields:
            setattr(handcrafted_requirements, field, getattr(all_requirements, field))
        return handcrafted_requirements

    def get_trainings(self):
        """Get the training opportunities from our partner's API."""
        if self._trainings is not None:
            return self._trainings
        self._trainings = carif.get_trainings(
            self.details.target_job.job_group.rome_id, self.details.mobility.city.departement_id)
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

    def populate_template(self, template):
        """Populate a template with project variables.

        Args:
            template: a string that may or may not contain placeholders e.g.
                %romeId, %departementId.
        Returns:
            A string with the placeholder replaced by actual values.
        """
        if '%' not in template:
            return template
        city = self.details.mobility.city
        job = self.details.target_job
        is_feminine = self.user_profile.gender == user_pb2.FEMININE
        genderized_determiner = 'une' if is_feminine else 'un'
        genderized_job_name = french.lower_first_letter(
            (job.feminine_name if is_feminine else job.masculine_name) or job.name)
        project_vars = {
            '%aJobName': '{} {}'.format(genderized_determiner, genderized_job_name),
            '%cityId': city.city_id,
            '%cityName': parse.quote(city.name),
            '%inCity': french.in_city(city.name),
            '%inDomain': self.job_group_info().in_domain,
            '%ofCity': french.of_city(city.name),
            '%experienceDuration': _EXPERIENCE_DURATION.get(self.details.seniority),
            '%latin1CityName': parse.quote(city.name.encode('latin-1', 'replace')),
            '%departementId': city.departement_id,
            '%postcode': city.postcodes.split('-')[0] or (
                city.departement_id + '0' * (5 - len(city.departement_id))),
            '%regionId': city.region_id,
            '%romeId': job.job_group.rome_id,
            '%jobId': job.code_ogr,
            '%jobName': genderized_job_name,
            '%ofJobName': french.maybe_contract_prefix('de ', "d'", genderized_job_name),
            '%jobGroupNameUrl': parse.quote(unidecode.unidecode(
                job.job_group.name.lower().replace(' ', '-').replace("'", '-'))),
            '%masculineJobName': parse.quote(job.masculine_name),
            '%latin1MasculineJobName': parse.quote(job.masculine_name.encode('latin-1', 'replace')),
        }
        pattern = re.compile('|'.join(project_vars.keys()))
        new_template = pattern.sub(lambda v: project_vars[v.group(0)], template)
        if _TEMPLATE_VAR.match(new_template):
            logging.warning(
                'One or more template variables have not been replaced in:\n%s',
                new_template)
        return new_template


class ModelBase(object):
    """A base/default scoring model.

    This class can be used either directly for advices that do not specify
    any scoring models, or as a base class for more complex scoring models.

    The sub classes should override the score method.
    """

    # If we do standard computation across models, add it here and use this one
    # as a base class.

    def score(self, unused_project):
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score` to avoid the fallback to a random value.
        """
        return random.random() * 3


class ConstantScoreModel(ModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score):
        self.constant_score = float(constant_score)

    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""
        return self.constant_score


class _AdviceTrainingScoringModel(ModelBase):
    """A scoring model for the training advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return training_pb2.Trainings(trainings=project.get_trainings())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        # TODO(guillaume): Get the score for each project from lbf.
        all_trainings = project.get_trainings()

        if not all_trainings:
            return 0

        if len(all_trainings) >= 2:
            if project.details.job_search_length_months >= 3:
                return 3
            if project.details.kind == project_pb2.REORIENTATION >= 3:
                return 3
        if project.details.job_search_length_months >= 2:
            return 2

        return 1


class _AdviceSpecificToJob(ModelBase):
    """A scoring model for the "Specific to Job" advice module."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.specific_to_job_advice_config():
            return 3
        return 0

    def get_advice_override(self, project, unused_advice):
        """Get override data for an advice."""
        config = project.specific_to_job_advice_config()

        is_feminine = project.user_profile.gender == user_pb2.FEMININE
        if is_feminine and config.expanded_card_items_feminine:
            expanded_card_items = config.expanded_card_items_feminine
        else:
            expanded_card_items = config.expanded_card_items

        if is_feminine and config.expanded_card_header_feminine:
            expanded_card_header = config.expanded_card_header_feminine
        else:
            expanded_card_header = config.expanded_card_header

        return project_pb2.Advice(
            title=config.title,
            card_text=config.card_text,
            expanded_card_header=expanded_card_header,
            expanded_card_items=expanded_card_items,
        )


class _SpontaneousApplicationScoringModel(ModelBase):
    """A scoring model for the "Send spontaneous applications" advice module."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(
            fap_modes.modes[0].mode for fap_modes in application_modes
            if len(fap_modes.modes))
        if job_pb2.SPONTANEOUS_APPLICATION in first_modes:
            return 3

        second_modes = set(
            fap_modes.modes[1].mode for fap_modes in application_modes
            if len(fap_modes.modes) > 1)
        if job_pb2.SPONTANEOUS_APPLICATION in second_modes:
            return 2

        return 0

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.SpontaneousApplicationData(companies=[
            companies.to_proto(c)
            for c in itertools.islice(companies.get_lbb_companies(project.details), 5)])


class _ActiveExperimentFilter(ModelBase):
    """A scoring model to filter on a feature enabled."""

    def __init__(self, feature):
        self.feature = feature

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        try:
            if getattr(project.features_enabled, self.feature) == user_pb2.ACTIVE:
                return 3
        except AttributeError:
            logging.warning(
                'A scoring model is referring to a non existant feature flag: "%s"', self.feature)
        return 0


class _UserProfileFilter(ModelBase):
    """A scoring model to filter on a user's profile property.

    It takes a filter function that takes the user's profile as parameter. If
    this function returns true, the score for any project taken by the user
    would be 3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to users with a computer:
        _UserProfileFilter(lambda user: user.has_access_to_computer)
    """

    def __init__(self, filter_func):
        self.filter_func = filter_func

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self.filter_func(project.user_profile):
            return 3
        return 0


class _ProjectFilter(ModelBase):
    """A scoring model to filter on a project's property.

    It takes a filter function that takes the project as parameter. If this
    function returns true, the score for any project taken by the user would be
    3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to projects about job group A1234:
        _ProjectFilter(lambda project: project.target_job.job_group.rome_id == 'A12344)
    """

    def __init__(self, filter_func):
        super(_ProjectFilter, self).__init__()
        self.filter_func = filter_func

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self.filter_func(project.details):
            return 3
        return 0


class JobGroupFilter(_ProjectFilter):
    """A scoring model to filter on a job group."""

    def __init__(self, job_group_start):
        super(JobGroupFilter, self).__init__(self._filter)
        self._job_group_starts = [prefix.strip() for prefix in job_group_start.split(',')]

    def _filter(self, project):
        for job_group_start in self._job_group_starts:
            if project.target_job.job_group.rome_id.startswith(job_group_start):
                return True
        return False


class _JobFilter(_ProjectFilter):
    """A scoring model to filter on specific jobs."""

    def __init__(self, jobs):
        super(_JobFilter, self).__init__(self._filter)
        self._jobs = set(job.strip() for job in jobs.split(','))

    def _filter(self, project):
        return project.target_job.code_ogr in self._jobs


class _JobGroupWithoutJobFilter(_ProjectFilter):
    """A scoring model to filter on a job group but exclude some jobs."""

    def __init__(self, job_groups, exclude_jobs=None):
        super(_JobGroupWithoutJobFilter, self).__init__(self._filter)
        self._job_groups = set(job_groups)
        self._exclude_jobs = set(exclude_jobs) or {}

    def _filter(self, project):
        if project.target_job.code_ogr in self._exclude_jobs:
            return False
        if project.target_job.job_group.rome_id in self._job_groups:
            return True
        return False


class _DepartementFilter(_ProjectFilter):
    """A scoring model to filter on the département."""

    def __init__(self, departements):
        super(_DepartementFilter, self).__init__(self._filter)
        self._departements = set(d.strip() for d in departements.split(','))

    def _filter(self, project):
        return project.mobility.city.departement_id in self._departements


class _OldUserFilter(_UserProfileFilter):
    """A scoring model to filter on the age."""

    def __init__(self, min_age):
        super(_OldUserFilter, self).__init__(self._filter)
        self._min_age = int(min_age)

    def _filter(self, user):
        return datetime.date.today().year - user.year_of_birth > self._min_age


class _YoungUserFilter(_UserProfileFilter):
    """A scoring model to filter on the age."""

    def __init__(self, max_age):
        super(_YoungUserFilter, self).__init__(self._filter)
        self._max_age = int(max_age)

    def _filter(self, user):
        return datetime.date.today().year - user.year_of_birth < self._max_age


class _NegateFilter(ModelBase):
    """A scoring model to filter the opposite of another filter."""

    def __new__(cls, negated_filter_name):
        self = super(_NegateFilter, cls).__new__(cls)
        self.negated_filter = get_scoring_model(negated_filter_name)
        if self.negated_filter is None:
            return None
        return self

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        return 3 - self.negated_filter.score(project)


class _ApplicationComplexityFilter(ModelBase):
    """A scoring model to filter on job group application complexity."""

    def __init__(self, application_complexity):
        super(_ApplicationComplexityFilter, self).__init__()
        self._application_complexity = application_complexity

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._application_complexity == project.job_group_info().application_complexity:
            return 3
        return 0


class _AdviceOtherWorkEnv(ModelBase):
    """A scoring model to trigger the "Other Work Environment" Advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.OtherWorkEnvAdviceData(
            work_environment_keywords=project.job_group_info().work_environment_keywords)

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        work_env = project.job_group_info().work_environment_keywords
        if len(work_env.structures) > 1 or len(work_env.sectors) > 1:
            return 2
        return 0


class _AdviceLifeBalanceScoringModel(ModelBase):
    """A scoring model to trigger the "life balance" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.user_profile.has_handicap:
            return 0

        if project.details.job_search_length_months > 3:
            return 1

        return 0


class _AdviceVae(ModelBase):
    """A scoring model to trigger the "VAE" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        is_frustrated_by_trainings = user_pb2.TRAINING in project.user_profile.frustrations
        has_experience = project.details.seniority in set([project_pb2.SENIOR, project_pb2.EXPERT])
        thinks_xp_covers_diplomas = \
            project.details.training_fulfillment_estimate == project_pb2.ENOUGH_EXPERIENCE

        does_not_have_required_diplomas = \
            project.details.training_fulfillment_estimate in set([
                project_pb2.ENOUGH_EXPERIENCE,
                project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
                project_pb2.CURRENTLY_IN_TRAINING])

        if project.details.training_fulfillment_estimate == project_pb2.ENOUGH_DIPLOMAS:
            return 0

        if thinks_xp_covers_diplomas:
            if is_frustrated_by_trainings or has_experience:
                return 3
            return 2

        if has_experience and (does_not_have_required_diplomas or is_frustrated_by_trainings):
            return 2

        return 0


class _AdviceSenior(ModelBase):
    """A scoring model to trigger the "Senior" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        user = project.user_profile
        age = datetime.date.today().year - user.year_of_birth
        if (user_pb2.AGE_DISCRIMINATION in user.frustrations and age > 40) or age >= 45:
            return 2
        return 0


class _AdviceLessApplications(ModelBase):
    """A scoring model to trigger the "Make less applications" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.weekly_applications_estimate == project_pb2.DECENT_AMOUNT or \
                project.details.weekly_applications_estimate == project_pb2.A_LOT:
            return 3
        return 0


class _AdviceFreshResume(_ProjectFilter):
    """A scoring model to trigger the "To start, prepare your resume" advice."""

    def __init__(self):
        super(_AdviceFreshResume, self).__init__(self._should_trigger)

    def _should_trigger(self, project):
        return project.weekly_applications_estimate <= project_pb2.LESS_THAN_2 or \
            project.job_search_length_months < 2

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            requirements=project.handcrafted_job_requirements())


class LowPriorityAdvice(ModelBase):
    """A base advice scoring model that keeps a low priority.

    The priority can go up to 2 if the user has a specific frustration.
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


_SCORING_MODEL_REGEXPS = (
    # Matches strings like "for-job-group(M16)" or "for-job-group(A12, A13)".
    _ScoringModelRegexp(re.compile(r'^for-job-group\((.*)\)$'), JobGroupFilter),
    # Matches strings like "for-job(12006)" or "for-job(12006,12007)".
    _ScoringModelRegexp(re.compile(r'^for-job\((.*)\)$'), _JobFilter),
    # Matches strings like "for-departement(31)" or "for-departement(31, 75)".
    _ScoringModelRegexp(re.compile(r'^for-departement\((.*)\)$'), _DepartementFilter),
    # Matches strings like "not-for-young" or "not-for-active-experiment".
    _ScoringModelRegexp(re.compile(r'^not-(.*)$'), _NegateFilter),
    # Matches strings like "for-active-experiment(lbb_integration)".
    _ScoringModelRegexp(re.compile(r'^for-active-experiment\((.*)\)$'), _ActiveExperimentFilter),
    # Matches strings that are integers.
    _ScoringModelRegexp(re.compile(r'^constant\((.+)\)$'), ConstantScoreModel),
    # Matches strings like "for-old(50)".
    _ScoringModelRegexp(re.compile(r'^for-old\(([0-9]+)\)$'), _OldUserFilter),
    # Matches strings like "for-young(25)".
    _ScoringModelRegexp(re.compile(r'^for-young\(([0-9]+)\)$'), _YoungUserFilter),
)


def get_scoring_model(scoring_model_name):
    """Get a scoring model by its name, may generate it if needed and possible."""
    if scoring_model_name in SCORING_MODELS:
        return SCORING_MODELS[scoring_model_name]

    for regexp, constructor in _SCORING_MODEL_REGEXPS:
        job_group_match = regexp.match(scoring_model_name)
        if job_group_match:
            scoring_model = constructor(job_group_match.group(1))
            if scoring_model:
                SCORING_MODELS[scoring_model_name] = scoring_model
            return scoring_model

    return None


SCORING_MODELS = {
    '': ModelBase(),
    'advice-fresh-resume': _AdviceFreshResume(),
    'advice-life-balance': _AdviceLifeBalanceScoringModel(),
    'advice-more-offer-answers': LowPriorityAdvice(user_pb2.NO_OFFER_ANSWERS),
    'advice-other-work-env': _AdviceOtherWorkEnv(),
    'advice-vae': _AdviceVae(),
    'advice-senior': _AdviceSenior(),
    'advice-specific-to-job': _AdviceSpecificToJob(),
    'advice-less-applications': _AdviceLessApplications(),
    'advice-wow-baker': _JobGroupWithoutJobFilter(job_groups={'D1102'}, exclude_jobs={'12006'}),
    'advice-training': _AdviceTrainingScoringModel(),
    'advice-spontaneous-application': _SpontaneousApplicationScoringModel(),
    'for-complex-application': _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS),
    'for-experienced(2)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.INTERMEDIARY),
    'for-experienced(6)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.SENIOR),
    'for-experienced(10)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.EXPERT),
    'for-first-job-search': _ProjectFilter(
        lambda project: project.kind == project_pb2.FIND_A_FIRST_JOB),
    'for-frustrated-old(50)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth > 50),
    'for-frustrated-young(25)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth < 25),
    'for-high-mobility(country)':  _ProjectFilter(
        lambda project: project.mobility.area_type >= geo_pb2.COUNTRY),
    'for-handicaped': _UserProfileFilter(
        lambda user: user_pb2.HANDICAPED in user.frustrations or user.has_handicap),
    'for-long-search(7)': _ProjectFilter(
        lambda project: project.job_search_length_months >= 7),
    'for-network(1)': _ProjectFilter(lambda project: project.network_estimate == 1),
    'for-network(2)': _ProjectFilter(lambda project: project.network_estimate == 2),
    'for-not-employed-anymore': _UserProfileFilter(
        lambda user: user.situation == user_pb2.LOST_QUIT),
    'for-qualified(bac+3)': _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.LICENCE_MAITRISE),
    'for-qualified(bac+5)': _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.DEA_DESS_MASTER_PHD),
    'for-reorientation': _ProjectFilter(
        lambda project: project.kind == project_pb2.REORIENTATION),
    'for-searching-forever': _ProjectFilter(
        lambda project: project.job_search_length_months >= 19),
    'for-simple-application': _ApplicationComplexityFilter(job_pb2.SIMPLE_APPLICATION_PROCESS),
    'for-single-parent': _UserProfileFilter(
        lambda user: user_pb2.SINGLE_PARENT in user.frustrations or
        user.family_situation == user_pb2.SINGLE_PARENT_SITUATION),
    'for-small-city-inhabitant(20000)': _ProjectFilter(
        lambda project: project.mobility.city.population > 0 and
        project.mobility.city.population <= 20000),
    'for-unemployed': _UserProfileFilter(
        lambda user: user.situation and user.situation != user_pb2.EMPLOYED),
    'for-unqualified(bac)': _UserProfileFilter(
        lambda user: user.highest_degree <= job_pb2.BAC_BACPRO),
    'for-women': _UserProfileFilter(lambda user: user.gender == user_pb2.FEMININE),
    'for-young(25)': _UserProfileFilter(
        lambda user: datetime.date.today().year - user.year_of_birth < 25),
}


def register_model(model_name, model):
    """Register a scoring model."""
    if model_name in SCORING_MODELS:
        raise ValueError('The model "{}" already exists.'.format(model_name))
    SCORING_MODELS[model_name] = model


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


def _load_module(name):
    """Loads an advice module."""
    spec = importlib_util.spec_from_file_location(
        'bob_emploi.frontend.modules.{}'.format(name),
        path.join(path.dirname(__file__), 'modules/{}.py'.format(name)))
    module = importlib_util.module_from_spec(spec)
    spec.loader.exec_module(module)


_load_module('application_tips')
_load_module('associations_help')
_load_module('better_job_in_group')
_load_module('commute')
_load_module('events')
_load_module('jobboards')
_load_module('network')
_load_module('relocate')
_load_module('seasonal_relocate')
_load_module('volunteer')
