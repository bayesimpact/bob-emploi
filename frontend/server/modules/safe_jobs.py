"""Module to advise the user to consider to reorient to a job close to theirs."""

import random
import typing

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import scoring_base


class _AdviceExploreSafeJobs(scoring_base.ModelBase):
    """A scoring model for the explore-safe-jobs advice module."""

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        has_any_covid_risk_info = jobs.has_covid_risk_info(project.database)
        has_any_automation_risk_info = jobs.has_automation_risk_info(project.database)
        if not has_any_covid_risk_info and not has_any_automation_risk_info:
            raise scoring_base.NotEnoughDataException(
                'No data about jobs being affected by Covid or automation',
                {'data.job_group_info.covid_risk', 'data.job_group_info.automation_risk'})

        # Total risk from 0 to 100.
        total_risk = 0

        # Covid risk: 0 if safe or no covid data at all, 25 if unknown, 50 if risky.
        covid_risk = project.job_group_info().covid_risk
        if covid_risk == job_pb2.COVID_RISKY:
            total_risk += 50
        elif not covid_risk and has_any_covid_risk_info:
            total_risk += 25

        # Automation risk: 0 if super safe or no covid data at all, 25 if unknown, 50 if very risky.
        automation_risk = project.job_group_info().automation_risk
        if automation_risk:
            total_risk += automation_risk // 2
        elif has_any_automation_risk_info:
            total_risk += 25

        if total_risk <= 15:
            # This job is as safe as it can be, no need to explore for more.
            return scoring_base.NULL_EXPLAINED_SCORE

        # 81+ => 3
        return scoring_base.ExplainedScore(min((total_risk - 15) / 22, 3), [
            project.translate_static_string(
                "il existe des métiers avec peu de risques d'automatisation",
            ),
        ])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> job_pb2.SafeJobGroups:
        """Retrieve data for the expanded card."""

        has_any_covid_risk_info = jobs.has_covid_risk_info(project.database)
        has_any_automation_risk_info = jobs.has_automation_risk_info(project.database)

        good_jobs = jobs.get_all_good_job_group_ids(project.database, automation_risk_threshold=30)
        return job_pb2.SafeJobGroups(
            job_groups=[
                job_pb2.JobGroup(
                    name=typing.cast(
                        job_pb2.JobGroup,
                        jobs.get_group_proto(project.database, job_group_id)).name,
                    rome_id=job_group_id,
                )
                for job_group_id in random.sample(good_jobs, min(20, len(good_jobs)))
            ],
            is_safe_from_automation=has_any_automation_risk_info,
            is_safe_from_covid=has_any_covid_risk_info,
        )


scoring_base.register_model('advice-explore-safe-jobs', _AdviceExploreSafeJobs())
