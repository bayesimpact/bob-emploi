"""Focus email module to find which diploma is required."""

from typing import Any, Dict, Optional

from google.protobuf import json_format
import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous.mail import campaign


def _get_find_diploma_vars(
        user: user_pb2.User, database: Optional[pymongo.database.Database] = None,
        **unused_kwargs: Any) -> Optional[Dict[str, Any]]:
    """Compute vars for the "Prepare your application" email."""

    project = user.projects[0]
    assert database
    scoring_project = scoring.ScoringProject(project, user, database)

    if not any(s.strategy_id == 'get-diploma' for s in project.opened_strategies):
        return None

    if not project.target_job.job_group.rome_id:
        return None

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


campaign.register_campaign('get-diploma', campaign.Campaign(
    mailjet_template='1130230',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'openedStrategies.strategyId': 'get-diploma',
        }},
    },
    get_vars=_get_find_diploma_vars,
    sender_name="Joanna et l'équipe de Bob",
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
