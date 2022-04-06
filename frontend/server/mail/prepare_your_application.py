"""Focus email module to prepare your application."""

from typing import Any
import logging

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


def _get_prepare_your_application_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    """Compute vars for the "Prepare your application" email."""

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]

    deep_link_motivation_email_url = \
        campaign.get_deep_link_advice(user.user_id, project, 'motivation-email')

    return campaign.get_default_coaching_email_vars(user) | {
        'deepLinkMotivationEmailUrl': deep_link_motivation_email_url,
        'hasInterviewFrustration':
        campaign.as_template_boolean(user_profile_pb2.INTERVIEW in user.profile.frustrations),
        'hasSelfConfidenceFrustration':
        campaign.as_template_boolean(user_profile_pb2.SELF_CONFIDENCE in user.profile.frustrations),
        'loginUrl': campaign.create_logged_url(user.user_id, f'/projet/{project.project_id}'),
    }


def _get_prepare_your_application_short_vars(user: user_pb2.User, **unused_kwargs: Any)\
        -> dict[str, Any]:
    """Compute vars for the "Prepare your application short" email."""

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    if (user.profile.locale or 'fr').startswith('fr'):
        advice_page_url = 'https://labonneboite.pole-emploi.fr/comment-faire-une-candidature-spontanee'
    elif user.profile.locale.startswith('en'):
        advice_page_url = 'https://www.theguardian.com/careers/speculative-applications'
    else:
        logging.warning(
            'No advice webpage given for campaign spontaneous-short in "%s"', user.profile.locale)
        advice_page_url = ''

    return campaign.get_default_coaching_email_vars(user) | {
        'advicePageUrl': advice_page_url,
        'hasInterviewFrustration':
        campaign.as_template_boolean(user_profile_pb2.INTERVIEW in user.profile.frustrations),
        'hasSelfConfidenceFrustration':
        campaign.as_template_boolean(user_profile_pb2.SELF_CONFIDENCE in user.profile.frustrations),
    }


_CAMPAIGNS = [
    campaign.Campaign(
        campaign_id='prepare-your-application',
        mongo_filters={
            'projects': {'$elemMatch': {
                'isIncomplete': {'$ne': True},
            }},
        },
        get_vars=_get_prepare_your_application_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='prepare-your-application-short',
        mongo_filters={
            'projects': {'$elemMatch': {
                'isIncomplete': {'$ne': True},
            }},
        },
        get_vars=_get_prepare_your_application_short_vars,
        sender_name=i18n.make_translatable_string("Pascal et l'équipe de {{var:productName}}"),
        sender_email='pascal@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=False,
    ),
]

for the_campaign in _CAMPAIGNS:
    campaign.register_campaign(the_campaign)
