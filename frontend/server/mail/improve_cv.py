"""Focus email module for improve one's CV."""

import datetime
from typing import Any

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


def _get_improve_cv_vars(
        user: user_pb2.User, *, now: datetime.datetime,
        **unused_kwargs: Any) -> dict[str, Any]:
    """Compute vars for the "Improve your CV" email."""

    if user_profile_pb2.RESUME not in user.profile.frustrations:
        raise campaign.DoNotSend('User is not frustrated by its CV')

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

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

    return campaign.get_default_coaching_email_vars(user) | {
        'deepLinkAdviceUrl': deep_link_advice_url,
        'hasExperience': has_experience,
        'isSeptember': campaign.as_template_boolean(now.month == 9),
        'loginUrl': campaign.create_logged_url(user.user_id)
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='improve-cv',
    mongo_filters={
        'profile.frustrations': 'RESUME',
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_improve_cv_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
