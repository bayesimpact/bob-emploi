"""Tests for the update_email_sent_status module."""

import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous import update_email_sent_status


class MainTestCase(unittest.TestCase):
    """Unit tests for the update_email_sent_status module."""

    @mock.patch(update_email_sent_status.__name__ + '.mail')
    def test_with_message_id(self, mock_mail):
        """Test retrieving info when message ID is present."""

        mock_mail.get_message.return_value = {
            'ArrivedAt': '2017-09-08T09:25:48Z',
            'ID': 6789,
            'Comment': 'Right message, arrived 2 seconds after being sent',
            'Status': 'opened',
        }
        database = mongomock.MongoClient().test
        database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-09-08T09:25:46.145001Z',
                'mailjetMessageId': 6789,
            }],
        })
        update_email_sent_status.main(database)
        updated_data = database.user.find_one()
        self.assertEqual('field', updated_data.get('other'))
        self.assertEqual(
            6789, int(updated_data.get('emailsSent')[0].get('mailjetMessageId')))
        self.assertEqual(
            'EMAIL_SENT_OPENED',
            updated_data.get('emailsSent')[0].get('status'))

    @mock.patch(update_email_sent_status.__name__ + '.now')
    @mock.patch(update_email_sent_status.__name__ + '.mail')
    def test_refresh_old_status(self, mock_mail, mock_now):
        """Test retrieving info when message ID is present."""

        database = mongomock.MongoClient().test

        # On Nov. the 5th, the email had been opened.
        mock_now.get.return_value = datetime.datetime(2017, 11, 5, 15, 13)
        mock_mail.get_message.return_value = {
            'ArrivedAt': '2017-10-28T09:25:48Z',
            'ID': 6789,
            'Status': 'opened',
        }
        database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-10-28T09:25:46.145001Z',
                'mailjetMessageId': 6789,
            }],
        })
        update_email_sent_status.main(database)

        # A week later the email link had been clicked.
        mock_now.get.return_value = datetime.datetime(2017, 11, 13, 15, 13)
        mock_mail.get_message.return_value = {
            'ArrivedAt': '2017-10-28T09:25:48Z',
            'ID': 6789,
            'Status': 'clicked',
        }
        update_email_sent_status.main(database)

        updated_data = database.user.find_one()
        self.assertEqual(
            'EMAIL_SENT_CLICKED',
            updated_data.get('emailsSent')[0].get('status'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
