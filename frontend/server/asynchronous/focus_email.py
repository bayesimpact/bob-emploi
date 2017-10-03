"""Script to send focused emails. See http://go/bob:focused-email-prd."""
import argparse
import collections
import csv
import datetime
import logging
import os
import re
from urllib import parse

import pymongo
import requests
from google.protobuf import json_format
import raven

from bob_emploi.frontend import auth
from bob_emploi.frontend import french
from bob_emploi.frontend import mail
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.asynchronous import report


_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()

# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO = proto.MongoCachedCollection(job_pb2.JobGroup, 'job_group_info')

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

# There is 2 spaces between the rank (2e, 3e) and the Arrondissement,
# except for the first one where there is only 1 space (i.e 1er Arrondissement).
_DISTRICT_MATCHER = re.compile(r'(\w+)\s(\d+e)r?(\s{1,2}Arrondissement)')


class RomePrefixInfo(object):
    """Info per job group organized by ROME prefix."""

    def __init__(self, records=None):
        self._data = collections.defaultdict(dict)
        if records:
            self._populate_prefixes(records)

    def _populate_prefixes(self, records):
        """Add some info for a list of given ROME prefixes."""
        for record in records:
            try:
                rome_prefix = record.pop('rome_prefix')
            except KeyError:
                raise ValueError(record)
            if len(rome_prefix) not in (1, 2, 3, 5):
                raise ValueError(
                    'ROME prefix length should be 1, 2, 3 or 5: {}'.format(rome_prefix))
            if rome_prefix in self._data:
                raise ValueError('Duplicate ROME prefix values for {}'.format(rome_prefix))
            self._data[rome_prefix] = record

    def import_from_csv(self, csv_path):
        """Import data from a CSV."""
        with open(csv_path, encoding='utf-8-sig') as csv_file:
            self._populate_prefixes(csv.DictReader(csv_file))

    def get_value(self, rome_id, fieldname):
        """Get the best data available for a job group on a given field."""
        for prefix_size in (5, 3, 2, 1):
            value = self._data[rome_id[:prefix_size]].get(fieldname)
            if value:
                return value
        return self._data[rome_id].get(fieldname)


def _get_french_months_ago(instant):
    duration_since_instant = datetime.datetime.now() - instant
    month_since_instant = round(duration_since_instant.days / 30.5)
    if month_since_instant < 1:
        return None
    if month_since_instant > 6:
        return 'plus de six'
    try:
        return french.try_stringify_number(month_since_instant)
    except NotImplementedError:
        return 'quelques'


def _genderize_job(job, gender):
    if gender == user_pb2.FEMININE and job.feminine_name:
        return job.feminine_name
    if gender == user_pb2.MASCULINE and job.masculine_name:
        return job.masculine_name
    return job.name


_ROME_INFO = RomePrefixInfo()


def strip_district(city):
    """Strip district from a city name, ie keep 'Lyon' from 'Lyon 5e Arrondissement'.

    Returns:
        a string with city stripped for district or the original city name.
    """
    district_match = re.match(_DISTRICT_MATCHER, city)
    if district_match:
        return district_match.group(1)
    return city


def network_vars(user):
    """Compute vars for a given user for the network email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """
    if not user.projects:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    registered_months_ago = _get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None

    in_target_domain = _ROME_INFO.get_value(project.target_job.job_group.rome_id, 'domain')
    if not in_target_domain:
        logging.warning('Could not find a target domain (%s)', project.target_job.job_group)
        return None

    worst_frustration = next(
        (f for f in (user_pb2.NO_OFFER_ANSWERS, user_pb2.MOTIVATION)
         if f in user.profile.frustrations),
        None)

    is_hairdresser_or_in_marseille = \
        project.target_job.job_group.rome_id.startswith('D') or \
        project.mobility.city.departement_id == '13'
    other_job_in_city = 'coiffeur à Marseille'
    if is_hairdresser_or_in_marseille:
        other_job_in_city = 'secrétaire à Lyon'

    return {
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'firstName': user.profile.name,
        'registeredMonthsAgo': registered_months_ago,
        'inTargetDomain': in_target_domain,
        'frustration': user_pb2.Frustration.Name(worst_frustration) if worst_frustration else '',
        'otherJobInCity': other_job_in_city,
        'jobInCity': '{} {}'.format(
            french.lower_first_letter(_genderize_job(project.target_job, user.profile.gender)),
            french.in_city(strip_district(project.mobility.city.name))),
        'emailInUrl': parse.quote(user.profile.email),
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            _BASE_URL, parse.quote(user.profile.email),
            parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))),
    }


_EXPERIENCE_AS_TEXT = {
    project_pb2.JUNIOR: 'quelques temps',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}


def spontaneous_vars(user, previous_email_campaign_id):
    """Compute vars for a given user for the spontaneous email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """
    if not user.projects:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    job_group_info = _JOB_GROUPS_INFO.get_collection(_DB).get(project.target_job.job_group.rome_id)

    def _should_use_spontaneous(modes):
        return any(
            mode.mode == job_pb2.SPONTANEOUS_APPLICATION and mode.percentage > 20
            for mode in modes.modes)
    application_modes = job_group_info.application_modes
    if not any(_should_use_spontaneous(modes) for modes in application_modes.values()):
        return None

    registered_months_ago = _get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None

    has_read_previous_email = previous_email_campaign_id and any(
        email.campaign_id == previous_email_campaign_id and
        email.status in (user_pb2.EMAIL_SENT_OPENED, user_pb2.EMAIL_SENT_CLICKED)
        for email in user.emails_sent)

    def _get_rome_value(fieldname):
        return _ROME_INFO.get_value(project.target_job.job_group.rome_id, fieldname)

    contact_mode = _get_rome_value('contact_mode')
    if not contact_mode:
        logging.error(
            'There is no contact mode for the job group "%s"',
            project.target_job.job_group.rome_id)
        return None

    in_a_workplace = _get_rome_value('in_a_workplace') or ''
    if not in_a_workplace and contact_mode != 'BY_EMAIL':
        logging.error(
            'There is no "in_a_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    like_your_workplace = _get_rome_value('like_your_workplace') or ''
    if in_a_workplace and not like_your_workplace:
        logging.error(
            'There is no "like_your_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    to_the_workplace = _get_rome_value('to_the_workplace')
    if not to_the_workplace:
        to_the_workplace = "à l'entreprise"

    some_companies = _get_rome_value('some_companies')
    if not some_companies:
        some_companies = 'des entreprises'

    what_i_love_about = _get_rome_value('what_i_love_about') or ''
    if user.profile.gender == user_pb2.FEMININE:
        what_i_love_about_feminine = _get_rome_value('what_i_love_about_feminine')
        if what_i_love_about_feminine:
            what_i_love_about = what_i_love_about_feminine
    if not what_i_love_about and contact_mode == 'BY_EMAIL':
        logging.error(
            'There is no "What I love about" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    why_specific_company = _get_rome_value('why_specific_company')
    if not why_specific_company:
        logging.error(
            'There is no "Why this specific company" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    various_companies = _get_rome_value('various_companies') or ''

    if project.weekly_applications_estimate == project_pb2.SOME:
        weekly_application_count = '5'
    elif project.weekly_applications_estimate > project_pb2.SOME:
        weekly_application_count = '15'
    else:
        weekly_application_count = ''

    return {
        'applicationComplexity':
            job_pb2.ApplicationProcessComplexity.Name(job_group_info.application_complexity),
        'contactMode': contact_mode,
        'deepLinkLBB':
            'https://labonneboite.pole-emploi.fr/entreprises/commune/{}/rome/'
            '{}?utm_medium=web&utm_source=bob&utm_campaign=bob-email'
            .format(project.mobility.city.city_id, project.target_job.job_group.rome_id),
        'emailInUrl': parse.quote(user.profile.email),
        'experienceAsText': _EXPERIENCE_AS_TEXT.get(project.seniority, 'peu'),
        'firstName': user.profile.name,
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'hasReadPreviousEmail': 'True' if has_read_previous_email else '',
        'inWorkPlace': in_a_workplace,
        'jobName':
            french.lower_first_letter(_genderize_job(project.target_job, user.profile.gender)),
        'lastName': user.profile.last_name,
        'likeYourWorkplace': like_your_workplace,
        'registeredMonthsAgo': registered_months_ago,
        'someCompanies': some_companies,
        'toTheWorkPlace': to_the_workplace,
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            _BASE_URL, parse.quote(user.profile.email),
            parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))),
        'variousCompanies': various_companies,
        'weeklyApplicationOptions': weekly_application_count,
        'whatILoveAbout': what_i_love_about,
        'whySpecificCompany': why_specific_company,
    }


def employment_vars(user):
    """Compute vars for a given user for the employment survey.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """
    registered_months_ago = _get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    return {
        'firstName': user.profile.name,
        'registeredMonthsAgo': registered_months_ago,
        'seekingUrl': '{}/api/employment-status?user={}&token={}&seeking=1&redirect={}'.format(
            _BASE_URL, user.user_id, survey_token,
            parse.quote('https://bayes.typeform.com/to/hn10ya'),
        ),
        # TODO(benoit) : Better if seeking is STOP_SEEKING instead of numeric value.
        'stopSeekingUrl': '{}/api/employment-status?user={}&token={}&seeking=2&redirect={}'.format(
            _BASE_URL, user.user_id, survey_token,
            parse.quote('https://bayes.typeform.com/to/jEnbMx'),
        ),
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            _BASE_URL, parse.quote(user.profile.email),
            parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))),
    }


_Campaign = collections.namedtuple('Campaign', [
    'mailjet_template', 'mongo_filters', 'get_vars', 'sender_name', 'sender_email'])


_CAMPAIGNS = {
    'focus-network': _Campaign(
        mailjet_template='205970',
        mongo_filters={
            'projects.networkEstimate': 1,
        },
        get_vars=network_vars,
        sender_name='Margaux de Bob Emploi',
        sender_email='margaux@bob-emploi.fr',
    ),
    'focus-spontaneous': _Campaign(
        mailjet_template='212606',
        # TODO(pascal): Decide on trigger.
        mongo_filters={},
        get_vars=lambda user: spontaneous_vars(user, 'focus-network'),
        sender_name='Margaux de Bob Emploi',
        sender_email='margaux@bob-emploi.fr',
    ),
    'employment-status': _Campaign(
        mailjet_template='225287',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0},
                'isIncomplete': {'$exists': False},
            }}
        },
        get_vars=employment_vars,
        sender_name='Benoit de Bob Emploi',
        sender_email='benoit@bob-emploi.fr',
    )
}


def blast_campaign(
        campaign_id, action, registered_from, registered_to, dry_run_email='', user_hash=''):
    """Send a campaign of personalized emails."""
    if action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')
    campaign = _CAMPAIGNS[campaign_id]
    template_id = campaign.mailjet_template
    selected_users = _DB.user.find(dict(campaign.mongo_filters, **{
        'profile.email': {'$not': re.compile(r'@example.com$')},
        'registeredAt': {
            '$gt': registered_from,
            '$lt': registered_to,
        }
    }))
    email_count = 0
    email_errors = 0

    for user_dict in selected_users:
        user_id = user_dict.pop('_id')
        user = user_pb2.User()
        proto.parse_from_mongo(user_dict, user)
        user.user_id = str(user_id)

        if user_hash and not user.user_id.startswith(user_hash):
            continue

        if any(email.campaign_id == campaign_id for email in user.emails_sent):
            # We already sent the email to that person.
            continue

        template_vars = campaign.get_vars(user)
        if not template_vars:
            continue

        if action == 'list':
            logging.info('%s %s', user.user_id, user.profile.email)
            continue

        if action == 'dry-run':
            user.profile.email = dry_run_email
        if action in ('dry-run', 'send'):
            res = mail.send_template(
                template_id, user.profile, template_vars,
                sender_email=campaign.sender_email, sender_name=campaign.sender_email)
            logging.info('Email sent to %s', user.profile.email)

        if action == 'dry-run':
            try:
                res.raise_for_status()
            except requests.exceptions.HTTPError:
                raise ValueError('Could not send email for vars:\n{}'.format(template_vars))
        elif res.status_code != 200:
            logging.warning('Error while sending an email: %d', res.status_code)
            email_errors += 1
            continue

        sent_response = res.json()
        message_id = next(iter(sent_response.get('Sent', [])), {}).get('MessageID', 0)
        if not message_id:
            logging.warning('Impossible to retrieve the sent email ID:\n%s', sent_response)
        if action == 'dry-run':
            return 1

        email_sent = user.emails_sent.add()
        email_sent.sent_at.GetCurrentTime()
        email_sent.sent_at.nanos = 0
        email_sent.mailjet_template = template_id
        email_sent.campaign_id = campaign_id
        email_sent.mailjet_message_id = message_id
        _DB.user.update_one({'_id': user_id}, {'$set': {
            'emailsSent': json_format.MessageToDict(user).get('emailsSent', []),
        }})
        email_count += 1
        if email_count % 100 == 0:
            print('{} emails sent ...'.format(email_count))

    if action == 'send':
        report.notify_slack(
            "Report for 3 month employment-status blast: I've sent {:d} emails (and got {:d} \
            errors).".format(email_count, email_errors))
    return email_count


def main():
    """Parse command line arguments and send mails."""
    parser = argparse.ArgumentParser(
        description='Send focus emails.', formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        epilog='''ROME info by prefix file can be downloaded at \
        https://airtable.com/tbl5jBDdG3vnYPWNu/viwz9GaBDHEpjTCU9
        ''')
    parser.add_argument('campaign', choices=_CAMPAIGNS.keys(), help='Campaign type to send.')
    parser.add_argument(
        'action', choices=('dry-run', 'list', 'send'), default='dry-run',
        help='Whether to process to a dry run, list all concerned users, or really send emails.')
    parser.add_argument(
        '--rome-info-by-prefix', help='Path to csv file "ROME info by prefix".')
    parser.add_argument(
        '--dry-run-email', default='pascal@bayes.org',
        help='Process a dry run and send email to this email adress.')
    parser.add_argument(
        '--user-hash', help='Only send to users whose ID starts with this given hash.')
    parser.add_argument(
        '--registered-from', default='2017-04-01', help='Consider only users who registered after \
        this date.')
    parser.add_argument(
        '--registered-to', default='2017-07-10', help='Consider only users who registered before \
        this date.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
    args = parser.parse_args()

    if args.rome_info_by_prefix:
        _ROME_INFO.import_from_csv(args.rome_info_by_prefix)

    logging.basicConfig(level='INFO')
    if args.action == 'send' and not args.disable_sentry:
        sentry_dsn = os.getenv('SENTRY_DSN', '')
        if not sentry_dsn:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return
        client = raven.Client(sentry_dsn)
        handler = raven.handlers.logging.SentryHandler(client)
        handler.setLevel(logging.WARNING)
        raven.conf.setup_logging(handler)

    logging.info('%d emails sent.', blast_campaign(
        args.campaign, args.action, args.registered_from, args.registered_to,
        dry_run_email=args.dry_run_email, user_hash=args.user_hash))


if __name__ == '__main__':
    main()
