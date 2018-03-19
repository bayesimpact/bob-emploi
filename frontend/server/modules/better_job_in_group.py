"""Module to advise the user to switch to a better job in their job group."""

import logging

from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import project_pb2


class _AdviceBetterJobInGroup(scoring_base.ModelBase):
    """A scoring model to trigger the "Change to better job in your job group" advice."""

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        # This job group has jobs that are too different to consider them as a
        # small change.
        # TODO(pascal): Check for other such job groups and move the config to
        # a class property.
        if project.details.target_job.job_group.rome_id == 'K2401':
            return scoring_base.NULL_EXPLAINED_SCORE

        specific_jobs = project.requirements().specific_jobs
        if not specific_jobs or specific_jobs[0].code_ogr == project.details.target_job.code_ogr:
            return scoring_base.NULL_EXPLAINED_SCORE

        try:
            target_job_percentage = next(
                j.percent_suggested for j in specific_jobs
                if j.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            target_job_percentage = 0

        has_way_better_job = target_job_percentage + 30 < specific_jobs[0].percent_suggested
        has_better_job = target_job_percentage + 5 < specific_jobs[0].percent_suggested
        is_looking_for_new_job = project.details.kind == project_pb2.REORIENTATION

        reasons = []
        if has_way_better_job:
            reasons.append(project.translate_string(
                "il y a beaucoup plus d'offres dans des métiers proches"))
        elif (project.get_search_length_at_creation() > 6 and has_better_job):
            reasons.append(project.translate_string(
                "il y a plus d'offres dans des métiers proches"))
        if is_looking_for_new_job:
            reasons.append(project.translate_string(
                'vous nous avezdit vouloir vous reconvertir'))
        if reasons:
            return scoring_base.ExplainedScore(3, reasons)
        return scoring_base.ExplainedScore(2, [project.translate_string(
            "il y a un bon nombre d'offres dans des métiers proches")])

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        specific_jobs = project.requirements().specific_jobs

        if not specific_jobs:
            return None

        extra_data = project_pb2.BetterJobInGroupData()
        try:
            extra_data.num_better_jobs = next(
                i for i, job in enumerate(specific_jobs)
                if job.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            # Target job is not mentionned in the specific jobs, do not mention
            # the number of better jobs.
            pass

        all_jobs = project.job_group_info().jobs
        try:
            best_job = next(
                job for job in all_jobs
                if job.code_ogr == specific_jobs[0].code_ogr)
            extra_data.better_job.CopyFrom(best_job)
        except StopIteration:
            logging.warning(
                'Better job "%s" is not listed in the group "%s"', specific_jobs[0].code_ogr,
                project.job_group_info().rome_id)

        return extra_data


scoring_base.register_model('advice-better-job-in-group', _AdviceBetterJobInGroup())
