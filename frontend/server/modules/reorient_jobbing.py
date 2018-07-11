"""Module to advise the user to consider to reorient to a job with low qualification."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base


class _AdviceReorientJobbing(scoring_base.ModelBase):
    """A scoring model for the reorient jobbing advice."""

    def __init__(self):
        super(_AdviceReorientJobbing, self).__init__()
        self._db = proto.MongoCachedCollection(
            reorient_jobbing_pb2.LocalJobbingStats, 'reorient_jobbing')

    def get_local_jobbing(self, project):
        """Get the jobbing opportunities for the departement."""

        recommended_jobs = reorient_jobbing_pb2.JobbingReorientJobs()
        departement_id = project.details.city.departement_id \
            or project.details.mobility.city.departement_id
        gender = project.user_profile.gender
        top_unqualified_jobs = self.list_reorient_jobbing_jobs(project)
        local_diagnosis = project.local_diagnosis()
        current_job_market_score = local_diagnosis.imt.yearly_avg_offers_per_10_candidates
        if current_job_market_score and departement_id in top_unqualified_jobs:
            for job in top_unqualified_jobs[departement_id].departement_job_stats.jobs:
                if job.market_score / current_job_market_score < 1:
                    break
                offers_gain = (job.market_score / current_job_market_score - 1) * 100
                recommended_jobs.reorient_jobbing_jobs.add(
                    name=french.genderize_job(job, gender),
                    offers_percent_gain=offers_gain)
        return recommended_jobs

    @scoring_base.ScoringProject.cached('reorient_jobbing')
    def list_reorient_jobbing_jobs(self, project):
        """List all job with no qualification suitable for a reorientation for a project."""

        return self._db.get_collection(project.database)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        # The number of job names is restricted to 2 because some job names
        # are very long e.g. Conducteur / Conductrice d'engins d'exploitation.
        recommended_jobs = self.get_local_jobbing(project).reorient_jobbing_jobs[:2]
        return project_pb2.ReorientData(
            jobs=[job_pb2.Job(name=job.name) for job in recommended_jobs])

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        local_jobbing = self.get_local_jobbing(project)
        if len(local_jobbing.reorient_jobbing_jobs) < 2:
            return scoring_base.NULL_EXPLAINED_SCORE
        score_modifier = 0
        reasons = []

        if project.details.passionate_level == project_pb2.LIFE_GOAL_JOB:
            score_modifier = -2
            if project.job_group_info().growth_2012_2022 < .1:
                score_modifier = -1
        if score_modifier >= 0:
            reasons.append(project.translate_string(
                'votre métier ne vous tient pas trop à cœur'))

        if project.user_profile.highest_degree <= job_pb2.CAP_BEP:
            return scoring_base.ExplainedScore(3 + score_modifier, reasons)
        if project.user_profile.highest_degree <= job_pb2.BAC_BACPRO:
            return scoring_base.ExplainedScore(max(2 + score_modifier, 1), reasons)
        if project.user_profile.highest_degree <= job_pb2.BTS_DUT_DEUG:
            return scoring_base.ExplainedScore(1, reasons)
        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        return self.get_local_jobbing(project)


scoring_base.register_model('advice-reorient-jobbing', _AdviceReorientJobbing())
