# encoding: utf-8
"""Scoring module for chantiers and actions.

See design doc at http://go/pe:scoring-chantiers.
"""
import collections
import datetime
import logging
import math
import random
import re

from bob_emploi.frontend import proto
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
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

# Increase in job offers (in percent) for red chantiers that is roughly
# equivalent to a 1 point target for blue or green chantiers.
JOB_OFFERS_INCREASE_PER_TARGET = 10

# Number of accessible offers that we consider enough: if there are already
# that many offers, we deprioritize chantiers that increase number of available
# offers.
#
# This number is a guestimate based on 10 new job offers per week, staying
# around for 2 months in average, and Pôle Emploi only having 30% of them.
_MAX_NUM_OFFERS_NEEDED = 24

# Maximum of the estimation scale for English skills, or office tools.
_ESTIMATION_SCALE_MAX = 3


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
        self._imt = None
        self._job_group_info = None
        self._unemployment_durations = None

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def imt_proto(self):
        """Get IMT data for the project's job and département."""
        if self._imt is not None:
            return self._imt

        self._imt = job_pb2.ImtLocalJobStats()
        local_id = '%s:%s' % (
            # TODO(pascal): Handle projects with no département.
            self.details.mobility.city.departement_id,
            # TODO(pascal): Handle projects with no target job.
            self.details.target_job.code_ogr)

        # TODO(pascal): Handle when return is False (no data).
        proto.parse_from_mongo(self._db.local_diagnosis.find_one({'_id': local_id}), self._imt)

        return self._imt

    def market_stress(self):
        """Get the ratio of # applicants / # job offers for the project."""
        imt = self.imt_proto()
        if not imt.yearly_avg_offers_denominator:
            return None
        # TODO(stephan): Rename yearly_avg_offers_per_10_opening to
        # yearly_avg_offers_per_10_job_seekers or similar.
        if not imt.yearly_avg_offers_per_10_openings:
            # No job offers at all, ouch!
            return 1000
        return imt.yearly_avg_offers_denominator / imt.yearly_avg_offers_per_10_openings

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

    def _unemployment_duration_at_level(self, area_type):
        """Get the median unemployment time for an area type if available.

        This function loads the data from MongoDB and caches it. To be even
        faster it directly loads all level of area type that are available.

        Returns:
            a UnemploymentDuration proto or None if it is not defined for this
            area type.
        """
        if self._unemployment_durations is not None:
            return self._unemployment_durations.get(area_type)
        city = self.details.mobility.city
        rome_id = self._rome_id()
        diagnosis_ids = {
            '%s:%s' % (city.city_id, rome_id): geo_pb2.CITY,
            'd%s:%s' % (city.departement_id, rome_id): geo_pb2.DEPARTEMENT,
            'r%s:%s' % (city.region_id, rome_id): geo_pb2.REGION,
            rome_id: geo_pb2.COUNTRY,
        }
        mongo_diagnoses = self._db.fhs_local_diagnosis.find(
            {'_id': {'$in': list(diagnosis_ids.keys())}})
        self._unemployment_durations = {}
        for mongo_diagnosis in mongo_diagnoses:
            mongo_area_type = diagnosis_ids[mongo_diagnosis.pop('_id')]
            stats = job_pb2.LocalJobStats()
            if proto.parse_from_mongo(mongo_diagnosis, stats):
                self._unemployment_durations[mongo_area_type] = stats.unemployment_duration
        return self._unemployment_durations.get(area_type)

    def median_unemployment_time(self, area_type=geo_pb2.UNKNOWN_AREA_TYPE, default=90):
        """Get the first median unemployment time available for the project.

        It will try each level of areas (only going wider) until it can find a
        value.

        Args:
            area_type: the minimum level of area to look for the best time (by
                default it picks the one defined by the project's mobility).
            default: the value to return if absolutely no data can be found.
        Returns:
            A number of days.
        """
        if area_type is None:
            area_type = self.details.mobility.area_type
        for try_area_type in geo_pb2.AreaType.values()[1:]:
            if try_area_type < area_type:
                continue
            duration = self._unemployment_duration_at_level(try_area_type)
            if duration:
                return duration.days
        return default

    def max_num_offers(self):
        """Maximum number of job offers available.

        This is the maximum of job offers that a user can access in their
        current project: in a given job group, in a given département.
        Extending their search to CDD, interim, part-time, moving anywhere in
        the département could help them get those offers.
        """
        local_stats = job_pb2.LocalJobStats()
        local_id = '%s:%s' % (
            self.details.mobility.city.departement_id,
            self.details.target_job.job_group.rome_id)
        proto.parse_from_mongo(self._db.recent_job_offers.find_one({'_id': local_id}), local_stats)
        return local_stats.num_available_job_offers


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

    def _get_stable_random(self, project):
        """Get a random number that is stable for each project.

        This function called by the same scoring model (by class) and on the
        same project (by ID) will return the same value.
        """
        randomizer = random.Random(project.details.project_id + self.__class__.__name__)
        return randomizer.random()

    def score(self, unused_project):
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score` to avoid the fallback to a random value.
        """
        return _Score(random.random() * 3)


class _IncreaseJobOffersScoringModel(_ScoringModelBase):
    """A base scoring model for all the Red Chantiers."""

    def additional_job_offers_percent(self, unused_project):
        """Compute raise in number of job offers.

        Note: Use this for models for which we haven't analyzed the necessary data yet,
            to return a static value as we believe that this chantier can be useful for everybody.
            Overwrite this function for models with actual data.
        """
        return 15

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        additional_job_offers = self.additional_job_offers_percent(project)
        return _Score(additional_job_offers * _SCORE_PER_JOB_OFFERS_PERCENT, additional_job_offers)


class _UseYourNetworkScoringModel(_ScoringModelBase):
    """A scoring model for the "Use your network" chantier.

    See http://go/pe:chantiers/recEmfRver85zzw4C
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        # TODO(pascal): Use IMT data to get how important is the network for
        # this project.
        score = 1
        if project.details.network_estimate > 0:
            score += .5 * (project.details.network_estimate - 3)
        market_stress = project.market_stress()
        if market_stress:
            score += .5 * market_stress
        return _Score(score)


class _GetMoreOffersScoringModel(_ScoringModelBase):
    """A scoring model for the "Get more offers" chantier.

    See http://go/pe:chantiers/recBUKv1sIzvciub3
    """

    offers_to_score = {
        project_pb2.LESS_THAN_2: 3,
        project_pb2.SOME: 2,
        project_pb2.DECENT_AMOUNT: 1,
    }

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.NO_OFFERS in project.user_profile.frustrations:
            return _Score(4)
        if project.details.weekly_offers_estimate in self.offers_to_score:
            return _Score(self.offers_to_score[project.details.weekly_offers_estimate])
        return _Score(.01)


class _LearnMoreAboutJobScoringModel(_ScoringModelBase):
    """A scoring model for the "Learn more about the job" chantier.

    See http://go/pe:chantiers/recUTsNXwd3ylXx5y
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.previous_job_similarity != project_pb2.NEVER_DONE:
            return _Score(0)
        score = 1.5
        if project.details.job_search_length_months <= 0:
            score += 1
        return _Score(score)


class _AcceptContractTypeScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for the "Fallback to CDD" chantier.

    See http://go/pe:chantiers/recy3Sr4T7mnor8kX
    """

    def __init__(self, contract_types):
        self.contract_types = set(contract_types)

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if set(project.details.employment_types) & self.contract_types:
            # The project already targets one of these contract type.
            return 0
        percentage_targeted_types = sum(
            c.percent_suggested
            for c in project.requirements().contract_types
            if c.contract_type in self.contract_types)
        return 100 / (1 - min(percentage_targeted_types, 99)/100) - 100


class ConstantScoreModel(_ScoringModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score):
        self.constant_score = constant_score

    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""
        return _Score(self.constant_score)


class _StandOutFromCompetitionScoringModel(_ScoringModelBase):
    """A scoring model for the "Stand out from the competition" chantier.

    See http://go/pe:chantiers/recprlmEghKRsqH8o
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.weekly_applications_estimate != project_pb2.SOME:
            return _Score(0)
        return _Score(2)


class _SpontaneousApplicationScoringModel(_ScoringModelBase):
    """A scoring model for the "Send spontaneous applications" chantier.

    See http://go/pe:chantiers/rec2qz1yvVzEysaTd
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (user_pb2.NO_OFFERS in project.user_profile.frustrations and
                project.details.job_search_length_months > 6):
            return _Score(4)
        return _Score(0)


class _ObtainDrivingLicenseScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for the "Obtain driving license" chantier.

    See http://go/pe:chantiers/rec4I6EPRJ9ea8rCB
    """

    def __init__(self, driving_license):
        self.driving_license = driving_license

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (self.driving_license in project.user_profile.driving_licenses or
                project.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT or
                user_pb2.HANDICAPED in project.user_profile.frustrations or
                (project.details.mobility.city.departement_id == '75' and
                 project.details.mobility.area_type <= geo_pb2.DEPARTEMENT)):
            return 0
        try:
            requirement = next(
                r for r in project.requirements().driving_licenses
                if r.driving_license == self.driving_license)
        except StopIteration:
            return 0
        percent_required = requirement.percent_suggested * requirement.percent_required / 100
        # Unfortunately our data is not clean and we know that in many cases
        # the employer forgot to tell about the requirement. So we use another
        # approximation, and get the geometric mean of both (this is clearly
        # handwaving data science).
        required_when_mentionned = requirement.percent_required
        fake_percent_required = math.sqrt(percent_required * required_when_mentionned)
        return 100 / (1 - min(fake_percent_required, 99)/100) - 100


class _OfficeToolsScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for the "Master Office Tools" chantier.

    See http://go/pe:chantiers/recKFsbKerNua8YA9
    """

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (project.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT or
                project.user_profile.office_skills_estimate >= _ESTIMATION_SCALE_MAX):
            return 0
        try:
            requirement = next(
                r for r in project.requirements().office_skills
                if r.office_skills_level == project.user_profile.office_skills_estimate + 1)
        except StopIteration:
            return 0
        return 100 / (1 - min(requirement.percent_suggested, 99)/100) - 100


class _PartTimeScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for the "Try a Part Time Job" chantier.

    TODO: Use actual data and don't call the super `additional_job_offers_percent`.

    See http://go/pe:chaniiers/recmZKvRrJCfjkP1d
    """

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (project.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT or
                project_pb2.PART_TIME in project.details.workloads):
            return 0
        return super(_PartTimeScoringModel, self).additional_job_offers_percent(project)


class _ImproveEnglishScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for "Improve your English" chantier.

    TODO: Use actual data and don't call the super `additional_job_offers_percent`.

    See http://go/pe:chantiers/rec9W3FpHBsUXADBu
    """

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (project.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT or
                project.user_profile.english_level_estimate >= _ESTIMATION_SCALE_MAX):
            return 0
        return super(_ImproveEnglishScoringModel, self).additional_job_offers_percent(project)


class _TrainingScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for "Plan a Training" chantier.

    TODO: Use actual data and don't call the super `additional_job_offers_percent`.

    See http://go/pe:chantiers/recY7emXfLAZ6kwSj
    """

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (project.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT or
                project.details.diploma_fulfillment_estimate == project_pb2.FULFILLED or
                project.user_profile.situation == user_pb2.IN_TRAINING):
            return 0
        return super(_TrainingScoringModel, self).additional_job_offers_percent(project)


class _ReduceSalaryScoringModel(_IncreaseJobOffersScoringModel):
    """A scoring model for "Reduce your Salary Expectation" chantier.

    TODO: Use actual data and don't call the super `additional_job_offers_percent`.

    See http://go/pe:chantiers/recb069UnblVUVUcc
    """

    def additional_job_offers_percent(self, project):
        """Compute raise in number of job offers."""
        if (project.user_profile.salary_requirement_flexibility == user_pb2.ABSOLUTELY_NOT or
                project.details.min_salary == 0):
            return 0
        return super(_ReduceSalaryScoringModel, self).additional_job_offers_percent(project)


class _MobilityWithoutMoveScoringModel(_ScoringModelBase):
    """A scoring model for the "Mobility without move" chantier.

    See http://go/pe:chantiers/recOqAr4gW8MtMoyg
    """

    def __init__(self, target_area_type, scaling_factor):
        self.target_area_type = target_area_type
        self.scaling_factor = scaling_factor

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.user_profile.geographical_flexibility == user_pb2.ABSOLUTELY_NOT:
            return _Score(0)
        if project.median_unemployment_time() < 90:
            return _Score(0)
        score = 2
        if project.user_profile.geographical_flexibility == user_pb2.YES:
            score += 1
        return _Score(score * self.scaling_factor * (
            project.median_unemployment_time(area_type=geo_pb2.CITY) /
            project.median_unemployment_time(area_type=self.target_area_type) - 1))


class _RelocateScoringModel(_ScoringModelBase):
    """A scoring model for the "Relocate" chantier.

    See http://go/pe:chantiers/recIQDiKBB99CKkY9
    """

    def __init__(self, target_area_type, scaling_factor):
        self.target_area_type = target_area_type
        self.scaling_factor = scaling_factor

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.user_profile.geographical_flexibility == user_pb2.ABSOLUTELY_NOT:
            return _Score(0)
        median_unemployment_time = project.median_unemployment_time()
        if median_unemployment_time < 180:
            return _Score(0)
        score = 2 * self.scaling_factor * (
            project.median_unemployment_time(area_type=geo_pb2.CITY) /
            project.median_unemployment_time(area_type=self.target_area_type) - 1)
        if median_unemployment_time >= 365:
            score += 1
        if project.user_profile.geographical_flexibility == user_pb2.YES:
            score += 1
        return _Score(score)


class _ImproveCVScoringModel(_ScoringModelBase):
    """A scoring model for "Improve your CV/Cover letter" chantier.

    See http://go/pe:chantiers/recHruwJ1nAF5BJYb
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.RESUME in project.user_profile.frustrations:
            return _Score(4)
        if (project.details.total_interviews_estimate >= project_pb2.DECENT_AMOUNT and
                project.details.job_search_length_months < 6):
            return _Score(0)
        score = 2
        market_stress = project.market_stress()
        if market_stress and market_stress >= 2:
            score = 3
        return _Score(score)


class _FightGenderDiscriminationScoringModel(_ScoringModelBase):
    """A scoring model for "Fight gender wage discriminations" chantier.

    See http://go/pe:chantiers/reciQ6buoTJYH8DWW
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (project.user_profile.gender == user_pb2.FEMININE and
                user_pb2.SEX_DISCRIMINATION in project.user_profile.frustrations):
            return _Score(4)
        return _Score(0)


class _ImproveInterviewScoringModel(_ScoringModelBase):
    """A scoring model for "Improve your interview skills" chantier.

    See http://go/pe:chantiers/rec6XRNNb9CX6NpiP
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.INTERVIEW in project.user_profile.frustrations:
            return _Score(4)
        if not project.details.total_interviews_estimate:
            # Unknown interviews.
            return _Score(0)
        job_search_length_weeks = project.details.job_search_length_months * 52 / 12
        return _Score(
            project.details.weekly_applications_estimate * job_search_length_weeks /
            project.details.total_interviews_estimate / 15)


class _ImproveOrganization(_ScoringModelBase):
    """A scoring model for "Stay on top of my organisation" chantier.

    See http://go/pe:chantiers/rec9yEocagBZQqBB1
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.TIME_MANAGEMENT in project.user_profile.frustrations:
            return _Score(4)
        return _Score(project.details.job_search_length_months / 6)


class _StayMotivatedScoringModel(_ScoringModelBase):
    """A scoring model for the "Stay motivated" chantier.

    See http://go/pe:chantiers/rec91fcbhNiDdqoSn
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.MOTIVATION in project.user_profile.frustrations:
            return _Score(4)
        return _Score(project.details.job_search_length_months / 6)


class _ShowcaseAtypicalProfileScoringModel(_ScoringModelBase):
    """A scoring model for the "Showcase your atypical profile" chantier.

    See http://go/pe:chantiers/recYT5juAIoAXJFg0
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if user_pb2.ATYPIC_PROFILE in project.user_profile.frustrations:
            return _Score(4)
        return _Score(0)


class _JobDiscoveryScoringModel(_ScoringModelBase):
    """A scoring model for the "Discover jobs close to yours" chantier.

    See http://go/pe:chantiers/recYETBPqTK4TCyKQ
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.intensity == project_pb2.PROJECT_FIGURING_INTENSITY:
            # User is in a discovery mode, this is the perfect chantier for them.
            return _Score(10)
        if (project.details.target_job.job_group.rome_id !=
                project.user_profile.latest_job.job_group.rome_id):
            # User already targets a different job than his, discover more!
            return _Score(3)
        if project.user_profile.professional_flexibility == user_pb2.YES:
            return _Score(2)
        if project.user_profile.professional_flexibility == user_pb2.IF_NEEDED:
            return _Score(1)
        return _Score(0)


class _SubsidizedContractScoringModel(_ScoringModelBase):
    """A scoring model for the "Learn about subsidized contracts" chantier.

    See http://go/pe:chantiers/recJp1piJLGnVDTz0
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.job_search_length_months < 12:
            return _Score(0)
        score = project.details.job_search_length_months / 6
        if project.details.seniority <= project_pb2.JUNIOR:
            score += 1
        return _Score(score)


class _InternationalJobScoringModel(_ScoringModelBase):
    """A scoring model for the "Check out international jobs" chantier.

    See http://go/pe:chantiers/recDJbIakmNXajJOB
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (project.user_profile.geographical_flexibility == user_pb2.ABSOLUTELY_NOT or
                project.user_profile.english_level_estimate <= 1):
            return _Score(0)
        score = 1
        if project.user_profile.geographical_flexibility == user_pb2.YES:
            score += 1
        if project.user_profile.english_level_estimate >= _ESTIMATION_SCALE_MAX:
            score += 1
        if project.details.mobility.area_type >= geo_pb2.WORLD:
            score += 2
        return _Score(score)


class _ProfessionnalisationScoringModel(_ScoringModelBase):
    """A scoring model for the "Professionnalisation Contract" chantier.

    See http://go/pe:chantiers/recFjB6pr7YwlcRUO
    """

    _seniority_to_score = {
        project_pb2.INTERNSHIP: 3,
        project_pb2.JUNIOR: 2.5,
        project_pb2.INTERMEDIARY: 2,
        project_pb2.SENIOR: 1.5,
        project_pb2.EXPERT: 1,
    }

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (project.user_profile.situation == user_pb2.IN_TRAINING or
                project.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT):
            return _Score(0)
        return _Score(self._seniority_to_score.get(project.details.seniority, 0))


class _ApprentissageScoringModel(_ScoringModelBase):
    """A scoring model for the "Apprentissage Contract" chantier.

    See http://go/pe:chantiers/recuFIzyLeePv80UE
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (project.user_profile.situation == user_pb2.IN_TRAINING or
                datetime.date.today().year - project.user_profile.year_of_birth > 25 or
                project.details.seniority >= project_pb2.INTERMEDIARY or
                project.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT):
            return _Score(0)
        return _Score(3)


class _FreelanceScoringModel(_ScoringModelBase):
    """A scoring model for the "Freelance" chantier.

    See http://go/pe:chantiers/recHaOxPLO8iIVpUo
    """

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            return _Score(0)
        score = 1
        if project.user_profile.contract_type_flexibility == user_pb2.YES:
            score += 1
        if project.details.seniority >= project_pb2.INTERMEDIARY:
            score += 1
        return _Score(score)


class _BlueTargetScoringModel(_ScoringModelBase):
    """A scoring model to set the target for blue chantiers."""

    estimates = {
        project_pb2.LESS_THAN_2: 1,
        project_pb2.SOME: 3.5,
        project_pb2.DECENT_AMOUNT: 9,
        project_pb2.A_LOT: 20,
    }

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        num_weeks = _WEEKS_PER_MONTH * project.details.job_search_length_months
        if num_weeks <= 9:
            return _Score(5)
        # Number of applications to get one interview.
        ratio_interviews = (
            self.estimates.get(project.details.weekly_applications_estimate, 0) * num_weeks /
            self.estimates.get(project.details.total_interviews_estimate, 1))
        failed_interviews = self.estimates.get(project.details.total_interviews_estimate, 0)
        return _Score(ratio_interviews * _SCORE_PER_INTERVIEW_RATIO + failed_interviews)


class _GreenTargetScoringModel(_ScoringModelBase):
    """A scoring model to set the target for green chantiers."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        return _Score(project.median_unemployment_time() / _DAYS_PER_MONTH)


class _ActiveExperimentFilter(_ScoringModelBase):
    """A scoring model to filter on a feature enabled."""

    def __init__(self, feature):
        self.feature = feature

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if getattr(project.features_enabled, self.feature) == user_pb2.ACTIVE:
            return _Score(3)
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


class _DepartementFilter(_ProjectFilter):
    """A scoring model to filter on the département."""

    def __init__(self, departements):
        super(_DepartementFilter, self).__init__(self._filter)
        self._departements = set(d.strip() for d in departements.split(','))

    def _filter(self, project):
        return project.mobility.city.departement_id in self._departements


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


class _AdviceReorientation(_ScoringModelBase):
    """A scoring model to trigger the Reorientation Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if not project.details.local_stats.less_stressful_job_groups:
            return _Score(0)
        return _Score(3)


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


GROUP_SCORING_MODELS = {
    chantier_pb2.IMPROVE_SUCCESS_RATE: 'blue-group',
    chantier_pb2.UNLOCK_NEW_LEADS: 'green-group',
}


SCORING_MODELS = {
    '': _ScoringModelBase(),
    'advice-reorientation': _AdviceReorientation(),
    'chantier-about-job': _LearnMoreAboutJobScoringModel(),
    'chantier-apprentissage': _ApprentissageScoringModel(),
    'chantier-atypical-profile': _ShowcaseAtypicalProfileScoringModel(),
    'chantier-contract-type(CDD)': _AcceptContractTypeScoringModel([
        job_pb2.CDD_OVER_3_MONTHS, job_pb2.CDD_LESS_EQUAL_3_MONTHS]),
    'chantier-contract-type(interim)': _AcceptContractTypeScoringModel([job_pb2.INTERIM]),
    'chantier-driving-license(B)': _ObtainDrivingLicenseScoringModel(job_pb2.CAR),
    'chantier-english': _ImproveEnglishScoringModel(),
    'chantier-freelance': _FreelanceScoringModel(),
    'chantier-gender-discriminations': _FightGenderDiscriminationScoringModel(),
    'chantier-get-more-offers': _GetMoreOffersScoringModel(),
    'chantier-international': _InternationalJobScoringModel(),
    'chantier-interview': _ImproveInterviewScoringModel(),
    'chantier-job-discovery': _JobDiscoveryScoringModel(),
    'chantier-mobility-without-move(dep)': _MobilityWithoutMoveScoringModel(
        target_area_type=geo_pb2.DEPARTEMENT, scaling_factor=.75),
    'chantier-mobility-without-move(reg)': _MobilityWithoutMoveScoringModel(
        target_area_type=geo_pb2.REGION, scaling_factor=.5),
    'chantier-office-tools': _OfficeToolsScoringModel(),
    'chantier-organize': _ImproveOrganization(),
    'chantier-part-time': _PartTimeScoringModel(),
    'chantier-professionnalisation': _ProfessionnalisationScoringModel(),
    'chantier-reduce-salary': _ReduceSalaryScoringModel(),
    'chantier-relocate(reg)': _RelocateScoringModel(
        target_area_type=geo_pb2.REGION, scaling_factor=.5),
    'chantier-relocate(fra)': _RelocateScoringModel(
        target_area_type=geo_pb2.COUNTRY, scaling_factor=.25),
    'chantier-resume': _ImproveCVScoringModel(),
    'chantier-spontaneous-application': _SpontaneousApplicationScoringModel(),
    'chantier-stand-out': _StandOutFromCompetitionScoringModel(),
    'chantier-stay-motivated': _StayMotivatedScoringModel(),
    'chantier-subsidized-contract': _SubsidizedContractScoringModel(),
    'chantier-training': _TrainingScoringModel(),
    'chantier-use-network': _UseYourNetworkScoringModel(),
    'constant(0)': ConstantScoreModel(0),
    'constant(2)': ConstantScoreModel(2),
    'for-complex-application': _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS),
    'for-driver(car)': _UserProfileFilter(lambda user: job_pb2.CAR in user.driving_licenses),
    'for-english-speaker(2)': _UserProfileFilter(lambda user: user.english_level_estimate >= 2),
    'for-discovery': _ProjectFilter(
        lambda project: project.intensity == project_pb2.PROJECT_FIGURING_INTENSITY),
    'for-frustrated-old(50)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth > 50),
    'for-frustrated-young(25)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth < 25),
    'for-handicaped': _UserProfileFilter(
        lambda user: user_pb2.HANDICAPED in user.frustrations),
    'for-non-driver(car)': _UserProfileFilter(
        lambda user: job_pb2.CAR not in user.driving_licenses),
    'for-not-employed-anymore': _UserProfileFilter(
        lambda user: user.situation == user_pb2.LOST_QUIT),
    'for-old(50)': _UserProfileFilter(
        lambda user: datetime.date.today().year - user.year_of_birth > 50),
    'for-qualified(bac+3)': _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.LICENCE_MAITRISE),
    'for-searching-forever': _ProjectFilter(
        lambda project: project.job_search_length_months >= 19),
    'for-simple-application': _ApplicationComplexityFilter(job_pb2.SIMPLE_APPLICATION_PROCESS),
    'for-single-parent': _UserProfileFilter(
        lambda user: user_pb2.SINGLE_PARENT in user.frustrations),
    'for-unemployed': _UserProfileFilter(lambda user: user.situation != user_pb2.EMPLOYED),
    'for-young(25)': _UserProfileFilter(
        lambda user: datetime.date.today().year - user.year_of_birth < 25),
    GROUP_SCORING_MODELS[chantier_pb2.IMPROVE_SUCCESS_RATE]: _BlueTargetScoringModel(),
    GROUP_SCORING_MODELS[chantier_pb2.UNLOCK_NEW_LEADS]: _GreenTargetScoringModel(),
}


_ScoreAndReasons = collections.namedtuple('ScoreAndReasons', ['score', 'additional_job_offers'])


# A simple namedtuple holding a chantier and its score for a given project.
ScoredChantier = collections.namedtuple(
    'ScoredChantier', ['chantier', 'score', 'additional_job_offers'])


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


class _ChantierScorer(_Scorer):
    """Helper object to score chantiers for a given project."""

    def __init__(self, chantiers, project):
        """Initialize the _ChantierScorer.

        Args:
            chantiers: A list of chantiers.
            project: A ScoringProject to be passed to the model.
        """
        super(_ChantierScorer, self).__init__(project)
        self._chantiers = chantiers
        # A cache of sorted scored chantiers (ScoredChantier).
        self._scored_chantiers = None

    def _get_scored_chantiers(self):
        if self._scored_chantiers is not None:
            return self._scored_chantiers

        # Score all chantiers.
        self._scored_chantiers = [
            ScoredChantier(c, **self._get_score(c.scoring_model)._asdict())
            for c in self._chantiers]

        # Sort by best score first, and then randomly sort chantiers with
        # the same scores.
        self._scored_chantiers.sort(reverse=True, key=lambda c: (c[1], random.random()))

        return self._scored_chantiers

    def get_best_chantiers(self, n_best, min_score=0):
        """Pick the n best scored chantiers above a given score."""
        return [
            c for i, c in enumerate(self._get_scored_chantiers())
            if i < n_best and c.score > min_score]

    def _get_red_chantiers_target(self):
        total_offers_increase = 0
        for scored_chantier in self._get_scored_chantiers():
            if scored_chantier.chantier.kind != chantier_pb2.INCREASE_AVAILABLE_OFFERS:
                continue
            offers_increase = scored_chantier.additional_job_offers
            # TODO(pascal): Remove this hack when all red chantiers send job
            # offers properly.
            if not offers_increase:
                offers_increase = scored_chantier.score * JOB_OFFERS_INCREASE_PER_TARGET
            total_offers_increase += offers_increase

        total_offers = self._project.max_num_offers()
        if total_offers > _MAX_NUM_OFFERS_NEEDED:
            # There are tons of offers available at maximum, so there's no need
            # for the user to increase their available offers to that point:
            # they only need to extend it up to the max offers.
            num_user_offers = total_offers * 100 / (total_offers_increase + 100)
            total_offers_increase = _MAX_NUM_OFFERS_NEEDED * 100 / num_user_offers - 100

        return total_offers_increase / JOB_OFFERS_INCREASE_PER_TARGET

    def get_group_targets(self):
        """Get the impact target for each group of chantiers."""
        # Set target for chantier kinds.
        targets = {}
        for kind, model_name in GROUP_SCORING_MODELS.items():
            targets[kind] = self._get_score(model_name).score
        targets[chantier_pb2.INCREASE_AVAILABLE_OFFERS] = self._get_red_chantiers_target()
        return targets


def score_chantiers(chantiers, project):
    """Score chantiers for a given project."""
    return _ChantierScorer(chantiers, project)


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
