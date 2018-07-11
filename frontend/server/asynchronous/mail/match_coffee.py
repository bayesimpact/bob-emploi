"""Script to match users with helpers to meet for coffee.
"""

import argparse
import logging
import math
import os
import re

from bson import objectid
from google.protobuf import json_format
import requests

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign

_DB, _USER_DB = mongo.get_connections_from_env()

_SENIORITY_LEVEL = {
    project_pb2.UNKNOWN_PROJECT_SENIORITY: 'souhaite travailler',
    project_pb2.INTERNSHIP: 'a déjà fait des stages',
    project_pb2.JUNIOR: "a moins de 2 ans d'expérience",
    project_pb2.INTERMEDIARY: "a entre 2 et 6 ans d'expérience",
    project_pb2.SENIOR: "a plus de 6 ans d'expérience",
    project_pb2.EXPERT: "a plus de 10 ans d'expérience",
}

_PROJECT_KIND = {
    project_pb2.FIND_A_NEW_JOB: "est à la recherche d'un nouvel emploi",
    project_pb2.REORIENTATION: 'est en reconversion',
    project_pb2.FIND_A_FIRST_JOB: 'cherche un premier emploi',
    project_pb2.FIND_ANOTHER_JOB: 'est déjà en poste et cherche un autre emploi',
    project_pb2.CREATE_OR_TAKE_OVER_COMPANY: 'veut créer ou reprendre une activité',
}

_HELPABLE_USERS = proto.MongoCachedCollection(user_pb2.User, 'user', query={
    'profile.email': re.compile('.+@.+'),
    'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    'mayday.hasAcceptedCoffee': 'TRUE',
    'mayday.coffeeHelperId': {'$exists': False},
})

_POSSIBLE_HELPERS = proto.MongoCachedCollection(helper_pb2.Helper, 'helper', query={
    'email': re.compile('.+@.+'),
    'domains': {'$exists': True},
    'emailConfirmed': True,
    'excludeFromAnalytics': {'$ne': True},
    'promises.kind': 'HELP_COFFEE',
})

_JOB_GROUP_INFO = proto.MongoCachedCollection(job_pb2.JobGroup, 'job_group_info')

_ELIDABLE_REGEXP = re.compile(r'^[aeiouy]', re.IGNORECASE)

# https://app.mailjet.com/template/396186/build
_MAILJET_TEMPLATE = '396186'

# Cache for city coordinates. It's populated once we have a database in which to look.
_CITIES = {}

_SQUARE_DEGREES_TO_SQUARE_KMS = 111.7 * 111.7

_EMAIL_DOT_REGEXP = re.compile(r'\.')


def _get_city_location(city_id, database, users_database):
    if city_id in _CITIES:
        return _CITIES[city_id]
    # Populate _CITIES.
    city_ids = {
        user.projects[0].city.city_id or user.projects[0].mobility.city.city_id
        for user in _HELPABLE_USERS.get_collection(users_database)
    } | {
        city.city_id
        for helper in _POSSIBLE_HELPERS.get_collection(users_database)
        for city in helper.cities
    }
    fetched_cities = proto.MongoCachedCollection(
        geo_pb2.FrenchCity, 'cities', query={'_id': {'$in': list(city_ids)}}
    ).get_collection(database)
    _CITIES.update(fetched_cities)
    return _CITIES[city_id]


# TODO(cyrille): Factorize with create_your_company.py in geo.py
def _distance_between_cities(city_a, city_b):
    delta_lat = abs(city_a.latitude - city_b.latitude)
    delta_lng = abs(city_a.longitude - city_b.longitude)
    lng_stretch = math.cos(math.radians(city_a.longitude))
    delta_lng_stretched = delta_lng * lng_stretch
    return delta_lng_stretched * delta_lng_stretched + delta_lat * delta_lat


def _match_domains(user_rome_id, helper_domains):
    for domains in helper_domains:
        for domain in domains.split(','):
            if user_rome_id.startswith(domain):
                return True
    return False


def _remove_dots(account):
    return re.sub(_EMAIL_DOT_REGEXP, '', account)


def _same_email(user_email, helper_email):
    """Match can be done if emails are different."""

    user_account, user_server = user_email.split('@')
    if user_server != 'gmail.com':
        return user_email == helper_email
    helper_account, helper_server = helper_email.split('@')
    if helper_server != 'gmail.com':
        return False
    return _remove_dots(user_account) == _remove_dots(helper_account)


def _score_location(project, helper, database, users_database):
    city_id = project.city.city_id or project.mobility.city.city_id
    if city_id in (city.city_id for city in helper.cities):
        return (2, 'in {}'.format(project.city.name or project.mobility.city.name))
    area_type = project.area_type or project.mobility.area_type
    if area_type >= geo_pb2.DEPARTEMENT and helper.cities:
        user_coordinates = _get_city_location(city_id, database, users_database)
        score_closest = 0
        closest_city = ''
        for city in helper.cities:
            distance = _SQUARE_DEGREES_TO_SQUARE_KMS * _distance_between_cities(
                user_coordinates, _get_city_location(city.city_id, database, users_database))
            # If closest is at less than 1km, don't bother differentiating from being in the same
            # city.
            if distance < 1:
                score_closest = 2
                closest_city = city.name
                break
            new_score = 1 + 1 / distance
            if new_score > score_closest:
                score_closest = new_score
                closest_city = city.name
        # Don't say cities are close if they are more than 20km apart.
        if score_closest > 1.0025:
            return (score_closest, 'between {} and {} (less than {:4.1f}km)'.format(
                project.city.name or project.mobility.city.name,
                closest_city, math.sqrt(1 / (score_closest - 1))))
    if helper.is_available_remotely:
        return (1, 'online')
    return 0


def _score_match(user, helper, database, users_database):
    project = user.projects[0]
    if not project:
        return 0
    if _same_email(user.profile.email, helper.email):
        return 0
    if not _match_domains(project.target_job.job_group.rome_id, helper.domains):
        return 0
    return _score_location(project, helper, database, users_database)


def get_matching_user(helper, users_database, database):
    """Returns a user who could be matched with the helper for a coffee, and removes them from the
    cached list of helpable users."""

    all_users = _HELPABLE_USERS.get_collection(users_database)
    user_scores = {}
    for user_id, user in all_users.items():
        score = _score_match(user, helper, database, users_database)
        if score:
            user_scores[user_id] = score
    if not user_scores:
        return None
    user_id = max(user_scores.keys(), key=user_scores.__getitem__)
    score, location = user_scores[user_id]
    return user_id, all_users.pop(user_id), score, location


def _match_maker_vars(helper, users_database=None, database=None, **unused_kwargs):
    for promise_index, promise in enumerate(helper.promises):
        if promise.is_fulfilled or promise.kind != helper_pb2.HELP_COFFEE:
            continue
        try:
            match, user, score, location = get_matching_user(helper, users_database, database)
        except TypeError:
            logging.warning('Helper %s cannot help any more users', helper.user_id)
            return
        user.user_id = match
        user.mayday.coffee_helper_id = helper.user_id
        project = user.projects[0]
        in_domain = _JOB_GROUP_INFO.get_collection(database)[
            project.target_job.job_group.rome_id].in_domain
        first_name = french.cleanup_firstname(user.profile.name)
        elided_first_name_prefix = "'" if _ELIDABLE_REGEXP.search(first_name) else 'e '
        yield {
            **campaign.get_default_vars(user),
            'elidedFirstName': elided_first_name_prefix + first_name,
            'helperId': helper.user_id,
            'inDomain': in_domain,
            'isOnline': campaign.as_template_boolean(score == 1),
            'location': location,
            'projectKind': _PROJECT_KIND.get(project.kind, 'cherche un emploi'),
            'promiseIndex': promise_index,
            'seniority': _SENIORITY_LEVEL[project.seniority],
            'user': user,
        }


def _send_matching_email(
        helper, user, template_vars, _user_db, dry_run=True, dry_run_email='cyrille@bayes.org'):
    other_recipients = [user.profile]
    promise_index = template_vars.pop('promiseIndex')
    if dry_run:
        other_recipients = []
        helper.email = dry_run_email
    res = mail.send_template(
        _MAILJET_TEMPLATE, helper, template_vars, other_recipients=other_recipients,
        sender_name='Pascal de Bob', sender_email='pascal@bob-emploi.fr')
    if dry_run:
        res.raise_for_status()
        # Don't send to any more people in dry-run. Don't change the database either.
        return
    elif res.status_code != 200:
        logging.warning('Error while sending an email: %d', res.status_code)
        return False

    email_sents = list(mail.create_email_sent_protos(res))
    for email_sent in email_sents:
        email_sent.mailjet_template = _MAILJET_TEMPLATE
        email_sent.campaign_id = 'mayday-match-coffee'

    _user_db.helper.update_one(
        {'_id': objectid.ObjectId(helper.user_id)},
        {
            '$push': {'emailsSent': json_format.MessageToDict(email_sents[0])},
            '$set': {
                'promises.{}.isFulfilled'.format(promise_index): True,
                'promises.{}.fulfilledAt'.format(promise_index):
                    proto.datetime_to_json_string(now.get()),
            }
        })
    report.notify_slack(':tada: A #BobAction promise was fulfilled for HELP_COFFEE {}'.format(
        template_vars['location']))

    _user_db.user.update_one(
        {'_id': objectid.ObjectId(user.user_id)},
        {
            '$push': {'emailsSent': json_format.MessageToDict(email_sents[0])},
            '$set': {'mayday.coffeeHelperId': helper.user_id},
        })
    return True


def blast_matches(action, dry_run_email):
    """Match users interested in meeting for a coffee with helpers willing to."""

    email_errors = 0
    email_count = 0
    dry_run = action == 'dry-run'
    for helper_id, helper in _POSSIBLE_HELPERS.get_collection(_USER_DB).items():
        helper.user_id = helper_id
        for template_vars in _match_maker_vars(helper, users_database=_USER_DB, database=_DB):
            user = template_vars.pop('user')
            if action == 'list':
                logging.info(
                    'User %s matched with helper %s %s',
                    user.user_id, helper_id, template_vars['location'])
                continue
            try:
                if not _send_matching_email(
                        helper, user, template_vars, _USER_DB,
                        dry_run=dry_run, dry_run_email=dry_run_email) and not dry_run:
                    email_errors += 1
                else:
                    email_count += 1
                    if email_count % 100 == 0:
                        print('{} emails sent ...'.format(email_count))
            except requests.exceptions.HTTPError:
                raise ValueError('Could not send email for vars:\n{}'.format(template_vars))
            if dry_run:
                break
        if dry_run:
            break
    # TODO(cyrille): Show results (error count, sent count) in logs.
    return email_count


def main(string_args=None):
    """Parse command line arguments and send mails."""

    parser = argparse.ArgumentParser(description='Send coffee matching emails.')
    parser.add_argument(
        'action', choices=('dry-run', 'list', 'send'), default='dry-run',
        help='Whether to process to a dry run, list all makable matches, or really send emails.')
    parser.add_argument(
        '--dry-run-email', default='cyrille@bayes.org',
        help="If action is dry-run, email is sent to this address rather than the user's.")
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

    logging.info('%d emails sent.', blast_matches(args.action, dry_run_email=args.dry_run_email))


if __name__ == '__main__':
    main()  # pragma: no cover
