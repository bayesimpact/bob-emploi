"""Script to send a mailing to compute the Net Promoter Score.

We send it to users that signed up more than N days ago (N to be set as a
commandline flag) but we send it only once.

Usage:

docker-compose run --rm \
    -e MONGO_URL ... \
    frontend-flask python bob_emploi/frontend/server/mail_nps.py 2
"""

from typing import Any, Dict
from urllib import parse

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail.templates import mailjet_templates

_CAMPAIGN_ID: mailjet_templates.Id = 'nps'

# Hour of the day (considered in UTC) at which we decide it is a new day: we
# only send NPS email on the next day.
_DAY_CUT_UTC_HOUR = 1


def _get_nps_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    user_id = user.user_id
    nps_form_url = f'{campaign.BASE_URL}/retours?hl={parse.quote(user.profile.locale)}'
    return {
        'baseUrl': campaign.BASE_URL,
        'firstName': french.cleanup_firstname(user.profile.name),
        'npsFormUrl':
        f'{campaign.BASE_URL}/api/nps?user={user_id}&token={auth.create_token(user_id, "nps")}&'
        f'redirect={parse.quote(nps_form_url)}',
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
    sender_name='Bob',
    sender_email='bob@bob-emploi.fr',
)

campaign.register_campaign(_NPS_CAMPAIGN)
