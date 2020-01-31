"""Focus email module to prepare your application."""

from typing import Any, Dict, Optional

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import campaign


def _get_prepare_your_application_vars(
        user: user_pb2.User, **unused_kwargs: Any) -> Optional[Dict[str, Any]]:
    """Compute vars for the "Prepare your application" email."""

    project = user.projects[0]

    deep_link_motivation_email_url = \
        campaign.get_deep_link_advice(user.user_id, project, 'motivation-email')

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepLinkMotivationEmailUrl': deep_link_motivation_email_url,
        'hasInterviewFrustration':
        campaign.as_template_boolean(user_pb2.INTERVIEW in user.profile.frustrations),
        'hasSelfConfidenceFrustration':
        campaign.as_template_boolean(user_pb2.SELF_CONFIDENCE in user.profile.frustrations),
        'loginUrl': campaign.create_logged_url(user.user_id, f'/projet/{project.project_id}'),
    })


campaign.register_campaign('prepare-your-application', campaign.Campaign(
    mailjet_template='1118228',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_prepare_your_application_vars,
    sender_name="Joanna et l'équipe de Bob",
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
