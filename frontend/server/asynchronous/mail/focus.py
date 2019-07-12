"""Send focus emails to users that asked for coaching."""

import argparse
import datetime
import logging
import os
import random
import re
import typing

import pymongo
import requests

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign
# pylint: disable=unused-import
# Import plugins: they register themselves when imported.
from bob_emploi.frontend.server.asynchronous.mail import all_campaigns
# pylint: enable=unused-import

_EMAIL_PERIOD_DAYS = {
    user_pb2.EMAIL_ONCE_A_MONTH: 30,
    user_pb2.EMAIL_MAXIMUM: 6,
}

_FOCUS_CAMPAIGNS = campaign.get_coaching_campaigns()
_POTENTIAL_CAMPAIGNS = set(_FOCUS_CAMPAIGNS)
_DURATION_BEFORE_FIRST_EMAIL = datetime.timedelta(days=3)


def _send_focus_emails(action: str, dry_run_email: str) -> None:
    database, users_database, unused_eval_database = mongo.get_connections_from_env()

    instant = now.get()
    email_errors = 0
    counts = {campaign_id: 0 for campaign_id in _FOCUS_CAMPAIGNS}
    potential_users = users_database.user.find({
        'profile.email': re.compile('.+@.+'),
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
        }},
        'profile.coachingEmailFrequency': {'$in': [
            user_pb2.EmailFrequency.Name(setting) for setting in _EMAIL_PERIOD_DAYS]},
        # Note that "not >" is not equivalent to "<=" in the case the field
        # is not defined: in that case we do want to select the user.
        'sendCoachingEmailAfter': {'$not': {'$gt': proto.datetime_to_json_string(instant)}},
    })
    for user_dict in potential_users:
        user_id = user_dict.pop('_id')
        user = typing.cast(user_pb2.User, proto.create_from_mongo(user_dict, user_pb2.User))
        user.user_id = str(user_id)

        if not user.HasField('send_coaching_email_after'):
            send_coaching_email_after = _compute_next_coaching_email_date(user)
            if send_coaching_email_after > instant:
                users_database.user.update_one({'_id': user_id}, {'$set': {
                    'sendCoachingEmailAfter': proto.datetime_to_json_string(
                        send_coaching_email_after
                    ),
                }})
                continue

        # Compute next send_coaching_email_after.
        next_send_coaching_email_after = proto.datetime_to_json_string(
            instant + _compute_duration_to_next_coaching_email(user)
        )

        try:
            campaign_id = _send_focus_email_to_user(
                action, dry_run_email, user, database, users_database,
                mongo_user_update={'$set': {
                    'sendCoachingEmailAfter': next_send_coaching_email_after,
                }})
        except requests.exceptions.HTTPError as error:
            if action == 'dry-run':
                raise
            logging.warning('Error while sending an email: %s', error)
            email_errors += 1
            continue

        if campaign_id:
            counts[campaign_id] += 1
            continue

        # No focus email was supported: it seems that we have sent all the
        # ones we had. However maybe in the future we'll add more focus
        # emails so let's wait the same amount of time we have waited until
        # this email (this makes to wait 1 period, then 2, 4, …).
        last_coaching_email_sent_at = typing.cast(
            datetime.datetime,
            _compute_last_coaching_email_date(user, user.registered_at.ToDatetime()))
        send_coaching_email_after = instant + (instant - last_coaching_email_sent_at)
        users_database.user.update_one({'_id': user_id}, {'$set': {
            'sendCoachingEmailAfter': proto.datetime_to_json_string(send_coaching_email_after),
        }})

    report_message = 'Focus emails sent:\n' + '\n'.join([
        f' • *{campaign_id}*: {count} email{"s" if count > 1 else ""}'
        for campaign_id, count in counts.items()
    ])
    if action == 'send':
        report.notify_slack(report_message)
    logging.info(report_message)


def _send_focus_email_to_user(
        action: str, dry_run_email: str, user: user_pb2.User,
        database: pymongo.database.Database, users_database: pymongo.database.Database,
        mongo_user_update: typing.Dict[str, typing.Any]) -> typing.Optional[str]:
    focus_emails_sent = set()
    last_focus_email_sent = None
    for email_sent in user.emails_sent:
        if email_sent.campaign_id not in _FOCUS_CAMPAIGNS:
            continue
        last_focus_email_sent = email_sent
        focus_emails_sent.add(email_sent.campaign_id)

    last_one_was_big = last_focus_email_sent and \
        _FOCUS_CAMPAIGNS[last_focus_email_sent.campaign_id].is_big_focus
    potential_campaigns = sorted(
        _POTENTIAL_CAMPAIGNS - focus_emails_sent,
        key=lambda c: (
            1 if _FOCUS_CAMPAIGNS[c].is_big_focus == last_one_was_big else 0,
            random.random(),
        )
    )

    for campaign_id in potential_campaigns:
        if _FOCUS_CAMPAIGNS[campaign_id].send_mail(
                campaign_id, user, database, users_database, action, dry_run_email,
                mongo_user_update=mongo_user_update):
            return campaign_id

    logging.debug('No more available focus email for "%s"', user.user_id)
    return None


# TODO(pascal): If/When pylint accepts typing overload, drop the Optional part in the response.
def _compute_last_coaching_email_date(
        user: user_pb2.User, default: typing.Optional[datetime.datetime]) \
        -> typing.Optional[datetime.datetime]:
    return max(
        typing.cast(
            typing.Iterator[typing.Optional[datetime.datetime]],
            (e.sent_at.ToDatetime()
             for e in user.emails_sent
             if e.campaign_id in _FOCUS_CAMPAIGNS)),
        default=default
    )


def _compute_next_coaching_email_date(user: user_pb2.User) -> datetime.datetime:
    last_coaching_email_date = _compute_last_coaching_email_date(user, None)
    if last_coaching_email_date is None:
        # First time coaching email.
        return user.registered_at.ToDatetime() + _DURATION_BEFORE_FIRST_EMAIL
    # The date got cleared, probably because a setting changed.
    return last_coaching_email_date + _compute_duration_to_next_coaching_email(user)


def _compute_duration_to_next_coaching_email(user: user_pb2.User) -> datetime.timedelta:
    period_days = _EMAIL_PERIOD_DAYS[user.profile.coaching_email_frequency]
    return datetime.timedelta(days=period_days) * (1 + .2 * (2 * random.random() - 1))


def main(string_args: typing.Optional[typing.List[str]] = None) -> None:
    """Parse command line arguments and send mails."""

    parser = argparse.ArgumentParser(
        description='Send focus emails.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument(
        'action', choices=('dry-run', 'list', 'send'), default='dry-run',
        help='Whether to process to a dry run, list all concerned users, or really send emails.')
    parser.add_argument(
        '--dry-run-email', default='pascal@bayes.org',
        help='Process a dry run and send email to this email address.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')
    if args.action == 'send' and not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    if args.action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')

    if args.action == 'list':
        logging.info('Potential focus emails: %s', sorted(_FOCUS_CAMPAIGNS.keys()))

    _send_focus_emails(args.action, args.dry_run_email)


if __name__ == '__main__':
    main()
