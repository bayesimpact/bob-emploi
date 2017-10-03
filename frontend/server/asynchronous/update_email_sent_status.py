"""Check the status of sent emails on MailJet and update our Database."""
import datetime
import logging
import os

import pymongo
from google.protobuf import json_format

from bob_emploi.frontend import mail
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import user_pb2

# Maximum skew allowed between our clock (tick recorded in emails_sent.sent_at)
# and MailJet's clock (tick recorded in ArrivedAt).
_CLOCK_MAX_SKEW = datetime.timedelta(minutes=2)

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()


def _find_message(email_sent, email_address):
    if email_sent.mailjet_message_id:
        return mail.get_message(email_sent.mailjet_message_id).json()

    # We forgot to save the mailjet message ID when we sent it, so we are going
    # to find it by its recipient and the time it was sent.
    messages = mail.list_messages(email_address)
    all_messages = []
    for message in messages:
        all_messages.append(message)
        arrived_at = datetime.datetime.strptime(message.get('ArrivedAt'), '%Y-%m-%dT%H:%M:%SZ')
        if abs(arrived_at - email_sent.sent_at.ToDatetime()) < _CLOCK_MAX_SKEW:
            return message

    # Could not find message.
    return None


def _update_email_sent_status(email_sent_dict, email_address):
    email_sent = user_pb2.EmailSent()
    proto.parse_from_mongo(email_sent_dict, email_sent)
    if email_sent.status != user_pb2.EMAIL_SENT_UNKNOWN:
        # TODO(pascal): Check the status again if too old.
        return email_sent_dict

    message = _find_message(email_sent, email_address)
    if not message:
        logging.warning('Could not find a message in MailJet.')
        return email_sent_dict

    email_sent.mailjet_message_id = message.get('ID', email_sent.mailjet_message_id)
    email_sent.last_status_checked_at.GetCurrentTime()
    email_sent.last_status_checked_at.nanos = 0
    email_sent.status = user_pb2.EmailSentStatus.Value(
        'EMAIL_SENT_{}'.format(message.get('Status', 'unknown').upper()))
    return json_format.MessageToDict(email_sent)


def main(database):
    """Check the status of sent emails on MailJet and update our Database."""
    selected_users = database.user.find({
        'emailsSent': {'$exists': True},
        'emailsSent.status': {'$exists': False},
    }, {'profile.email': 1, 'emailsSent': 1})
    for user in selected_users:
        emails_sent = user.get('emailsSent', [])
        updated_emails_sent = [
            _update_email_sent_status(email, user.get('profile', {}).get('email'))
            for email in emails_sent]
        database.user.update_one(
            {'_id': user['_id']},
            {'$set': {'emailsSent': updated_emails_sent}})


if __name__ == '__main__':
    main(_DB)
