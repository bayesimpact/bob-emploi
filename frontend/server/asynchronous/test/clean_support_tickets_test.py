"""Unit tests for the module clean_guests."""

import datetime
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous import clean_support_tickets


@mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2019, 10, 4))
@mock.patch('logging.info')
class CleanSupportTicketsTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(clean_support_tickets.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_user_with_old_ticket(self, mock_info: mock.MagicMock) -> None:
        """An old support ticket gets deleted."""

        self._db.user.insert_one({
            'supportTickets': [{
                'ticketId': 'support-id',
                'deleteAfter': '2019-10-01',
            }]
        })
        clean_support_tickets.main(['--disable-sentry'])
        self.assertNotIn('supportTickets', self._db.user.find_one({}))
        mock_info.assert_has_calls([
            mock.call('Removed deprecated support tickets for %d users.', 1),
            mock.call('Removed empty support ticket list for %d users.', 1)])

    def test_user_with_recent_ticket(self, mock_info: mock.MagicMock) -> None:
        """A new support ticket doesn't get deleted."""

        user = {
            'supportTickets': [{
                'ticketId': 'support-id',
                'deleteAfter': '2019-10-05'
            }]
        }
        self._db.user.insert_one(user)
        clean_support_tickets.main(['--disable-sentry'])
        mock_info.assert_called_once_with('Removed deprecated support tickets for %d users.', 0)
        user.pop('_id', None)
        db_user = self._db.user.find_one({})
        db_user.pop('_id')
        self.assertEqual(user, db_user)

    def test_user_with_several_tickets(self, mock_info: mock.MagicMock) -> None:
        """All deprecated tickets of given users are deleted."""

        self._db.user.insert_one({
            'supportTickets': [{
                'ticketId': f'support-id-{days}',
                'deleteAfter': f'2019-10-{days:02d}'
            } for days in range(1, 10, 2)]
        })
        clean_support_tickets.main(['--disable-sentry'])
        mock_info.assert_called_once_with('Removed deprecated support tickets for %d users.', 1)
        db_user = self._db.user.find_one({})
        self.assertEqual(
            ['support-id-5', 'support-id-7', 'support-id-9'],
            [ticket.get('ticketId') for ticket in db_user.get('supportTickets', [])])

    def test_several_users(self, mock_info: mock.MagicMock) -> None:
        """All users are cleaned up of old tickets."""

        self._db.user.insert_many([{
            'supportTickets': [{
                'ticketId': f'support-id-{user}',
                'deleteAfter': f'2019-10-{user:02d}'
            }],
        } for user in range(1, 10, 2)])
        clean_support_tickets.main(['--disable-sentry'])
        mock_info.assert_has_calls([
            mock.call('Removed deprecated support tickets for %d users.', 2),
            mock.call('Removed empty support ticket list for %d users.', 2)])


if __name__ == '__main__':
    unittest.main()
