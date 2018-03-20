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
from urllib import parse

import requests
from google.protobuf import json_format

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign
# pylint: disable=unused-import
# Import all plugins: they register themselves when imported.
from bob_emploi.frontend.server.asynchronous.mail import holiday
from bob_emploi.frontend.server.asynchronous.mail import imt
from bob_emploi.frontend.server.asynchronous.mail import network
from bob_emploi.frontend.server.asynchronous.mail import salon_arles
# pylint: enable=unused-import


_DB, _USER_DB = mongo.get_connections_from_env()


_ONE_MONTH_AGO = now.get() - datetime.timedelta(30)
_ONE_YEAR_AGO = now.get() - datetime.timedelta(365)


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

    job_group_info = jobs.get_group_proto(_DB, project.target_job.job_group.rome_id)

    def _should_use_spontaneous(modes):
        return any(
            mode.mode == job_pb2.SPONTANEOUS_APPLICATION and mode.percentage > 20
            for mode in modes.modes)
    application_modes = job_group_info.application_modes
    if not any(_should_use_spontaneous(modes) for modes in application_modes.values()):
        return None

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None

    has_read_previous_email = previous_email_campaign_id and any(
        email.campaign_id == previous_email_campaign_id and
        email.status in (user_pb2.EMAIL_SENT_OPENED, user_pb2.EMAIL_SENT_CLICKED)
        for email in user.emails_sent)

    contact_mode = job_group_info.preferred_application_medium
    if not contact_mode:
        logging.error(
            'There is no contact mode for the job group "%s"',
            project.target_job.job_group.rome_id)
        return None
    contact_mode = job_pb2.ApplicationMedium.Name(contact_mode).replace('APPLY_', '')

    in_a_workplace = job_group_info.in_a_workplace
    if not in_a_workplace and contact_mode != 'BY_EMAIL':
        logging.error(
            'There is no "in_a_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    like_your_workplace = job_group_info.like_your_workplace
    if in_a_workplace and not like_your_workplace:
        logging.error(
            'There is no "like_your_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    to_the_workplace = job_group_info.to_the_workplace
    if not to_the_workplace:
        to_the_workplace = "à l'entreprise"

    some_companies = job_group_info.place_plural
    if not some_companies:
        some_companies = 'des entreprises'

    what_i_love_about = job_group_info.what_i_love_about
    if user.profile.gender == user_pb2.FEMININE:
        what_i_love_about_feminine = job_group_info.what_i_love_about_feminine
        if what_i_love_about_feminine:
            what_i_love_about = what_i_love_about_feminine
    if not what_i_love_about and contact_mode == 'BY_EMAIL':
        logging.error(
            'There is no "What I love about" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    why_specific_company = job_group_info.why_specific_company
    if not why_specific_company:
        logging.error(
            'There is no "Why this specific company" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    at_various_companies = job_group_info.at_various_companies

    if project.weekly_applications_estimate == project_pb2.SOME:
        weekly_application_count = '5'
    elif project.weekly_applications_estimate > project_pb2.SOME:
        weekly_application_count = '15'
    else:
        weekly_application_count = ''

    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    return {
        'applicationComplexity':
            job_pb2.ApplicationProcessComplexity.Name(job_group_info.application_complexity),
        'atVariousCompanies': at_various_companies,
        'contactMode': contact_mode,
        'deepLinkLBB':
            'https://labonneboite.pole-emploi.fr/entreprises/commune/{}/rome/'
            '{}?utm_medium=web&utm_source=bob&utm_campaign=bob-email'
            .format(project.mobility.city.city_id, project.target_job.job_group.rome_id),
        'emailInUrl': parse.quote(user.profile.email),
        'experienceAsText': _EXPERIENCE_AS_TEXT.get(project.seniority, 'peu'),
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'hasReadPreviousEmail': campaign.as_template_boolean(has_read_previous_email),
        'inWorkPlace': in_a_workplace,
        'jobName':
            french.lower_first_letter(french.genderize_job(
                project.target_job, user.profile.gender)),
        'lastName': user.profile.last_name,
        'likeYourWorkplace': like_your_workplace,
        'registeredMonthsAgo': registered_months_ago,
        'someCompanies': some_companies,
        # TODO(cyrille): Use campaign.get_status_update_link
        'statusUpdateUrl': '{}/statut/mise-a-jour?user={}&token={}&gender={}'.format(
            campaign.BASE_URL, user.user_id, survey_token,
            user_pb2.Gender.Name(user.profile.gender)),
        'toTheWorkplace': to_the_workplace,
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            campaign.BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
        'weeklyApplicationOptions': weekly_application_count,
        'whatILoveAbout': what_i_love_about,
        'whySpecificCompany': why_specific_company,
    }


def self_development_vars(user, unused_db=None):
    """Compute vars for a given user for the self-development email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.info('User registered only recently (%s)', user.registered_at)
        return None

    job_search_length = campaign.job_search_started_months_ago(project)
    if job_search_length < 0:
        logging.info('No info on user search duration')
        return None

    if job_search_length >= 12:
        logging.info('User has been searching for too long (%s)', job_search_length)
        return None

    genderized_job_name = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))
    age = datetime.date.today().year - user.profile.year_of_birth
    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))

    max_young = 30
    min_old = 50

    return {
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'hasEnoughExperience': campaign.as_template_boolean(
            project.seniority > project_pb2.JUNIOR),
        'isAdministrativeAssistant': campaign.as_template_boolean(
            project.target_job.job_group.name == 'Secrétariat'),
        'isOld': campaign.as_template_boolean(age >= min_old),
        'isOldNotWoman': campaign.as_template_boolean(
            age >= min_old and user.profile.gender != user_pb2.FEMININE),
        'isYoung': campaign.as_template_boolean(age <= max_young),
        'isYoungNotWoman': campaign.as_template_boolean(
            age <= max_young and user.profile.gender != user_pb2.FEMININE),
        'jobName': genderized_job_name,
        'ofJobName': french.maybe_contract_prefix('de ', "d'", genderized_job_name),
        'registeredMonthsAgo': registered_months_ago,
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            campaign.BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
    }


def body_language_vars(user, unused_db=None):
    """Compute vars for a given user for the body language email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects:
        logging.info('User has no project')
        return None

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.info('User registered only recently (%s)', user.registered_at)
        return None

    has_read_last_focus_email = any(
        email.status in _READ_EMAIL_STATUSES
        for email in user.emails_sent
        if email.campaign_id.startswith('focus-'))

    worst_frustration = next(
        (user_pb2.Frustration.Name(frustration)
         for frustration in (user_pb2.SELF_CONFIDENCE, user_pb2.INTERVIEW, user_pb2.ATYPIC_PROFILE)
         if frustration in user.profile.frustrations),
        '')
    if not worst_frustration:
        return None

    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))

    return {
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'hasReadLastFocusEmail': campaign.as_template_boolean(has_read_last_focus_email),
        'registeredMonthsAgo': registered_months_ago,
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            campaign.BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
        'worstFrustration': worst_frustration,
    }


def employment_vars(user, unused_db=None):
    """Compute vars for a given user for the employment survey.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None
    # If the users have already updated their employment status less than one month ago,
    # ignore them.
    for status in user.employment_status:
        if status.created_at.ToDatetime() > _ONE_MONTH_AGO:
            return None
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    return {
        'firstName': french.cleanup_firstname(user.profile.name),
        'registeredMonthsAgo': registered_months_ago,
        'seekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STILL_SEEKING',
            parse.quote('{}/statut/en-recherche'.format(campaign.BASE_URL)),
        ),
        'stopSeekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STOP_SEEKING',
            parse.quote('{}/statut/ne-recherche-plus'.format(campaign.BASE_URL)),
        ),
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            campaign.BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
    }


def new_diagnostic_vars(user, unused_db=None):
    """Compute vars for the "New Diagnostic"."""

    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    frustrations_vars = {
        'frustration_{}'.format(user_pb2.Frustration.Name(f)): 'True'
        for f in user.profile.frustrations
    }
    age = datetime.date.today().year - user.profile.year_of_birth
    has_children = user.profile.family_situation in {
        user_pb2.FAMILY_WITH_KIDS,
        user_pb2.SINGLE_PARENT_SITUATION,
    }
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    auth_token = parse.quote(auth.create_token(user.user_id, is_using_timestamp=True))
    return dict(frustrations_vars, **{
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'mayHaveSeekingChildren': campaign.as_template_boolean(has_children and age >= 45),
        'loginUrl': '{}?userId={}&authToken={}'.format(campaign.BASE_URL, user.user_id, auth_token),
        'stopSeekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STOP_SEEKING',
            parse.quote('{}/statut/ne-recherche-plus'.format(campaign.BASE_URL)),
        ),
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            campaign.BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
    })


def _viral_sharing_vars(user, hash_start=''):
    """Template variables for viral sharing emails."""

    if user.registered_at.ToDatetime() > _ONE_YEAR_AGO:
        return None
    # TODO(cyrille): Move this in the --user-hash flag, to be usable by all campaigns.
    if hash_start:
        uniform_hash = hashlib.sha1()
        uniform_hash.update(user.user_id.encode('ascii'))
        if not uniform_hash.hexdigest().startswith(hash_start):
            return None
    return campaign.get_default_vars(user)


# TODO(cyrille): Modularize.
_CAMPAIGNS = {
    'focus-spontaneous': campaign.Campaign(
        mailjet_template='212606',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0},
                'isIncomplete': {'$exists': False},
            }},
        },
        get_vars=lambda user, unused_db=None: spontaneous_vars(user, 'focus-network'),
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'focus-self-develop': campaign.Campaign(
        mailjet_template='255279',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0, '$lte': 12},
                'isIncomplete': {'$exists': False},
            }}
        },
        get_vars=self_development_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'focus-body-language': campaign.Campaign(
        mailjet_template='277304',
        mongo_filters={
            'projects': {'$elemMatch': {
                'isIncomplete': {'$exists': False},
            }},
            'profile.frustrations': {'$elemMatch': {
                '$in': ['SELF_CONFIDENCE', 'INTERVIEW', 'ATYPIC_PROFILE'],
            }},
        },
        get_vars=body_language_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'employment-status': campaign.Campaign(
        mailjet_template='225287',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0},
                'isIncomplete': {'$exists': False},
            }}
        },
        get_vars=employment_vars,
        sender_name='Benoit de Bob',
        sender_email='benoit@bob-emploi.fr',
    ),
    'new-diagnostic': campaign.Campaign(
        mailjet_template='310559',
        mongo_filters={
            'registeredAt': {'$lt': '2017-11'},
            'requestedByUserAtDate': {'$not': {'$gt': '2017-11'}},
        },
        get_vars=new_diagnostic_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'galita-1': campaign.Campaign(
        mailjet_template='315773',
        mongo_filters={
            'profile.frustrations': 'MOTIVATION',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=lambda user, unused_db: campaign.get_default_vars(user),
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'viral-sharing-1': campaign.Campaign(
        mailjet_template='334851',
        mongo_filters={},
        get_vars=lambda user, unused_db: _viral_sharing_vars(user, hash_start='0'),
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
}

for the_id, the_campaign in _CAMPAIGNS.items():
    campaign.register_campaign(the_id, the_campaign)

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


def blast_campaign(
        campaign_id, action, registered_from, registered_to,
        dry_run_email='', user_hash='',
        email_policy=EmailPolicy(days_since_any_email=2, days_since_same_campaign_unread=0)):
    """Send a campaign of personalized emails."""

    if action == 'send' and auth.SECRET_SALT == auth.FAKE_SECRET_SALT:
        raise ValueError('Set the prod SECRET_SALT env var before continuing.')
    this_campaign = campaign.get_campaign(campaign_id)
    template_id = this_campaign.mailjet_template
    selected_users = _USER_DB.user.find(dict(this_campaign.mongo_filters, **{
        'profile.email': {
            '$not': re.compile(r'@example.com$'),
            '$regex': re.compile(r'@'),
        },
        'registeredAt': {
            '$gt': registered_from,
            '$lt': registered_to,
        }
    }))
    email_count = 0
    email_errors = 0
    users_processed_count = 0
    users_wrong_hash_count = 0
    users_stopped_seeking = 0
    email_policy_rejections = 0
    no_template_vars_count = 0

    for user_dict in selected_users:
        users_processed_count += 1

        user_id = user_dict.pop('_id')
        user = proto.create_from_mongo(user_dict, user_pb2.User)
        user.user_id = str(user_id)

        if user_hash and not user.user_id.startswith(user_hash):
            users_wrong_hash_count += 1
            continue

        # Do not send emails to users who said they have stopped seeking.
        if any(status.seeking == user_pb2.STOP_SEEKING for status in user.employment_status):
            users_stopped_seeking += 1
            continue

        if not email_policy.can_send(campaign_id, user.emails_sent):
            email_policy_rejections += 1
            continue

        template_vars = this_campaign.get_vars(user, _DB)
        if not template_vars:
            no_template_vars_count += 1
            continue

        if action == 'list':
            logging.info('%s %s', user.user_id, user.profile.email)
            continue

        if action == 'dry-run':
            user.profile.email = dry_run_email
        if action in ('dry-run', 'send'):
            res = mail.send_template(
                template_id, user.profile, template_vars,
                sender_email=this_campaign.sender_email, sender_name=this_campaign.sender_name)
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
        _USER_DB.user.update_one({'_id': user_id}, {'$set': {
            'emailsSent': json_format.MessageToDict(user).get('emailsSent', []),
        }})
        email_count += 1
        if email_count % 100 == 0:
            print('{} emails sent ...'.format(email_count))

    logging.info('{:d} users processed.'.format(users_processed_count))
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
        help='Process a dry run and send email to this email adress.')
    parser.add_argument(
        '--user-hash', help='Only send to users whose ID starts with this given hash. WARNING: \
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
        dry_run_email=args.dry_run_email, user_hash=args.user_hash, email_policy=policy))


if __name__ == '__main__':
    main()  # pragma: no cover
