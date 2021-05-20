"""Focus email module to find which diploma is required."""

from typing import Any, Dict

from google.protobuf import json_format

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


def _get_find_diploma_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, Any]:
    """Compute vars for the "Prepare your application" email."""

    project = user.projects[0]
    scoring_project = scoring.ScoringProject(project, user, database)

    if not any(s.strategy_id == 'get-diploma' for s in project.opened_strategies):
        raise campaign.DoNotSend('The user has not started a strategy to get a diploma')

    if not project.target_job.job_group.rome_id:
        raise scoring.NotEnoughDataException(
            'Need a job group to find trainings',
            # TODO(pascal): Use project_id instead of 0.
            {'projects.0.targetJob.jobGroup.romeId'})

    trainings = scoring_project.get_trainings()[:3]

    deep_link_training_url = \
        campaign.get_deep_link_advice(user.user_id, project, 'training')

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepTrainingAdviceUrl': deep_link_training_url,
        'inDepartement': scoring_project.populate_template('%inDepartement'),
        'loginUrl': campaign.create_logged_url(user.user_id, f'/projet/{project.project_id}'),
        'numTrainings': len(trainings),
        'ofJobName': scoring_project.populate_template('%ofJobName'),
        'trainings': [json_format.MessageToDict(t) for t in trainings],
    })


campaign.register_campaign(campaign.Campaign(
    campaign_id='get-diploma',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'openedStrategies.strategyId': 'get-diploma',
        }},
    },
    get_vars=_get_find_diploma_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
