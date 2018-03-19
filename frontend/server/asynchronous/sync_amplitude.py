"""Script to sync Amplitude metrics with MongoDB."""

import argparse
import datetime
import logging
import os

from google.protobuf import json_format
import requests

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous import report

_, _DB = mongo.get_connections_from_env()

_AMPLITUDE_API_URL = 'https://amplitude.com/api/2'
_AMPLITUDE_AUTH = (os.getenv('AMPLITUDE_API_KEY'), os.getenv('AMPLITUDE_SECRET_KEY'))

# Min duration of idle time before we consider a session as over.
_SESSION_CUT_DURATION = datetime.timedelta(minutes=30)

# User ID set when user cannot be found on Amplitude.
_AMPLITUDE_ID_NOT_FOUND = 'Not Found'


class TooManyRequestsException(IOError):
    """Too many requests to the Amplitude API."""


def _account_for_api_requests_limit(response):
    if response.status_code == 429:
        raise TooManyRequestsException(
            'Too many requests to the Amplitude API.\n'
            'Requests to the User Activity/User Search are limited to 360 per hour.\n'
            'https://amplitude.zendesk.com/hc/en-us/articles/205469748#user-activity-user-search\n'
            'Try again later.')


def _get_amplitude_id(user_id):
    response = requests.get(
        '{}/usersearch'.format(_AMPLITUDE_API_URL),
        auth=_AMPLITUDE_AUTH,
        params={'user': user_id})
    _account_for_api_requests_limit(response)
    response.raise_for_status()
    try:
        return str(next(match['amplitude_id'] for match in response.json()['matches']))
    except StopIteration:
        raise KeyError('No user "{}" found in Amplitude.'.format(user_id))


def _get_amplitude_events(amplitude_id):
    response = requests.get(
        '{}/useractivity'.format(_AMPLITUDE_API_URL),
        auth=_AMPLITUDE_AUTH,
        params={'user': amplitude_id})
    _account_for_api_requests_limit(response)
    response.raise_for_status()
    return response.json()['events']


def _parse_time(amplitude_time):
    """Parse an Amplitude date time which might contain milliseconds."""

    try:
        return datetime.datetime.strptime(amplitude_time, '%Y-%m-%d %H:%M:%S.%f')
    except ValueError:
        return datetime.datetime.strptime(amplitude_time, '%Y-%m-%d %H:%M:%S')


def compute_first_session_duration(events):
    """Compute the duration of the user's first session."""

    if not events:
        return datetime.timedelta()

    sorted_times = sorted(_parse_time(event['event_time']) for event in events)
    if sorted_times[-1] - sorted_times[0] < _SESSION_CUT_DURATION:
        return sorted_times[-1] - sorted_times[0]

    for i, time in enumerate(sorted_times):
        try:
            next_time = sorted_times[i + 1]
        except IndexError:
            break

        if next_time - time >= _SESSION_CUT_DURATION:
            return time - sorted_times[0]

    return sorted_times[-1] - sorted_times[0]


def update_users_client_metrics(user_collection, from_date, to_date, dry_run=True):
    """Update user data with client-side metrics from Amplitude."""

    users = user_collection.find({
        'registeredAt': {'$gt': from_date, '$lt': to_date},
        'clientMetrics.amplitudeId': {'$exists': False},
    }, projection={'_id': 1})
    num_users_updated = 0
    for user in users:
        try:
            _update_user_client_metric(user_collection, user, dry_run)
        except TooManyRequestsException:
            # The API is limited to 360 requests, so if we manage to get 200
            # users it's expected to get an error here: no need to warn Sentry.
            if num_users_updated > 200:
                logging.info('Too many requests after updating %d users', num_users_updated)
                return
            raise
        num_users_updated += 1


def _update_user_client_metric(user_collection, user, dry_run):
    user_id = user['_id']

    updated_user = user_pb2.User()
    try:
        amplitude_id = _get_amplitude_id(user_id)
        updated_user.client_metrics.amplitude_id = amplitude_id
        is_user_found = True
    except KeyError:
        logging.info('Could not find user "%s" on Amplitude.', user_id)
        updated_user.client_metrics.amplitude_id = _AMPLITUDE_ID_NOT_FOUND
        is_user_found = False

    if is_user_found:
        events = _get_amplitude_events(amplitude_id)
        first_session_duration = compute_first_session_duration(events)
        updated_user.client_metrics.first_session_duration_seconds = \
            round(first_session_duration.total_seconds())

    dict_update = json_format.MessageToDict(updated_user)
    if dry_run:
        logging.info('Update user "%s":\n%s', user_id, dict_update)
    else:
        user_collection.update_one(user, {'$set': dict_update})


def main(string_args=None):
    """Parse command line arguments and trigger the update_users_client_metrics function."""

    parser = argparse.ArgumentParser(
        description='Synchronize MongoDB client metrics fields from Amplitude')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
    parser.add_argument(
        '--registered-from', help='Consider only users who registered after this date.')
    yesterday = str((now.get() - datetime.timedelta(days=1)).date())
    parser.add_argument(
        '--registered-to', default=yesterday,
        help='Consider only users who registered before this date.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false', help='No dry run really store in DB.')

    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')
    if not args.dry_run and not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    update_users_client_metrics(
        _DB.user, from_date=args.registered_from, to_date=args.registered_to,
        dry_run=args.dry_run)


if __name__ == '__main__':
    main()  # pragma: no-cover
