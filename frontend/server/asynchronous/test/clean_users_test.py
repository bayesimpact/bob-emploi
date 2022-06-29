"""Unit tests for the module clean_users."""

import datetime
import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import clean_users
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


def _zulu_time_to_datetime(date: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(date.replace('Z', ''))


@mock.patch('logging.info')
class CleanUsersTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = self._user_db

    def test_guest_user(self, mock_info: mock.MagicMock) -> None:
        """A guest user gets deleted."""

        self._db.user.insert_one({
            'profile': {'name': 'Cyrille'},
            'requestedByUserAtDate': '2019-07-03T00:00:00Z',
        })
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 1, 0, 0)
        db_user = self._db.user.find_one({})
        assert db_user
        self.assertEqual('REDACTED', db_user.get('profile', {}).get('name'))
        self.assertTrue(db_user.get('deletedAt'))

    def test_old_user(self, mock_info: mock.MagicMock) -> None:
        """An inactive user gets deleted."""

        self._db.user.insert_one({
            'hasAccount': True,
            'profile': {'name': 'Sil'},
            'registeredAt': '2014-07-03T00:00:00Z',
            'emailsSent': [{
                'campaignId': 'account-deletion-notice',
                'sentAt': proto.datetime_to_json_string(
                    datetime.datetime.today() - datetime.timedelta(days=9))
            }],
            'requestedByUserAtDate': '2014-07-10T00:00:00Z'
        })
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 1, 0, 0)
        db_user = self._db.user.find_one({})
        assert db_user
        self.assertEqual('REDACTED', db_user.get('profile', {}).get('name'))
        self.assertTrue(db_user.get('deletedAt'))

    def test_recent_email_reader(self, mock_info: mock.MagicMock) -> None:
        """A user that has read an email in the pas 2 months doesn't get deleted."""

        self._db.user.insert_one({
            'hasAccount': True,
            'profile': {'name': 'Sil'},
            'registeredAt': '2014-07-03T00:00:00Z',
            'emailsSent': [{
                'campaignId': 'christmas',
                'sentAt': proto.datetime_to_json_string(
                    datetime.datetime.now() - datetime.timedelta(days=79)),
                'status': email_pb2.EMAIL_SENT_OPENED
            }],
            'requestedByUserAtDate': '2014-07-10T00:00:00Z'
        })
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 0, 1, 0)
        db_user = self._db.user.find_one({})
        assert db_user
        self.assertFalse(db_user.get('deletedAt'))

    def test_returned_old_user(self, mock_info: mock.MagicMock) -> None:
        """An inactive user back on Bob doesn't get deleted."""

        self._db.user.insert_one({
            'hasAccount': True,
            'profile': {'name': 'Sil'},
            'registeredAt': '2014-07-03T00:00:00Z',
            'emailsSent': [{
                'campaignId': 'whatever-email',
                'sentAt': proto.datetime_to_json_string(
                    datetime.datetime.now() - datetime.timedelta(days=12))
            }],
            'requestedByUserAtDate': proto.datetime_to_json_string(
                datetime.datetime.now() - datetime.timedelta(days=10))
        })
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 0, 1, 0)
        db_user = self._db.user.find_one({})
        assert db_user
        req_user_by_date = _zulu_time_to_datetime(db_user.get('requestedByUserAtDate'))
        chck_for_deletion_date = _zulu_time_to_datetime(db_user.get('checkForDeletionDate'))

        self.assertEqual('Sil', db_user.get('profile', {}).get('name'))
        self.assertFalse(db_user.get('deletedAt'))
        self.assertEqual(
            req_user_by_date.replace(microsecond=0) + datetime.timedelta(days=90),
            chck_for_deletion_date.replace(microsecond=0))

    def test_deleted_user(self, mock_info: mock.MagicMock) -> None:
        """An already deleted user doesn't get more deleted."""

        self._db.user.insert_one({
            'deletedAt': '2019-05-02T00:00:00Z',
            'profile': {'name': 'REDACTED'},
            'requestedByUserAtDate': '2019-04-03T00:00:00Z',
        })
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 0, 0, 0)
        db_user = self._db.user.find_one({})
        assert db_user
        self.assertEqual('2019-05-02T00:00:00Z', db_user.get('deletedAt'))

    def test_days_ago(self, mock_info: mock.MagicMock) -> None:
        """Only guests users connected before the 1 week period are deleted."""

        self._db.user.insert_many([{
            'profile': {'name': 'Cyrille'},
            'projects': [{'projectId': str(i)}],
            'requestedByUserAtDate': proto.datetime_to_json_string(
                datetime.datetime.now() - datetime.timedelta(days=i, hours=1)),
        } for i in range(4, 11)])
        clean_users.main(['--no-dry-run', '--disable-sentry'])
        mock_info.assert_called_once_with(
            'Cleaned %d users, set check date for %d users and got %d errors', 4, 3, 0)
        self.assertCountEqual(
            ['4', '5', '6'],
            [user['projects'][0]['projectId'] for user in self._db.user.find({'deletedAt': None})])


if __name__ == '__main__':
    unittest.main()
