"""Script to get back typeform employment survey answers to mongoDB."""
import argparse
import logging
import os
from urllib import parse
import time

from google.protobuf import json_format
import pymongo
import requests

from bob_emploi.frontend.api import user_pb2

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()


# Documentation about how to use typeform api: https://www.typeform.com/help/data-api/ .
TYPEFORM_API_URL = 'https://api.typeform.com/v1/form/{}?{}'
TYPEFORM_API_KEY = os.getenv('TYPEFORM_API_KEY', 'fake234234')

_SURVEYS = [
    # Survey for still seeking users: https://admin.typeform.com/form/4787593/fields/#/ .
    {
        # You can find the following ID in the page mentioned above, in url to pass hidden
        # variables.
        'id': 'hn10ya',
        'seeking': user_pb2.STILL_SEEKING,
        'questions': {
            # Those fields cannot be found on Typeform site for now, you can find them by looking
            # at the api's data. Verbose mode will help for that.
            'situation': 'list_62799756_choice',
            'bobHasHelped': 'list_62727692_choice',
        },
    },
    # Survey for users who stopped seeking: https://admin.typeform.com/form/4932130/fields/#/ .
    {
        'id': 'jEnbMx',
        'seeking': user_pb2.STOP_SEEKING,
        'questions': {
            'situation': 'list_ZG8hSuiwD3YY_choice',
            'bobHasHelped': 'list_FInQVJzQr71J_choice',
        },
    },
]

# Maps real answers to standardized strings.
_SITUATION_MAPPING = {
    'Je cherche toujours un emploi': 'SEEKING',
    "J'ai un travail, mais je cherche encore": 'WORKING',
    "J'ai un travail": 'WORKING',
    'Je suis en formation': 'FORMATION',
    "C'est compliqué": 'COMPLICATED',
}

# Map real answers to standardized strings.
_BOB_HAS_HELP_MAPPING = {
    'Oui, vraiment décisif': 'YES_A_LOT',
    "Oui, ça m'a aidé": 'YES',
    'Non, pas du tout': 'NO',
}

_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')


def call_typeform_api(survey_id, since_timestamp, offset, limit):
    """Call typeform API and return response as dict."""
    url = TYPEFORM_API_URL.format(
        survey_id,
        parse.urlencode({
            'key': TYPEFORM_API_KEY,
            'since': since_timestamp,
            'completed': 'true',
            'offset': offset,
            'limit': limit
        }))
    response = requests.get(url)
    if response.status_code != 200:
        logging.error('got http status %s when calling %s', response.status_code, url)
        return None
    return response.json()


def iter_survey_responses(survey, since_timestamp, limit):
    """Iterate through survey responses, using typeform API in a paginated way."""
    offset = 0
    while True:
        # Call Typeform API.
        json_response = call_typeform_api(survey['id'], since_timestamp, offset, limit)

        # Check questions in case we have changed them.
        target_questions = set(survey['questions'].values())
        survey_questions = set(question['id'] for question in json_response['questions'])
        remaining_questions = target_questions - survey_questions
        if remaining_questions:
            logging.error('cannot find some questions in results: %s', remaining_questions)
            logging.debug('survey questions are:')
            logging.debug(json_response['questions'])
            return

        # Yield responses.
        for item in json_response['responses']:
            yield item

        # Check if we should call again to get more responses.
        if len(json_response['responses']) < limit:
            break
        offset += limit


def survey_response_to_bob_data(survey, response):
    """Process Typeform response dict to get data that will be used to call Bob API."""
    user_id = response['hidden']['user']
    token = response['hidden'].get('token', '')
    if not token:
        # First survey version did not store token correctly.
        # Try to retrieve token from referer
        referer_params = dict(parse.parse_qsl(
            parse.urlparse(response['metadata']['referer']).query))
        token = referer_params['token']
    if not token:
        logging.error('cannot handle response from user %s, missing token !', user_id)
    employment_status = user_pb2.EmploymentStatus()
    employment_status.seeking = survey['seeking']
    json_format.ParseDict(
        dict((field, response['answers'][question_id]) for field, question_id in
             survey['questions'].items()),
        employment_status)
    if employment_status.situation not in _SITUATION_MAPPING:
        logging.critical('missing situation mapping for %s', employment_status.situation)
        return None
    if employment_status.bob_has_helped not in _BOB_HAS_HELP_MAPPING:
        logging.critical('missing bob_has_help mapping for %s', employment_status.bob_has_helped)
        return None
    return {
        'user': user_id,
        'token': token,
        'id': response['hidden']['id'],
        'seeking': survey['seeking'],
        'situation': _SITUATION_MAPPING.get(employment_status.situation),
        'bobHasHelped': _BOB_HAS_HELP_MAPPING.get(employment_status.bob_has_helped),
    }


def sync_employment_status(surveys, since_timestamp, dry_run=True, nb_responses_per_call=200):
    """Analyze employment_status survey campaign."""
    nb_responses = 0
    nb_users_to_update = 0
    nb_users_updated = 0
    nb_errors = 0
    for survey in surveys:
        # Iterate through responses.
        for response in iter_survey_responses(survey, since_timestamp, limit=nb_responses_per_call):
            nb_responses += 1
            bob_params = survey_response_to_bob_data(survey, response)
            logging.debug('got bob params: %s', bob_params)
            if bob_params is None:
                continue
            nb_users_to_update += 1
            bob_url = '{}/api/employment-status?{}'.format(_BASE_URL, parse.urlencode(bob_params))
            logging.info('update user %s survey id %s', bob_params['user'], bob_params['id'])
            logging.debug(bob_url)
            if dry_run:
                continue
            bob_response = requests.get(bob_url)
            if bob_response.status_code != 200:
                logging.warning('got response %s when calling %s', bob_response.text, bob_url)
                nb_errors += 1
                continue
            nb_users_updated += 1
    return {
        'nb_responses': nb_responses,
        'nb_users_to_update': nb_users_to_update,
        'nb_users_updated': nb_users_updated,
        'nb_errors': nb_errors,
    }


def main():
    """Parse command line arguments and trigger sync_employment_status function."""
    parser = argparse.ArgumentParser(
        description='Synchronize mongodb employement status fields retrieving typeform data.')
    parser.add_argument(
        '--nb-days', type=int, default=3, help='Retrieve results from the last nb days.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false', help='No dry run really store in db.')
    parser.add_argument('--verbose', '-v', action='store_true', help='More detailed output.')
    args = parser.parse_args()

    logging.basicConfig(level='DEBUG' if args.verbose else 'INFO')

    since_timestamp = int(time.time()) - args.nb_days * 86400
    counters = sync_employment_status(_SURVEYS, since_timestamp, dry_run=args.dry_run)
    logging.info('%d survey responses processed.', counters['nb_responses'])
    logging.info('%d users to update.', counters['nb_users_to_update'])
    logging.info('%d users updated successfully.', counters['nb_users_updated'])
    logging.info('%d errors when updating users.', counters['nb_errors'])

if __name__ == '__main__':
    main()
