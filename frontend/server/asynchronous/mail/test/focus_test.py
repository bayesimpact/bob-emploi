"""Unit tests for the focus script to send focus emails."""

import datetime
import os
import unittest
from unittest import mock

import mongomock
import requests

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import focus
from bob_emploi.frontend.server.test import mailjetmock

# The sorted list of campaign IDs corresponding to focus email. Keep this list
# updated as the tests here depend on it to be complete and accurate.
_GOLDEN_FOCUS_CAMPAIGNS = (
    'focus-body-language', 'focus-network', 'focus-self-develop', 'focus-spontaneous',
    'galita-1', 'galita-2', 'galita-3', 'get-diploma', 'improve-cv', 'imt', 'jobbing',
    'network-plus', 'prepare-your-application',
)


@mock.patch(focus.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
class SendFocusEmailTest(unittest.TestCase):
    """Unit tests for the main function."""

    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(focus.mongo.__name__ + '.get_connections_from_env')
        mock_mongo = patcher.start()
        self.addCleanup(patcher.stop)
        self._db = mongomock.MongoClient()
        mock_mongo.return_value = (self._db.test, self._db.user_test, self._db.eval_test)

        patcher = mock.patch(focus.now.__name__ + '.get')
        self.mock_now = patcher.start()
        self.addCleanup(patcher.stop)
        self.mock_now.return_value = datetime.datetime(2018, 5, 31, 12, 38)

        self._db.user_test.user.insert_one({
            'profile': {
                'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                'email': 'pascal@example.fr',
                'frustrations': ['SELF_CONFIDENCE', 'INTERVIEW'],
            },
            'projects': [{
                'kind': 'FIND_A_FIRST_JOB',
                'network_estimate': 1,
                'jobSearchStartedAt': '2017-10-01T09:34:00Z',
                'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            }],
            'registeredAt': '2018-01-15T15:24:34Z',
        })
        self._db.test.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans le domaine',
        })

    @mock.patch(focus.logging.__name__ + '.info')
    def test_list_campaigns(self, mock_logging: mock.MagicMock) -> None:
        """List existing focus email campaigns."""

        self._db.user_test.user.drop()

        focus.main(['list'])

        mock_logging.assert_called()
        for logging_call in mock_logging.call_args_list:
            if logging_call[0][0].startswith('Potential focus emails:'):
                self.assertEqual(
                    list(_GOLDEN_FOCUS_CAMPAIGNS), logging_call[0][1],
                    msg="Update the golden focus campaigns as it's used in other tests.")
                break
        else:  # pragma: no-cover
            self.fail('No logging call about potential focus emails.')

    @mock.patch(focus.__name__ + '.logging')
    def test_list_emails(self, mock_logging: mock.MagicMock) -> None:
        """List uses logging extensively but does not send any email."""

        focus.main(['list'])

        mock_logging.info.assert_called()

        self.assertFalse(mailjetmock.get_all_sent_messages())

    def test_send_first(self) -> None:
        """Sending a first focus email."""

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.fr'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][0]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_send_first_too_early(self) -> None:
        """Sending a first focus email too soon after a registration."""

        self._db.user_test.user.update_one(
            {}, {'$set': {'registeredAt': '2018-05-30T14:22:00Z'}})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        user_data = self._db.user_test.user.find_one()
        self.assertFalse(user_data.get('emailsSent'))
        self.assertEqual(
            '2018-06-02T14:22:00Z',
            user_data.get('sendCoachingEmailAfter'))

    def test_send_shortly_after_another(self) -> None:
        """Sending a second focus email shortly after the first one."""

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(hours=1)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent')))

    def test_send_a_week_after_another(self) -> None:
        """Sending a second focus email a week after the first one."""

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(days=9)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.fr'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_send_only_once_a_month(self) -> None:
        """Sending focus emails to user on "once-a-month" frequency."""

        self._db.user_test.user.update_one(
            {}, {'$set': {'profile.coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH'}})

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(days=15)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        # No email sent, even 15 days later.
        self.assertFalse(mailjetmock.get_all_sent_messages())

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent')))

        self.mock_now.return_value += datetime.timedelta(days=30)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.fr'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))

    def test_send_after_not_focus(self) -> None:
        """Sending a second focus email shortly after another random email."""

        self._db.user_test.user.update_one(
            {}, {'$push': {'emailsSent': {
                'campaignId': 'not-a-focus',
                'sentAt': '2018-05-30T23:12:00Z',
            }}})

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.fr'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    @mock.patch(focus.logging.__name__ + '.info')
    def test_send_all_focus_emails(self, unused_mock_logging: mock.MagicMock) -> None:
        """Sending all focus emails in 6 months."""

        days_without_email = 0
        sent_emails_count = 0

        # Try sending emails until there has been a month without any email sent.
        while days_without_email < 30 and sent_emails_count <= len(_GOLDEN_FOCUS_CAMPAIGNS):
            focus.main(['send', '--disable-sentry'])

            emails_sent = mailjetmock.get_all_sent_messages()
            if len(emails_sent) > sent_emails_count:
                sent_emails_count = len(emails_sent)
                days_without_email = 0
            else:
                days_without_email += 1

            self.mock_now.return_value += datetime.timedelta(days=1)

        emails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual({'pascal@example.fr'}, {m.recipient['Email'] for m in emails_sent})
        self.assertLessEqual(len(emails_sent), len(_GOLDEN_FOCUS_CAMPAIGNS))

        user_data = self._db.user_test.user.find_one()
        campaigns_sent = [e.get('campaignId') for e in user_data['emailsSent']]
        self.assertCountEqual(set(campaigns_sent), campaigns_sent, msg='No duplicates')
        self.assertLessEqual(set(campaigns_sent), set(_GOLDEN_FOCUS_CAMPAIGNS))

        # Try sending emails until the next check.
        next_date = datetime.datetime.fromisoformat(user_data['sendCoachingEmailAfter'][:-1])
        while next_date >= self.mock_now.return_value:
            focus.main(['send', '--disable-sentry'])

            self.mock_now.return_value += datetime.timedelta(days=1)

        self.assertEqual(
            len(emails_sent), len(mailjetmock.get_all_sent_messages()),
            msg='No new messages.'
            ' There probably is an issue with time sensitive conditions on some emails')
        user_data = self._db.user_test.user.find_one()
        # Next check should be at least a month from now.
        self.assertLessEqual(
            self.mock_now.return_value + datetime.timedelta(days=30),
            datetime.datetime.fromisoformat(user_data['sendCoachingEmailAfter'][:-1]))

    @mock.patch(focus.logging.__name__ + '.info')
    @mock.patch(focus.random.__name__ + '.random', new=lambda: 0.5)
    def test_change_setting(self, unused_mock_logging: mock.MagicMock) -> None:
        """Changing the settings after the first email has been sent."""

        focus.main(['send', '--disable-sentry'])
        mailjetmock.clear_sent_messages()

        # Change the email frequency setting right after the first email.
        self._db.user_test.user.update_one({}, {
            '$set': {'profile.coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH'},
            '$unset': {'sendCoachingEmailAfter': 1},
        })

        # A week later, there should be no email.
        for unused_day in range(7):
            self.mock_now.return_value += datetime.timedelta(days=1)
            focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent', [])))

        # A month later, there should be another email.
        for unused_data in range(30):
            self.mock_now.return_value += datetime.timedelta(days=1)
            focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.fr'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent', [])))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_dont_send_to_deleted(self) -> None:
        """Do not send focus emails to deleted users."""

        self._db.user_test.user.update_one({}, {'$set': {
            'profile.email': 'REDACTED',
            'deletedAt': '2018-06-01T15:24:34Z',
        }})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch(focus.__name__ + '._POTENTIAL_CAMPAIGNS', {'galita-2'})
    def test_restrict_campaign(self) -> None:
        """Restrict to only one campaign."""

        focus.main(['send', '--disable-sentry'])
        user_data = self._db.user_test.user.find_one()
        self.assertEqual('galita-2', user_data['emailsSent'][0]['campaignId'])

    @mock.patch('bob_emploi.frontend.server.mail.send_template')
    @mock.patch('logging.warning')
    def test_error_while_sending(
            self, mock_warning: mock.MagicMock, mock_send_template: mock.MagicMock) -> None:
        """Error when sending a focus email get caught and logged as warning."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user_data = self._db.user_test.user.find_one()
        self.assertFalse(user_data.get('emailsSent'))

        mock_warning.assert_called_once()
        self.assertEqual('Error while sending an email: %s', mock_warning.call_args[0][0])

    @mock.patch('bob_emploi.frontend.server.mail.send_template')
    def test_error_while_dry_run(self, mock_send_template: mock.MagicMock) -> None:
        """Error when sending a focus email in dry run mode."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        with self.assertRaises(requests.exceptions.HTTPError):
            focus.main(['dry-run', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user_data = self._db.user_test.user.find_one()
        self.assertFalse(user_data.get('emailsSent'))

    def test_error_no_secret_salt(self) -> None:
        """Error when trying to send without a secret salt."""

        with mock.patch(focus.auth.__name__ + '.SECRET_SALT', new=focus.auth.FAKE_SECRET_SALT):
            with self.assertRaises(ValueError):
                focus.main(['send', '--disable-sentry'])

    @mock.patch(focus.report.__name__ + '.setup_sentry_logging')
    @mock.patch.dict(os.environ, {'SENTRY_DSN': 'fake-sentry'})
    def test_setup_report(self, mock_setup_sentry: mock.MagicMock) -> None:
        """Make sure the report is setup."""

        focus.main(['send'])

        mock_setup_sentry.assert_called_once_with('fake-sentry')
        self.assertTrue(mailjetmock.get_all_sent_messages())

    @mock.patch('logging.error')
    def test_failed_setup_report(self, mock_error: mock.MagicMock) -> None:
        """Warn if the report is not correctly setup."""

        focus.main(['send'])

        mock_error.assert_called_once_with(
            'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
        self.assertFalse(mailjetmock.get_all_sent_messages())

    def test_ghost_mode(self) -> None:
        """Test the ghost mode."""

        user = user_pb2.User()
        user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH
        user.profile.frustrations.append(user_pb2.SELF_CONFIDENCE)
        user.projects.add()

        campaign_id = focus.send_focus_email_to_user(
            'ghost', user, database=self._db, users_database=self._db,
            instant=datetime.datetime.now())

        self.assertIn(campaign_id, _GOLDEN_FOCUS_CAMPAIGNS)
        self.assertEqual([campaign_id], [e.campaign_id for e in user.emails_sent])
        self.assertGreater(user.send_coaching_email_after.ToDatetime(), datetime.datetime.now())

        self.assertFalse(mailjetmock.get_all_sent_messages())


if __name__ == '__main__':
    unittest.main()
