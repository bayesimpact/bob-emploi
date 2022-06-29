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
from typing import Any, Optional

from google.protobuf import json_format
import requests

from bob_emploi.common.python import now
from bob_emploi.common.python import proto as common_proto
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import mail_blast
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.api import email_pb2


def _find_message(email_sent: email_pb2.EmailSent) -> Optional[dict[str, Any]]:
    if email_sent.mailjet_message_id:
        try:
            return mail_send.get_message(email_sent.mailjet_message_id)
        except requests.exceptions.HTTPError as error:
            if error.response.status_code == 404:
                return None

    # Could not find message.
    return None


def _update_email_sent_status(
        email_sent_dict: dict[str, Any], yesterday: str,
        campaign_ids: Optional[list[str]] = None) -> dict[str, Any]:
    email_sent = proto.create_from_mongo(email_sent_dict, email_pb2.EmailSent)
    if campaign_ids and email_sent.campaign_id not in campaign_ids:
        # Email is not from a campaign we wish to update, skipping.
        return email_sent_dict

    if email_sent.status != email_pb2.EMAIL_SENT_UNKNOWN and email_sent.last_status_checked_at:
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
            email_sent.status = email_pb2.EmailSentStatus.Value(f'EMAIL_SENT_{status.upper()}')
        else:
            logging.warning('No status for message "%s"', email_sent.mailjet_message_id)
    else:
        logging.warning('Could not find a message in MailJet.')

    common_proto.set_date_now(email_sent.last_status_checked_at)
    email_sent.last_status_checked_after_days = (now.get() - email_sent.sent_at.ToDatetime()).days
    return json_format.MessageToDict(email_sent)


def main(string_args: Optional[list[str]] = None) -> None:
    """Check the status of sent emails on MailJet and update our Database.
    """

    parser = argparse.ArgumentParser(
        description='Update email status on sent emails.',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    report.add_report_arguments(parser)

    parser.add_argument(
        '--campaigns', choices=mail_blast.campaign.list_all_campaigns(), nargs='*',
        help='Campaign IDs to check. If not specified, run for all campaigns.')

    parser.add_argument(
        '--mongo-collection', default='user', help='Name of the mongo collection to update.')

    args = parser.parse_args(string_args)

    if not report.setup_sentry_logging(args):
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

    user_db = mongo.get_connections_from_env().user_db
    mongo_collection = user_db.get_collection(args.mongo_collection)
    selected_users = mongo_collection.find(mongo_filter, {'emailsSent': 1})
    treated_users = 0
    # TODO(cyrille): Make sure errors are logged to sentry.
    # TODO(cyrille): If it fails on a specific user, keep going.
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
