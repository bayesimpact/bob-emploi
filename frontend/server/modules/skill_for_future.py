"""Module to recommend skills for the future of a job."""

from bob_emploi.frontend.api import skill_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base


class _SkillForFuture(scoring_base.ModelBase):
    """A scoring model for the skills recommendation."""

    def __init__(self) -> None:
        super().__init__()
        self._db: proto.MongoCachedCollection[skill_pb2.JobSkills] = \
            proto.MongoCachedCollection(skill_pb2.JobSkills, 'skills_for_future')

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute the score for a given project and explains it."""

        skills = self._get_skills(project)

        if not skills.skills:
            return scoring_base.NULL_EXPLAINED_SCORE

        return scoring_base.ExplainedScore(2, [])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> skill_pb2.JobSkills:
        """Retrieve data for the expanded card."""

        return self._get_skills(project)

    @scoring_base.ScoringProject.cached('skill-for-future')
    def _get_skills(self, project: scoring_base.ScoringProject) \
            -> skill_pb2.JobSkills:
        """Return a list of skills recommendation for the project's target job."""

        rome_id = project.details.target_job.job_group.rome_id
        skills_per_rome_prefix = self._db.get_collection(project.database)
        for prefix_len in (5, 3, 1):
            skills = skills_per_rome_prefix.get(rome_id[:prefix_len])
            if skills:
                return skills
        return skill_pb2.JobSkills()


scoring_base.register_model('advice-skill-for-future', _SkillForFuture())
