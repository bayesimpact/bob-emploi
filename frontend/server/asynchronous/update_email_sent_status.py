"""Check the status of sent emails on MailJet and update our Database."""

import datetime
import itertools
import logging
import re

from google.protobuf import json_format
from google.protobuf import timestamp_pb2

from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2

# Maximum skew allowed between our clock (tick recorded in emails_sent.sent_at)
# and MailJet's clock (tick recorded in ArrivedAt).
_CLOCK_MAX_SKEW = datetime.timedelta(minutes=2)

_, _DB = mongo.get_connections_from_env()


def _find_message(email_sent):
    if email_sent.mailjet_message_id:
        return mail.get_message(email_sent.mailjet_message_id)

    # Could not find message.
    return None


def _update_email_sent_status(email_sent_dict, email_address, last_checked_at):
    email_sent = proto.create_from_mongo(email_sent_dict, user_pb2.EmailSent)
    if email_sent.status != user_pb2.EMAIL_SENT_UNKNOWN and \
            email_sent.last_status_checked_at.ToJsonString() >= last_checked_at:
        logging.warning('Skip check for "%s"', email_address)
        return email_sent_dict

    message = _find_message(email_sent)
    if message:
        email_sent.mailjet_message_id = message.get('ID', email_sent.mailjet_message_id)
        status = message.get('Status')
        if status:
            email_sent.status = user_pb2.EmailSentStatus.Value(
                'EMAIL_SENT_{}'.format(status.upper()))
        else:
            logging.warning('No status for message to "%s"', email_address)
    else:
        logging.warning('Could not find a message in MailJet.')

    email_sent.last_status_checked_at.FromDatetime(now.get())
    email_sent.last_status_checked_at.nanos = 0
    return json_format.MessageToDict(email_sent)


def _datetime_to_json(instant):
    timestamp_proto = timestamp_pb2.Timestamp()
    timestamp_proto.FromDatetime(instant)
    return timestamp_proto.ToJsonString()


def main(database, last_check_days_ago=7):
    """Check the status of sent emails on MailJet and update our Database.

    Args:
        database: a pymongo access to the Database. Only the user collection will be
            accessed and modified.
        last_check_days_ago: consider checked done more than n days ago as too
            old, and check the status again.
    """

    last_checked_at = _datetime_to_json(now.get() - datetime.timedelta(days=last_check_days_ago))
    a_month_ago = _datetime_to_json(now.get() - datetime.timedelta(days=30.5))

    users_with_missing_status = database.user.find({
        'emailsSent': {'$exists': True},
        'profile.email': re.compile('.*@.*'),
        'emailsSent.lastStatusCheckedAt': {'$exists': False},
    }, {'profile.email': 1, 'emailsSent': 1})
    users_with_old_status = database.user.find({
        'emailsSent.sentAt': {'$gt': a_month_ago},
        'profile.email': re.compile('.*@.*'),
        'emailsSent.lastStatusCheckedAt': {'$lt': last_checked_at},
    }, {'profile.email': 1, 'emailsSent': 1})
    selected_users = itertools.chain(users_with_missing_status, users_with_old_status)
    for user in selected_users:
        emails_sent = user.get('emailsSent', [])
        updated_emails_sent = [
            _update_email_sent_status(
                email, user.get('profile', {}).get('email'),
                last_checked_at)
            for email in emails_sent]
        database.user.update_one(
            {'_id': user['_id']},
            {'$set': {'emailsSent': updated_emails_sent}})


if __name__ == '__main__':
    main(_DB, last_check_days_ago=7)
