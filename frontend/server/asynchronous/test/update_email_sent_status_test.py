"""Tests for the update_email_sent_status module."""

import datetime
import typing
import unittest
from unittest import mock

import mailjet_rest
import mongomock

from bob_emploi.frontend.server.asynchronous import update_email_sent_status
from bob_emploi.frontend.server.test import mailjetmock


@mailjetmock.patch()
class MainTestCase(unittest.TestCase):
    """Unit tests for the update_email_sent_status module."""

    def setUp(self) -> None:
        super().setUp()
        self.database = mongomock.MongoClient().test
        db_patcher = mock.patch(update_email_sent_status.__name__ + '._DB', self.database)
        db_patcher.start()
        self.addCleanup(db_patcher.stop)

    def _send_email(self, email_address: str = 'hello@example.com') -> int:
        return typing.cast(int, mailjet_rest.Client(version='v3.1').send.create({'Messages': [{
            'To': [{'Email': email_address}],
            'TemplateID': 123456,
        }]}).json()['Messages'][0]['To'][0]['MessageID'])

    def test_with_message_id(self) -> None:
        """Test retrieving info when message ID is present."""

        message_id = self._send_email('pascal@example.com')

        self.database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-09-08T09:25:46.145001Z',
                'mailjetMessageId': message_id,
            }],
        })

        # Mark the message as opened.
        mailjetmock.get_message(message_id).open()

        update_email_sent_status.main(['--disable-sentry'])

        updated_data = self.database.user.find_one()
        assert updated_data
        self.assertEqual('field', updated_data.get('other'))
        self.assertEqual(
            message_id, int(updated_data.get('emailsSent')[0].get('mailjetMessageId')))
        self.assertEqual(
            'EMAIL_SENT_OPENED',
            updated_data.get('emailsSent')[0].get('status'))

    @mock.patch(update_email_sent_status.__name__ + '.now')
    def test_refresh_old_status(self, mock_now: mock.MagicMock) -> None:
        """Test refreshing old status."""

        # On Nov. the 5th, the email had been opened.
        message_id = self._send_email('pascal@example.com')
        mailjetmock.get_message(message_id).open()
        mock_now.get.return_value = datetime.datetime(2017, 11, 5, 15, 13)
        self.database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-11-01T09:25:46.145001Z',
                'mailjetMessageId': message_id,
            }],
        })
        update_email_sent_status.main(['--disable-sentry'])

        # A week later the email link had been clicked.
        mock_now.get.return_value = datetime.datetime(2017, 11, 13, 15, 13)
        mailjetmock.get_message(message_id).click()
        update_email_sent_status.main(['--disable-sentry'])

        updated_data = self.database.user.find_one()
        assert updated_data
        self.assertEqual(
            'EMAIL_SENT_CLICKED',
            updated_data.get('emailsSent')[0].get('status'))

    @mock.patch(update_email_sent_status.mail_blast.__name__ + '.campaign')
    def test_campaign_specific(self, mock_campaigns: mock.MagicMock) -> None:
        """Test retrieving info for a specific campaign."""

        message_id = self._send_email('pascal@example.com')
        mailjetmock.get_message(message_id).open()

        mock_campaigns.list_all_campaigns.return_value = ['this-campaign', 'other-campaign']
        self.database.user.insert_many([
            {
                'profile': {'email': 'pascal@example.com'},
                'emailsSent': [
                    {
                        'campaignId': 'this-campaign',
                        'sentAt': '2017-09-08T09:25:46.145001Z',
                        'mailjetMessageId': message_id,
                    },
                    {
                        'campaignId': 'other-campaign',
                        'sentAt': '2017-09-08T09:25:46.145001Z',
                        'mailjetMessageId': self._send_email('pascal@example.com'),
                    },
                ],
            },
            {
                'profile': {'email': 'cyrille@example.com'},
                'emailsSent': [{
                    'campaignId': 'other-campaign',
                    'sentAt': '2017-09-08T09:25:46.145001Z',
                    'mailjetMessageId': self._send_email('cyrille@example.com'),
                }],
            },
        ])
        update_email_sent_status.main(['--campaigns', 'this-campaign', '--disable-sentry'])
        updated_user = self.database.user.find_one({'profile.email': 'pascal@example.com'})
        assert updated_user
        self.assertEqual(
            'EMAIL_SENT_OPENED',
            updated_user.get('emailsSent')[0].get('status'))
        self.assertIsNone(updated_user.get('emailsSent')[1].get('status'))
        not_updated_user = self.database.user.find_one({'profile.email': 'cyrille@example.com'})
        assert not_updated_user
        self.assertIsNone(not_updated_user.get('emailsSent')[0].get('status'))

    @mock.patch(update_email_sent_status.__name__ + '.now')
    @mock.patch(update_email_sent_status.__name__ + '.mail_send')
    def test_multiple_checks(self, mock_mail: mock.MagicMock, mock_now: mock.MagicMock) -> None:
        """Test checking the status of an email several times."""

        # Note that in this test we do not use mailjetmock because what's
        # important is to check when calls to Mailjet are made (i.e. not too often).

        mock_now.get.return_value = datetime.datetime(2017, 9, 8, 15, 13)
        mock_mail.get_message.return_value = {
            'ArrivedAt': '2017-09-08T09:25:48Z',
            'ID': 6789,
            'Comment': 'Right message, arrived 2 seconds after being sent',
            'Status': 'opened',
        }
        self.database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-09-08T09:25:46.145001Z',
                'mailjetMessageId': 6789,
            }],
        })
        update_email_sent_status.main(['--disable-sentry'])
        mock_mail.get_message.reset_mock()

        # Check again, an hour later.
        mock_now.get.return_value = datetime.datetime(2017, 9, 8, 16, 13)
        update_email_sent_status.main(['--disable-sentry'])

        mock_mail.get_message.assert_called_once()
        mock_mail.get_message.reset_mock()

        # Check again the next day.
        mock_now.get.return_value = datetime.datetime(2017, 9, 9, 17, 13)
        update_email_sent_status.main(['--disable-sentry'])

        mock_mail.get_message.assert_called_once()
        mock_mail.get_message.reset_mock()

        # Check again an hour later the next day.
        mock_now.get.return_value = datetime.datetime(2017, 9, 9, 18, 13)
        update_email_sent_status.main(['--disable-sentry'])

        mock_mail.get_message.assert_not_called()

        # Check again 15 days later.
        mock_now.get.return_value = datetime.datetime(2017, 9, 24, 18, 14)
        update_email_sent_status.main(['--disable-sentry'])

        mock_mail.get_message.assert_called_once()
        mock_mail.get_message.reset_mock()

        # Check again the next day.
        mock_now.get.return_value = datetime.datetime(2017, 9, 25, 18, 14)
        update_email_sent_status.main(['--disable-sentry'])

        mock_mail.get_message.assert_not_called()

    def test_update_helper(self) -> None:
        """Test updating the sent emails for another collection."""

        message_id = self._send_email('pascal@example.com')
        mailjetmock.get_message(message_id).open()

        self.database.other_users.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-09-08T09:25:46.145001Z',
                'mailjetMessageId': message_id,
            }],
        })
        update_email_sent_status.main(['--mongo-collection', 'other_users', '--disable-sentry'])
        updated_data = self.database.other_users.find_one()
        assert updated_data
        self.assertEqual('field', updated_data.get('other'))
        self.assertEqual(
            message_id, int(updated_data.get('emailsSent')[0].get('mailjetMessageId')))
        self.assertEqual(
            'EMAIL_SENT_OPENED',
            updated_data.get('emailsSent')[0].get('status'))

    def test_mailjet_unknown(self) -> None:
        """Test retrieving info but MailJet never heard of the message."""

        self.database.user.insert_one({
            'other': 'field',
            'profile': {'email': 'pascal@example.com'},
            'emailsSent': [{
                'sentAt': '2017-09-08T09:25:46.145001Z',
                'mailjetMessageId': 9876554,
            }],
        })

        update_email_sent_status.main(['--disable-sentry'])

        updated_data = self.database.user.find_one()
        assert updated_data
        self.assertEqual('field', updated_data.get('other'))
        self.assertEqual(
            9876554, int(updated_data.get('emailsSent')[0].get('mailjetMessageId')))
        self.assertNotIn('status', updated_data.get('emailsSent')[0])


if __name__ == '__main__':
    unittest.main()
