"""Module to advise the user to consider to reorient to a job close to theirs."""

import typing

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.api import reorient_to_close_pb2
from bob_emploi.frontend.server import scoring_base


class _AdviceReorientToClose(scoring_base.ModelBase):
    """A scoring model for the reorient to close job advice."""

    def _convert_to_reorient_jobs(
            self,
            jobs: typing.Iterable[job_pb2.RelatedLocalJobGroup],
            market_score_source: float) -> typing.Iterator[reorient_jobbing_pb2.ReorientJob]:
        for job in jobs:
            # Here the market score improvement
            # (job that the user is searching for vs recommended job)
            # is overly simplified as offers gain.
            # TODO(marielaure): Find a way to explain the market score improvement to the user.
            offers_gain = 100 * (
                job.local_stats.imt.yearly_avg_offers_per_10_candidates / market_score_source - 1)
            yield reorient_jobbing_pb2.ReorientJob(
                name=job.job_group.name, offers_percent_gain=offers_gain)

    @scoring_base.ScoringProject.cached('reorient_to_close')
    def get_close_jobs(self, project: scoring_base.ScoringProject) \
            -> reorient_to_close_pb2.ReorientCloseJobs:
        """Get the jobs close to a job group."""

        recommended_jobs = reorient_to_close_pb2.ReorientCloseJobs()
        local_diagnosis = project.local_diagnosis()
        market_score = local_diagnosis.imt.yearly_avg_offers_per_10_candidates
        if not market_score:
            return recommended_jobs
        reorientation_jobs = local_diagnosis.less_stressful_job_groups
        close_jobs = [job for job in reorientation_jobs if job.mobility_type == job_pb2.CLOSE]
        evolution_jobs = [
            job for job in reorientation_jobs if job.mobility_type == job_pb2.EVOLUTION]
        recommended_jobs.close_jobs.extend(self._convert_to_reorient_jobs(close_jobs, market_score))
        recommended_jobs.evolution_jobs.extend(
            self._convert_to_reorient_jobs(evolution_jobs, market_score))
        return recommended_jobs

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        close_jobs = self.get_close_jobs(project)
        search_since_nb_months = round(project.get_search_length_now())
        score_modifier = 0
        reasons: typing.List[str] = []
        if len(close_jobs.close_jobs) + len(close_jobs.evolution_jobs) < 2:
            return scoring_base.NULL_EXPLAINED_SCORE
        if project.get_user_age() >= 45:
            return scoring_base.NULL_EXPLAINED_SCORE
        if project.details.passionate_level >= project_pb2.PASSIONATING_JOB:
            score_modifier = -1
        else:
            reasons.append(project.translate_string(
                "vous n'êtes pas trop attaché à votre métier"))
        if project.details.job_search_has_not_started or search_since_nb_months <= 1:
            return scoring_base.ExplainedScore(2 + score_modifier, reasons)
        reasons = [
            project.translate_string('vous cherchez depuis {} mois')
            .format(search_since_nb_months)]
        if search_since_nb_months >= 12:
            return scoring_base.ExplainedScore(3, reasons)
        if search_since_nb_months >= 9:
            return scoring_base.ExplainedScore(2, reasons)
        if search_since_nb_months >= 6:
            return scoring_base.ExplainedScore(1, reasons)
        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> reorient_to_close_pb2.ReorientCloseJobs:
        """Retrieve data for the expanded card."""

        return self.get_close_jobs(project)


scoring_base.register_model('advice-reorient-to-close-job', _AdviceReorientToClose())
