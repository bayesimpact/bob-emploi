"""Module to advise the user with small tips for their job applications."""
import itertools
import random

from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2


class _AdviceImproveResume(scoring.ModelBase):
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
        if (self._num_interviews_increase(project) >= 2 and
                project.details.job_search_length_months <= 6):
            return 3
        return 0

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""
        resume_tips = project.list_application_tips()
        sorted_tips = sorted(resume_tips, key=lambda t: (-len(t.filters), random.random()))
        tips_proto = application_pb2.ResumeTips(
            qualities=[t for t in sorted_tips if t.type == application_pb2.QUALITY],
            improvements=[t for t in sorted_tips if t.type == application_pb2.CV_IMPROVEMENT])
        for tip in itertools.chain(tips_proto.qualities, tips_proto.improvements):
            tip.ClearField('type')
        return tips_proto


class _AdviceImproveInterview(scoring.ModelBase):
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
            return 3
        # Whatever the number of month of search, trigger 3 if the user did more than 5 interviews:
        if num_interviews >= self._NUM_INTERVIEWS[project_pb2.A_LOT] and \
                project.details.job_search_length_months <= 6:
            return 3
        return 0

    def get_expanded_card_data(self, project):
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


scoring.register_model('advice-improve-interview', _AdviceImproveInterview())
scoring.register_model('advice-improve-resume', _AdviceImproveResume())
