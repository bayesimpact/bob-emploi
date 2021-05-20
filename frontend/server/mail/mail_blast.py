"""Script to send an emails blast. See http://go/bob:focused-email-prd.
To get help on how to run the script, run
docker-compose run --rm frontend-flask \
    python bob_emploi/frontend/server/mail/mail_blast.py --help
"""

import argparse
import datetime
import hashlib
import logging
import re
from typing import Iterable, List, Optional

import requests

from bob_emploi.common.python import now
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail import campaign
# pylint: disable=unused-import
# Import plugins: they register themselves when imported.
from bob_emploi.frontend.server.mail import all_campaigns
# pylint: enable=unused-import
from bob_emploi.frontend.server.mail.templates import mailjet_templates


class EmailPolicy:
    """Implements our email policy."""

    def __init__(
            self, days_since_any_email: int = 7, days_since_same_campaign_unread: int = 0,
            days_since_same_campaign: int = 0) -> None:
        """Constructor for an EmailPolicy object.

        Args:
            days_since_any_email: number of days to wait before sending any new
                mail to the users.
            days_since_same_campaign_unread: number of days to wait before sending
                again the same campaign email to a user to whom it has already been
                sent and who has not read/open it. ATTENTION: emails status have
                to be updated in mongodb.
            days_since_same_campaign: number of days to wait before sending
                again the same campaign email to a user whom it has already been
                sent whether they have opened it or not.
        """

        instant = now.get()
        self.last_email_datetime = instant - datetime.timedelta(days=days_since_any_email)

        self.retry_campaign_date_unread: Optional[datetime.datetime]

        if days_since_same_campaign_unread > 0:
            self.retry_campaign_date_unread = \
                instant - datetime.timedelta(days=days_since_same_campaign_unread)
        else:
            self.retry_campaign_date_unread = None

        self.retry_campaign_date: Optional[datetime.datetime]

        if days_since_same_campaign > 0:
            self.retry_campaign_date = instant - datetime.timedelta(days=days_since_same_campaign)
        else:
            self.retry_campaign_date = None

    def can_send(
            self, campaign_id: mailjet_templates.Id,
            emails_sent: Iterable[user_pb2.EmailSent]) -> bool:
        """Check whether we can send this campaign to a user having the given sent emails."""

        for email in emails_sent:
            # If any sent mail have a status EMAIL_SENT_BOUNCE, do not send mails anymore.
            if email.status in (user_pb2.EMAIL_SENT_BOUNCE, user_pb2.EMAIL_SENT_HARDBOUNCED):
                return False
            # Do not send any new mail if we already sent recently.
            if email.sent_at.ToDatetime() > self.last_email_datetime:
                return False
            # Do not send again the same email if the user has read it or if we have waited enough
            # before sending again.
            # TODO(pascal): Declare associated EmailPolicy in _CAMPAIGNS dict, so that for each
            # campaign we could define if it can be send again, even if the user has already read
            # it. (employment-status may be send every 3 months, even if the user has answered.)
            if email.campaign_id != campaign_id:
                continue

            if not self.retry_campaign_date_unread and not self.retry_campaign_date:
                # Email has already been sent.
                return False

            email_sent_date = email.sent_at.ToDatetime()

            if self.retry_campaign_date_unread and \
                    email_sent_date > self.retry_campaign_date_unread:
                # We sent the email very recently.
                return False

            if email.status in mail_send.READ_EMAIL_STATUSES:
                if self.retry_campaign_date and email_sent_date <= self.retry_campaign_date:
                    # The user read the email but we are ready to try it again.
                    continue
                return False

            email_check_date = email.last_status_checked_at.ToDatetime()
            if (email_check_date - email_sent_date).days < 7:
                logging.warning(
                    'Relying on email status that have not been checked 7 days after sending.')
                return False
        return True


def _hash_user_id(user_id: str) -> str:
    uniform_hash = hashlib.sha1()
    uniform_hash.update(user_id.encode('ascii'))
    return uniform_hash.hexdigest()


def blast_campaign(
        campaign_id: mailjet_templates.Id, action: 'campaign.Action',
        registered_from: str, registered_to: str,
        dry_run_email: str, user_hash: str, user_id_start: str, email_policy: EmailPolicy) -> int:
    """Send a campaign of personalized emails."""

    if action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')
    database, user_database, unused_ = mongo.get_connections_from_env()
    this_campaign = campaign.get_campaign(campaign_id)
    mongo_filters = dict(this_campaign.mongo_filters)
    mongo_filters['profile.email'] = {
        '$not': re.compile(r'@example.com$'),
        '$regex': re.compile(r'[^ ]+@[^ ]+\.[^ ]+'),
    }
    if 'registeredAt' not in mongo_filters:
        mongo_filters['registeredAt'] = {}
    mongo_filters['registeredAt'].setdefault('$gt', registered_from)
    mongo_filters['registeredAt'].setdefault('$lt', registered_to)
    selected_users = user_database.user.find(mongo_filters)
    email_count = 0
    email_errors = 0
    users_processed_count = 0
    users_wrong_id_count = 0
    users_wrong_hash_count = 0
    users_stopped_seeking = 0
    email_policy_rejections = 0
    no_template_vars_count = 0

    for user_dict in selected_users:
        users_processed_count += 1

        user = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id')

        if user_id_start and not user.user_id.startswith(user_id_start):
            users_wrong_id_count += 1
            continue

        hash_value = _hash_user_id(user.user_id)
        if user_hash and not hash_value.startswith(user_hash):
            users_wrong_hash_count += 1
            continue

        if any(status.seeking == user_pb2.STOP_SEEKING for status in user.employment_status):
            users_stopped_seeking += 1
            continue

        if not email_policy.can_send(campaign_id, user.emails_sent):
            email_policy_rejections += 1
            continue

        try:
            if not this_campaign.send_mail(
                    user, database=database, users_database=user_database,
                    action=action, dry_run_email=dry_run_email, now=now.get()):
                no_template_vars_count += 1
                continue
        except requests.exceptions.HTTPError as error:
            if action == 'dry-run':
                raise
            logging.warning('Error while sending an email: %s', error)
            email_errors += 1
            continue

        if action == 'dry-run':
            break

        email_count += 1
        if email_count % 100 == 0:
            print(f'{email_count} emails sent ...')

    logging.info('%d users processed.', users_processed_count)
    if users_wrong_id_count:
        logging.info('%d users ignored because of ID selection.', users_wrong_id_count)
    if users_wrong_hash_count:
        logging.info('%d users ignored because of hash selection.', users_wrong_hash_count)
    logging.info('%d users have stopped seeking.', users_stopped_seeking)
    logging.info('%d users ignored because of emailing policy.', email_policy_rejections)
    logging.info('%d users ignored because of no template vars.', no_template_vars_count)
    if action == 'send':
        report.notify_slack(
            f"Report for {campaign_id} blast: I've sent {email_count:d} emails (and got "
            f'{email_errors:d} errors).')
    return email_count


# TODO(cyrille): Put that in common with the other async tools.
def _date_from_today(absolute_date: str, num_days_ago: Optional[int]) -> str:
    if num_days_ago is None:
        return absolute_date
    return (now.get() - datetime.timedelta(days=num_days_ago)).strftime('%Y-%m-%d')


def main(string_args: Optional[List[str]] = None) -> None:
    """Parse command line arguments and send mails."""

    parser = argparse.ArgumentParser(
        description='Send focus emails.', formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        epilog='''ROME info by prefix file can be downloaded at \
        https://airtable.com/tbl5jBDdG3vnYPWNu/viwz9GaBDHEpjTCU9
        ''')
    parser.add_argument(
        'campaign', choices=campaign.list_all_campaigns(), help='Campaign type to send.')
    parser.add_argument(
        'action', choices=('dry-run', 'list', 'send'), default='dry-run',
        help='Whether to process to a dry run, list all concerned users, or really send emails.')
    parser.add_argument(
        '--dry-run-email', default='pascal@bayes.org',
        help='Process a dry run and send email to this email address.')
    parser.add_argument(
        '--user-hash', help='Only send to users whose ID hash starts with this given hash. \
        Hashing the ID ensures a uniform distribution, so this gives a consistent sample of users.')
    # TODO(cyrille): Replace with option to select only one user_id.
    parser.add_argument(
        '--user-id-start', help='Only send to users whose ID starts with this given hash. WARNING: \
        hash distribution is not uniform for old users, do not use this to get a sample.')

    registered_from_group = parser.add_mutually_exclusive_group()
    registered_from_group.add_argument(
        '--registered-from', default='2017-04-01', help='Consider only users who registered after \
        this date.')
    registered_from_group.add_argument(
        '--registered-from-days-ago', type=int,
        help='Consider only users who registered less than N days ago.')

    registered_to_group = parser.add_mutually_exclusive_group()
    registered_to_group.add_argument(
        '--registered-to', default='2017-11-10', help='Consider only users who registered before \
        this date.')
    registered_to_group.add_argument(
        '--registered-to-days-ago', type=int,
        help='Consider only users who registered more than N days ago.')

    parser.add_argument(
        '--days-since-any-email',
        default='2', type=int,
        help="Consider only users who haven't received any email in the last given number of days.")
    parser.add_argument(
        '--days-since-same-campaign',
        default='0', type=int,
        help="Consider only users who haven't had the same email in the last given number of \
        days. If default or 0, will not resend the same campaign to anyone.")
    parser.add_argument(
        '--days-since-same-campaign-unread',
        default='0', type=int,
        help="Must be smaller than --days-since-same-campaign. Users who received an email between \
        --days-since-same-campaign and --days-since-same-campaign-unread will only be sent a new \
        one if they haven't read it.")
    report.add_report_arguments(parser, setup_dry_run=False)
    args = parser.parse_args(string_args)

    if not report.setup_sentry_logging(args, dry_run=args.action != 'send'):
        return

    if args.days_since_same_campaign < args.days_since_same_campaign_unread:
        logging.error('Please use coherent values in the policy durations.')
        return

    policy = EmailPolicy(
        args.days_since_any_email,
        args.days_since_same_campaign_unread,
        args.days_since_same_campaign)

    registered_from = _date_from_today(args.registered_from, args.registered_from_days_ago)
    registered_to = _date_from_today(args.registered_to, args.registered_to_days_ago)

    logging.info('%d emails sent.', blast_campaign(
        args.campaign, args.action, registered_from, registered_to,
        dry_run_email=args.dry_run_email, user_id_start=args.user_id_start,
        user_hash=args.user_hash, email_policy=policy))


if __name__ == '__main__':
    main()
