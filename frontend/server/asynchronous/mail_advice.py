# encoding: utf-8
"""Script to send a mailing to some users that include a selected advice.
Usage:

docker-compose run --rm \
    -e MONGO_URL ... \
    frontend-flask python bob_emploi/frontend/asynchronous/mail_advice.py
"""
# TODO(pascal): Factorize with mail_actions if both stick around.
import datetime
import logging
import os
import random
import signal

import pymongo
import requests

from google.protobuf import json_format

from bob_emploi.frontend import advisor
from bob_emploi.frontend import mail
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import user_pb2

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()
# Minimum duration between two emails.
_COOL_DOWN_TIME = datetime.timedelta(hours=20)

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

# For a dry run we do not send emails to users nor modify the database.
DRY_RUN = not bool(os.getenv('NODRY_RUN'))
if DRY_RUN:
    logging.getLogger().setLevel(logging.INFO)

# ID of the email template for advice in MailJet. See
# https://app.mailjet.com/template/132388/build
_MAILJET_ADVICE_TEMPLATE_ID = '132388'

# ID of the email template in MailJet to report the final count of the blast. See
# https://app.mailjet.com/tempate/74071/build
_MAILJET_REPORT_TEMPLATE_ID = '74071'

# The names of the days of the week in French.
# We could start using the FR locale for this, but it's quite heavy for such a
# small perk. If we end up using it for anoter reason, change this code.
_FRENCH_WEEK_DAYS = {
    user_pb2.MONDAY: 'lundi',
    user_pb2.TUESDAY: 'mardi',
    user_pb2.WEDNESDAY: 'mercredi',
    user_pb2.THURSDAY: 'jeudi',
    user_pb2.FRIDAY: 'vendredi',
    user_pb2.SATURDAY: 'samedi',
    user_pb2.SUNDAY: 'dimanche',
}

_FRENCH_COUNT = {
    2: 'deux',
    3: 'trois',
    4: 'quatre',
    5: 'cinq',
    6: 'six',
}


def see_you_day(days, weekday):
    """Gets the right French word to say "see you next x" given it might not be tomorrow.

    Args:
        days: a list of WeekDay enum proto on which the user receives emails.
        weekday: a WeekDay enum defining the day of the week we are.
    """
    if not days:
        return 'la prochaine'  # another day
    # Extend to next week's days as well.
    days = sorted([d for d in days] + [d + 7 for d in days])
    next_day = next(d for d in days if d > weekday)
    if next_day == weekday + 1:
        return 'demain'  # tomorrow
    if next_day == weekday + 7:
        return 'la semaine prochaine'  # next week
    if next_day > user_pb2.SUNDAY:
        next_day -= 7
    return _FRENCH_WEEK_DAYS[next_day]


def frequency(days):
    """Gets the right French wording to say "x times a week".

    Args:
        days: a list of WeekDay enum proto on which the user receives emails.
    """
    num_days = len(set(days))
    if not num_days:
        return 'de temps à autre'  # every now and then
    if num_days == 1:
        return 'tous les %ss' % _FRENCH_WEEK_DAYS[days[0]]  # every Monday
    if num_days >= 7:
        return 'tous les jours'
    return '%s fois par semaine' % _FRENCH_COUNT[num_days]


def send_email_to_user(user, base_url, weekday, database):
    """Sends an email to the user with their current actions."""
    if not user.projects:
        return False
    # Renew actions for the day if needed.
    advice = advisor.select_advice_for_email(user, weekday, database)
    if not advice:
        logging.warning('No useful advice to send for: %s', user.profile.email)
        return False

    advice_module = advisor.get_advice_module(advice.advice_id, database)
    if not advice_module:
        logging.warning('Module for advice "%s" not found in DB.'. advice.advice_id)
        return False

    tips = advisor.select_tips_for_email(user, user.projects[0], advice, database)
    if not tips:
        logging.warning('No tips for advice "%s".', advice.advice_id)

    mail_result = mail.send_template(
        _MAILJET_ADVICE_TEMPLATE_ID,
        user.profile,
        dict({
            'advices': json_format.MessageToDict(user.projects[0]).get('advices', []),
            'baseUrl': base_url,
            'fact': random.choice(advice_module.email_facts),
            'firstName': user.profile.name,
            'frequency': frequency(user.profile.email_days),
            'nextday': see_you_day(user.profile.email_days, weekday),
            'numStars': advice.num_stars,
            'projectId': user.projects[0].project_id,
            'subject': advice_module.email_subject,
            'suggestionSentence': advice_module.email_suggestion_sentence,
            'title': advice_module.email_title,
        }, **_flatten([json_format.MessageToDict(t) for t in tips], prefix='tips')),
        dry_run=DRY_RUN,
    )
    mail_result.raise_for_status()
    return True


def _break_on_signal(signums, iterator):
    """Wrapper for an iterator to stop iterating when kernal signal is received.

    Args:
        signums: a list of signal numbers to break on.
        iterator: the iterator to wrap.
    Yields:
        the item of the iterator as long as no signal has been caught.
    """
    signals = []

    def _record_signal(signum, unused_frame):
        # TODO(pascal): Update the report email to write that the blast was
        # interrupted.
        signals.append(signum)

    for signum in signums:
        signal.signal(signum, _record_signal)
    for item in iterator:
        yield item
        if signals:
            break


def _deactivate_if_never_opened(user_id, user, user_db):
    """Deactivate mailings if emails were never opened."""
    if not user.last_email_sent_at:
        return False
    email = user.profile.email
    # TODO(pascal): Store the fact that the user has already been checked
    # in our DB to avoid the extra call to MailJet API.
    counts = mail.count_sent_to(email)
    if counts['DeliveredCount'] < 5 or counts['OpenedCount']:
        return False

    logging.info('Disable sending email to %s', user_id)

    if not DRY_RUN:
        user_db.update_one(
            {'_id': user_id},
            {'$set': {'profile.emailDays': [], 'featuresEnabled.autoStopEmails': True}})
    return True


def _send_reports(count, errors, weekday):
    logging.warning('%d emails sent.', count)

    english_weekday = user_pb2.WeekDay.Name(weekday)
    english_weekday = english_weekday[0] + english_weekday[1:].lower()

    _send_slack_report(count, errors, english_weekday)
    _send_email_report(count, errors, english_weekday)


def _send_slack_report(count, errors, english_weekday):
    if _SLACK_WEBHOOK_URL:
        requests.post(
            _SLACK_WEBHOOK_URL,
            json={
                'text':
                    "Report for %s's blast: I've sent %d emails (with %d errors)."
                    % (english_weekday, count, len(errors)),
            },
        )


def _send_email_report(count, errors, english_weekday):
    result = mail.send_template_to_admins(
        _MAILJET_REPORT_TEMPLATE_ID,
        {'count': count, 'errors': errors or ['No errors'], 'weekday': english_weekday},
    )
    if result.status_code != 200:
        logging.error('Error while sending the report: %d', result.status_code)


def main(database, base_url, now):
    """Send an email with a selected advice to a list of users."""
    # Week day as a user_pb2.WeekDay value.
    weekday = now.weekday() + 1
    query = {
        'profile.emailDays': user_pb2.WeekDay.Name(weekday),
        'projects': {'$exists': True},
        'featuresEnabled.advisorEmail': 'ACTIVE',
    }
    count = 0
    cool_down_time_beginning = now - _COOL_DOWN_TIME
    user_iterator = database.user.find(query)
    errors = []
    for user_in_db in _break_on_signal([signal.SIGTERM], user_iterator):
        user = user_pb2.User()
        user_id = user_in_db['_id']
        if not proto.parse_from_mongo(user_in_db, user):
            # Skip silently (the proto library already logs the error).
            continue
        if user.last_email_sent_at.ToDatetime() > cool_down_time_beginning:
            # Skip silently.
            continue

        if _deactivate_if_never_opened(user_id, user, database.user):
            continue

        try:
            result = send_email_to_user(user, base_url, weekday, database)
        except (IOError, json_format.ParseError) as err:
            errors.append('%s - %s' % (err, user_id))
            logging.error(err)
            continue

        if not result:
            continue

        if not DRY_RUN:
            database.user.update_one(
                {'_id': user_id},
                {'$set': {'lastEmailSentAt': now}})

        count += 1

    _send_reports(count, errors, weekday)


def _flatten(root, prefix='', all_vars=None):
    if not all_vars:
        all_vars = dict()
    if isinstance(root, dict):
        for key, value in root.items():
            all_vars = _flatten(value, prefix='%s_%s' % (prefix, key), all_vars=all_vars)
    elif isinstance(root, list):
        for i, value in enumerate(root):
            all_vars = _flatten(value, prefix='%s_%d' % (prefix, i), all_vars=all_vars)
    else:
        all_vars[prefix] = root
    return all_vars


if __name__ == '__main__':
    main(_DB, _BASE_URL, datetime.datetime.utcnow())
