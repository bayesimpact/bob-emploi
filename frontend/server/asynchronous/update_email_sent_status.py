"""Check the status of sent emails on MailJet and update our Database.

This module make the assumptions that old emails have less chance to be updated
(read, clicked, etc) so we only check thouroughly recent emails:
 - emails sent less than 1 day ago, always check again
 - emails checked less than 2 weeks after they were sent, only check if not checked for 24 hours
 - other emails: drop it
"""

import argparse
import datetime
import logging
import os
import typing

from google.protobuf import json_format
import requests

from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import mail_blast
from bob_emploi.frontend.api import user_pb2

_, _DB, _ = mongo.get_connections_from_env()


def _find_message(email_sent: user_pb2.EmailSent) -> typing.Optional[typing.Dict[str, typing.Any]]:
    if email_sent.mailjet_message_id:
        try:
            return mail.get_message(email_sent.mailjet_message_id)
        except requests.exceptions.HTTPError as error:
            if error.response.status_code == 404:
                return None

    # Could not find message.
    return None


def _update_email_sent_status(
        email_sent_dict: typing.Dict[str, typing.Any], yesterday: str,
        campaign_ids: typing.Optional[typing.List[str]] = None) \
        -> typing.Dict[str, typing.Any]:
    email_sent = typing.cast(
        user_pb2.EmailSent, proto.create_from_mongo(email_sent_dict, user_pb2.EmailSent))
    if campaign_ids and email_sent.campaign_id not in campaign_ids:
        # Email is not from a campaign we wish to update, skipping.
        return email_sent_dict

    if email_sent.status != user_pb2.EMAIL_SENT_UNKNOWN and email_sent.last_status_checked_at:
        sent_at = email_sent.sent_at.ToJsonString()
        if sent_at < yesterday:
            last_status_checked_at = email_sent.last_status_checked_at.ToJsonString()
            if email_sent.last_status_checked_after_days > 14 or last_status_checked_at > yesterday:
                return email_sent_dict

    message = _find_message(email_sent)
    if message:
        email_sent.mailjet_message_id = message.get('ID', email_sent.mailjet_message_id)
        status = message.get('Status')
        if status:
            email_sent.status = user_pb2.EmailSentStatus.Value(
                'EMAIL_SENT_{}'.format(status.upper()))
        else:
            logging.warning('No status for message "%s"', email_sent.mailjet_message_id)
    else:
        logging.warning('Could not find a message in MailJet.')

    email_sent.last_status_checked_at.FromDatetime(now.get())
    email_sent.last_status_checked_at.nanos = 0
    email_sent.last_status_checked_after_days = (now.get() - email_sent.sent_at.ToDatetime()).days
    return json_format.MessageToDict(email_sent)


def main(string_args: typing.Optional[typing.List[str]] = None) -> None:
    """Check the status of sent emails on MailJet and update our Database.
    """

    parser = argparse.ArgumentParser(
        description='Update email status on sent emails.',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    parser.add_argument(
        '--campaigns', choices=mail_blast.campaign.list_all_campaigns(), nargs='*',
        help='Campaign IDs to check. If not specified, run for all campaigns.')

    parser.add_argument(
        '--mongo-collection', default='user', help='Name of the mongo collection to update.')

    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')

    args = parser.parse_args(string_args)

    if not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    email_mongo_filter = {
        'mailjetMessageId': {'$exists': True},
    }
    if args.campaigns:
        email_mongo_filter['campaignId'] = {'$in': args.campaigns}
    yesterday = proto.datetime_to_json_string(now.get() - datetime.timedelta(days=1))
    mongo_filter = {
        '$or': [
            # Emails that we've never checked.
            {
                'emailsSent': {
                    '$elemMatch': dict({
                        'lastStatusCheckedAt': {'$exists': False},
                    }, **email_mongo_filter),
                },
            },
            # Emails checked less than two weeks after they have been sent and
            # that we haven't checked today.
            {
                'emailsSent': {
                    '$elemMatch': dict({
                        'lastStatusCheckedAt': {'$lt': yesterday},
                        'lastStatusCheckedAfterDays': {'$not': {'$gte': 14}},
                    }, **email_mongo_filter),
                },
            },
            # Emails sent less than 24 hours ago.
            {
                'emailsSent': {
                    '$elemMatch': dict({
                        'sentAt': {'$gt': yesterday},
                    }, **email_mongo_filter),
                },
            },
        ],
    }

    mongo_collection = _DB.get_collection(args.mongo_collection)
    selected_users = mongo_collection.find(mongo_filter, {'emailsSent': 1})
    treated_users = 0
    for user in selected_users:
        emails_sent = user.get('emailsSent', [])
        updated_emails_sent = [
            _update_email_sent_status(email, yesterday, campaign_ids=args.campaigns)
            for email in emails_sent]
        mongo_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'emailsSent': updated_emails_sent}})
        treated_users += 1
        if not treated_users % 100:
            logging.info('Treated %d users', treated_users)


if __name__ == '__main__':
    main()
