"""Unit tests for the module sync_amplitude."""

import datetime
import unittest
from unittest import mock

import mongomock
import requests_mock

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import sync_amplitude
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


@requests_mock.mock()
@mock.patch(sync_amplitude.__name__ + '._AMPLITUDE_AUTH', new=('api-key', 'auth-key'))
@nowmock.patch(new=lambda: datetime.datetime(2017, 11, 19))
class SyncAmplitudeTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the module."""

    def test_update_users_client_metrics(self, mock_requests: requests_mock.Mocker) -> None:
        """Test update_users_client_metrics."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            json={'matches': [{'amplitude_id': 42}]})
        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=42',
            json={'events': [
                {'event_time': '2017-10-24 10:41:08.396000'},
                # Event out of order, this one is actually the first of the session.
                {'event_time': '2017-10-24 10:41:00.412000'},
                # Last event of the session: 25 min, 5.1 sec later.
                {'event_time': '2017-10-24 11:06:05.512000'},
                # Event really later: next session.
                {'event_time': '2017-10-24 13:06:05'},
            ]})

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--disable-sentry', '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({}), user)

        self.assertEqual('42', user.client_metrics.amplitude_id)
        self.assertEqual(
            25 * 60 + 5,
            user.client_metrics.first_session_duration_seconds)
        self.assertEqual(boolean_pb2.FALSE, user.client_metrics.is_first_session_mobile)

    def test_unknown_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Test update_users_client_metrics with an unknown user."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            json={'matches': []})

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--disable-sentry', '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({}), user)

        self.assertEqual('Not Found', user.client_metrics.amplitude_id)

    def test_long_continuous_session(self, mock_requests: requests_mock.Mocker) -> None:
        """Test update_users_client_metrics with a user using Bob continuously for an hour."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            json={'matches': [{'amplitude_id': 42}]})
        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=42',
            json={'events': [
                {'event_time': '2017-10-24 10:40:00'},
                {'event_time': '2017-10-24 10:45:08'},
                {'event_time': '2017-10-24 11:06:05'},
                {'event_time': '2017-10-24 11:26:05'},
                {'event_time': '2017-10-24 11:46:05'},
                {'event_time': '2017-10-24 12:05:05'},
            ]})

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--disable-sentry', '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({}), user)

        self.assertEqual('42', user.client_metrics.amplitude_id)
        self.assertEqual(
            85 * 60 + 5,
            user.client_metrics.first_session_duration_seconds)
        self.assertEqual(boolean_pb2.FALSE, user.client_metrics.is_first_session_mobile)

    @mock.patch('logging.info')
    def test_dry_run(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Test update_users_client_metrics."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            json={'matches': [{'amplitude_id': 42}]})
        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=42',
            json={'events': [
                {'event_time': '2017-10-24 10:41:00.412000'},
                {'event_time': '2017-10-24 11:06:05.512000'},
            ]})

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--disable-sentry'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({}), user)

        self.assertFalse(user.client_metrics.amplitude_id)
        self.assertFalse(user.client_metrics.first_session_duration_seconds)
        self.assertFalse(user.client_metrics.is_first_session_mobile)

        mock_logging.assert_called_once()

    def test_too_many_requests(self, mock_requests: requests_mock.Mocker) -> None:
        """Test too many requests."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            status_code=429,
            reason='429 Client Error: Too many requests for url',
        )

        with self.assertRaises(sync_amplitude.TooManyRequestsException):
            sync_amplitude.main([
                '--registered-from', '2017-11-14',
                '--registered-to', '2017-11-18',
                '--disable-sentry', '--no-dry-run'])

    def test_too_many_requests_but_still_enough(self, mock_requests: requests_mock.Mocker) -> None:
        """Test too many requests but already done more than 200."""

        self._user_db.user.insert_many([{
            '_id': mongomock.ObjectId(f'7ed900dbfbebdee97f9e2{i:03d}'),
            'registeredAt': '2017-11-17T10:57:12Z',
        } for i in range(400)])

        # Reply politely to the 300 first.
        for i in range(300):
            mock_requests.get(
                f'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2{i:03d}',
                json={'matches': [{'amplitude_id': i}]},
            )
            mock_requests.get(
                f'https://amplitude.com/api/2/useractivity?user={i}',
                json={'events': []})
        # Then reply with an error 429.
        for i in range(100):
            mock_requests.get(
                f'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2{i + 300:03d}',
                status_code=429,
                reason='429 Client Error: Too many requests for url',
            )

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--disable-sentry', '--no-dry-run'])

        self.assertEqual(
            300,
            len(list(self._user_db.user.find({'clientMetrics.amplitudeId': {'$exists': True}}))))

    def test_registered_from_days_ago(self, mock_requests: requests_mock.Mocker) -> None:
        """Test update_users_client_metrics."""

        self._user_db.user.insert_many([
            {
                '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
                'registeredAt': '2017-11-17T10:57:12Z',
            },
            # User registered just "today" (the day the script is run).
            {
                '_id': mongomock.ObjectId('7ed900dbfbebd00000000004'),
                'registeredAt': '2017-11-19T10:57:12Z',
            },
        ])

        mock_requests.get(
            'https://amplitude.com/api/2/usersearch?user=7ed900dbfbebdee97f9e2332',
            json={'matches': [{'amplitude_id': 42}]})
        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=42',
            json={'events': [
                {
                    'event_time': '2017-10-24 10:41:00.412000',
                    'event_properties': {
                        'Mobile Version': True,
                    },
                },
                # Last event of the session: 25 min, 5.1 sec later.
                {'event_time': '2017-10-24 11:06:05.512000'},
            ]})

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--disable-sentry', '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
        }), user)
        self.assertEqual('42', user.client_metrics.amplitude_id)
        self.assertEqual(
            25 * 60 + 5,
            user.client_metrics.first_session_duration_seconds)
        self.assertEqual(boolean_pb2.TRUE, user.client_metrics.is_first_session_mobile)

    def test_adding_mobile_afterwards(self, mock_requests: requests_mock.Mocker) -> None:
        """Adding the mobile information after already syncing."""

        self._user_db.user.insert_many([
            {
                'registeredAt': '2018-09-03T10:57:12Z',
                'clientMetrics': {'amplitudeId': 'Not Found'},
            },
            {
                '_id': mongomock.ObjectId('7ed900dbfbebd00000000004'),
                'registeredAt': '2018-09-03T10:57:12Z',
                'clientMetrics': {
                    'amplitudeId': '1234',
                    'firstSessionDurationSeconds': 5,
                },
            },
            {
                '_id': mongomock.ObjectId('7ed900dbfbebd00000000999'),
                'registeredAt': '2018-09-03T10:58:12Z',
                'clientMetrics': {
                    'amplitudeId': '5678',
                    'firstSessionDurationSeconds': 10,
                },
            },
            {
                'registeredAt': '2018-09-03T10:58:12Z',
                'clientMetrics': {
                    'amplitudeId': 'REDACTED',
                    'firstSessionDurationSeconds': 10,
                },
            },
        ])

        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=1234&limit=5',
            json={'events': [
                {
                    'event_time': '2017-10-24 10:41:00.412000',
                    'event_properties': {
                        'Mobile Version': True,
                    },
                },
            ]}
        )
        mock_requests.get(
            'https://amplitude.com/api/2/useractivity?user=5678&limit=5',
            json={'events': []}
        )

        sync_amplitude.main([
            '--registered-from', '2018-08-14',
            '--registered-to', '2018-09-04',
            '--disable-sentry', '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(
            self._user_db.user.find_one(mongomock.ObjectId('7ed900dbfbebd00000000004')), user)
        self.assertEqual('1234', user.client_metrics.amplitude_id)
        self.assertEqual(5, user.client_metrics.first_session_duration_seconds)
        self.assertEqual(boolean_pb2.TRUE, user.client_metrics.is_first_session_mobile)

    @mock.patch('logging.error')
    def test_missing_sentry(
            self, unused_mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Missing sentry env var."""

        self._user_db.user.insert_one({
            '_id': mongomock.ObjectId('7ed900dbfbebdee97f9e2332'),
            'registeredAt': '2017-11-17T10:57:12Z',
        })

        sync_amplitude.main([
            '--registered-from', '2017-11-14',
            '--registered-to', '2017-11-18',
            '--no-dry-run'])

        user = user_pb2.User()
        proto.parse_from_mongo(self._user_db.user.find_one({}), user)
        self.assertFalse(user.client_metrics.amplitude_id)

        mock_logging.assert_called_once()


if __name__ == '__main__':
    unittest.main()
