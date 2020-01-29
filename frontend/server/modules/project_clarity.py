"""Module to score the clarity of a project."""

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import scoring_base


# TODO(pascal): Import from Airtable.
_SUPER_GROUPS = [
    {'M1602', 'M1606', 'M1607', 'M1608'},  # Secretariat.
    {'K2204', 'K2303', 'G1501'},  # Cleaning.
    {'G1502', 'G1702'},  # Hotel industry.
    {'B', 'L'},  # Artists.
    {'N1103', 'N1104', 'N1105'},  # Goods handling.
    {'E1103', 'E1106'},  # Communication/Media.
    {'D1106', 'D1211', 'D1212', 'D1213', 'D1214', 'D1507', 'D1505'},  # Sales.
]


# TODO(pascal): Make sure that there are no conflicts (a job in several super groups).
_SUPER_GROUPS_BY_PREFIX = {
    prefix: f'super-{index}'
    for index, prefixes in enumerate(_SUPER_GROUPS)
    for prefix in prefixes
}


def _upgrade_to_super_group(rome_id: str) -> str:
    for i in range(len(rome_id) - 1):
        try:
            return _SUPER_GROUPS_BY_PREFIX[rome_id[:-(i + 1)]]
        except KeyError:
            pass
    return rome_id


def _count_project_super_groups(project: scoring_base.ScoringProject) -> int:
    job_groups = {
        p.target_job.job_group.rome_id
        for p in project.user.projects
        if p.target_job.job_group.rome_id
    }

    if not job_groups:
        return 0

    job_super_groups = {_upgrade_to_super_group(g) for g in job_groups}
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


class _CantSellSelf(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        super_groups_count = _count_project_super_groups(project)
        if not super_groups_count or super_groups_count > 2:
            # User project is not clear.
            return 0
        if project.details.seniority < project_pb2.SENIOR:
            # User is not experienced enough.
            return 0
        # TODO(cyrille): Add something about unable to sell themself.
        return 3


scoring_base.register_model('cant-sell-self', _CantSellSelf())
scoring_base.register_model('for-unclear-project', _UnclearProject())
scoring_base.register_model('for-no-clear-project', scoring_base.BaseFilter(
    lambda p: len(p.user.projects) <= 1 and _UnclearProject().filter(p)))
scoring_base.register_model(
    'for-too-many-objectives',
    scoring_base.BaseFilter(lambda p: _count_project_super_groups(p) >= 3))
