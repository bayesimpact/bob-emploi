"""Module to score a user project according to different metrics."""

import logging
import re
import typing

from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_ESTIMATE_OPTION_TO_NUMBER = {
    project_pb2.UNKNOWN_NUMBER_ESTIMATE_OPTION: 0,
    project_pb2.LESS_THAN_2: 1,
    project_pb2.SOME: 3,
    project_pb2.DECENT_AMOUNT: 8,
    project_pb2.A_LOT: 15,
}


def _interpolate_points(var: float, point_list: typing.Iterable[typing.Tuple[float, float]]) \
        -> float:
    total = 0.
    for abscissa, ordinate in point_list:
        if not ordinate:
            continue
        term = ordinate
        for other_abscissa, unused_ordinate in point_list:
            if other_abscissa == abscissa:
                continue
            term *= (var - other_abscissa) / (abscissa - other_abscissa)
        total += term
    return total


class _SearchLengthScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the length of the search."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        search_since_nb_months = project.get_search_length_at_creation()
        if search_since_nb_months < 0:
            raise scoring_base.NotEnoughDataException()
        if search_since_nb_months > 12:
            return 0
        return _interpolate_points(search_since_nb_months, [(0, 100), (3, 50), (6, 30), (12, 0)])


class _InterviewRateScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the ability of the user to get interviews."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        if project.details.weekly_applications_estimate == project_pb2.LESS_THAN_2:
            raise scoring_base.NotEnoughDataException()
        if project.details.total_interview_count < 0:
            raise scoring_base.NotEnoughDataException()
        search_since_nb_months = project.get_search_length_at_creation()
        if search_since_nb_months < 0:
            raise scoring_base.NotEnoughDataException()
        interviews_per_month = project.details.total_interview_count / search_since_nb_months
        return interviews_per_month * 15


class _TooManyInterviewsScoringModel(scoring_base.ModelHundredBase):
    """A model that scores badly when users are doing too many interviews.
    This probably means they don't know how to convince the recruiters.
    """

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a score for the given ScoringProject."""

        if project.details.total_interview_count < 10:
            raise scoring_base.NotEnoughDataException

        # 10 -> 30, 13 -> 0
        return 100 - 8 * project.details.total_interview_count


class _TooManyApplicationsScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the fact that user makes too many applications."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a score for the given ScoringProject."""

        if project.details.job_search_has_not_started:
            raise scoring_base.NotEnoughDataException()
        try:
            nb_applications = _ESTIMATE_OPTION_TO_NUMBER[
                project.details.weekly_applications_estimate]
        except KeyError:
            logging.error(
                '_ESTIMATE_OPTION_TO_NUMBER should have all keys from '
                'project_pb2.NumberOfferEstimateOption')
            raise scoring_base.NotEnoughDataException()
        if nb_applications <= 5:
            # This is just to ensure that too many applications get sanctionned,
            # we don't look at what happens below.
            raise scoring_base.NotEnoughDataException()
        return 0


class _TooFewApplicationsScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the ability of the user to apply to offers."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a score for the given ScoringProject."""

        if project.details.job_search_has_not_started:
            raise scoring_base.NotEnoughDataException()
        nb_applications = _ESTIMATE_OPTION_TO_NUMBER[project.details.weekly_applications_estimate]
        if nb_applications == 0 or nb_applications > 5:
            raise scoring_base.NotEnoughDataException()
        # rescale: 0 -> 0, 5 -> 100
        return 20 * nb_applications


class _TrainingFullfillmentScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the training fullfillment the user has."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a percentage score for the given ScoringProject."""

        if (project.details.training_fulfillment_estimate ==
                project_pb2.TRAINING_FULFILLMENT_NOT_SURE):
            return 0
        if project.details.training_fulfillment_estimate in [
                project_pb2.ENOUGH_DIPLOMAS, project_pb2.ENOUGH_EXPERIENCE,
                project_pb2.NO_TRAINING_REQUIRED]:
            return 100
        if project.details.training_fulfillment_estimate == project_pb2.CURRENTLY_IN_TRAINING:
            return 50
        raise scoring_base.NotEnoughDataException()


class _RequiredDiplomasScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the necessity for required diplomas."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        # Only score if user is not sure about this.
        if (project.details.training_fulfillment_estimate is not
                project_pb2.TRAINING_FULFILLMENT_NOT_SURE):
            raise scoring_base.NotEnoughDataException()
        max_requirement = -1
        for diploma in project.job_group_info().requirements.diplomas:
            if diploma.percent_required > max_requirement:
                max_requirement = diploma.percent_required
        if max_requirement >= 0:
            return 100 - max_requirement
        raise scoring_base.NotEnoughDataException()


class _SeniorityScoringModel(scoring_base.ModelHundredBase):
    """
    A model that scores the seniority of the user in their job,
    whether they are searching for the same or not.
    """

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a percentage score for the given ScoringProject."""

        if project.details.seniority == project_pb2.INTERN:
            return 0
        if project.details.seniority == project_pb2.JUNIOR:
            return 33
        if project.details.seniority == project_pb2.INTERMEDIARY:
            return 67
        if project.details.seniority >= project_pb2.SENIOR:
            return 100
        raise scoring_base.NotEnoughDataException()


class _JobSimilarityScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the experience of the user in similar jobs."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a percentage score for the given ScoringProject."""

        if project.details.previous_job_similarity == project_pb2.NEVER_DONE:
            return 0
        if project.details.previous_job_similarity == project_pb2.DONE_SIMILAR:
            if user_pb2.ATYPIC_PROFILE in project.user_profile.frustrations:
                return 60
            return 50
        if project.details.previous_job_similarity == project_pb2.DONE_THIS:
            if user_pb2.MOTIVATION in project.user_profile.frustrations:
                return 100
            return 90
        raise scoring_base.NotEnoughDataException()


class _AgeScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the age of the user."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        # rescale user age: <=18 -> 100, >=68 -> 0
        return (68 - project.get_user_age()) * 2


class _MarketStressScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the market stress of the job that the user is interested in."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        market_stress = project.market_stress()
        if not market_stress:
            raise scoring_base.NotEnoughDataException()
        if market_stress == 1000:
            return 0
        return 1 / market_stress * 100


class _OffersChangeScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the offers change of the job that the user is interested in."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        local_diagnosis = project.local_diagnosis()
        offers_change = local_diagnosis.job_offers_change
        if local_diagnosis.num_job_offers_previous_year < 5\
                and local_diagnosis.num_job_offers_last_year < 5:
            raise scoring_base.NotEnoughDataException()
        if offers_change < 0:
            return 0
        # rescale offers: >=0 -> 50, >=10 -> 100
        return offers_change * 5 + 50


class _ReturnToEmploymentScoringModel(scoring_base.ModelHundredBase):
    """A model that scores the time to return to employment for a project."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a percentage score for the given ScoringProject."""

        local_diagnosis = project.local_diagnosis()
        if not local_diagnosis.unemployment_duration.days:
            raise scoring_base.NotEnoughDataException()
        # Rescale unemployment_duration: 0 -> 100, >= 12 months -> 0
        # As unemployment_duration has much more low values in DB, use ** .7 to have more variance
        # in high scores (50% -> 136 ~= median).
        return 100 * (1 - (local_diagnosis.unemployment_duration.days / 365) ** .7)


class _JobOfTheFutureScoringModel(scoring_base.ModelHundredBase):
    """A model that scores whether a job is future proof.

    See the notebook exploring the data we use here at:
    http://go/pe:notebooks/datasets/france_strategie_rapport_metiers_2022.ipynb

    The bounds are -0.168856 and 0.292818. The mean is 0.0688136.
    """

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a percentage score for the given ScoringProject."""

        growth_2012_2022 = project.job_group_info().growth_2012_2022
        if not growth_2012_2022:
            raise scoring_base.NotEnoughDataException()
        return _interpolate_points(growth_2012_2022, [(-.17, 0), (.07, 50), (.29, 100)])


class _NetworkScoringModel(scoring_base.ModelHundredBase):
    """A model that scores whether the user has a good network."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a percentage score for the given ScoringProject."""

        if project.details.network_estimate == 1:
            return 0
        if project.details.network_estimate == 2:
            return 60
        if project.details.network_estimate == 3:
            return 100
        raise scoring_base.NotEnoughDataException()


class _JobPassionScoringModel(scoring_base.ModelHundredBase):
    """A model that scores whether the user is passionate about their job."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        """Compute a percentage score for the given ScoringProject."""

        if project.details.passionate_level == project_pb2.ALIMENTARY_JOB:
            return 0
        if project.details.passionate_level == project_pb2.LIKEABLE_JOB:
            return 50
        if project.details.passionate_level == project_pb2.PASSIONATING_JOB:
            return 80
        if project.details.passionate_level == project_pb2.LIFE_GOAL_JOB:
            return 100
        raise scoring_base.NotEnoughDataException()


class _FrustrationScoringModel(scoring_base.ModelHundredBase):
    """A model that gives a bad score if user has a given frustration,
    to lower the overall score of a submetric.
    """

    def __init__(self, frustration: user_pb2.Frustration) -> None:
        self.frustration = frustration

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        if self.frustration in project.user_profile.frustrations:
            return 0
        raise scoring_base.NotEnoughDataException()


class _HiringNeedScoringModel(scoring_base.ModelHundredBase):
    """A model that gives a good score if hiring is considered difficult in local stats."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        bmo = project.local_diagnosis().bmo
        if not bmo.percent_difficult:
            raise scoring_base.NotEnoughDataException()
        return bmo.percent_difficult


class _DiagnosticTopicFilter(scoring_base.BaseFilter):
    """A filter that passes when a given diagnostic submetric satisfies a predicate."""

    def __init__(
            self,
            diagnostic_topic: str,
            predicate: typing.Callable[[typing.Optional[diagnostic_pb2.SubDiagnostic]], bool]
    ) -> None:
        self._diagnostic_topic = diagnostic_pb2.DiagnosticTopic.Value(diagnostic_topic)
        self._predicate = predicate
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        """The filter function for this scoring model."""

        sub_diagnostics = project.details.diagnostic.sub_diagnostics
        sub_diagnostic = next(
            (sub for sub in sub_diagnostics if sub.topic == self._diagnostic_topic), None)
        return self._predicate(sub_diagnostic)


class _GoodDiagnosticCountFilter(scoring_base.BaseFilter):
    """A filter that passes when a given number of diagnostic submetrics have a good score."""

    def __init__(self, count: int) -> None:
        self._count = count
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        """The filter function for this scoring model."""

        sub_diagnostics = project.details.diagnostic.sub_diagnostics
        valid_sub_diagnostics = [sub for sub in sub_diagnostics if sub.score >= 60]
        return len(valid_sub_diagnostics) >= self._count


scoring_base.register_model('age-score', _AgeScoringModel())
scoring_base.register_model('hiring-difficulty-score', _HiringNeedScoringModel())
scoring_base.register_model('for-good-diagnostic-submetrics(+4)', _GoodDiagnosticCountFilter(4))
scoring_base.register_model('for-good-diagnostic-submetrics(ALL)', _GoodDiagnosticCountFilter(
    len(diagnostic_pb2.DiagnosticTopic.values()) - 1))
scoring_base.register_model(
    'frustration-atypic-scorer', _FrustrationScoringModel(user_pb2.ATYPIC_PROFILE))
scoring_base.register_model(
    'frustration-interview-scorer', _FrustrationScoringModel(user_pb2.INTERVIEW))
scoring_base.register_model(
    'frustration-motivation-scorer', _FrustrationScoringModel(user_pb2.MOTIVATION))
scoring_base.register_model(
    'frustration-resume-scorer', _FrustrationScoringModel(user_pb2.RESUME))
scoring_base.register_model(
    'frustration-self-confidence-scorer', _FrustrationScoringModel(user_pb2.SELF_CONFIDENCE))
scoring_base.register_model(
    'frustration-time-managment-scorer', _FrustrationScoringModel(user_pb2.TIME_MANAGEMENT))
scoring_base.register_model('interview-rate-score', _InterviewRateScoringModel())
scoring_base.register_model('job-passionate-score', _JobPassionScoringModel())
scoring_base.register_model('job-similarity-score', _JobSimilarityScoringModel())
scoring_base.register_model('job-of-the-future', _JobOfTheFutureScoringModel())
scoring_base.register_model('market-stress-score', _MarketStressScoringModel())
scoring_base.register_model('network-score', _NetworkScoringModel())
scoring_base.register_model('offers-change-score', _OffersChangeScoringModel())
scoring_base.register_model('required-diplomas-score', _RequiredDiplomasScoringModel())
scoring_base.register_model(
    'return-to-employment-score', _ReturnToEmploymentScoringModel())
scoring_base.register_model('search-length-score', _SearchLengthScoringModel())
scoring_base.register_model('seniority-score', _SeniorityScoringModel())
scoring_base.register_model(
    'too-many-applications-score', _TooManyApplicationsScoringModel())
scoring_base.register_model(
    'too-few-applications-score', _TooFewApplicationsScoringModel())
scoring_base.register_model('too-many-interviews-score', _TooManyInterviewsScoringModel())
scoring_base.register_model(
    'training-fullfillment-score', _TrainingFullfillmentScoringModel())

scoring_base.register_regexp(
    re.compile(r'^for-empty-diagnostic\((.*?)\)$'),
    lambda name: _DiagnosticTopicFilter(name, lambda sub: sub is None),
    'for-empty-diagnostic(PROFILE_DIAGNOSTIC)')
scoring_base.register_regexp(
    re.compile(r'^for-low-diagnostic\((.*?), (\d+)\)$'),
    lambda name, percent: _DiagnosticTopicFilter(
        name, lambda sub: sub is not None and sub.score < int(percent)),
    'for-low-diagnostic(PROFILE_DIAGNOSTIC, 40)')
scoring_base.register_regexp(
    re.compile(r'^for-high-diagnostic\((.*?), (\d+)\)$'),
    lambda name, percent: _DiagnosticTopicFilter(
        name, lambda sub: sub is not None and sub.score >= int(percent)),
    'for-high-diagnostic(PROFILE_DIAGNOSTIC, 40)')
