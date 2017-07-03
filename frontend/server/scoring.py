# encoding: utf-8
"""Scoring module for chantiers and actions.

See design doc at http://go/pe:scoring-chantiers.
"""
import collections
import datetime
import itertools
import logging
import math
import random
import re

from bob_emploi.frontend import companies
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


# TODO(pascal): Split this file and remove the line below.
# pylint: disable=too-many-lines

# Score for each percent of additional job offers that a chantier enables. We
# want to have a score of 3 for 30% increase.
_SCORE_PER_JOB_OFFERS_PERCENT = .1

# Score per interview ratio. E.g. a value of 1/5 would make us recommend a
# small impact chantier (1 impact point) if a user gets an interview for every
# 5 applications they do; a value of 1/15 would make us recommend a large
# impact chantier (3 impact points) or 3 small ones if auser gets an interview
# for every 15 applications.
_SCORE_PER_INTERVIEW_RATIO = 1 / 5

# Average number of days per month.
_DAYS_PER_MONTH = 365.25 / 12

# Average number of weeks per month.
_WEEKS_PER_MONTH = 52 / 12

# Maximum of the estimation scale for English skills, or office tools.
_ESTIMATION_SCALE_MAX = 3

_JOB_BOARDS = proto.MongoCachedCollection(jobboard_pb2.JobBoard, 'jobboards')

_ASSOCIATIONS = proto.MongoCachedCollection(association_pb2.Association, 'associations')

_APPLICATION_TIPS = proto.MongoCachedCollection(application_pb2.ApplicationTip, 'application_tips')

# Distance below which the city is so close that it is obvious.
_MIN_CITY_DISTANCE = 8

# Distance above which the city is so far that it should not be considered.
_MAX_CITY_DISTANCE = 35


def compute_square_distance(city_a, city_b):
    """Compute the approximative distance between two cities.

        Since we only look at short distances, we can approximate that, for metropolitan france:

        1° latitude = 111km
        1° longitude = 73km
        Caveat: this approximation will be bad for DOM close to the equator, recommending some
        people to commute up to 2x further than in France.
        TODO(guillaume): Improve approximation.
    """
    delta_y = (city_a.latitude - city_b.latitude) * 111
    delta_x = (city_a.longitude - city_b.longitude) * 73
    return delta_x * delta_x + delta_y * delta_y


def is_city_quite_close(city_a, city_b):
    """Return true if the city is not too far for commute, but not too close to be obvious."""
    square_distance = compute_square_distance(city_a, city_b)
    return (square_distance > _MIN_CITY_DISTANCE * _MIN_CITY_DISTANCE and
            square_distance < _MAX_CITY_DISTANCE * _MAX_CITY_DISTANCE)


def is_city_very_close(city_a, city_b):
    """Return true if the city is so close that it is obviously known."""
    square_distance = compute_square_distance(city_a, city_b)
    return square_distance <= _MIN_CITY_DISTANCE * _MIN_CITY_DISTANCE


class ScoringProject(object):
    """The project and its environment for the scoring.

    When deciding whether a chantier is useful or not for a given project we
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
        self._jobboards = None
        self._associations = None
        self._nearby_cities = None
        self._application_tips = None
        self._volunteering_missions = None

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def local_diagnosis(self):
        """Get local stats for the project's job group and département."""
        if self._local_diagnosis is not None:
            return self._local_diagnosis

        self._local_diagnosis = job_pb2.LocalJobStats()
        local_id = '%s:%s' % (
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
        offers = imt.yearly_avg_offers_per_10_candidates or imt.yearly_avg_offers_per_10_openings
        if not offers:
            # No job offers at all, ouch!
            return 1000
        return imt.yearly_avg_offers_denominator / offers

    def _rome_id(self):
        return self.details.target_job.job_group.rome_id

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

    def list_jobboards(self):
        """List all job boards for this project."""
        if self._jobboards:
            return self._jobboards

        all_job_boards = _JOB_BOARDS.get_collection(self._db)
        self._jobboards = list(filter_using_score(all_job_boards, lambda j: j.filters, self))
        return self._jobboards

    def list_associations(self):
        """List all associations for this project."""
        if self._associations:
            return self._associations

        all_associations = _ASSOCIATIONS.get_collection(self._db)
        self._associations = list(filter_using_score(all_associations, lambda j: j.filters, self))
        return self._associations

    def _get_commuting_cities(self, interesting_cities_for_rome, target_city):
        # Get the reference offers per inhabitant.

        ref = next((h.offers / h.city.population
                    for h in interesting_cities_for_rome
                    if h.city.city_id == target_city.city_id and h.city.population), 0)

        for hiring_city in interesting_cities_for_rome:
            distance = math.sqrt(compute_square_distance(hiring_city.city, target_city))

            if distance < _MAX_CITY_DISTANCE:
                try:
                    relative_offers = (hiring_city.offers / hiring_city.city.population) / ref
                except ZeroDivisionError:
                    relative_offers = 0

                yield commute_pb2.CommutingCity(
                    name=hiring_city.city.name,
                    relative_offers_per_inhabitant=relative_offers,
                    distance_km=distance)

    def list_nearby_cities(self):
        """Compute and store all interesting cities that are not too close and not too far.

           Those cities will be used by the Commute advice.
        """
        if self._nearby_cities is not None:
            return self._nearby_cities
        self._nearby_cities = []

        job_group = self.details.target_job.job_group.rome_id

        all_cities = commute_pb2.HiringCities()
        proto.parse_from_mongo(self._db.hiring_cities.find_one({'_id': job_group}), all_cities)
        interesting_cities_for_rome = all_cities.hiring_cities

        if not interesting_cities_for_rome:
            return []

        target_city = geo_pb2.FrenchCity()
        mongo_city = self._db.cities.find_one({'_id': self.details.mobility.city.city_id})
        if not mongo_city:
            return []
        proto.parse_from_mongo(mongo_city, target_city)

        commuting_cities = list(
            self._get_commuting_cities(interesting_cities_for_rome, target_city))

        obvious_cities = [
            city for city in commuting_cities
            if city.distance_km < _MIN_CITY_DISTANCE]

        interesting_cities = [
            city for city in commuting_cities
            if city.distance_km >= _MIN_CITY_DISTANCE]

        # If there is only one city nearby and no obvious city, the nearby city becomes obvious, so
        # we do not recommend it.
        if len(interesting_cities) == 1 and not obvious_cities:
            return []

        self._nearby_cities = interesting_cities
        return self._nearby_cities

    def volunteering_missions(self):
        """Return a list of volunteering mission close to the project."""
        if self._volunteering_missions is not None:
            return self._volunteering_missions

        departement_id = self.details.mobility.city.departement_id

        # Get data from MongoDB.
        volunteering_missions_dict = collections.defaultdict(association_pb2.VolunteeringMissions)
        for record in self._db.volunteering_missions.find({'_id': {'$in': [departement_id, '']}}):
            record_id = record.pop('_id')
            proto.parse_from_mongo(record, volunteering_missions_dict[record_id])

        # TODO(pascal): First get missions from target city if any.

        # Merge data.
        project_missions = association_pb2.VolunteeringMissions()
        for scope in [departement_id, '']:
            for mission in volunteering_missions_dict[scope].missions:
                mission.is_available_everywhere = not scope
                project_missions.missions.add().CopyFrom(mission)

        self._volunteering_missions = project_missions
        return project_missions

    def list_application_tips(self):
        """List all application tips available for this project."""
        if self._application_tips:
            return self._application_tips

        all_application_tips = _APPLICATION_TIPS.get_collection(self._db)
        self._application_tips = list(filter_using_score(
            all_application_tips, lambda j: j.filters, self))
        return self._application_tips


class _Score(collections.namedtuple('Score', ['score', 'additional_job_offers'])):

    def __new__(cls, score, additional_job_offers=0):
        return super(_Score, cls).__new__(cls, score, additional_job_offers)


class _ScoringModelBase(object):
    """A base/default scoring model.

    This class can be used either directly for chantiers that do not specify
    any scoring models, or as a base class for more complex scoring models.

    The sub classes should override the score method.
    """

    # If we do standard computation across models, add it here and use this one
    # as a base class.

    def score(self, unused_project):
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score` to avoid the fallback to a random value.
        """
        return _Score(random.random() * 3)


class _AdviceEventScoringModel(_ScoringModelBase):
    """A scoring model for Advice that user needs to go to events."""

    def score(self, project):
        imt = project.imt_proto()
        first_modes = set(mode.first for mode in imt.application_modes.values())
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return _Score(2)

        return _Score(1)


class _ImproveYourNetworkScoringModel(_ScoringModelBase):
    """A scoring model for Advice that user needs to improve their network."""

    def __init__(self, network_level):
        self._network_level = network_level

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.network_estimate != self._network_level:
            return _Score(0)

        imt = project.imt_proto()
        first_modes = set(mode.first for mode in imt.application_modes.values())
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return _Score(3)

        return _Score(2)


class ConstantScoreModel(_ScoringModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score):
        self.constant_score = float(constant_score)

    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""
        return _Score(self.constant_score)


class _SpontaneousApplicationScoringModel(_ScoringModelBase):
    """A scoring model for the "Send spontaneous applications" chantier.

    See http://go/pe:chantiers/rec2qz1yvVzEysaTd
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        imt = project.imt_proto()
        first_modes = set(mode.first for mode in imt.application_modes.values())
        if job_pb2.SPONTANEOUS_APPLICATION in first_modes:
            return _Score(3)

        second_modes = set(mode.second for mode in imt.application_modes.values())
        if job_pb2.SPONTANEOUS_APPLICATION in second_modes:
            return _Score(2)

        return _Score(0)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.SpontaneousApplicationData(companies=[
            companies.to_proto(c)
            for c in itertools.islice(companies.get_lbb_companies(project.details), 5)])


class _ActiveExperimentFilter(_ScoringModelBase):
    """A scoring model to filter on a feature enabled."""

    def __init__(self, feature):
        self.feature = feature

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        try:
            if getattr(project.features_enabled, self.feature) == user_pb2.ACTIVE:
                return _Score(3)
        except AttributeError:
            logging.warning(
                'A scoring model is referring to a non existant feature flag: "%s"', self.feature)
        return _Score(0)


class _UserProfileFilter(_ScoringModelBase):
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
            return _Score(3)
        return _Score(0)


class _ProjectFilter(_ScoringModelBase):
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
            return _Score(3)
        return _Score(0)


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
    """A scoring model to filter on a job group."""

    def __init__(self, job_groups, exclude_jobs=None):
        super(_JobFilter, self).__init__(self._filter)
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


class _NegateFilter(_ScoringModelBase):
    """A scoring model to filter the opposite of another filter."""

    def __new__(cls, negated_filter_name):
        self = super(_NegateFilter, cls).__new__(cls)
        self.negated_filter = get_scoring_model(negated_filter_name)
        if self.negated_filter is None:
            return None
        return self

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        return _Score(3 - self.negated_filter.score(project).score)


class _ApplicationComplexityFilter(_ScoringModelBase):
    """A scoring model to filter on job group application complexity."""

    def __init__(self, application_complexity):
        super(_ApplicationComplexityFilter, self).__init__()
        self._application_complexity = application_complexity

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._application_complexity == project.job_group_info().application_complexity:
            return _Score(3)
        return _Score(0)


class _AdviceOtherWorkEnv(_ScoringModelBase):
    """A scoring model to trigger the "Other Work Environment" Advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.OtherWorkEnvAdviceData(
            work_environment_keywords=project.job_group_info().work_environment_keywords)

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        work_env = project.job_group_info().work_environment_keywords
        if len(work_env.structures) > 1 or len(work_env.sectors) > 1:
            return _Score(2)
        return _Score(0)


class _AdviceVolunteer(_ScoringModelBase):
    """A scoring model to trigger the "Try volunteering" Advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        association_names = [m.association_name for m in project.volunteering_missions().missions]

        # Deduplicate association names.
        seen = set()
        association_names = [n for n in association_names if not (n in seen or seen.add(n))]

        return project_pb2.VolunteerData(association_names=association_names[:3])

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        missions = project.volunteering_missions().missions
        if not missions:
            return _Score(0)
        if project.details.job_search_length_months < 3:
            return _Score(1)
        if project.details.job_search_length_months < 9:
            return _Score(2)
        return _Score(3)


class _AdviceImproveInterview(_ScoringModelBase):
    """A scoring model to trigger the "Improve your interview skills" advice."""

    _NUM_INTERVIEWS = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 1,
        project_pb2.DECENT_AMOUNT: 5,
        project_pb2.A_LOT: 10,
    }

    def _max_monthly_interviews(self, project):
        """Maximum number of monthly interviews one should have."""
        if project.job_group_info().application_complexity == job_pb2.COMPLEX_APPLICATION_PROCESS:
            return 5
        return 3

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            requirements=project.handcrafted_job_requirements())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.total_interview_count < 0:
            num_interviews = 0
        elif project.details.total_interview_count > 0:
            num_interviews = project.details.total_interview_count
        else:
            num_interviews = self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)
        num_monthly_interviews = num_interviews / (project.details.job_search_length_months or 1)
        if num_monthly_interviews > self._max_monthly_interviews(project):
            return _Score(3)
        # Whatever the number of month of search, trigger 3 if the user did more than 5 interviews:
        if num_interviews >= self._NUM_INTERVIEWS[project_pb2.A_LOT]:
            return _Score(3)
        return _Score(0)


class _AdviceBetterJobInGroup(_ScoringModelBase):
    """A scoring model to trigger the "Change to better job in your job group" advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        specific_jobs = project.requirements().specific_jobs
        if not specific_jobs or specific_jobs[0].code_ogr == project.details.target_job.code_ogr:
            return _Score(0)

        try:
            target_job_percentage = next(
                j.percent_suggested for j in specific_jobs
                if j.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            target_job_percentage = 0

        if target_job_percentage + 20 < specific_jobs[0].percent_suggested:
            return _Score(2)

        return _Score(1)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        specific_jobs = project.requirements().specific_jobs

        if not specific_jobs:
            return None

        extra_data = project_pb2.BetterJobInGroupData()
        try:
            extra_data.num_better_jobs = next(
                i for i, job in enumerate(specific_jobs)
                if job.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            # Target job is not mentionned in the specific jobs, do not mention
            # the number of better jobs.
            pass

        all_jobs = project.job_group_info().jobs
        try:
            best_job = next(
                job for job in all_jobs
                if job.code_ogr == specific_jobs[0].code_ogr)
            extra_data.better_job.CopyFrom(best_job)
        except StopIteration:
            logging.warning(
                'Better job "%s" is not listed in the group "%s"', specific_jobs[0].code_ogr,
                project.job_group_info().rome_id)

        return extra_data


class _AdviceImproveResume(_ScoringModelBase):
    """A scoring model to trigger the "Improve your resume to get more interviews" advice."""

    _APPLICATION_PER_WEEK = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 2,
        project_pb2.DECENT_AMOUNT: 6,
        project_pb2.A_LOT: 15,
    }

    _NUM_INTERVIEWS = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 1,
        project_pb2.DECENT_AMOUNT: 5,
        project_pb2.A_LOT: 10,
    }

    def _num_interviews(self, project):
        if project.details.total_interview_count < 0:
            return 0
        if project.details.total_interview_count:
            return project.details.total_interview_count
        return self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)

    def _num_interviews_increase(self, project):
        """Compute the increase (in ratio) of # of interviews that one could hope for."""
        if project.details.total_interviews_estimate >= project_pb2.A_LOT or \
                project.details.total_interview_count > 20:
            return 0

        job_search_length_weeks = project.details.job_search_length_months * 52 / 12
        num_applicants_per_offer = project.market_stress() or 2.85
        weekly_applications = self._APPLICATION_PER_WEEK.get(
            project.details.weekly_applications_estimate, 0)
        num_applications = job_search_length_weeks * weekly_applications
        num_potential_interviews = num_applications / num_applicants_per_offer
        return num_potential_interviews / (self._num_interviews(project) or 1)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            num_interviews_increase=self._num_interviews_increase(project),
            requirements=project.handcrafted_job_requirements())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._num_interviews_increase(project) >= 2:
            return _Score(3)
        return _Score(0)


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


class _LowPriorityAdvice(_ScoringModelBase):

    def __init__(self, main_frustration):
        super(_LowPriorityAdvice, self).__init__()
        self._main_frustration = main_frustration

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._main_frustration in project.user_profile.frustrations:
            return _Score(2)
        return _Score(1)


class _AdviceJobBoards(_LowPriorityAdvice):
    """A scoring model to trigger the "Find job boards" advice."""

    def __init__(self):
        super(_AdviceJobBoards, self).__init__(user_pb2.NO_OFFERS)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        jobboards = project.list_jobboards()
        if not jobboards:
            return None
        sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
        best_job_board = sorted_jobboards[0]
        return project_pb2.JobBoardsData(
            job_board_title=best_job_board.title,
            is_specific_to_job_group=any(
                f.startswith('for-job') for f in best_job_board.filters),
            is_specific_to_region=any(
                f.startswith('for-departement') for f in best_job_board.filters),
        )


class _AdviceCommuteScoringModel(_ScoringModelBase):
    """A scoring model to trigger the "Commute" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.CommuteData(cities=[c.name for c in project.list_nearby_cities()])

    def score(self, project):
        if project.list_nearby_cities():
            return _Score(2)
        return _Score(0)


class _AdviceAssociationHelp(_ScoringModelBase):
    """A scoring model to trigger the "Find an association to help you" advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if not project.list_associations():
            return _Score(0)
        if user_pb2.MOTIVATION in project.user_profile.frustrations:
            return _Score(3)
        return _Score(2)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        associations = project.list_associations()
        if not associations:
            return None
        sorted_associations = sorted(associations, key=lambda j: (-len(j.filters), random.random()))
        return project_pb2.AssociationsData(association_name=sorted_associations[0].name)


_ScoringModelRegexp = collections.namedtuple('ScoringModelRegexp', ['regexp', 'constructor'])


_SCORING_MODEL_REGEXPS = (
    # Matches strings like "for-job-group(M16)" or "for-job-group(A12, A13)".
    _ScoringModelRegexp(re.compile(r'^for-job-group\((.*)\)$'), JobGroupFilter),
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
    '': _ScoringModelBase(),
    'advice-association-help': _AdviceAssociationHelp(),
    'advice-better-job-in-group': _AdviceBetterJobInGroup(),
    'advice-better-network': _ImproveYourNetworkScoringModel(2),
    'advice-event': _AdviceEventScoringModel(),
    'advice-fresh-resume': _AdviceFreshResume(),
    'advice-improve-interview': _AdviceImproveInterview(),
    'advice-improve-network': _ImproveYourNetworkScoringModel(1),
    'advice-improve-resume': _AdviceImproveResume(),
    'advice-commute': _AdviceCommuteScoringModel(),
    'advice-job-boards': _AdviceJobBoards(),
    'advice-more-offer-answers': _LowPriorityAdvice(user_pb2.NO_OFFER_ANSWERS),
    'advice-other-work-env': _AdviceOtherWorkEnv(),
    'advice-use-good-network': _ImproveYourNetworkScoringModel(3),
    'advice-volunteer': _AdviceVolunteer(),
    'advice-wow-baker': _JobFilter(job_groups={'D1102'}, exclude_jobs={'12006'}),
    'chantier-spontaneous-application': _SpontaneousApplicationScoringModel(),
    'for-complex-application': _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS),
    'for-discovery': _ProjectFilter(
        lambda project: project.intensity == project_pb2.PROJECT_FIGURING_INTENSITY),
    'for-experienced(2)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.INTERMEDIARY),
    'for-experienced(6)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.SENIOR),
    'for-experienced(10)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.EXPERT),
    'for-frustrated-old(50)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth > 50),
    'for-frustrated-young(25)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth < 25),
    'for-handicaped': _UserProfileFilter(
        lambda user: user_pb2.HANDICAPED in user.frustrations or user.has_handicap),
    'for-not-employed-anymore': _UserProfileFilter(
        lambda user: user.situation == user_pb2.LOST_QUIT),
    'for-qualified(bac+3)': _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.LICENCE_MAITRISE),
    'for-searching-forever': _ProjectFilter(
        lambda project: project.job_search_length_months >= 19),
    'for-simple-application': _ApplicationComplexityFilter(job_pb2.SIMPLE_APPLICATION_PROCESS),
    'for-single-parent': _UserProfileFilter(
        lambda user: user_pb2.SINGLE_PARENT in user.frustrations or
        user.family_situation == user_pb2.SINGLE_PARENT_SITUATION),
    'for-unemployed': _UserProfileFilter(
        lambda user: user.situation and user.situation != user_pb2.EMPLOYED),
    'for-unqualified(bac)': _UserProfileFilter(
        lambda user: user.highest_degree <= job_pb2.BAC_BACPRO),
    'for-women': _UserProfileFilter(lambda user: user.gender == user_pb2.FEMININE),
}


_ScoreAndReasons = collections.namedtuple('ScoreAndReasons', ['score', 'additional_job_offers'])


class _Scorer(object):
    """Helper to compute the scores of multiple models for a given project."""

    def __init__(self, project):
        self._project = project
        # A cache of scores (_ScoreAndReasons) keyed by scoring model names.
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
        return all(self._get_score(f).score > 0 for f in filters)


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
