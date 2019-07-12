"""Unit tests for the module clean_guests."""

import datetime
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import clean_guests


@mock.patch('logging.info')
class CleanGuestsTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(clean_guests.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_guest_user(self, mock_info: mock.MagicMock) -> None:
        """A guest user gets deleted."""

        self._db.user.insert_one({
            'profile': {'name': 'Cyrille'},
            'registeredAt': '2019-07-03T00:00:00Z',
        })
        clean_guests.main(['--no-dry-run', '--disable-sentry', '--registered-to', '2020'])
        mock_info.assert_called_once_with('Cleaned %d users and got %d errors', 1, 0)
        self.assertEqual('REDACTED', self._db.user.find_one({}).get('profile', {}).get('name'))
        self.assertTrue(self._db.user.find_one({}).get('deletedAt'))

    def test_logged_user(self, mock_info: mock.MagicMock) -> None:
        """A non-guest user doesn't get deleted."""

        self._db.user.insert_one({
            'hasAccount': True,
            'profile': {
                'email': 'cyrille@bayes.org',
                'name': 'Cyrille',
            },
            'registeredAt': '2019-07-03T00:00:00Z',
        })
        clean_guests.main(['--no-dry-run', '--disable-sentry', '--registered-to', '2020'])
        mock_info.assert_called_once_with('Cleaned %d users and got %d errors', 0, 0)
        self.assertEqual('Cyrille', self._db.user.find_one({}).get('profile', {}).get('name'))
        self.assertFalse(self._db.user.find_one({}).get('deletedAt'))

    def test_deleted_user(self, mock_info: mock.MagicMock) -> None:
        """An already deleted user doesn't get more deleted."""

        self._db.user.insert_one({
            'deletedAt': '2019-05-02T00:00:00Z',
            'profile': {'name': 'REDACTED'},
            'registeredAt': '2019-04-03T00:00:00Z',
        })
        clean_guests.main(['--no-dry-run', '--disable-sentry', '--registered-to', '2020'])
        mock_info.assert_called_once_with('Cleaned %d users and got %d errors', 0, 0)
        self.assertEqual('2019-05-02T00:00:00Z', self._db.user.find_one({}).get('deletedAt'))

    def test_days_ago(self, mock_info: mock.MagicMock) -> None:
        """Only users created before the given days delta are deleted."""

        self._db.user.insert_many([{
            'profile': {'name': 'Cyrille'},
            'projects': [{'projectId': str(i)}],
            'registeredAt': proto.datetime_to_json_string(
                datetime.datetime.now() - datetime.timedelta(days=i, hours=1)),
        } for i in range(7)])
        clean_guests.main(['--no-dry-run', '--disable-sentry', '--registered-to-days-ago=3'])
        mock_info.assert_called_once_with('Cleaned %d users and got %d errors', 4, 0)
        self.assertCountEqual(
            ['0', '1', '2'],
            [user['projects'][0]['projectId'] for user in self._db.user.find({'deletedAt': None})])


if __name__ == '__main__':
    unittest.main()
