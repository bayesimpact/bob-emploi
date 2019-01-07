"""Scoring module for advices and actions.

See design doc at http://go/bob:scoring-advices.
"""

import datetime
import logging
import re
import typing

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import scoring_base
# pylint: disable=unused-import
# Import all plugins: they register themselves when imported.
from bob_emploi.frontend.server.modules import application_modes
from bob_emploi.frontend.server.modules import application_tips
from bob_emploi.frontend.server.modules import associations_help
from bob_emploi.frontend.server.modules import better_job_in_group
from bob_emploi.frontend.server.modules import civic_service
from bob_emploi.frontend.server.modules import commute
from bob_emploi.frontend.server.modules import create_your_company
from bob_emploi.frontend.server.modules import diagnostic
from bob_emploi.frontend.server.modules import driving_license
from bob_emploi.frontend.server.modules import events
from bob_emploi.frontend.server.modules import immersion
from bob_emploi.frontend.server.modules import jobboards
from bob_emploi.frontend.server.modules import network
from bob_emploi.frontend.server.modules import online_salons
from bob_emploi.frontend.server.modules import relocate
from bob_emploi.frontend.server.modules import reorient_jobbing
from bob_emploi.frontend.server.modules import reorient_to_close_job
from bob_emploi.frontend.server.modules import seasonal_relocate
from bob_emploi.frontend.server.modules import skill_for_future
from bob_emploi.frontend.server.modules import volunteer
# Re-export some base elements from here as well.
from bob_emploi.frontend.server.scoring_base import ConstantScoreModel
from bob_emploi.frontend.server.scoring_base import ExplainedScore
from bob_emploi.frontend.server.scoring_base import filter_using_score
from bob_emploi.frontend.server.scoring_base import get_scoring_model
from bob_emploi.frontend.server.scoring_base import LowPriorityAdvice
from bob_emploi.frontend.server.scoring_base import ModelBase
from bob_emploi.frontend.server.scoring_base import NotEnoughDataException
from bob_emploi.frontend.server.scoring_base import NULL_EXPLAINED_SCORE
from bob_emploi.frontend.server.scoring_base import ScoringProject
from bob_emploi.frontend.server.scoring_base import SCORING_MODEL_REGEXPS
from bob_emploi.frontend.server.scoring_base import SCORING_MODELS
# pylint: enable=unused-import


class _AdviceTrainingScoringModel(scoring_base.ModelBase):
    """A scoring model for the training advice."""

    def get_expanded_card_data(self, project: ScoringProject) -> training_pb2.Trainings:
        """Compute extra data for this module to render a card in the client."""

        return training_pb2.Trainings(trainings=project.get_trainings())

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute the score of given project and why it's scored."""

        # TODO(guillaume): Get the score for each project from lbf.
        all_trainings = project.get_trainings()

        if not all_trainings:
            return NULL_EXPLAINED_SCORE

        search_length = round(project.get_search_length_at_creation())
        if len(all_trainings) >= 2:
            if search_length >= 3:
                return ExplainedScore(3, [
                    project.translate_string('vous cherchez depuis {} mois')
                    .format(search_length)])
            if project.details.kind == project_pb2.REORIENTATION >= 3:
                return ExplainedScore(3, [project.translate_string(
                    'vous souhaitez vous réorienter')])
        if search_length >= 2:
            return ExplainedScore(2, [
                project.translate_string('vous cherchez depuis {} mois')
                .format(search_length)])

        return ExplainedScore(1, [])


class _AdviceBodyLanguage(scoring_base.ModelBase):
    """A scoring model for recommending to improve one's body language."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        _related_frustrations = {
            user_pb2.INTERVIEW: project.translate_string(
                'vous nous avez dit que les entretiens sont un challenge pour vous'),
            user_pb2.SELF_CONFIDENCE: project.translate_string(
                'vous nous avez dit parfois manquer de confiance en vous'
            ),
            user_pb2.ATYPIC_PROFILE: project.translate_string(
                'vous nous avez dit ne pas rentrer dans les cases des recruteurs'
            ),
        }

        reasons = [
            _related_frustrations[frustration]
            for frustration in project.user_profile.frustrations
            if frustration in _related_frustrations]
        return ExplainedScore(
            2 if reasons else 1,
            reasons if reasons else [project.translate_string(
                'vous pouvez toujours vous mettre plus en valeur'
            )])


class _AdviceSpecificToJob(scoring_base.ModelBase):
    """A scoring model for the "Specific to Job" advice module."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.specific_to_job_advice_config():
            return ExplainedScore(3, [])
        return NULL_EXPLAINED_SCORE

    def get_advice_override(self, project: ScoringProject, unused_advice: project_pb2.Advice) \
            -> typing.Optional[project_pb2.Advice]:
        """Get override data for an advice."""

        config = project.specific_to_job_advice_config()
        if not config:
            logging.warning(
                'Did not found any config for specific-to-job advice for job "%s".',
                project.details.target_job.code_ogr)
            return None

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
            title=project.translate_string(config.title),
            short_title=project.translate_string(config.short_title),
            goal=project.translate_string(config.goal),
            diagnostic_topics=config.diagnostic_topics,
            card_text=project.translate_string(config.card_text),
            expanded_card_header=project.translate_string(expanded_card_header),
            expanded_card_items=[project.translate_string(item) for item in expanded_card_items],
        )


class _UserProfileFilter(scoring_base.BaseFilter):
    """A scoring model to filter on a user's profile property.

    It takes a filter function that takes the user's profile as parameter. If
    this function returns true, the score for any project taken by the user
    would be 3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to users with a computer:
        _UserProfileFilter(lambda user: user.has_access_to_computer)
    """

    def __init__(self, filter_func: typing.Callable[[user_pb2.UserProfile], bool]) -> None:
        super(_UserProfileFilter, self).__init__(lambda project: filter_func(project.user_profile))


class _ProjectFilter(scoring_base.BaseFilter):
    """A scoring model to filter on a project's property.

    It takes a filter function that takes the project as parameter. If this
    function returns true, the score for any project taken by the user would be
    3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to projects about job group A1234:
        _ProjectFilter(lambda project: project.target_job.job_group.rome_id == 'A1234')
    """

    def __init__(
            self,
            filter_func: typing.Callable[[project_pb2.Project], bool],
            reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_ProjectFilter, self).__init__(
            lambda project: filter_func(project.details), reasons=reasons)


class _JobGroupFilter(_ProjectFilter):
    """A scoring model to filter on a job group."""

    def __init__(self, job_group_start: str) -> None:
        super(_JobGroupFilter, self).__init__(self._filter)
        self._job_group_starts = [prefix.strip() for prefix in job_group_start.split(',')]

    def _filter(self, project: project_pb2.Project) -> bool:
        for job_group_start in self._job_group_starts:
            if project.target_job.job_group.rome_id.startswith(job_group_start):
                return True
        return False


class _JobFilter(_ProjectFilter):
    """A scoring model to filter on specific jobs."""

    def __init__(self, jobs: str) -> None:
        super(_JobFilter, self).__init__(self._filter)
        self._jobs = set(job.strip() for job in jobs.split(','))

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.target_job.code_ogr in self._jobs


class _DepartementFilter(_ProjectFilter):
    """A scoring model to filter on the département."""

    def __init__(self, departements: str) -> None:
        super(_DepartementFilter, self).__init__(self._filter)
        self._departements = set(d.strip() for d in departements.split(','))

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.city.departement_id in self._departements


class _OldUserFilter(scoring_base.BaseFilter):
    """A scoring model to filter on the age."""

    def __init__(self, min_age: str) -> None:
        super(_OldUserFilter, self).__init__(self._filter)
        self._min_age = int(min_age)

    def _filter(self, project: ScoringProject) -> bool:
        return project.get_user_age() > self._min_age


class _FrustratedOldUserFilter(_OldUserFilter):
    """A scoring model to filter on the age."""

    def _filter(self, project: ScoringProject) -> bool:
        return super(_FrustratedOldUserFilter, self)._filter(project) and \
            user_pb2.AGE_DISCRIMINATION in project.user_profile.frustrations


class _FrustrationFilter(_UserProfileFilter):
    """A scoring model to filter on a frustration."""

    def __init__(self, frustration: str) -> None:
        super(_FrustrationFilter, self).__init__(self._filter)
        self.frustration = user_pb2.Frustration.Value(frustration)

    def _filter(self, user: user_pb2.UserProfile) -> bool:
        return self.frustration in user.frustrations


class _PassionateFilter(_ProjectFilter):
    """A scoring model to filter on a frustration."""

    def __init__(self, passionate_level: str):
        super(_PassionateFilter, self).__init__(self._filter)
        self._passionate_level = project_pb2.PassionateLevel.Value(passionate_level)

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.passionate_level >= self._passionate_level


class _YoungUserFilter(scoring_base.BaseFilter):
    """A scoring model to filter on the age."""

    def __init__(self, max_age: str) -> None:
        super(_YoungUserFilter, self).__init__(self._filter)
        self._max_age = int(max_age)

    def _filter(self, project: ScoringProject) -> bool:
        return project.get_user_age() < self._max_age


class _NegateFilter(scoring_base.ModelBase):
    """A scoring model to filter the opposite of another filter."""

    def __init__(self, negated_filter_name: str) -> None:
        super(_NegateFilter, self).__init__()
        if get_scoring_model(negated_filter_name) is None:
            raise ValueError('Scorer to negate does not exist: {}'.format(negated_filter_name))
        self._negated_filter_name = negated_filter_name

    # TODO(cyrille): Make it return 0 when negated_filter would return anything but 0.
    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        return 3 - project.score(self._negated_filter_name)


class _ActiveExperimentFilter(scoring_base.BaseFilter):
    """A scoring model to filter on a feature enabled."""

    _features: typing.Set[str] = {
        f.name for f in user_pb2.Features.DESCRIPTOR.fields
        if f.enum_type == user_pb2.BinaryExperiment.DESCRIPTOR
    }

    def __init__(self, feature: str, reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_ActiveExperimentFilter, self).__init__(self._filter, reasons=reasons)
        if feature not in self._features:
            raise ValueError('"{}" is not a valid feature:\n{}'.format(feature, self._features))
        self._feature = feature

    def _filter(self, project: ScoringProject) -> bool:

        return user_pb2.ACTIVE == \
            typing.cast(user_pb2.BinaryExperiment, getattr(project.features_enabled, self._feature))


class _JobGroupWithoutJobFilter(_ProjectFilter):
    """A scoring model to filter on a job group but exclude some jobs."""

    def __init__(
            self,
            job_groups: typing.Iterable[str],
            exclude_jobs: typing.Optional[typing.Iterable[str]] = None,
            reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_JobGroupWithoutJobFilter, self).__init__(self._filter, reasons=reasons)
        self._job_groups = set(job_groups)
        self._exclude_jobs = set(exclude_jobs) if exclude_jobs else set()

    def _filter(self, project: project_pb2.Project) -> bool:
        if project.target_job.code_ogr in self._exclude_jobs:
            return False
        if project.target_job.job_group.rome_id in self._job_groups:
            return True
        return False


class _ApplicationComplexityFilter(scoring_base.BaseFilter):
    """A scoring model to filter on job group application complexity."""

    def __init__(
            self,
            application_complexity: 'job_pb2.ApplicationProcessComplexity',
            reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_ApplicationComplexityFilter, self).__init__(self._filter, reasons=reasons)
        self._application_complexity = application_complexity

    def _filter(self, project: ScoringProject) -> bool:

        return self._application_complexity == project.job_group_info().application_complexity


class _ScorerFilter(scoring_base.BaseFilter):
    """A scoring model to filter on above/below average values on a given scorer."""

    def __init__(self, scorer: str, is_good: bool = False):
        super(_ScorerFilter, self).__init__(self._filter)
        if not get_scoring_model(scorer):
            raise ValueError('Could not find scoring model {}'.format(scorer))
        self._scorer_name = scorer
        self._is_good = is_good

    def _filter(self, project: ScoringProject) -> bool:
        """Compute a score for the given ScoringProject."""

        try:
            score = project.score(self._scorer_name)
        except NotEnoughDataException:
            return False
        if self._is_good:
            return score >= 1.5
        return score < 1.5


class _MarketTensionFilter(scoring_base.BaseFilter):
    """A scoring model to filter on market tension.
        max_offers is an integer ans it's the number of offers for 10 seekers.
    """

    def __init__(self, max_offers: str):
        super(_MarketTensionFilter, self).__init__(self._filter)
        self._max_offers = int(max_offers)

    def _filter(self, project: ScoringProject) -> bool:
        tension = project.market_stress()
        if not tension:
            return False
        return tension <= 10 / self._max_offers and tension != 1000


class _AdviceOtherWorkEnv(scoring_base.ModelBase):
    """A scoring model to trigger the "Other Work Environment" Advice."""

    def get_expanded_card_data(self, project: ScoringProject) -> project_pb2.OtherWorkEnvAdviceData:
        """Compute extra data for this module to render a card in the client."""

        return project_pb2.OtherWorkEnvAdviceData(
            work_environment_keywords=project.job_group_info().work_environment_keywords)

    def score(self, project: ScoringProject) -> int:
        """Compute a score for the given ScoringProject."""

        work_env = project.job_group_info().work_environment_keywords
        if len(work_env.structures) > 1 or len(work_env.sectors) > 1:
            return 2
        return 0


class _AdviceLifeBalanceScoringModel(scoring_base.ModelBase):
    """A scoring model to trigger the "life balance" Advice."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.user_profile.has_handicap:
            return NULL_EXPLAINED_SCORE

        if project.get_search_length_at_creation() > 3:
            return ExplainedScore(1, [])

        return NULL_EXPLAINED_SCORE


class _AdviceVae(scoring_base.ModelBase):
    """A scoring model to trigger the "VAE" Advice."""

    # TODO(cyrille): Split between score and explain.
    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
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
            return NULL_EXPLAINED_SCORE

        reasons: typing.List[str] = []
        if has_experience:
            reasons.append(project.translate_string(
                "vous nous avez dit avoir de l'expérience"))
        if is_frustrated_by_trainings:
            reasons.append(project.translate_string(
                'vous nous avez dit avoir du mal à accéder à une formation'))
        if thinks_xp_covers_diplomas:
            reasons.append(project.translate_string(
                'vous nous avez dit ne pas avoir les diplômes mais avoir '
                "l'expérience demandée"))
        if not thinks_xp_covers_diplomas and does_not_have_required_diplomas:
            reasons.append(project.translate_string(
                'vous nous avez dit ne pas avoir les diplômes demandés'))

        if thinks_xp_covers_diplomas:
            if is_frustrated_by_trainings or has_experience:
                return ExplainedScore(3, reasons)
            return ExplainedScore(2, reasons)

        if has_experience and (does_not_have_required_diplomas or is_frustrated_by_trainings):
            return ExplainedScore(2, reasons)

        return NULL_EXPLAINED_SCORE


class _AdviceSenior(scoring_base.ModelBase):
    """A scoring model to trigger the "Senior" Advice."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        age = project.get_user_age()
        reasons = []
        if (user_pb2.AGE_DISCRIMINATION in project.user_profile.frustrations and age > 40):
            reasons.append(project.translate_string(
                'vous nous avez dit que votre age pouvait parfois être un ' +
                'obstacle'))
        # TODO(cyrille): Add a reason for age >= 45.
        if reasons or age >= 45:
            return ExplainedScore(2, reasons)
        return NULL_EXPLAINED_SCORE


class _AdviceLessApplications(scoring_base.ModelBase):
    """A scoring model to trigger the "Make less applications" Advice."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.details.weekly_applications_estimate == project_pb2.DECENT_AMOUNT or \
                project.details.weekly_applications_estimate == project_pb2.A_LOT:
            return ExplainedScore(3, [project.translate_string(
                'vous nous avez dit envoyer beaucoup de candidatures'
            )])
        return NULL_EXPLAINED_SCORE


class _ApplicationMediumFilter(scoring_base.BaseFilter):
    """A model that filters out users searching for jobs with the wrong application medium."""

    def __init__(
            self,
            medium: job_pb2.ApplicationMedium,
            reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_ApplicationMediumFilter, self).__init__(self._filter, reasons=reasons)
        self._medium = medium

    def _filter(self, project: ScoringProject) -> bool:

        return project.job_group_info().preferred_application_medium == self._medium


class _LBBProjectFilter(scoring_base.BaseFilter):
    """A scoring model that filters in users searching for jobs in a sector that recruits."""

    def __init__(self, reasons: typing.Optional[typing.List[str]] = None) -> None:
        super(_LBBProjectFilter, self).__init__(self._filter, reasons)

    def _filter(self, project: ScoringProject) -> bool:

        total_nb_employees = 0
        for company in [companies.to_proto(c)
                        for c in companies.get_lbb_companies(project.details, distance=30)]:
            headcount = company.headcount_text
            if not headcount:
                continue
            # Always get the lower limit.
            try:
                total_nb_employees += int(headcount.split(' ')[0])
            except ValueError:  # We are not able to parse the LBB response yet.
                logging.warning(
                    'Not able to parse "%s", skipping company "%s".', headcount, company.name)
                continue
            if total_nb_employees >= 500:
                return True
        return False


class _TrainingFullfilmentFilter(_ProjectFilter):

    def __init__(self, training_fulfillment_estimate: project_pb2.TrainingFulfillmentEstimate) \
            -> None:
        super(_TrainingFullfilmentFilter, self).__init__(self._filter)
        self.training_fulfillment_estimate = training_fulfillment_estimate

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.training_fulfillment_estimate == self.training_fulfillment_estimate


class _ContractTypeFilter(scoring_base.BaseFilter):

    def __init__(
            self,
            selected_contracts: typing.List['job_pb2.EmploymentType'],
            min_percentage: int) -> None:
        super(_ContractTypeFilter, self).__init__(self._filter)
        self._selected_contracts = selected_contracts
        self._min_percentage = min_percentage

    def _filter(self, scoring_project: ScoringProject) -> bool:
        contract_types = scoring_project.job_group_info().requirements.contract_types
        if not contract_types:
            return False
        percentage = sum(contract_type.percent_suggested for contract_type in contract_types if
                         contract_type.contract_type in self._selected_contracts)
        return percentage >= self._min_percentage


class _NarrowContractTypesFilter(scoring_base.BaseFilter):

    def __init__(self, required_percentage: int) -> None:
        super(_NarrowContractTypesFilter, self).__init__(self._filter)
        self._required_percentage = required_percentage

    def _filter(self, project: ScoringProject) -> bool:
        contract_types = project.job_group_info().requirements.contract_types
        if not contract_types:
            return False
        percentage = sum(contract_type.percent_suggested for contract_type in contract_types if
                         contract_type.contract_type in project.details.employment_types)
        return percentage < self._required_percentage


class _AdviceFollowupEmail(scoring_base.ModelBase):

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.job_group_info().preferred_application_medium == job_pb2.APPLY_IN_PERSON:
            return NULL_EXPLAINED_SCORE
        if user_pb2.NO_OFFER_ANSWERS in project.user_profile.frustrations:
            return ExplainedScore(2, [project.translate_string(
                'vous nous avez dit ne pas avoir assez de réponses des recruteurs'
            )])
        return ExplainedScore(1, [])


class _MonthlyInterviewFilter(scoring_base.BaseFilter):

    def __init__(self, interview_rate: str) -> None:
        super(_MonthlyInterviewFilter, self).__init__(self._filter)
        self._interview_rate = float(interview_rate)

    def _filter(self, project: ScoringProject) -> bool:
        job_search_length = project.get_search_length_at_creation()

        # User has not started their job search.
        if job_search_length < 0:
            return False

        interview_counts = project.details.total_interview_count
        return interview_counts > self._interview_rate * job_search_length


class _InterviewFilter(scoring_base.BaseFilter):

    def __init__(self, min_interviews: str) -> None:
        super(_InterviewFilter, self).__init__(self._filter)
        self._min_interviews = int(min_interviews)

    def _filter(self, project: ScoringProject) -> bool:

        interview_counts = project.details.total_interview_count
        return interview_counts > self._min_interviews


def _is_long_term_mom(user: user_pb2.UserProfile) -> bool:
    return user.gender == user_pb2.FEMININE and user_pb2.STAY_AT_HOME_PARENT in user.frustrations


# Matches strings like "for-job-group(M16)" or "for-job-group(A12, A13)".
scoring_base.register_regexp(
    re.compile(r'^for-job-group\((.*)\)$'), _JobGroupFilter, 'for-job-group(A12, A13)')
# Matches strings like "for-job(12006)" or "for-job(12006,12007)".
scoring_base.register_regexp(
    re.compile(r'^for-job\((.*)\)$'), _JobFilter, 'for-job(12006,12007)')
# Matches strings like "for-departement(31)" or "for-departement(31, 75)".
scoring_base.register_regexp(
    re.compile(r'^for-departement\((.*)\)$'), _DepartementFilter, 'for-departement(31)')
# Matches strings like "not-for-young" or "not-for-active-experiment".
scoring_base.register_regexp(
    re.compile(r'^not-(.*)$'), _NegateFilter, 'not-for-job(12006)')
# Matches strings like "for-active-experiment(lbb_integration)".
scoring_base.register_regexp(
    re.compile(r'^for-active-experiment\((.*)\)$'),
    _ActiveExperimentFilter, 'for-active-experiment(lbb_integration)')
# Matches strings that are integers.
scoring_base.register_regexp(
    re.compile(r'^constant\((.+)\)$'), ConstantScoreModel, 'constant(2)')
# Matches strings like "for-old(50)".
scoring_base.register_regexp(
    re.compile(r'^for-old\(([0-9]+)\)$'), _OldUserFilter, 'for-old(50)')
# Matches strings like "for-frustrated-old(50)".
scoring_base.register_regexp(
    re.compile(r'^for-frustrated-old\(([0-9]+)\)$'), _FrustratedOldUserFilter,
    'for-frustrated-old(50)')
# Matches strings like "for-frustrated(INTERVIEW)".
scoring_base.register_regexp(
    re.compile(r'^for-frustrated\((\w*)\)$'), _FrustrationFilter,
    'for-frustrated(INTERVIEW)')
# Matches strings like "for-young(25)".
scoring_base.register_regexp(
    re.compile(r'^for-young\(([0-9]+)\)$'), _YoungUserFilter, 'for-young(25)')
scoring_base.register_regexp(
    re.compile(r'^for-passionate\((\w+)\)$'), _PassionateFilter, 'for-passionate(LIFE_GOAL_JOB)')
scoring_base.register_regexp(
    re.compile(r'^for-good-score\((.+)\)$'),
    lambda scorer: _ScorerFilter(scorer, is_good=True),
    'for-good-score(constant(2))')
# This is not the reverse of the previous one, because some scorers might not give any value.
scoring_base.register_regexp(
    re.compile(r'^for-bad-score\((.+)\)$'),
    lambda scorer: _ScorerFilter(scorer, is_good=False),
    'for-bad-score(constant(2))')
# Matches strings like "for-market-tension(10/7)".
scoring_base.register_regexp(
    re.compile(r'^for-lower-market-tension\(10\/([0-9]+)\)$'), _MarketTensionFilter,
    'for-lower-market-tension(10/7)')
# Matches strings like "for-many-interviews-per-month(0.5)".
scoring_base.register_regexp(
    re.compile(r'^for-many-interviews-per-month\(([0-9]+(?:\.[0-9]+)?)\)$'),
    _MonthlyInterviewFilter, 'for-many-interviews-per-month(4)')
# Matches strings like "for-many-interviews(5)".
scoring_base.register_regexp(
    re.compile(r'^for-many-interviews\(([0-9]+)\)$'), _InterviewFilter,
    'for-many-interviews(5)')


scoring_base.register_model(
    'advice-body-language', _AdviceBodyLanguage())
scoring_base.register_model(
    'advice-follow-up', _AdviceFollowupEmail())
scoring_base.register_model(
    'advice-less-applications', _AdviceLessApplications())
scoring_base.register_model(
    'advice-life-balance', _AdviceLifeBalanceScoringModel())
scoring_base.register_model(
    'advice-more-offer-answers', LowPriorityAdvice(user_pb2.NO_OFFER_ANSWERS))
scoring_base.register_model(
    'advice-other-work-env', _AdviceOtherWorkEnv())
scoring_base.register_model(
    'advice-vae', _AdviceVae())
scoring_base.register_model(
    'advice-senior', _AdviceSenior())
scoring_base.register_model(
    'advice-specific-to-job', _AdviceSpecificToJob())
scoring_base.register_model(
    'advice-wow-baker', _JobGroupWithoutJobFilter(
        job_groups={'D1102'}, exclude_jobs={'12006'}))
scoring_base.register_model(
    'advice-training', _AdviceTrainingScoringModel())
scoring_base.register_model(
    'for-active-search', _ProjectFilter(
        lambda project: project.HasField('created_at') and not project.job_search_has_not_started))
scoring_base.register_model(
    'for-application(2)', _ProjectFilter(
        lambda project: project.weekly_applications_estimate >= project_pb2.SOME))
scoring_base.register_model(
    'for-big-city-inhabitant(100000)', _ProjectFilter(
        lambda project: project.city.population >= 100000))
scoring_base.register_model(
    'for-company-creator', _ProjectFilter(
        lambda project: project.kind == project_pb2.CREATE_OR_TAKE_OVER_COMPANY))
scoring_base.register_model(
    'for-complex-application', _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS))
scoring_base.register_model(
    'for-currently-in-training', _TrainingFullfilmentFilter(project_pb2.CURRENTLY_IN_TRAINING))
scoring_base.register_model(
    'for-driver', _UserProfileFilter(
        lambda user: bool(user.has_car_driving_license >= user_pb2.TRUE or user.driving_licenses)))
scoring_base.register_model(
    'for-employed', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.user_profile.situation == user_pb2.EMPLOYED or
        scoring_project.details.kind == project_pb2.FIND_ANOTHER_JOB))
scoring_base.register_model(
    'for-evolution-of-offers(+10%)', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.local_diagnosis().job_offers_change >= 10))
scoring_base.register_model(
    'for-experienced(2)', _ProjectFilter(
        lambda project: project.seniority >= project_pb2.INTERMEDIARY))
scoring_base.register_model(
    'for-experienced(6)', _ProjectFilter(
        lambda project: project.seniority >= project_pb2.SENIOR))
scoring_base.register_model(
    'for-experienced(10)', _ProjectFilter(
        lambda project: project.seniority >= project_pb2.EXPERT))
scoring_base.register_model(
    # TODO(pascal): Drop this once it has been changed in all prod filters.
    'for-exact-experienced(internship)', _ProjectFilter(
        lambda project: project.seniority == project_pb2.INTERN))
scoring_base.register_model(
    'for-exact-experienced(intern)', _ProjectFilter(
        lambda project: project.seniority == project_pb2.INTERN))
scoring_base.register_model(
    'for-experience-in-domain', _ProjectFilter(
        lambda project: project.previous_job_similarity == project_pb2.DONE_THIS))
scoring_base.register_model(
    'for-experience-in-similar-domain', _ProjectFilter(
        lambda project: project.previous_job_similarity == project_pb2.DONE_SIMILAR))
scoring_base.register_model(
    'for-exact-interview(1)', _ProjectFilter(
        lambda project: project.total_interview_count == 1))
scoring_base.register_model(
    'for-few-job-creation', scoring_base.BaseFilter(
        # Average growth is 6.9%, see
        # https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/datasets/france_strategie_rapport_metiers_2022.ipynb
        lambda scoring_project: scoring_project.job_group_info().growth_2012_2022 < 0.069))
scoring_base.register_model(
    'for-first-job-search', _ProjectFilter(
        lambda project: project.kind == project_pb2.FIND_A_FIRST_JOB))
scoring_base.register_model(
    'for-first-time-in-job', _ProjectFilter(
        lambda project: project.previous_job_similarity == project_pb2.NEVER_DONE))
scoring_base.register_model(
    'for-frustrated-young(25)', _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth < 25))
scoring_base.register_model(
    'for-good-overall-score(50)', _ProjectFilter(
        lambda project: project.diagnostic.overall_score > 50))
# TODO(cyrille): Replace by more relevant field once it's been added in the onboarding.
scoring_base.register_model(
    'for-handicaped', _UserProfileFilter(
        lambda user: user_pb2.HANDICAPED in user.frustrations or user.has_handicap))
scoring_base.register_model(
    'for-high-mobility(country)', _ProjectFilter(
        lambda project: project.area_type >= geo_pb2.COUNTRY))
scoring_base.register_model(
    'for-high-salary-expectations', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.details.min_salary >
        scoring_project.salary_estimation()))
scoring_base.register_model(
    'for-job-applied-by-mail', _ApplicationMediumFilter(job_pb2.APPLY_BY_EMAIL))
scoring_base.register_model(
    'for-job-applied-in-person', _ApplicationMediumFilter(job_pb2.APPLY_IN_PERSON))
scoring_base.register_model(
    'for-long-search(7)', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.get_search_length_at_creation() >= 7))
scoring_base.register_model(
    'for-long-term-mom', _UserProfileFilter(_is_long_term_mom))
scoring_base.register_model(
    'for-low-mobility(departement)', _ProjectFilter(
        lambda project: project.area_type >= geo_pb2.DEPARTEMENT))
scoring_base.register_model(
    'for-medium-mobility(region)', _ProjectFilter(
        lambda project: project.area_type >= geo_pb2.REGION))
scoring_base.register_model(
    'for-most-likely-short-contract', _ContractTypeFilter(
        [job_pb2.CDD_LESS_EQUAL_3_MONTHS, job_pb2.INTERIM], 50))
scoring_base.register_model(
    'for-narrow-contract-search', _NarrowContractTypesFilter(50))
scoring_base.register_model(
    'for-network(1)', _ProjectFilter(lambda project: project.network_estimate == 1))
scoring_base.register_model(
    'for-network(2)', _ProjectFilter(lambda project: project.network_estimate == 2))
scoring_base.register_model(
    'for-network(3)', _ProjectFilter(lambda project: project.network_estimate == 3))
scoring_base.register_model(
    'for-no-interview', _ProjectFilter(
        lambda project: project.total_interview_count == -1))
scoring_base.register_model(
    'for-no-required-diploma', scoring_base.BaseFilter(lambda project: all(
        not d.percent_required for d in project.job_group_info().requirements.diplomas)))
scoring_base.register_model(
    'for-not-employed-anymore', _UserProfileFilter(
        lambda user: user.situation == user_pb2.LOST_QUIT))
scoring_base.register_model(
    'for-potential-freelancer',
    scoring_base.BaseFilter(lambda project: project.job_group_info().has_freelancers))
scoring_base.register_model(
    'for-qualified(bac+2)', _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.BTS_DUT_DEUG))
scoring_base.register_model(
    'for-qualified(bac+3)', _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.LICENCE_MAITRISE))
scoring_base.register_model(
    'for-qualified(bac+5)', _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.DEA_DESS_MASTER_PHD))
scoring_base.register_model(
    'for-recruiting-sector', _LBBProjectFilter())
scoring_base.register_model(
    'for-reorientation', _ProjectFilter(
        lambda project: project.kind == project_pb2.REORIENTATION))
scoring_base.register_model(
    'for-rural-area-inhabitant', _ProjectFilter(
        lambda project: project.city.urban_score == -1))
scoring_base.register_model(
    'for-searching-forever', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.get_search_length_at_creation() >= 19))
scoring_base.register_model(
    'for-short-search(-1)', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.get_search_length_at_creation() <= 1))
scoring_base.register_model(
    'for-short-search(-3)', scoring_base.BaseFilter(
        lambda scoring_project: scoring_project.get_search_length_at_creation() <= 3))
scoring_base.register_model(
    'for-simple-application', _ApplicationComplexityFilter(job_pb2.SIMPLE_APPLICATION_PROCESS))
scoring_base.register_model(
    'for-single-parent', _UserProfileFilter(
        lambda user: user_pb2.SINGLE_PARENT in user.frustrations or
        user.family_situation == user_pb2.SINGLE_PARENT_SITUATION))
scoring_base.register_model(
    'for-small-city-inhabitant(20000)', _ProjectFilter(
        lambda project: project.city.population > 0 and project.city.population <= 20000))
scoring_base.register_model(
    'for-training-fulfilled', _TrainingFullfilmentFilter(project_pb2.ENOUGH_DIPLOMAS))
scoring_base.register_model(
    'for-unemployed', _UserProfileFilter(
        lambda user: bool(user.situation) and user.situation != user_pb2.EMPLOYED))
scoring_base.register_model(
    'for-unqualified(bac)', _UserProfileFilter(
        lambda user: user.highest_degree <= job_pb2.BAC_BACPRO))
scoring_base.register_model(
    'for-unstressed-market(10/7)', _MarketTensionFilter('7'))
scoring_base.register_model(
    'for-very-frustrated(5)', _UserProfileFilter(
        lambda user: len(set(user.frustrations)) + len(set(user.custom_frustrations)) >= 5))
scoring_base.register_model(
    'for-very-short-contract', _ProjectFilter(
        lambda project: job_pb2.INTERIM in project.employment_types))
scoring_base.register_model(
    'for-women', _UserProfileFilter(lambda user: user.gender == user_pb2.FEMININE))
