"""Campaigns for the account deletion emails."""

import datetime
from typing import Any, Dict

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import mail_send

_TWO_YEARS_AGO_STRING = \
    proto.datetime_to_json_string(datetime.datetime.now() - datetime.timedelta(730))


def _account_deletion_notice_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    return dict(
        campaign.get_default_vars(user),
        loginUrl=campaign.create_logged_url(user.user_id))


campaign.register_campaign(campaign.Campaign(
    campaign_id='account-deletion-notice',
    mongo_filters={
        # User hasn't been on Bob for two years.
        'registeredAt': {'$lt': _TWO_YEARS_AGO_STRING},
        'requestedByUserAtDate': {'$not': {'$gt': _TWO_YEARS_AGO_STRING}},
        # User hasn't read any email we sent to them in the last two years.
        'emailsSent': {'$not': {'$elemMatch': {
            'sentAt': {'$gt': _TWO_YEARS_AGO_STRING},
            'status': {'$in': list(mail_send.READ_EMAIL_STATUS_STRINGS)},
        }}},
    },
    get_vars=_account_deletion_notice_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
    sender_email='joanna@bob-emploi.fr',
))
