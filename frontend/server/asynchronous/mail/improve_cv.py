"""Focus email module for improve one's CV."""

import datetime
import logging
from typing import Any, Dict, Optional
from urllib import parse

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import campaign
from bob_emploi.frontend.server import auth


def _get_improve_cv_vars(
        user: user_pb2.User, now: datetime.datetime,
        **unused_kwargs: Any) -> Optional[Dict[str, Any]]:
    """Compute vars for the "Improve your CV" email."""

    if user_pb2.RESUME not in user.profile.frustrations:
        logging.info('User is not frustrated by its CV')
        return None

    project = user.projects[0]
    if project.kind == project_pb2.FIND_A_FIRST_JOB:
        has_experience = 'False'
    elif project.kind in (project_pb2.FIND_A_NEW_JOB, project_pb2.FIND_ANOTHER_JOB):
        has_experience = 'True'
    else:
        has_experience = ''

    deep_link_advice_url = \
        campaign.get_deep_link_advice(user.user_id, project, 'improve-resume') or \
        campaign.get_deep_link_advice(user.user_id, project, 'fresh-resume')

    auth_token = parse.quote(auth.create_token(user.user_id, is_using_timestamp=True))
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepLinkAdviceUrl': deep_link_advice_url,
        'hasExperience': has_experience,
        'isSeptember': campaign.as_template_boolean(now.month == 9),
        'loginUrl': f'{campaign.BASE_URL}?userId={user.user_id}&authToken={auth_token}',
    })


campaign.register_campaign('improve-cv', campaign.Campaign(
    mailjet_template='980269',
    mongo_filters={
        'profile.frustrations': 'RESUME',
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_improve_cv_vars,
    sender_name="Joanna et l'équipe de Bob",
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
