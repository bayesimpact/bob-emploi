"""Script to send a mailing to compute the Net Promoter Score.

We send it to users that signed up more than N days ago (N to be set as a
commandline flag) but we send it only once.

Usage:

docker-compose run --rm \
    -e MONGO_URL ... \
    frontend-flask python bob_emploi/frontend/server/mail_nps.py 2
"""

from typing import Any

from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import product
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail.templates import mailjet_templates

_CAMPAIGN_ID: mailjet_templates.Id = 'nps'

# Hour of the day (considered in UTC) at which we decide it is a new day: we
# only send NPS email on the next day.
_DAY_CUT_UTC_HOUR = 1


def _get_nps_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    user_id = user.user_id
    return campaign.get_default_vars(user) | {
        'npsFormUrl': campaign.get_bob_link('/api/nps', {
            'user': user_id,
            'token': auth_token.create_token(user_id, 'nps'),
            'redirect': campaign.get_bob_link('/retours', {'hl': user.profile.locale}),
        }),
    }


_NPS_CAMPAIGN = campaign.Campaign(
    # See https://app.mailjet.com/template/100819/build
    campaign_id=_CAMPAIGN_ID,
    mongo_filters={
        'emailsSent': {'$not': {'$elemMatch': {'campaignId': _CAMPAIGN_ID}}},
        'projects': {'$exists': True},
        'projects.isIncomplete': {'$ne': True},
        'registeredAt': {'$gt': '2018-01-01'},
    },
    get_vars=_get_nps_vars,
    sender_name=product.bob.name,
    sender_email='bob@bob-emploi.fr',
)

campaign.register_campaign(_NPS_CAMPAIGN)
