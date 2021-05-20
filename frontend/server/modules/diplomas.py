"""Module to score a user project in relation with diplomas."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import scoring_base

_DIPLOMA_REQUIREMENTS = {
    # Secrétariat.
    'M1608': job_pb2.CAP_BEP,
    # Secrétariat comptable.
    'M1606': job_pb2.CAP_BEP,
    # Courses et livraisons express.
    'N4104': job_pb2.CAP_BEP,
}


class _RequiredDiplomasScoringModel(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        rome_id = project.details.target_job.job_group.rome_id
        if not rome_id:
            raise scoring_base.NotEnoughDataException(
                'Need a job group to determine if the user has enough diplomas',
                {'projects.0.targetJob.jobGroup.romeId'})
        if project.user_profile.highest_degree >= job_pb2.DEA_DESS_MASTER_PHD:
            return 0
        required_diploma = min(
            (r.diploma.level for r in project.job_group_info().requirements.diplomas),
            default=job_pb2.UNKNOWN_DEGREE) or _DIPLOMA_REQUIREMENTS.get(rome_id[:5])
        # TODO(pascal): Check the is_diploma_strictly_required bool.
        if not required_diploma:
            raise scoring_base.NotEnoughDataException(
                'No information about this job group diploma requirements',
                {f'data.job_group_info.{rome_id}.requirements.diplomas'})
        if required_diploma == job_pb2.NO_DEGREE:
            return 0
        if project.user_profile.highest_degree >= required_diploma:
            return 0
        return 3


scoring_base.register_model('missing-required-diploma', _RequiredDiplomasScoringModel())
scoring_base.register_model('for-foreign-diploma', scoring_base.BaseFilter(
    lambda project: user_pb2.FOREIGN_QUALIFICATIONS in project.user_profile.frustrations))
