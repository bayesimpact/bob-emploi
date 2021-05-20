"""Scoring module for advices and actions.

See design doc at http://go/bob:scoring-advices.
"""

import logging
import re
import typing
from typing import Callable, List, Iterable, Optional, Set

from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import modules
from bob_emploi.frontend.server import scoring_base
# pylint: disable=unused-import,import-only-modules
from bob_emploi.frontend.server import template
# Re-export some base elements from here.
from bob_emploi.frontend.server.scoring_base import ConstantScoreModel
from bob_emploi.frontend.server.scoring_base import ExplainedScore
from bob_emploi.frontend.server.scoring_base import filter_using_score
from bob_emploi.frontend.server.scoring_base import get_scoring_model
from bob_emploi.frontend.server.scoring_base import get_user_locale
from bob_emploi.frontend.server.scoring_base import LowPriorityAdvice
from bob_emploi.frontend.server.scoring_base import ModelBase
from bob_emploi.frontend.server.scoring_base import NotEnoughDataException
from bob_emploi.frontend.server.scoring_base import NULL_EXPLAINED_SCORE
from bob_emploi.frontend.server.scoring_base import ScoringProject
from bob_emploi.frontend.server.scoring_base import SCORING_MODEL_REGEXPS
from bob_emploi.frontend.server.scoring_base import SCORING_MODELS
from bob_emploi.frontend.server.scoring_base import TEMPLATE_VAR_PATTERN
from bob_emploi.frontend.server.template import APPLICATION_MODES
# pylint: enable=unused-import,import-only-modules

# TODO(cyrille): Move strategy scorers to its own module and re-enable rule below.
# pylint: disable=too-many-lines
_Type = typing.TypeVar('_Type')

modules.import_all_modules()


class _AdviceTrainingScoringModel(scoring_base.ModelBase):
    """A scoring model for the training advice."""

    def get_expanded_card_data(self, project: ScoringProject) -> training_pb2.Trainings:
        """Compute extra data for this module to render a card in the client."""

        return training_pb2.Trainings(trainings=project.get_trainings())

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute the score of given project and why it's scored."""

        if project.details.diagnostic.category_id == 'missing-diploma':
            return ExplainedScore(3, ["vous avez besoin d'un diplôme"])

        # TODO(guillaume): Get the score for each project from lbf.
        all_trainings = project.get_trainings()

        if not all_trainings:
            return NULL_EXPLAINED_SCORE

        search_length = round(project.get_search_length_at_creation())
        if len(all_trainings) >= 2:
            if search_length >= 3:
                return ExplainedScore(3, [
                    project.translate_static_string('vous cherchez depuis {} mois')
                    .format(search_length)])
            if project.details.kind == project_pb2.REORIENTATION >= 3:
                return ExplainedScore(3, [project.translate_static_string(
                    'vous souhaitez vous réorienter')])
        if search_length >= 2:
            return ExplainedScore(2, [
                project.translate_static_string('vous cherchez depuis {} mois')
                .format(search_length)])

        return ExplainedScore(1, [])


class _AdviceBodyLanguage(scoring_base.ModelBase):
    """A scoring model for recommending to improve one's body language."""

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        _related_frustrations = {
            user_pb2.INTERVIEW: project.translate_static_string(
                'vous nous avez dit que les entretiens sont un challenge pour vous'),
            user_pb2.SELF_CONFIDENCE: project.translate_static_string(
                'vous nous avez dit parfois manquer de confiance en vous'
            ),
            user_pb2.ATYPIC_PROFILE: project.translate_static_string(
                'vous nous avez dit ne pas rentrer dans les cases des recruteurs'
            ),
        }

        reasons = [
            _related_frustrations[frustration]
            for frustration in project.user_profile.frustrations
            if frustration in _related_frustrations]
        return ExplainedScore(
            2 if reasons else 1,
            reasons if reasons else [project.translate_static_string(
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
            -> Optional[project_pb2.Advice]:
        """Get override data for an advice."""

        config = project.specific_to_job_advice_config()
        if not config:
            logging.warning(
                'Did not find any config for specific-to-job advice for job "%s".',
                project.details.target_job.code_ogr)
            return None

        # TODO(pascal): Use keyed translation with context and drop those.
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
            title=project.translate_airtable_string(
                'specificToJobAdvice', config.id, 'title', config.title),
            short_title=project.translate_airtable_string(
                'specificToJobAdvice', config.id, 'short_title', config.short_title),
            goal=project.translate_airtable_string(
                'specificToJobAdvice', config.id, 'goal', config.goal),
            diagnostic_topics=config.diagnostic_topics,
            card_text=project.translate_airtable_string(
                'specificToJobAdvice', config.id, 'card_text', config.card_text),
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

    def __init__(self, filter_func: Callable[[user_pb2.UserProfile], bool]) -> None:
        super().__init__(lambda project: filter_func(project.user_profile))


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
            filter_func: Callable[[project_pb2.Project], bool],
            reasons: Optional[List[str]] = None) -> None:
        super().__init__(
            lambda project: filter_func(project.details), reasons=reasons)


class _JobGroupFilter(_ProjectFilter):
    """A scoring model to filter on a job group."""

    def __init__(self, job_group_start: str) -> None:
        super().__init__(self._filter)
        self._job_group_starts = [prefix.strip() for prefix in job_group_start.split(',')]

    def _filter(self, project: project_pb2.Project) -> bool:
        for job_group_start in self._job_group_starts:
            if project.target_job.job_group.rome_id.startswith(job_group_start):
                return True
        return False


class _JobFilter(_ProjectFilter):
    """A scoring model to filter on specific jobs."""

    def __init__(self, jobs: str) -> None:
        super().__init__(self._filter)
        self._jobs = set(job.strip() for job in jobs.split(','))

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.target_job.code_ogr in self._jobs


class _DepartementFilter(_ProjectFilter):
    """A scoring model to filter on the département."""

    def __init__(self, departements: str) -> None:
        super().__init__(self._filter)
        self._departements = set(d.strip() for d in departements.split(','))

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.city.departement_id in self._departements


class _OldUserFilter(scoring_base.BaseFilter):
    """A scoring model to filter on the age."""

    def __init__(self, min_age: str) -> None:
        super().__init__(self._filter)
        self._min_age = int(min_age)

    def _filter(self, project: ScoringProject) -> bool:
        return project.get_user_age() > self._min_age


class _FrustratedOldUserFilter(_OldUserFilter):
    """A scoring model to filter on the age."""

    def _filter(self, project: ScoringProject) -> bool:
        return super()._filter(project) and \
            user_pb2.AGE_DISCRIMINATION in project.user_profile.frustrations


class _FrustrationFilter(_UserProfileFilter):
    """A scoring model to filter on a frustration."""

    def __init__(self, frustration: str) -> None:
        super().__init__(self._filter)
        self.frustration = user_pb2.Frustration.Value(frustration)

    def _filter(self, user: user_pb2.UserProfile) -> bool:
        return self.frustration in user.frustrations


class _PassionateFilter(_ProjectFilter):
    """A scoring model to filter on a frustration."""

    def __init__(self, passionate_level: str):
        super().__init__(self._filter)
        self._passionate_level = project_pb2.PassionateLevel.Value(passionate_level)

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.passionate_level >= self._passionate_level


class _YoungUserFilter(scoring_base.BaseFilter):
    """A scoring model to filter on the age."""

    def __init__(self, max_age: str) -> None:
        super().__init__(self._filter)
        self._max_age = int(max_age)

    def _filter(self, project: ScoringProject) -> bool:
        return project.get_user_age() < self._max_age


class _NegateFilter(scoring_base.BaseFilter):
    """A scoring model to filter the opposite of another filter."""

    def __init__(self, negated_filter_name: str) -> None:
        super().__init__(self._filter)
        if get_scoring_model(negated_filter_name) is None:
            raise ValueError(f'Scorer to negate does not exist: {negated_filter_name}')
        self._negated_filter_name = negated_filter_name

    def _filter(self, project: ScoringProject) -> bool:
        return not project.check_filters((self._negated_filter_name,))


class _ActiveExperimentFilter(scoring_base.BaseFilter):
    """A scoring model to filter on a feature enabled."""

    _features: Set[str] = {
        f.name for f in user_pb2.Features.DESCRIPTOR.fields
        if f.enum_type == user_pb2.BinaryExperiment.DESCRIPTOR
    }

    def __init__(self, feature: str, reasons: Optional[List[str]] = None) -> None:
        super().__init__(self._filter, reasons=reasons)
        if feature not in self._features:
            raise ValueError(f'"{feature}" is not a valid feature:\n{self._features}')
        self._feature = feature

    def _filter(self, project: ScoringProject) -> bool:

        return user_pb2.ACTIVE == \
            typing.cast(
                'user_pb2.BinaryExperiment.V', getattr(project.features_enabled, self._feature))


class _JobGroupWithoutJobFilter(_ProjectFilter):
    """A scoring model to filter on a job group but exclude some jobs."""

    def __init__(
            self,
            job_groups: Iterable[str],
            exclude_jobs: Optional[Iterable[str]] = None,
            reasons: Optional[List[str]] = None) -> None:
        super().__init__(self._filter, reasons=reasons)
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
            application_complexity: 'job_pb2.ApplicationProcessComplexity.V',
            reasons: Optional[List[str]] = None) -> None:
        super().__init__(self._filter, reasons=reasons)
        self._application_complexity = application_complexity

    def _filter(self, project: ScoringProject) -> bool:

        return self._application_complexity == project.job_group_info().application_complexity


class _ScorerFilter(scoring_base.BaseFilter):
    """A scoring model to filter on above/below average values on a given scorer."""

    def __init__(self, scorer: str, is_good: bool = False):
        super().__init__(self._filter)
        if not get_scoring_model(scorer):
            raise ValueError(f'Could not find scoring model {scorer}')
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
    offers_limit is an integer and it's the number of offers for 10 seekers. If keep_stressed is
    True, the filter passes for all markets with higher tension. Otherwise it passes for markets
    with lower tension.
    """

    def __init__(self, offers_limit: str, keep_stressed: bool = False):
        super().__init__(self._filter)
        self._tension_limit = 10 / int(offers_limit) if int(offers_limit) else 1000
        self._keep_stressed = keep_stressed

    def _filter(self, project: ScoringProject) -> bool:
        tension = project.market_stress()
        if not tension:
            # TODO(cyrille): Consider raising a NotEnoughDataException here, and in all filters
            # where it would be relevant.
            return False
        if self._keep_stressed:
            return tension >= self._tension_limit
        return tension <= self._tension_limit


class _MarketStressRelevance(scoring_base.RelevanceModelBase):

    def score_relevance(self, project: ScoringProject) -> 'diagnostic_pb2.MainChallengeRelevance.V':
        """Compute a relevance for the given project."""

        if project.market_stress() is None:
            return diagnostic_pb2.NEUTRAL_RELEVANCE
        return diagnostic_pb2.RELEVANT_AND_GOOD


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

        return ExplainedScore(1, [])


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

        reasons: List[str] = []
        if has_experience:
            reasons.append(project.translate_static_string(
                "vous nous avez dit avoir de l'expérience"))
        if is_frustrated_by_trainings:
            reasons.append(project.translate_static_string(
                'vous nous avez dit avoir du mal à accéder à une formation'))
        if thinks_xp_covers_diplomas:
            reasons.append(project.translate_static_string(
                'vous nous avez dit ne pas avoir les diplômes mais avoir '
                "l'expérience demandée"))
        if not thinks_xp_covers_diplomas and does_not_have_required_diplomas:
            reasons.append(project.translate_static_string(
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
            reasons.append(project.translate_static_string(
                'vous nous avez dit que votre age pouvait parfois être un obstacle'))
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
            return ExplainedScore(3, [project.translate_static_string(
                'vous nous avez dit envoyer beaucoup de candidatures'
            )])
        return NULL_EXPLAINED_SCORE


class _ApplicationMediumFilter(scoring_base.BaseFilter):
    """A model that filters out users searching for jobs with the wrong application medium."""

    def __init__(
            self,
            medium: 'job_pb2.ApplicationMedium.V',
            reasons: Optional[List[str]] = None) -> None:
        super().__init__(self._filter, reasons=reasons)
        self._medium = medium

    def _filter(self, project: ScoringProject) -> bool:

        return project.job_group_info().preferred_application_medium == self._medium


class _LBBProjectFilter(scoring_base.BaseFilter):
    """A scoring model that filters in users searching for jobs in a sector that recruits."""

    def __init__(self, reasons: Optional[List[str]] = None) -> None:
        super().__init__(self._filter, reasons)

    def _filter(self, project: ScoringProject) -> bool:

        total_nb_employees = 0
        for company in [companies.to_proto(c)
                        for c in companies.get_lbb_companies(project.details, distance_km=30)]:
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

    def __init__(
            self,
            training_fulfillment_estimate: 'project_pb2.TrainingFulfillmentEstimate.V') -> None:
        super().__init__(self._filter)
        self.training_fulfillment_estimate = training_fulfillment_estimate

    def _filter(self, project: project_pb2.Project) -> bool:
        return project.training_fulfillment_estimate == self.training_fulfillment_estimate


class _ContractTypeFilter(scoring_base.BaseFilter):

    def __init__(
            self,
            selected_contracts: List['job_pb2.EmploymentType.V'],
            min_percentage: int) -> None:
        super().__init__(self._filter)
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
        super().__init__(self._filter)
        self._required_percentage = required_percentage

    def _filter(self, project: ScoringProject) -> bool:
        contract_types = project.job_group_info().requirements.contract_types
        if not contract_types:
            return False
        percentage = sum(contract_type.percent_suggested for contract_type in contract_types if
                         contract_type.contract_type in project.details.employment_types)
        return percentage < self._required_percentage


class _StressedJobFilter(scoring_base.BaseFilter):

    def __init__(self, min_stress: float) -> None:
        super().__init__(self._filter)
        self._min_stress = min_stress

    def _filter(self, project: ScoringProject) -> bool:
        national_market_score = project.job_group_info().national_market_score
        if not national_market_score:
            return False
        return 1 / national_market_score >= self._min_stress


class _LongSearchFilter(scoring_base.BaseFilter):
    """A scoring model to filter on the search length."""

    def __init__(self, min_search: str) -> None:
        super().__init__(self._filter)
        self._min_search = int(min_search)

    def _filter(self, project: ScoringProject) -> bool:
        return project.get_search_length_at_creation() >= self._min_search


class _AdviceFollowupEmail(scoring_base.ModelBase):

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.job_group_info().preferred_application_medium == job_pb2.APPLY_IN_PERSON:
            return NULL_EXPLAINED_SCORE
        if user_pb2.NO_OFFER_ANSWERS in project.user_profile.frustrations:
            return ExplainedScore(2, [project.translate_static_string(
                'vous nous avez dit ne pas avoir assez de réponses des recruteurs'
            )])
        return ExplainedScore(1, [])


class _MonthlyInterviewFilter(scoring_base.BaseFilter):

    def __init__(self, interview_rate: str) -> None:
        super().__init__(self._filter)
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
        super().__init__(self._filter)
        self._min_interviews = int(min_interviews)

    def _filter(self, project: ScoringProject) -> bool:

        interview_counts = project.details.total_interview_count
        return interview_counts > self._min_interviews


class _CumulativeSearchFilter(scoring_base.BaseFilter):

    def __init__(self, active_search_min_months: int, passive_search_min_months: int) -> None:
        super().__init__(self._filter)
        self._passive_search_min_months = passive_search_min_months
        self._active_search_min_months = active_search_min_months

    def _filter(self, project: ScoringProject) -> bool:
        search_length = project.get_search_length_at_creation()
        if project.score('for-employed') > 0:
            return search_length >= self._passive_search_min_months
        return search_length >= self._active_search_min_months


class _FindWhatYouLikeFilter(scoring_base.BaseFilter):

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        has_never_done_job = project.details.previous_job_similarity == project_pb2.NEVER_DONE
        if project.details.passionate_level > project_pb2.LIKEABLE_JOB:
            # User is already passionate enough about that job.
            return False
        # User should not be motivated to create a company to change job.
        if project.details.kind == project_pb2.CREATE_OR_TAKE_OVER_COMPANY:
            return user_pb2.MOTIVATION in project.user_profile.frustrations
        market_stress = project.market_stress()
        if market_stress and market_stress < 10 / 7:
            # Easy market, they might as well do that.
            return False
        age = project.get_user_age()
        if age <= 30:
            # User is young, they should not be too experienced to change.
            return project.details.seniority < project_pb2.SENIOR
        # User hasn't started search yet and is not motivated.
        if project.details.job_search_has_not_started and has_never_done_job:
            return user_pb2.MOTIVATION in project.user_profile.frustrations
        if _CumulativeSearchFilter(2, 6).score(project):
            # User has been searching for some time, don't tell them to switch project.
            return False
        # User should be asking for a new job.
        return project.details.kind == project_pb2.REORIENTATION or \
            has_never_done_job


# TODO(pascal): Merge with _RequiredDiplomasScoringModel.
class _MissingDiplomaFilter(scoring_base.BaseFilter):

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        if project.details.kind == project_pb2.CREATE_OR_TAKE_OVER_COMPANY:
            # No need for a diploma if you want to create your company.
            return False
        rome_id = project.details.target_job.job_group.rome_id
        if not rome_id:
            raise scoring_base.NotEnoughDataException(
                'Need a job group to determine if the user has enough diplomas',
                # TODO(pascal): Use project_id instead of 0.
                {'projects.0.targetJob.jobGroup.romeId'})
        if all(diploma.percent_required == 0 for diploma in project.requirements().diplomas):
            # No diploma is actually required for the job.
            return False
        if project.details.training_fulfillment_estimate in {
                project_pb2.ENOUGH_DIPLOMAS, project_pb2.CURRENTLY_IN_TRAINING}:
            # They already have the diploma, or are about to get it.
            return False
        if project.details.seniority > project_pb2.SENIOR and project.get_user_age() >= 50:
            # They are too old and experienced for a diploma to be relevant.
            return False
        return True


class _RiskyCovidFilter(scoring_base.BaseFilter):

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        covid_risk = project.job_group_info().covid_risk
        if not covid_risk:
            rome_id = project.details.target_job.job_group.rome_id
            if not rome_id:
                raise scoring_base.NotEnoughDataException(
                    'Need a job group to determine if the job is affected by Covid',
                    {'projects.0.targetJob.jobGroup.romeId'})
            raise scoring_base.NotEnoughDataException(
                'No information on Covid-related risks for this job',
                {f'data.job_group_info.{rome_id}.covid_risk'})
        return covid_risk == job_pb2.COVID_RISKY


class _TryWithoutDiploma(scoring_base.ModelHundredBase):

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        if project.job_group_info().is_diploma_strictly_required:
            return 0
        return 10


class _GetAlternanceScorer(scoring_base.ModelHundredBase):

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        age = project.get_user_age()
        if age > 30:
            # It's harder to get alternance after 30.
            return 20
        return 40


class _InterviewSuccessScorer(scoring_base.ModelHundredBase):

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        if project.details.total_interview_count >= 3 and project.get_search_length_now() >= 7:
            # This gets more relevant in this case.
            return 30
        return 10


class _FindLikeableJobScorer(scoring_base.ModelHundredBase):

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        if project.details.passionate_level > project_pb2.LIKEABLE_JOB:
            return 0
        if project.details.diagnostic.category_id == 'find-what-you-like':
            return 30
        return 40


class _FindWhatYouLikeRelevance(scoring_base.RelevanceModelBase):

    def score_relevance(self, project: ScoringProject) -> 'diagnostic_pb2.MainChallengeRelevance.V':
        """Compute a relevance for the given project."""

        if project.details.passionate_level == project_pb2.LIKEABLE_JOB:
            return diagnostic_pb2.NEUTRAL_RELEVANCE
        market_stress = project.market_stress()
        if project.details.passionate_level < project_pb2.LIKEABLE_JOB and \
                market_stress and market_stress < 10 / 7:
            return diagnostic_pb2.NEUTRAL_RELEVANCE
        return diagnostic_pb2.RELEVANT_AND_GOOD


class _EnhanceMethodsRelevance(scoring_base.RelevanceModelBase):

    def score_relevance(self, project: ScoringProject) -> 'diagnostic_pb2.MainChallengeRelevance.V':
        """Compute a relevance for the given project."""

        if project.get_search_length_at_creation() < 0:
            return diagnostic_pb2.NEUTRAL_RELEVANCE
        return diagnostic_pb2.RELEVANT_AND_GOOD


class _StrategyForFrustrated(scoring_base.ModelHundredBase):

    def __init__(self, frustrations: str) -> None:
        self._important_frustrations = set(
            user_pb2.Frustration.Value(f.strip()) for f in frustrations.split(','))
        super().__init__()

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> int:
        frustrations = set(project.user_profile.frustrations)
        if frustrations.intersection(self._important_frustrations):
            return 15
        return 10


class _MultiProjectsModelBase(scoring_base.ModelBase):

    def __init__(self, project_filter_name: str) -> None:
        super().__init__()
        if get_scoring_model(project_filter_name) is None:
            raise ValueError(f'Scorer does not exist: {project_filter_name}')
        self._project_filter_name = project_filter_name

    def _iter_on_project_scores(self, project: ScoringProject) -> Iterable[float]:
        for each_project in project.user.projects:
            yield project.get_other_project(each_project).score(self._project_filter_name)


class _ForAnyProject(_MultiProjectsModelBase):

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        for score in self._iter_on_project_scores(project):
            if score:
                return score
        return 0


class _ForAllProjects(_MultiProjectsModelBase):

    def score(self, project: ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        # TODO(cyrille): Rewrite this to be logically consistent with forall.
        first_score = 0.
        for score in self._iter_on_project_scores(project):
            if not score:
                return score
            if not first_score:
                first_score = score
        return first_score


_UNEMPLOYED_KINDS = {
    project_pb2.FIND_A_FIRST_JOB,
    project_pb2.FIND_A_NEW_JOB,
    project_pb2.REORIENTATION,
}


class _TryAlternanceScoringModel(scoring_base.ModelBase):

    def score_and_explain(self, project: ScoringProject) -> ExplainedScore:
        """Compute a score for the given ScoringProject."""

        is_missing_diploma = project.details.diagnostic.category_id == 'missing-diploma'

        if not is_missing_diploma and project.details.seniority >= project_pb2.SENIOR:
            # Too senior to suggest alternance.
            return NULL_EXPLAINED_SCORE

        age = project.get_user_age()
        if not is_missing_diploma and age > 55:
            # Too old to suggest alternance.
            return NULL_EXPLAINED_SCORE

        training_fulfillment_estimate = project.details.training_fulfillment_estimate
        may_require_training = \
            is_missing_diploma or \
            training_fulfillment_estimate == project_pb2.TRAINING_FULFILLMENT_NOT_SURE or \
            not training_fulfillment_estimate
        if not may_require_training:
            # Doe not require a training.
            return NULL_EXPLAINED_SCORE

        if age < 26:
            return ExplainedScore(3, [project.translate_static_string('vous êtes jeune')])
        if age < 35 and project.details.kind in _UNEMPLOYED_KINDS:
            return ExplainedScore(3, [project.translate_static_string('vous êtes encore jeune')])
        if age > 45:
            return ExplainedScore(
                1, [project.translate_static_string("l'alternance n'est pas que pour les jeunes")])

        return ExplainedScore(
            2, [project.translate_static_string("l'alternance n'est pas que pour les jeunes")])


class _ResumeScoringModel(_ProjectFilter):

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: project_pb2.Project) -> bool:
        if not project.has_resume:
            raise NotEnoughDataException(
                "It's not clear whether the user has a resume or not",
                # TODO(pascal): Use project_id instead of 0. Same below.
                {'projects.0.hasResume'},
            )
        return project.has_resume == boolean_pb2.TRUE


class _CompanyCreatorScoringModel(_ProjectFilter):

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: project_pb2.Project) -> bool:
        if not project.kind:
            raise NotEnoughDataException(
                "It's not clear what kind of project the user wants",
                {'projects.0.kind'},
            )
        return project.kind == project_pb2.CREATE_OR_TAKE_OVER_COMPANY


def unoptional(maybe_bool: 'boolean_pb2.OptionalBool.V', field: Optional[str] = None) -> bool:
    """Returns a boolean value from an optional one, or raise if the value is missing."""

    if maybe_bool == boolean_pb2.UNKNOWN_BOOL:
        raise NotEnoughDataException(
            'An OptionalBool field is missing', fields=None if field is None else {field})
    return maybe_bool == boolean_pb2.TRUE


def _is_long_term_mom(user: user_pb2.UserProfile) -> bool:
    return user.gender == user_pb2.FEMININE and user_pb2.STAY_AT_HOME_PARENT in user.frustrations


_MIGRANT_FRUSTRATIONS = {user_pb2.LANGUAGE, user_pb2.FOREIGN_QUALIFICATIONS}

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
# Matches strings like "for-lower-market-tension(10/7)".
scoring_base.register_regexp(
    re.compile(r'^for-lower-market-tension\(10\/([0-9]+)\)$'), _MarketTensionFilter,
    'for-lower-market-tension(10/7)')
# Matches strings like "for-stressed-market(10/3)".
scoring_base.register_regexp(
    re.compile(r'^for-stressed-market\(10\/([0-9]+)\)$'),
    lambda offers: _MarketTensionFilter(offers, keep_stressed=True), 'for-stressed-market(10/3)')
# Matches strings like "for-many-interviews-per-month(0.5)".
scoring_base.register_regexp(
    re.compile(r'^for-many-interviews-per-month\(([0-9]+(?:\.[0-9]+)?)\)$'),
    _MonthlyInterviewFilter, 'for-many-interviews-per-month(4)')
# Matches strings like "for-many-interviews(5)".
scoring_base.register_regexp(
    re.compile(r'^for-many-interviews\(([0-9]+)\)$'), _InterviewFilter,
    'for-many-interviews(5)')
# Matches strings like "strategy-for-frustrated(MOTIVATION, TRAINING)".
scoring_base.register_regexp(
    re.compile(r'^strategy-for-frustrated\((.*)\)$'), _StrategyForFrustrated,
    'strategy-for-frustrated(MOTIVATION, TRAINING)')
# Matches strings like "for-any-project(filter-on-project)".
scoring_base.register_regexp(
    re.compile(r'^for-any-project\((.*)\)$'), _ForAnyProject,
    'for-any-project(constant(0))')
# Matches strings like "for-all-projects(filter-on-project)".
scoring_base.register_regexp(
    re.compile(r'^for-all-projects\((.*)\)$'), _ForAllProjects,
    'for-all-projects(constant(0))')
# Matches strings like "for-long-search(12)".
scoring_base.register_regexp(
    re.compile(r'^for-long-search\(([0-9]+)\)$'), _LongSearchFilter, 'for-long-search(12)')


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
    'advice-training', _AdviceTrainingScoringModel())
scoring_base.register_model(
    'advice-try-alternance', _TryAlternanceScoringModel())
scoring_base.register_model(
    'category-find-what-you-like', _FindWhatYouLikeFilter())
scoring_base.register_model(
    'category-missing-diploma', _MissingDiplomaFilter())
scoring_base.register_model(
    'for-active-search', _ProjectFilter(
        lambda project: project.HasField('created_at') and not project.job_search_has_not_started))
scoring_base.register_model(
    'for-application(2)', _ProjectFilter(
        lambda project: project.weekly_applications_estimate >= project_pb2.SOME))
scoring_base.register_model(
    'for-autonomous', _UserProfileFilter(
        lambda profile: unoptional(profile.is_autonomous, 'profile.isAutonomous')))
scoring_base.register_model(
    'for-big-city-inhabitant(100000)', _ProjectFilter(
        lambda project: project.city.population >= 100000))
scoring_base.register_model(
    'for-company-creator', _CompanyCreatorScoringModel())
scoring_base.register_model(
    'for-complex-application', _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS))
scoring_base.register_model(
    'for-currently-in-training', _TrainingFullfilmentFilter(project_pb2.CURRENTLY_IN_TRAINING))
scoring_base.register_model(
    'for-driver', _UserProfileFilter(
        lambda user: user.has_car_driving_license >= boolean_pb2.TRUE or
        bool(user.driving_licenses)))
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
    'for-more-job-offers-locally(5)', scoring_base.BaseFilter(
        # 15.12 annual offers in PE is equivalent to 5 job offers currently
        # opened in the département.
        # https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/datasets/job_offers/rare_job_offers.ipynb
        lambda scoring_project: scoring_project.local_diagnosis().num_job_offers_last_year > 15.12))
scoring_base.register_model(
    'for-first-job-search', _ProjectFilter(
        lambda project: project.kind == project_pb2.FIND_A_FIRST_JOB))
scoring_base.register_model(
    'for-first-time-in-job', _ProjectFilter(
        lambda project: project.previous_job_similarity == project_pb2.NEVER_DONE))
scoring_base.register_model(
    'for-frustrated-young(25)', scoring_base.BaseFilter(
        lambda scoring_project:
        user_pb2.AGE_DISCRIMINATION in scoring_project.user_profile.frustrations and
        scoring_project.get_user_age() < 25))
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
    'for-long-term-mom', _UserProfileFilter(_is_long_term_mom))
scoring_base.register_model(
    'for-low-mobility(departement)', _ProjectFilter(
        lambda project: project.area_type >= geo_pb2.DEPARTEMENT))
scoring_base.register_model(
    'for-medium-mobility(region)', _ProjectFilter(
        lambda project: project.area_type >= geo_pb2.REGION))
# TODO(cyrille): Consider using a more explicit question to get this info.
scoring_base.register_model(
    'for-migrant', _UserProfileFilter(
        lambda profile: bool(_MIGRANT_FRUSTRATIONS & set(profile.frustrations))))
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
    'for-risky-covid', _RiskyCovidFilter())
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
    'for-long-accumulated-search(2)', _CumulativeSearchFilter(
        active_search_min_months=2, passive_search_min_months=6))
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
    'for-stressed-job(10/3)', _StressedJobFilter(10 / 3))
scoring_base.register_model(
    'for-training-fulfilled', _TrainingFullfilmentFilter(project_pb2.ENOUGH_DIPLOMAS))
scoring_base.register_model(
    'for-unemployed', _UserProfileFilter(
        lambda user: bool(user.situation) and user.situation != user_pb2.EMPLOYED))
scoring_base.register_model(
    'for-unqualified(bac)', _UserProfileFilter(
        lambda user: user.highest_degree <= job_pb2.BAC_BACPRO))
scoring_base.register_model(
    'for-no-degree', _UserProfileFilter(
        lambda user: user.highest_degree == job_pb2.NO_DEGREE))
# TODO(cyrille): Replace with for-lower-market-tension(7) and remove.
scoring_base.register_model(
    'for-unstressed-market(10/7)', _MarketTensionFilter('7'))
scoring_base.register_model(
    'for-very-frustrated(5)', _UserProfileFilter(
        lambda user: len(set(user.frustrations)) + len(set(user.custom_frustrations)) >= 5))
scoring_base.register_model(
    'for-very-short-contract', _ProjectFilter(
        lambda project: job_pb2.INTERIM in project.employment_types))
# TODO(cyrille): Rather use unoptional.
scoring_base.register_model(
    'for-with-resume', _ResumeScoringModel())
scoring_base.register_model(
    'for-women', _UserProfileFilter(lambda user: user.gender == user_pb2.FEMININE))
scoring_base.register_model(
    'relevance-enhance-methods', _EnhanceMethodsRelevance())
scoring_base.register_model(
    'relevance-find-what-you-like', _FindWhatYouLikeRelevance())
scoring_base.register_model(
    'relevance-market-stress', _MarketStressRelevance())
scoring_base.register_model(
    'strategy-interview-success', _InterviewSuccessScorer())
scoring_base.register_model(
    'strategy-get-alternance', _GetAlternanceScorer())
scoring_base.register_model(
    'strategy-likeable-job', _FindLikeableJobScorer())
scoring_base.register_model(
    'strategy-try-without-diploma', _TryWithoutDiploma())


# TODO(cyrille): Add documentation on each scoring model.
def document_scoring_models() -> List[str]:
    """Prepare the lines for a documentation file with the list of all scoring models."""

    base_models = [
        model for model in SCORING_MODELS
        if not any(regexp.match(model) for regexp, c in SCORING_MODEL_REGEXPS)]
    lines = ['# List of Available Scoring Models', '']
    lines.extend(['## Scoring Models', '', '```'])
    lines.extend(model for model in sorted(base_models) if model)
    lines.extend(['```', '', '## Scoring Model Regular Expressions', '', '```'])
    lines.extend(sorted(f'/{regexp.pattern}/' for regexp, c in SCORING_MODEL_REGEXPS))
    lines.extend(['```'])
    return lines


if __name__ == '__main__':
    for line in document_scoring_models():
        print(line)
