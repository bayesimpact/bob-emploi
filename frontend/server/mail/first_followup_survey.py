"""Mailing to ask users to complete the first followup survey."""

import datetime
from typing import Any

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail.templates import mailjet_templates

_CAMPAIGN_ID: mailjet_templates.Id = 'first-followup-survey'


def _get_ffs_vars(
    user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any,
) -> dict[str, str]:
    user_id = user.user_id
    days_since_registered = (now - user.registered_at.ToDatetime()).days

    if user.net_promoter_score_survey_response.score:
        raise campaign.DoNotSend('User already answered the NPS survey')

    is_alpha = user.features_enabled.alpha
    if (days_since_registered < 6 or days_since_registered > 13) and not is_alpha:
        raise campaign.DoNotSend('User registered too long ago or too recently')

    main_challenge_id = user.projects[0].diagnostic.category_id if user.projects else ''
    return campaign.get_default_vars(user) | {
        'buttonBackgroundColor': '#58bbfb',
        'buttonTextColor': '#ffffff',
        'ffsFormUrl': campaign.get_bob_link('/api/first-followup-survey', {
            'user': user_id,
            'token': auth_token.create_token(user_id, 'first-followup-survey'),
            'redirect': campaign.get_bob_link('/first-followup-survey', {
                'hl': user.profile.locale,
                'gender': user_profile_pb2.Gender.Name(user.profile.gender),
                'mainChallenge': main_challenge_id,
            }),
        }),
    }


_FFS_CAMPAIGN = campaign.Campaign(
    campaign_id=_CAMPAIGN_ID,
    mongo_filters={
        'emailsSent': {'$not': {'$elemMatch': {'campaignId': _CAMPAIGN_ID}}},
        # Don't bug very old users, they wouldn't pass the date check anyway.
        'registeredAt': {'$gt': '2022-02-01'},
    },
    get_vars=_get_ffs_vars,
    sender_name=i18n.make_translatable_string('Tabitha de {{var:productName}}'),
    sender_email='tabitha@bob-emploi.fr',
)

campaign.register_campaign(_FFS_CAMPAIGN)
