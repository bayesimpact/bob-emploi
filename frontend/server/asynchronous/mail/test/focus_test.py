"""Unit tests for the focus script to send focus emails."""

import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous.mail import focus
from bob_emploi.frontend.server.test import mailjetmock

# The sorted list of campaign IDs corresponding to focus email. Keep this list
# updated as the tests here depend on it to be complete and accurate.
_GOLDEN_FOCUS_CAMPAIGNS = (
    'focus-body-language', 'focus-network', 'focus-self-develop', 'focus-spontaneous',
    'galita-1', 'galita-3', 'imt', 'network-plus',
)


@mock.patch(focus.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
class SendFocusEmailTest(unittest.TestCase):
    """Unit tests for the main function."""

    def setUp(self):
        super(SendFocusEmailTest, self).setUp()
        patcher = mock.patch(focus.mongo.__name__ + '.get_connections_from_env')
        mock_mongo = patcher.start()
        self.addCleanup(patcher.stop)
        self._db = mongomock.MongoClient()
        mock_mongo.return_value = (self._db.test, self._db.user_test)

        patcher = mock.patch(focus.now.__name__ + '.get')
        self.mock_now = patcher.start()
        self.addCleanup(patcher.stop)
        self.mock_now.return_value = datetime.datetime(2018, 5, 31, 12, 38)

        self._db.user_test.user.insert_one({
            'profile': {
                'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                'email': 'pascal@example.com',
                'frustrations': ['SELF_CONFIDENCE', 'INTERVIEW'],
            },
            'projects': [{
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
    def test_list_campaigns(self, mock_logging):
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
        else:
            self.fail('No logging call about potential focus emails.')  # pragma: no-cover

    @mock.patch(focus.__name__ + '.logging')
    def test_list_emails(self, mock_logging):
        """List uses logging extensively but does not send any email."""

        focus.main(['list'])

        mock_logging.info.assert_called()

        self.assertFalse(mailjetmock.get_all_sent_messages())

    def test_send_first(self):
        """Sending a first focus email."""

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][0]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_send_first_too_early(self):
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

    def test_send_shortly_after_another(self):
        """Sending a second focus email shortly after the first one."""

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(hours=1)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(1, len(user_data.get('emailsSent')))

    def test_send_a_week_after_another(self):
        """Sending a second focus email a week after the first one."""

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(days=9)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_send_only_once_a_month(self):
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
            ['pascal@example.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))

    def test_send_after_not_focus(self):
        """Sending a second focus email shortly after another random email."""

        self._db.user_test.user.update_one(
            {}, {'$push': {'emailsSent': {
                'campaignId': 'not-a-focus',
                'sentAt': '2018-05-30T23:12:00Z',
            }}})

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    @mock.patch(focus.logging.__name__ + '.info')
    def test_send_all_focus_emails(self, unused_mock_logging):
        """Sending all focus emails in 6 months."""

        for unused_day in range(180):
            focus.main(['send', '--disable-sentry'])

            self.mock_now.return_value += datetime.timedelta(days=1)

        emails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual({'pascal@example.com'}, {m.recipient['Email'] for m in emails_sent})
        self.assertLessEqual(len(emails_sent), len(_GOLDEN_FOCUS_CAMPAIGNS))

        user_data = self._db.user_test.user.find_one()
        campaigns_sent = [e.get('campaignId') for e in user_data['emailsSent']]
        self.assertEqual(sorted(set(campaigns_sent)), sorted(campaigns_sent), msg='No duplicates')
        self.assertLessEqual(set(campaigns_sent), set(_GOLDEN_FOCUS_CAMPAIGNS))

        last_sent_at = user_data['emailsSent'][-1]['sentAt']
        self.assertGreaterEqual('2018-08', last_sent_at, msg='No emails sent after 3 months.')

        self.assertLess('2018-12', user_data.get('sendCoachingEmailAfter'))

    @mock.patch(focus.logging.__name__ + '.info')
    @mock.patch(focus.random.__name__ + '.random', new=lambda: 0.5)
    def test_change_setting(self, unused_mock_logging):
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
        self.assertEqual(1, len(user_data.get('emailsSent')))

        # A month later, there should be another email.
        for unused_data in range(30):
            self.mock_now.return_value += datetime.timedelta(days=30)
            focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@example.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        user_data = self._db.user_test.user.find_one()
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_dont_send_to_deleted(self):
        """Do not send focus emails to deleted users."""

        self._db.user_test.user.update_one({}, {'$set': {
            'profile.email': 'REDACTED',
            'deletedAt': '2018-06-01T15:24:34Z',
        }})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
