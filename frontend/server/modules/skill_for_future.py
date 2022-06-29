"""Module to recommend skills for the future of a job."""

from typing import Sequence

from bob_emploi.frontend.api import skill_pb2
from bob_emploi.frontend.server import scoring_base


class _SkillForFuture(scoring_base.ModelBase):
    """A scoring model for the skills recommendation."""

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute the score for a given project and explains it."""

        skills = self._get_skills(project)

        if not skills:
            return scoring_base.NULL_EXPLAINED_SCORE

        return scoring_base.ExplainedScore(2, [])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> skill_pb2.JobSkills:
        """Retrieve data for the expanded card."""

        return skill_pb2.JobSkills(skills=self._get_skills(project))

    @scoring_base.ScoringProject.cached('skill-for-future')
    def _get_skills(self, project: scoring_base.ScoringProject) \
            -> Sequence[skill_pb2.Skill]:
        """Return a list of skills recommendation for the project's target job."""

        return project.job_group_info().skills_for_future


scoring_base.register_model('advice-skill-for-future', _SkillForFuture())
