"""Module to score the clarity of a project."""

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import scoring_base


def _count_project_super_groups(project: scoring_base.ScoringProject) -> int:
    job_groups = {
        p.target_job.job_group.rome_id
        for p in project.user.projects
        if p.target_job.job_group.rome_id
    }

    if not job_groups:
        return 0

    job_super_groups = {jobs.upgrade_to_super_group(g) or g for g in job_groups}
    return len(job_super_groups)


class _UnclearProject(scoring_base.BaseFilter):

    def __init__(self) -> None:
        super().__init__(self.filter)

    def filter(self, project: scoring_base.ScoringProject) -> bool:
        """Whether the project should pass or fail the filter."""

        super_groups_count = _count_project_super_groups(project)
        if super_groups_count == 0:
            # User has no target job.
            return True

        if super_groups_count >= 3:
            # User has too many objectives (jobs belonging to the same super group are part of the
            # same objective, but here there are too many super groups).
            return True

        if len(project.user.projects) > 1:
            # User has one or two objectives, that they entered willingfully.
            return False

        if not project.details.has_clear_project:
            # Unsure project, we must ask whether the project is clear to the user.
            raise scoring_base.NotEnoughDataException(
                'User only has one project', fields={'projects.0.hasClearProject'})

        # User told us whether their project was clear.
        return project.details.has_clear_project == project_pb2.FALSE


# TODO(cyrille): Split into three different filters once those are used in lever rules.
class _CantSellSelf(scoring_base.BaseFilter):
    """
    A filter for users who are experienced in a job, but have never really applied for it,
    so they don't know how to sell themselves.
    """

    def __init__(self) -> None:
        super().__init__(self._filter)

    def _filter(self, project: scoring_base.ScoringProject) -> bool:
        super_groups_count = _count_project_super_groups(project)
        if not super_groups_count or super_groups_count > 2:
            # User project is not clear.
            return False
        if project.details.seniority < project_pb2.SENIOR:
            # User is not experienced enough.
            return False

        if project.user_profile.is_autonomous == project_pb2.UNKNOWN_BOOL:
            raise scoring_base.NotEnoughDataException(
                "Don't know if user is autonomous.", fields={'profile.isAutonomous'})

        return project.user_profile.is_autonomous == project_pb2.FALSE


scoring_base.register_model('cant-sell-self', _CantSellSelf())
scoring_base.register_model('for-unclear-project', _UnclearProject())
scoring_base.register_model('for-no-clear-project', scoring_base.BaseFilter(
    lambda p: len(p.user.projects) <= 1 and _UnclearProject().filter(p)))
scoring_base.register_model(
    'for-too-many-objectives',
    scoring_base.BaseFilter(lambda p: _count_project_super_groups(p) >= 3))
