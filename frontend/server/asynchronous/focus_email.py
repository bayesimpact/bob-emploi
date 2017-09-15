"""Script to send focused emails. See http://go/bob:focused-email-prd."""
import csv
import datetime
import itertools
import logging
import os
import re
import sys
from urllib import parse

import pymongo
from google.protobuf import json_format

from bob_emploi.frontend import auth
from bob_emploi.frontend import french
from bob_emploi.frontend import mail
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import user_pb2


_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

_DOMAINS = {}

# There is 2 spaces between the rank (2e, 3e) and the Arrondissement,
# except for the first one where there is only 1 space (i.e 1er Arrondissement).
_DISTRICT_MATCHER = re.compile(r'(\w+)\s(\d+e)r?(\s{1,2}Arrondissement)')


def _import_domains(csv_path):
    with open(csv_path) as csv_file:
        for record in itertools.islice(csv.reader(csv_file), 1, None):
            rome_prefix, domain = record
            if not domain:
                continue
            if len(rome_prefix) not in (1, 2, 3, 5):
                raise ValueError('ROME prefix length should be 1, 2, 3 or 5: %s' % rome_prefix)
            if rome_prefix in _DOMAINS:
                raise ValueError('Duplicate domain name for %s' % rome_prefix)
            _DOMAINS[rome_prefix] = domain


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


def _get_best_in_domain_match(rome_id):
    for prefix_size in (1, 2, 3):
        domain = _DOMAINS.get(rome_id[:prefix_size])
        if domain:
            return domain
    return _DOMAINS.get(rome_id)


def _genderize_job(job, gender):
    if gender == user_pb2.FEMININE and job.feminine_name:
        return job.feminine_name
    if gender == user_pb2.MASCULINE and job.masculine_name:
        return job.masculine_name
    return job.name


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

    in_target_domain = _get_best_in_domain_match(project.target_job.job_group.rome_id)
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
        'jobInCity': '%s %s' % (
            french.lower_first_letter(_genderize_job(project.target_job, user.profile.gender)),
            french.in_city(strip_district(project.mobility.city.name))),
        'emailInUrl': parse.quote(user.profile.email),
        'unsubscribeLink': '%s/unsubscribe.html?email=%s&auth=%s' % (
            _BASE_URL, parse.quote(user.profile.email),
            parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))),
    }


def main():
    """Send an email to a user to tell them to focus on the network."""
    campaign_id = 'focus-network'
    template_id = '205970'
    email_count = 0
    selected_users = _DB.user.find({
        'registeredAt': {
            '$gt': '2017-04-01',
            '$lt': '2017-07-10',
        },
        'projects.networkEstimate': 1,
    })
    for user_dict in selected_users:
        user_id = user_dict.pop('_id')
        user = user_pb2.User()
        proto.parse_from_mongo(user_dict, user)

        if any(email.campaign_id == campaign_id for email in user.emails_sent):
            # We already sent the email to that person.
            continue

        template_vars = network_vars(user)
        if not template_vars:
            continue

        req = mail.send_template(template_id, user.profile, template_vars)
        print('Email sent to %s' % user.profile.email)

        if req.status_code != 200:
            logging.warning('Error while sending an email: %d', req.status_code)
            continue

        email_sent = user.emails_sent.add()
        email_sent.sent_at.GetCurrentTime()
        email_sent.mailjet_template = template_id
        email_sent.campaign_id = campaign_id
        _DB.user.update_one({'_id': user_id}, {'$set': {
            'emailsSent': json_format.MessageToDict(user).get('emailsSent', []),
        }})
        email_count += 1

    return email_count


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('''Usage: focus_email.py <path_to_domains.csv>

You can download the CSV at https://airtable.com/tbl5jBDdG3vnYPWNu/viwz9GaBDHEpjTCU9''')
        sys.exit(1)
    _import_domains(sys.argv[1])
    print('%d emails sent.' % main())
