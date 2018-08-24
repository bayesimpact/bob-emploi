"""Script to send an emails blast. See http://go/bob:focused-email-prd.
To get help on how to run the script, run
docker-compose run --rm frontend-flask \
    python bob_emploi/frontend/server/asynchronous/mail/mail_blast.py --help
"""

import argparse
import datetime
import hashlib
import logging
import os
import re

import requests

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign
# pylint: disable=unused-import
# Import plugins: they register themselves when imported.
from bob_emploi.frontend.server.asynchronous.mail import all_campaigns
# pylint: enable=unused-import

_DB, _USER_DB = mongo.get_connections_from_env()

_READ_EMAIL_STATUSES = frozenset([
    user_pb2.EMAIL_SENT_OPENED, user_pb2.EMAIL_SENT_CLICKED])


class EmailPolicy(object):
    """Implements our email policy."""

    def __init__(
            self, days_since_any_email=7, days_since_same_campaign_unread=0,
            days_since_same_campaign=0):
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

        if days_since_same_campaign_unread > 0:
            self.retry_campaign_date_unread = \
                instant - datetime.timedelta(days=days_since_same_campaign_unread)
        else:
            self.retry_campaign_date_unread = None

        if days_since_same_campaign > 0:
            self.retry_campaign_date = instant - datetime.timedelta(days=days_since_same_campaign)
        else:
            self.retry_campaign_date = None

    def can_send(self, campaign_id, emails_sent):
        """Check whether we can send this campaign to a user having the given sent emails."""

        for email in emails_sent:
            # If any sent mail have a status EMAIL_SENT_BOUNCE, do not send mails anymore.
            if email.status == user_pb2.EMAIL_SENT_BOUNCE:
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

            if email.status in _READ_EMAIL_STATUSES:
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


def _hash_user_id(user_id):
    uniform_hash = hashlib.sha1()
    uniform_hash.update(user_id.encode('ascii'))
    return uniform_hash.hexdigest()


def blast_campaign(
        campaign_id, action, registered_from, registered_to,
        dry_run_email='', user_hash='', user_id_start='',
        email_policy=EmailPolicy(days_since_any_email=2, days_since_same_campaign_unread=0)):
    """Send a campaign of personalized emails."""

    if action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')
    this_campaign = campaign.get_campaign(campaign_id)
    collection = this_campaign.users_collection
    mongo_filters = this_campaign.mongo_filters
    mongo_filters[collection.email_field] = {
        '$not': re.compile(r'@example.com$'),
        '$regex': re.compile(r'@'),
    }
    if collection.has_registered_at:
        mongo_filters['registeredAt'] = {
            '$gt': registered_from,
            '$lt': registered_to,
        }
    selected_users = _USER_DB.get_collection(collection.mongo_collection).find(mongo_filters)
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

        user_id = user_dict.pop('_id')
        user = proto.create_from_mongo(user_dict, collection.proto)
        user.user_id = str(user_id)

        if user_id_start and not user.user_id.startswith(user_id_start):
            users_wrong_id_count += 1
            continue

        hash_value = _hash_user_id(user.user_id)
        if user_hash and not hash_value.startswith(user_hash):
            users_wrong_hash_count += 1
            continue

        if not collection.can_send_email(user):
            users_stopped_seeking += 1
            continue

        if not email_policy.can_send(campaign_id, user.emails_sent):
            email_policy_rejections += 1
            continue

        try:
            if not this_campaign.send_mail(campaign_id, user, _DB, _USER_DB, action, dry_run_email):
                no_template_vars_count += 1
                continue
        except requests.exceptions.HTTPError as error:
            if action == 'dry-run':
                raise
            else:
                logging.warning('Error while sending an email: %s', error)
                email_errors += 1
                continue

        if action == 'dry-run':
            break

        email_count += 1
        if email_count % 100 == 0:
            print('{} emails sent ...'.format(email_count))

    logging.info('{:d} users processed.'.format(users_processed_count))
    if users_wrong_id_count:
        logging.info('{:d} users ignored because of ID selection.'.format(users_wrong_id_count))
    if users_wrong_hash_count:
        logging.info('{:d} users ignored because of hash selection.'.format(users_wrong_hash_count))
    logging.info('{:d} users have stopped seeking.'.format(users_stopped_seeking))
    logging.info('{:d} users ignored because of emailing policy.'.format(email_policy_rejections))
    logging.info('{:d} users ignored because of no template vars.'.format(no_template_vars_count))
    if action == 'send':
        report.notify_slack(
            "Report for {} blast: I've sent {:d} emails (and got {:d} "
            'errors).'.format(campaign_id, email_count, email_errors))
    return email_count


# TODO(cyrille): Put that in common with the other async tools.
def _date_from_today(absolute_date, num_days_ago):

    if num_days_ago is None:
        return absolute_date
    return (datetime.datetime.today() - datetime.timedelta(days=num_days_ago))\
        .strftime('%Y-%m-%d')


def main(string_args=None):
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
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
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
    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')
    if args.action == 'send' and not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
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
    main()  # pragma: no cover
