"""Script to send a mailing to compute the Net Promoter Score.

We send it to users that signed up more than N days ago (N to be set as a
commandline flag) but we send it only once.

Usage:

docker-compose run --rm \
    -e MONGO_URL ... \
    frontend-flask python bob_emploi/frontend/server/asynchronous/mail_nps.py 2
"""

import datetime
import logging
import os
import re
import sys
from typing import Any, Dict, Iterator, List, Optional
from urllib import parse

from google.protobuf import json_format

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign

# For a dry run we do not send emails to users nor modify the database.
DRY_RUN = not bool(os.getenv('NODRY_RUN'))
if DRY_RUN:
    logging.getLogger().setLevel(logging.INFO)

_CAMPAIGN_ID = 'nps'

# Hour of the day (considered in UTC) at which we decide it is a new day: we
# only send NPS email on the next day.
_DAY_CUT_UTC_HOUR = 1


def _get_nps_vars(user: user_pb2.User, **unused_kwargs: Any) -> Optional[Dict[str, str]]:
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
    # ID of the email template in MailJet. See
    # https://app.mailjet.com/template/100819/build
    mailjet_template='100819',
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

campaign.register_campaign(_CAMPAIGN_ID, _NPS_CAMPAIGN)


def _send_reports(count: int, errors: List[str]) -> None:
    logging.warning('%d emails sent.', count)

    report.notify_slack(
        f"Report for NPS blast: I've sent {count:d} emails (with {len(errors):d} errors).")


# TODO(pascal): Move to mail_blast module.
def main(now: datetime.datetime, days_before_sending: str) -> None:
    """Send an email to users that signed up more than n days ago list of users."""

    stats_db, user_db, unused_eval_db = mongo.get_connections_from_env()

    query = dict(_NPS_CAMPAIGN.mongo_filters, **{
        'profile.email': re.compile('@'),
    })
    count = 0
    user_iterator: Iterator[Dict[str, Any]] = user_db.user.find(
        query,
        (
            '_id',
            'registeredAt',
            'emailsSent',
            'profile.email',
            'profile.lastName',
            'profile.locale',
            'profile.name',
        ))
    errors: List[str] = []
    registered_before = (now - datetime.timedelta(days=int(days_before_sending)))\
        .replace(hour=_DAY_CUT_UTC_HOUR, minute=0, second=0, microsecond=0)
    for user_in_db in user_iterator:
        user = user_pb2.User()
        user_id = user_in_db.pop('_id')
        json_format.ParseDict(user_in_db, user)
        user.user_id = str(user_id)

        if user.registered_at.ToDatetime() > registered_before:
            # Skip silently: will send another day.
            continue

        if not _NPS_CAMPAIGN.send_mail(
                _CAMPAIGN_ID, user, database=stats_db, users_database=user_db,
                action='dry-run' if DRY_RUN else 'send', now=now):
            continue

        count += 1

    _send_reports(count, errors)


if __name__ == '__main__':
    _DAYS_BEFORE_SENDING, = sys.argv[1:]  # pylint: disable=unbalanced-tuple-unpacking
    main(datetime.datetime.utcnow(), _DAYS_BEFORE_SENDING)
