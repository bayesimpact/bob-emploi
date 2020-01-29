"""Module to score a user project in relation with diplomas."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import scoring_base

_DIPLOMA_REQUIREMENTS = {
    # "Promotion d'artistes et de spectacles", this has relevant master degrees that are enough.
    'L1203': job_pb2.DEA_DESS_MASTER_PHD,
}


class _RequiredDiplomasScoringModel(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        if not project.details.target_job.job_group.rome_id:
            raise scoring_base.NotEnoughDataException(
                'Need a job group to determine if the user has enough diplomas',
                {'projects.0.targetJob.jobGroup.romeId'})
        required_diploma = min(
            (r.diploma.level for r in project.job_group_info().requirements.diplomas),
            default=job_pb2.UNKNOWN_DEGREE) or \
            _DIPLOMA_REQUIREMENTS.get(project.details.target_job.job_group.rome_id[:5])
        # TODO(pascal): Check the is_diploma_strictly_required bool.
        if not required_diploma:
            raise scoring_base.NotEnoughDataException(
                'No information about this job group diploma requirements',
                {'data.job_group_info.requirements.diplomas'})
        if required_diploma == job_pb2.NO_DEGREE:
            return 0
        if project.user_profile.highest_degree >= required_diploma:
            return 0
        return 3


scoring_base.register_model('missing-required-diploma', _RequiredDiplomasScoringModel())
