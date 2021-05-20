"""Module to advise the user to consider to reorient to a job close to theirs."""

from typing import Iterable, Iterator, List

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.api import reorient_to_close_pb2
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring_base


class _AdviceReorientToClose(scoring_base.ModelBase):
    """A scoring model for the reorient to close job advice."""

    # TODO(cyrille): Add codeOgr to link to IMT job page.
    # TODO(sil): Make a proper translation when needed.
    def _convert_to_reorient_jobs(
            self,
            database: mongo.NoPiiMongoDatabase,
            reorient_jobs: Iterable[job_pb2.RelatedJobGroup],
            market_score_source: float,
            project: scoring_base.ScoringProject) -> Iterator[reorient_jobbing_pb2.ReorientJob]:
        for job in reorient_jobs:
            # Here the market score improvement
            # (job that the user is searching for vs recommended job)
            # is overly simplified as offers gain.
            # TODO(sil): Find a way to explain the market score improvement to the user.
            # TODO(cyrille): Replace offers_percent_gain by stress_percent_loss to simplify
            #   client-side computations.
            offers_gain = 100 * (
                job.local_stats.imt.yearly_avg_offers_per_10_candidates / market_score_source - 1)
            job_group_info = jobs.get_group_proto(
                database, job.job_group.rome_id, project.user_profile.locale)
            is_diploma_required = False
            if job_group_info:
                is_diploma_required = job_group_info.is_diploma_strictly_required
            yield reorient_jobbing_pb2.ReorientJob(
                name=job_group_info and job_group_info.name or
                project.translate_string(job.job_group.name),
                offers_percent_gain=offers_gain, is_diploma_strictly_required=is_diploma_required)

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
        database = project.database
        recommended_jobs.close_jobs.extend(self._convert_to_reorient_jobs(
            database, close_jobs, market_score, project))
        recommended_jobs.evolution_jobs.extend(
            self._convert_to_reorient_jobs(database, evolution_jobs, market_score, project))
        return recommended_jobs

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        close_jobs = self.get_close_jobs(project)
        search_since_nb_months = round(project.get_search_length_now())
        score_modifier = 0
        reasons: List[str] = []
        if len(close_jobs.close_jobs) + len(close_jobs.evolution_jobs) < 2:
            return scoring_base.NULL_EXPLAINED_SCORE
        # TODO(cyrille): Make this more robust.
        force_in_stuck_market = None
        # TODO(cyrille): Rather use market_stress to avoid depending on diagnostic to be computed.
        if project.details.diagnostic.category_id == 'stuck-market':
            force_in_stuck_market = scoring_base.ExplainedScore(1, reasons)
        if project.get_user_age() >= 45:
            return force_in_stuck_market or scoring_base.NULL_EXPLAINED_SCORE
        if project.details.passionate_level >= project_pb2.PASSIONATING_JOB:
            score_modifier = -1
        else:
            reasons.append(project.populate_template(project.translate_static_string(
                "vous n'êtes pas trop attaché%eFeminine à votre métier")))
        if project.details.job_search_has_not_started or search_since_nb_months <= 1:
            return scoring_base.ExplainedScore(2 + score_modifier, reasons)
        reasons = [
            project.translate_static_string('vous cherchez depuis {} mois')
            .format(search_since_nb_months)]
        if search_since_nb_months >= 12:
            return scoring_base.ExplainedScore(3, reasons)
        if search_since_nb_months >= 9:
            return scoring_base.ExplainedScore(2, reasons)
        if search_since_nb_months >= 6:
            return scoring_base.ExplainedScore(1, reasons)
        return force_in_stuck_market or scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> reorient_to_close_pb2.ReorientCloseJobs:
        """Retrieve data for the expanded card."""

        return self.get_close_jobs(project)


scoring_base.register_model('advice-reorient-to-close-job', _AdviceReorientToClose())
