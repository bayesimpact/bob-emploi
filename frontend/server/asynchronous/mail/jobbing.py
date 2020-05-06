"""Focus email module for finding jobbing ideas."""

import typing
from typing import Any, Dict, Optional

import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous.mail import campaign


def _get_jobbing_vars(
        user: user_pb2.User, database: Optional[pymongo.database.Database] = None,
        **unused_kwargs: Any) -> Optional[Dict[str, Any]]:
    """Compute vars for the "Jobbing" email."""

    project = user.projects[0]

    if not any(s.strategy_id == 'diploma-free-job' for s in project.opened_strategies):
        return None

    assert database
    scoring_project = scoring.ScoringProject(project, user, database)
    model = scoring.get_scoring_model('advice-reorient-jobbing')
    if not model:
        return None
    reorient_jobs = typing.cast(
        reorient_jobbing_pb2.JobbingReorientJobs,
        model.get_expanded_card_data(scoring_project),
    ).reorient_jobbing_jobs
    if not reorient_jobs:
        return None

    if project.target_job.name:
        of_job_name = scoring_project.populate_template('%ofJobName')
    else:
        # This is not translated to fr@tu because the email templates are only in fr for now.
        of_job_name = 'de definir votre projet professionnel'

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'inDepartement': scoring_project.populate_template('%inDepartement'),
        'jobs': [{'name': job.name} for job in reorient_jobs],
        'loginUrl': campaign.create_logged_url(user.user_id, f'/projet/{project.project_id}'),
        'ofJobName': of_job_name,
    })


campaign.register_campaign('jobbing', campaign.Campaign(
    mailjet_template='1183675',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'openedStrategies.strategyId': 'diploma-free-job',
        }},
    },
    get_vars=_get_jobbing_vars,
    sender_name="Joanna et l'équipe de Bob",
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=False,
))
