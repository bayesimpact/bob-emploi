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
import signal
import sys
import typing
from urllib import parse

from google.protobuf import json_format
import pymongo

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report

_, _USER_DB, _ = mongo.get_connections_from_env()

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

# For a dry run we do not send emails to users nor modify the database.
DRY_RUN = not bool(os.getenv('NODRY_RUN'))
if DRY_RUN:
    logging.getLogger().setLevel(logging.INFO)

# ID of the email template in MailJet. See
# https://app.mailjet.com/template/100819/build
_MAILJET_TEMPLATE_ID = '100819'

_CAMPAIGN_ID = 'nps'

# ID of the email template in MailJet to report the final count of the blast. See
# https://app.mailjet.com/tempate/74071/build
_MAILJET_REPORT_TEMPLATE_ID = '74071'

# Hour of the day (considered in UTC) at which we decide it is a new day: we
# only send NPS email on the next day.
_DAY_CUT_UTC_HOUR = 1


def send_email_to_user(user: user_pb2.User, user_id: str, base_url: str) -> 'mail._Response':
    """Sends an email to the user to measure the Net Promoter Score."""

    # Renew actions for the day if needed.
    mail_result = mail.send_template(
        _MAILJET_TEMPLATE_ID,
        user.profile,
        {
            'baseUrl': base_url,
            'firstName': french.cleanup_firstname(user.profile.name),
            'npsFormUrl': '{}/api/nps?user={}&token={}&redirect={}'.format(
                base_url, user_id, auth.create_token(user_id, 'nps'),
                parse.quote('{}/retours'.format(base_url)),
            ),
        },
        dry_run=DRY_RUN,
    )
    mail_result.raise_for_status()
    return mail_result


_T = typing.TypeVar('_T')


def _break_on_signal(
        signums: typing.List[signal.Signals], iterator: typing.Iterator[_T]) -> typing.Iterator[_T]:
    """Wrapper for an iterator to stop iterating when kernal signal is received.

    Args:
        signums: a list of signal numbers to break on.
        iterator: the iterator to wrap.
    Yields:
        the item of the iterator as long as no signal has been caught.
    """

    signals = []

    def _record_signal(signum: signal.Signals, unused_frame: typing.Any) -> None:
        # TODO(pascal): Update the report email to write that the blast was
        # interrupted.
        signals.append(signum)

    for signum in signums:
        signal.signal(signum, _record_signal)
    for item in iterator:
        yield item
        if signals:
            break


def _send_reports(count: int, errors: typing.List[str]) -> None:
    logging.warning('%d emails sent.', count)

    report.notify_slack(
        "Report for NPS blast: I've sent {:d} emails (with {:d} errors).".format(
            count, len(errors)))


# TODO(pascal): Move to mail_blast module.
def main(
        user_db: pymongo.collection.Collection, base_url: str, now: datetime.datetime,
        days_before_sending: str) -> None:
    """Send an email to users that signed up more than n days ago list of users."""

    query = {
        'emailsSent': {'$not': {'$elemMatch': {'campaignId': _CAMPAIGN_ID}}},
        'profile.email': re.compile('@'),
        'projects': {'$exists': True},
        'projects.isIncomplete': {'$ne': True},
        'registeredAt': {'$gt': '2018-01-01'},
    }
    count = 0
    user_iterator: typing.Iterator[typing.Dict[str, typing.Any]] = user_db.find(
        query,
        (
            '_id',
            'registeredAt',
            'emailsSent',
            'profile.email',
            'profile.lastName',
            'profile.name',
        ))
    errors: typing.List[str] = []
    registered_before = (now - datetime.timedelta(days=int(days_before_sending)))\
        .replace(hour=_DAY_CUT_UTC_HOUR, minute=0, second=0, microsecond=0)
    for user_in_db in _break_on_signal([signal.SIGTERM], user_iterator):
        user = user_pb2.User()
        user_id = user_in_db.pop('_id')
        json_format.ParseDict(user_in_db, user)

        if user.registered_at.ToDatetime() > registered_before:
            # Skip silently: will send another day.
            continue

        try:
            result = send_email_to_user(user, str(user_id), base_url)
        except (IOError, json_format.ParseError) as err:
            errors.append('{} - {}'.format(err, user_id))
            logging.error(err)
            continue

        if not result:
            continue

        if not DRY_RUN:
            sent_response = result.json()
            message_id = 0
            message_id = next(iter(  # type: ignore
                next(iter(sent_response.get('Messages', [])), {}).get('To', {})  # type: ignore
            ), {}).get('MessageID', 0)
            if not message_id:
                logging.warning('Impossible to retrieve the sent email ID:\n%s', sent_response)
            email_sent = user.emails_sent.add()
            email_sent.sent_at.GetCurrentTime()
            email_sent.sent_at.nanos = 0
            email_sent.mailjet_template = _MAILJET_TEMPLATE_ID
            email_sent.campaign_id = _CAMPAIGN_ID
            email_sent.mailjet_message_id = message_id

            updated_user = user_pb2.User(emails_sent=user.emails_sent)
            user_db.update_one({'_id': user_id}, {'$set': json_format.MessageToDict(updated_user)})

        count += 1

    _send_reports(count, errors)


if __name__ == '__main__':
    _DAYS_BEFORE_SENDING, = sys.argv[1:]  # pylint: disable=unbalanced-tuple-unpacking
    main(_USER_DB.user, _BASE_URL, datetime.datetime.utcnow(), _DAYS_BEFORE_SENDING)
