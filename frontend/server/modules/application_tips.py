"""Module to advise the user with small tips for their job applications."""

import itertools
import random
from typing import Optional

from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


def _get_handcrafted_job_requirements(project: scoring_base.ScoringProject) \
        -> Optional[job_pb2.JobRequirements]:
    """Handcrafted job requirements for the target job."""

    handcrafted_requirements = job_pb2.JobRequirements()
    all_requirements = project.job_group_info().requirements
    handcrafted_fields = [
        field for field in job_pb2.JobRequirements.DESCRIPTOR.fields_by_name.keys()
        if field.endswith('_short_text')]
    has_requirements = False
    for field in handcrafted_fields:
        field_requirements = getattr(all_requirements, field)
        if field_requirements:
            has_requirements = True
            setattr(handcrafted_requirements, field, field_requirements)
    if not has_requirements:
        return None
    return handcrafted_requirements


def _get_expanded_card_data_for_resume(project: scoring_base.ScoringProject) \
        -> application_pb2.ResumeTips:
    resume_tips = project.list_application_tips()
    sorted_tips = sorted(resume_tips, key=lambda t: (-len(t.filters), random.random()))
    tips_proto = application_pb2.ResumeTips(
        qualities=[t for t in sorted_tips if t.type == application_pb2.QUALITY],
        improvements=[t for t in sorted_tips if t.type == application_pb2.CV_IMPROVEMENT])
    for tip in itertools.chain(tips_proto.qualities, tips_proto.improvements):
        tip.ClearField('type')
    return tips_proto


def _max_monthly_interviews(project: scoring_base.ScoringProject) -> int:
    """Maximum number of monthly interviews one should have."""

    if project.job_group_info().application_complexity == job_pb2.COMPLEX_APPLICATION_PROCESS:
        return 5
    return 3


class _AdviceFreshResume(scoring_base.ModelBase):
    """A scoring model to trigger the "To start, prepare your resume" advice."""

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.details.weekly_applications_estimate <= project_pb2.LESS_THAN_2 or \
                project.details.job_search_length_months < 2:
            return scoring_base.ExplainedScore(3, [project.translate_string(
                'vous nous avez dit que vous en êtes au début de '
                'vos candidatures')])
        if project.details.diagnostic.category_id == 'bravo' and \
                user_pb2.RESUME in project.user_profile.frustrations:
            return scoring_base.ExplainedScore(1, [project.translate_string(
                'vous nous avez dit avoir du mal à rédiger votre CV')])

        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> application_pb2.ResumeTips:
        """Retrieve data for the expanded card."""

        return _get_expanded_card_data_for_resume(project)


class _AdviceImproveResume(scoring_base.ModelBase):
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

    def _num_interviews(self, project: scoring_base.ScoringProject) -> int:
        if project.details.total_interview_count < 0:
            return 0
        if project.details.total_interview_count:
            return project.details.total_interview_count
        return self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)

    def _num_interviews_increase(self, project: scoring_base.ScoringProject) -> float:
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

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if (self._num_interviews_increase(project) >= 2 and
                project.details.job_search_length_months <= 6):
            return scoring_base.ExplainedScore(3, [project.translate_string(
                "nous pensons qu'avec votre profil vous pourriez "
                "décrocher plus d'entretiens")])
        if project.details.diagnostic.category_id == 'bravo' and \
                user_pb2.RESUME in project.user_profile.frustrations:
            return scoring_base.ExplainedScore(1, [project.translate_string(
                'vous nous avez dit avoir du mal à rédiger votre CV')])
        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> application_pb2.ResumeTips:
        """Retrieve data for the expanded card."""

        return _get_expanded_card_data_for_resume(project)


class _AdviceImproveInterview(scoring_base.ModelBase):
    """A scoring model to trigger the "Improve your interview skills" advice."""

    _NUM_INTERVIEWS = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 1,
        project_pb2.DECENT_AMOUNT: 5,
        project_pb2.A_LOT: 10,
    }

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        if project.details.diagnostic.category_id == 'enhance-methods-to-interview':
            return scoring_base.ExplainedScore(3, [])
        reasons = [project.translate_string(
            "vous nous avez dit avoir passé beaucoup d'entretiens sans succès")]
        if project.details.total_interview_count < 0:
            num_interviews = 0
        elif project.details.total_interview_count > 0:
            num_interviews = project.details.total_interview_count
        else:
            num_interviews = self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)
        num_monthly_interviews = num_interviews / (project.details.job_search_length_months or 1)
        if num_monthly_interviews > _max_monthly_interviews(project):
            return scoring_base.ExplainedScore(3, reasons)
        # Whatever the number of month of search, trigger 3 if the user did more than 5 interviews:
        if num_interviews >= self._NUM_INTERVIEWS[project_pb2.DECENT_AMOUNT]:
            return scoring_base.ExplainedScore(3, reasons)
        if project.details.diagnostic.category_id == 'bravo':
            return scoring_base.ExplainedScore(1, [])
        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> application_pb2.InterviewTips:
        """Retrieve data for the expanded card."""

        interview_tips = project.list_application_tips()
        sorted_tips = sorted(interview_tips, key=lambda t: (-len(t.filters), random.random()))
        tips_proto = application_pb2.InterviewTips(
            qualities=[t for t in sorted_tips if t.type == application_pb2.QUALITY],
            preparations=[
                t for t in sorted_tips
                if t.type == application_pb2.INTERVIEW_PREPARATION])
        for tip in itertools.chain(tips_proto.qualities, tips_proto.preparations):
            tip.ClearField('type')
        return tips_proto


scoring_base.register_model('advice-fresh-resume', _AdviceFreshResume())
scoring_base.register_model('advice-improve-interview', _AdviceImproveInterview())
scoring_base.register_model('advice-improve-resume', _AdviceImproveResume())
