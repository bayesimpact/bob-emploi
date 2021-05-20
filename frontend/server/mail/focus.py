"""Send focus emails to users that asked for coaching."""

import argparse
import datetime
import logging
import random
import re
import typing
from typing import Dict, Iterable, List, Optional, Set

from bson import objectid
import requests

from bob_emploi.common.python import now
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import campaign
# pylint: disable=unused-import
# Import plugins: they register themselves when imported.
from bob_emploi.frontend.server.mail import all_campaigns
# pylint: enable=unused-import
from bob_emploi.frontend.server.mail.templates import mailjet_templates

_EMAIL_PERIOD_DAYS = {
    user_pb2.EMAIL_ONCE_A_MONTH: 30,
    user_pb2.EMAIL_MAXIMUM: 6,
}

_FOCUS_CAMPAIGNS = campaign.get_coaching_campaigns()
_DURATION_BEFORE_FIRST_EMAIL = datetime.timedelta(days=3)
# A list of campaigns coming from our DB so that we can decide dynamically to NOT send some of them.
_CAMPAIGNS_DB: proto.MongoCachedCollection[email_pb2.Campaign] = \
    proto.MongoCachedCollection(email_pb2.Campaign, 'focus_emails')


def _get_possible_campaigns(
        database: mongo.NoPiiMongoDatabase,
        restricted_campaigns: Optional[Iterable[mailjet_templates.Id]] = None) \
        -> Dict[mailjet_templates.Id, email_pb2.Campaign]:
    restricted_campaigns_set: Optional[Set[mailjet_templates.Id]]
    if restricted_campaigns:
        if isinstance(restricted_campaigns, set):
            restricted_campaigns_set = restricted_campaigns
        else:
            restricted_campaigns_set = set(restricted_campaigns)
    else:
        restricted_campaigns_set = set()

    possible_campaigns = {
        typing.cast(mailjet_templates.Id, c.campaign_id): c
        for c in _CAMPAIGNS_DB.get_collection(database)
        if not restricted_campaigns_set or c.campaign_id in restricted_campaigns_set
    }

    for campaign_id in restricted_campaigns_set - possible_campaigns.keys():
        possible_campaigns[campaign_id] = email_pb2.Campaign(campaign_id=campaign_id)

    return possible_campaigns


def _send_focus_emails(
        action: 'campaign.Action', dry_run_email: str,
        restricted_campaigns: Optional[Iterable[mailjet_templates.Id]] = None) -> None:
    database, users_database, unused_eval_database = mongo.get_connections_from_env()

    instant = now.get()
    email_errors = 0
    counts = {
        campaign_id: 0
        for campaign_id in sorted(_get_possible_campaigns(database, restricted_campaigns))
    }
    potential_users = users_database.user.find({
        'profile.email': {
            '$regex': re.compile(r'[^ ]+@[^ ]+\.[^ ]+'),
        },
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
        }},
        'profile.coachingEmailFrequency': {'$in': [
            user_pb2.EmailFrequency.Name(setting) for setting in _EMAIL_PERIOD_DAYS]},
        # Note that "not >" is not equivalent to "<=" in the case the field
        # is not defined: in that case we do want to select the user.
        'sendCoachingEmailAfter': {'$not': {'$gt': proto.datetime_to_json_string(instant)}},
    })
    restricted_campaigns_set: Optional[Set[mailjet_templates.Id]]
    if restricted_campaigns:
        restricted_campaigns_set = set(restricted_campaigns)
    else:
        restricted_campaigns_set = None
    for user_dict in potential_users:
        user_id = user_dict.pop('_id')
        user = proto.create_from_mongo(user_dict, user_pb2.User)
        user.user_id = str(user_id)

        try:
            campaign_id = send_focus_email_to_user(
                action, user, dry_run_email=dry_run_email, database=database,
                users_database=users_database, instant=instant,
                restricted_campaigns=restricted_campaigns_set)
        except requests.exceptions.HTTPError as error:
            if action == 'dry-run':
                raise
            logging.warning('Error while sending an email: %s', error)
            email_errors += 1
            continue

        if campaign_id:
            counts[campaign_id] += 1
            if action == 'dry-run':
                break
            continue

    report_message = 'Focus emails sent today:\n' + '\n'.join([
        f' • *{campaign_id}*: {count} email{"s" if count > 1 else ""}'
        for campaign_id, count in counts.items()
    ])
    if action == 'send':
        report.notify_slack(report_message)
    logging.info(report_message)


# Three criterias are taken in account to shuffle the campaigns:
# - SCORES: gives higher piority to campaigns that scored better for the user [0-3]
# - RANDOM: shuffle campaigns [0-1]
# - BIG: gives more priority to alternate big and small emails {0,1}
# Each criteria weights more or less compared to the others criterias.
# First, the values for the criterias need to be normalized ([0-1])
# Then, a weight is applied for each criteria :
# - 50% for the campaign score
# - 40% for a random value
# - 10% for the campaign being big
_BIG_WEIGHT = 1
_SCORES_WEIGHT = 5
_RANDOM_WEIGHTS = {
    # Less random if user receives less emails.
    user_pb2.EMAIL_ONCE_A_MONTH: 2,
    user_pb2.EMAIL_MAXIMUM: 4,
}


def _shuffle(
        campaigns: Set[mailjet_templates.Id],
        last_focus_email_sent: Optional[user_pb2.EmailSent],
        campaigns_scores: Dict[mailjet_templates.Id, float],
        frequency: 'user_pb2.EmailFrequency.V') -> List[mailjet_templates.Id]:
    """Shuffles the focus emails and simulates a random sort"""

    last_one_was_big = bool(
        last_focus_email_sent and
        last_focus_email_sent.campaign_id in _FOCUS_CAMPAIGNS and
        _FOCUS_CAMPAIGNS[
            typing.cast(mailjet_templates.Id, last_focus_email_sent.campaign_id)
        ].is_big_focus)

    random_weight = _RANDOM_WEIGHTS.get(frequency, _RANDOM_WEIGHTS[user_pb2.EMAIL_MAXIMUM])

    return sorted(
        campaigns,
        key=lambda c: (
            _BIG_WEIGHT * (1 if _FOCUS_CAMPAIGNS[c].is_big_focus == last_one_was_big else 0) +
            _SCORES_WEIGHT * (-campaigns_scores[c] / 3) +
            random_weight * random.random()
        )
    )


def send_focus_email_to_user(
        action: 'campaign.Action', user: user_pb2.User, *, dry_run_email: Optional[str] = None,
        database: mongo.NoPiiMongoDatabase, users_database: mongo.UsersDatabase,
        instant: datetime.datetime,
        restricted_campaigns: Optional[Set[mailjet_templates.Id]] = None) \
        -> Optional[mailjet_templates.Id]:
    """Try to send a focus email to the user and returns the campaign ID."""

    if not user.HasField('send_coaching_email_after'):
        send_coaching_email_after = _compute_next_coaching_email_date(user)
        if send_coaching_email_after > instant:
            user.send_coaching_email_after.FromDatetime(send_coaching_email_after)
            if user.user_id:
                users_database.user.update_one(
                    {'_id': objectid.ObjectId(user.user_id)}, {'$set': {
                        'sendCoachingEmailAfter': proto.datetime_to_json_string(
                            send_coaching_email_after,
                        ),
                    }})
            return None

    # Compute next send_coaching_email_after.
    next_send_coaching_email_after = instant + _compute_duration_to_next_coaching_email(user)

    focus_emails_sent: Set[mailjet_templates.Id] = set()
    last_focus_email_sent = None
    for email_sent in user.emails_sent:
        if email_sent.campaign_id not in _FOCUS_CAMPAIGNS:
            continue
        last_focus_email_sent = email_sent
        focus_emails_sent.add(typing.cast(mailjet_templates.Id, email_sent.campaign_id))

    project = scoring_base.ScoringProject(
        user.projects[0] if user.projects else project_pb2.Project(),
        user, database, instant,
    )

    possible_campaigns = _get_possible_campaigns(database, restricted_campaigns)
    campaigns_scores = {
        campaign_id: (
            project.score(possible_campaign.scoring_model)
            if possible_campaign.scoring_model else 2
        )
        for campaign_id, possible_campaign in possible_campaigns.items()
    }

    focus_emails_project_score_zero = {
        campaign for campaign, score in campaigns_scores.items() if not score
    }

    potential_campaigns = _shuffle(
        possible_campaigns.keys() - focus_emails_sent - focus_emails_project_score_zero,
        last_focus_email_sent, campaigns_scores,
        user.profile.coaching_email_frequency)

    for campaign_id in potential_campaigns:
        if _FOCUS_CAMPAIGNS[campaign_id].send_mail(
                user, database=database, users_database=users_database, action=action,
                dry_run_email=dry_run_email,
                mongo_user_update={'$set': {
                    'sendCoachingEmailAfter': proto.datetime_to_json_string(
                        next_send_coaching_email_after,
                    ),
                }}, now=instant):
            user.send_coaching_email_after.FromDatetime(next_send_coaching_email_after)
            return campaign_id

    # No focus email was supported: it seems that we have sent all the
    # ones we had. However maybe in the future we'll add more focus
    # emails so let's wait the same amount of time we have waited until
    # this email (this makes to wait 1 period, then 2, 4, …).
    last_coaching_email_sent_at = \
        _compute_last_coaching_email_date(user, user.registered_at.ToDatetime())
    send_coaching_email_after = instant + (instant - last_coaching_email_sent_at)
    user.send_coaching_email_after.FromDatetime(send_coaching_email_after)
    if user.user_id and action != 'ghost':
        logging.debug('No more available focus email for "%s"', user.user_id)
        users_database.user.update_one({'_id': objectid.ObjectId(user.user_id)}, {'$set': {
            'sendCoachingEmailAfter': proto.datetime_to_json_string(send_coaching_email_after),
        }})
    return None


@typing.overload
def _compute_last_coaching_email_date(
        user: user_pb2.User, default: datetime.datetime) -> datetime.datetime:
    ...


@typing.overload
def _compute_last_coaching_email_date(
        user: user_pb2.User, default: None = None) -> Optional[datetime.datetime]:
    ...


def _compute_last_coaching_email_date(
        user: user_pb2.User, default: Optional[datetime.datetime] = None) \
        -> Optional[datetime.datetime]:
    return max((
        e.sent_at.ToDatetime()
        for e in user.emails_sent
        if e.campaign_id in _FOCUS_CAMPAIGNS
    ), default=default)


def _compute_next_coaching_email_date(user: user_pb2.User) -> datetime.datetime:
    last_coaching_email_date = _compute_last_coaching_email_date(user)
    if last_coaching_email_date is None:
        # First time coaching email.
        return user.registered_at.ToDatetime() + _DURATION_BEFORE_FIRST_EMAIL
    # The date got cleared, probably because a setting changed.
    return last_coaching_email_date + _compute_duration_to_next_coaching_email(user)


def _compute_duration_to_next_coaching_email(user: user_pb2.User) -> datetime.timedelta:
    period_days = _EMAIL_PERIOD_DAYS[user.profile.coaching_email_frequency]
    return datetime.timedelta(days=period_days) * (1 + .2 * (2 * random.random() - 1))


def main(string_args: Optional[List[str]] = None) -> None:
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
        '--restrict-campaigns', help='IDs of campaigns to send.',
        choices=sorted(_FOCUS_CAMPAIGNS.keys()), nargs='*')
    report.add_report_arguments(parser, setup_dry_run=False)
    args = parser.parse_args(string_args)

    if not report.setup_sentry_logging(args, dry_run=args.action != 'send'):
        return

    if args.action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')

    if args.action == 'list':
        logging.info('Potential focus emails: %s', sorted(_FOCUS_CAMPAIGNS.keys()))

    _send_focus_emails(
        args.action, args.dry_run_email, restricted_campaigns=args.restrict_campaigns)


if __name__ == '__main__':
    main()
