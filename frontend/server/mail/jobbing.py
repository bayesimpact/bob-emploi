"""Focus email module for finding jobbing ideas."""

import typing
from typing import Any

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


def _get_jobbing_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, Any]:
    """Compute vars for the "Jobbing" email."""

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]

    if not any(s.strategy_id == 'diploma-free-job' for s in project.opened_strategies):
        raise campaign.DoNotSend(
            'The user has not started a strategy to get a job without a diploma')

    scoring_project = scoring.ScoringProject(project, user, database)
    model = scoring.get_scoring_model('advice-reorient-jobbing')
    if not model:
        raise campaign.DoNotSend('The advice-reorient-jobbing model is not implemented')
    reorient_jobs = typing.cast(
        reorient_jobbing_pb2.JobbingReorientJobs,
        model.get_expanded_card_data(scoring_project),
    ).reorient_jobbing_jobs
    if not reorient_jobs:
        raise campaign.DoNotSend("We didn't find any jobbing jobs to reorient to for the user")

    if project.target_job.name:
        of_job_name = scoring_project.populate_template('%ofJobName')
    else:
        # This is not translated to fr@tu because the email templates are only in fr for now.
        of_job_name = 'de definir votre projet professionnel'

    return campaign.get_default_coaching_email_vars(user) | {
        'inDepartement': scoring_project.populate_template('%inDepartement'),
        'jobs': [{'name': job.name} for job in reorient_jobs],
        'loginUrl': campaign.create_logged_url(user.user_id, f'/projet/{project.project_id}'),
        'ofJobName': of_job_name,
    }


def _get_jobbing_short_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, Any]:
    """Compute vars for the "Jobbing" email."""

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]

    if not any(s.strategy_id == 'diploma-free-job' for s in project.opened_strategies):
        raise campaign.DoNotSend(
            'The user has not started a strategy to get a job without a diploma')

    scoring_project = scoring.ScoringProject(project, user, database)
    model = scoring.get_scoring_model('advice-reorient-jobbing')
    if not model:
        raise campaign.DoNotSend('The advice-reorient-jobbing model is not implemented')
    reorient_jobs = typing.cast(
        reorient_jobbing_pb2.JobbingReorientJobs,
        model.get_expanded_card_data(scoring_project),
    ).reorient_jobbing_jobs
    if not reorient_jobs:
        raise campaign.DoNotSend("We didn't find any jobbing jobs to reorient to for the user")

    if project.target_job.name:
        of_job_name = scoring_project.populate_template('%ofJobName')
    else:
        of_job_name = scoring_project.translate_static_string(
            'de definir votre projet professionnel')

    return campaign.get_default_coaching_email_vars(user) | {
        'inDepartement': scoring_project.populate_template('%inDepartement'),
        'jobs': [{'name': job.name} for job in reorient_jobs],
        'ofJobName': of_job_name,
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='jobbing',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'openedStrategies.strategyId': 'diploma-free-job',
        }},
    },
    get_vars=_get_jobbing_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=False,
))
campaign.register_campaign(campaign.Campaign(
    campaign_id='jobbing-short',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'openedStrategies.strategyId': 'diploma-free-job',
        }},
    },
    get_vars=_get_jobbing_short_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
))
