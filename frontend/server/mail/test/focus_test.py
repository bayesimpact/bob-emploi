"""Unit tests for the focus script to send focus emails."""

import datetime
import os
import random
import textwrap
import typing
import unittest
from unittest import mock

import mongomock
import requests

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import focus
from bob_emploi.frontend.server.mail.templates import mailjet_templates
from bob_emploi.frontend.server.test import mailjetmock


# The real random.random function in case we mock it.
real_random = random.random


# The sorted list of campaign IDs corresponding to focus email. Keep this list
# updated as the tests here depend on it to be complete and accurate.
_GOLDEN_FOCUS_CAMPAIGNS = (
    'christmas', 'confidence-boost', 'focus-body-language', 'focus-network', 'focus-self-develop',
    'focus-spontaneous', 'galita-1', 'galita-2', 'galita-2-short', 'galita-3', 'galita-3-short',
    'get-diploma', 'get-diploma-short', 'improve-cv', 'imt', 'jobbing', 'jobbing-short',
    'jobflix-invite', 'network-plus', 'post-covid', 'prepare-your-application',
    'prepare-your-application-short', 'spontaneous-short', 'switch-grant',
)


@mock.patch(focus.auth_token.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
class SendFocusEmailTest(unittest.TestCase):
    """Unit tests for the main function."""

    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(focus.mongo.__name__ + '.get_connections_from_env')
        mock_mongo = patcher.start()
        self.addCleanup(patcher.stop)
        self._db = mongomock.MongoClient()
        mock_mongo.return_value = (
            focus.mongo.NoPiiMongoDatabase(self._db.test),
            focus.mongo.UsersDatabase.from_database(self._db.user_test),
            focus.mongo.NoPiiMongoDatabase(self._db.eval_test))

        patcher = nowmock.patch()
        self.mock_now = patcher.start()
        self.addCleanup(patcher.stop)
        self.mock_now.return_value = datetime.datetime(2018, 5, 31, 12, 38)

        self._db.user_test.user.insert_one({
            'profile': {
                'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                'email': 'pascal@bayes.org',
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
        self._db.test.focus_emails.insert_many([
            {'campaignId': c} for c in _GOLDEN_FOCUS_CAMPAIGNS
        ])
        self._db.test.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans le domaine',
        })

    @mock.patch('logging.info')
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

    @mock.patch('logging.info')
    def test_list_emails(self, mock_logging: mock.MagicMock) -> None:
        """List uses logging extensively but does not send any email."""

        focus.main(['list'])

        mock_logging.assert_called()

        self.assertFalse(mailjetmock.get_all_sent_messages())

    def test_send_first(self) -> None:
        """Sending a first focus email."""

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][0]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    def test_send_first_too_early(self) -> None:
        """Sending a first focus email too soon after a registration."""

        self._db.user_test.user.update_one(
            {}, {'$set': {'registeredAt': '2018-05-30T14:22:00Z'}})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        user_data = self._db.user_test.user.find_one()
        assert user_data
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
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))

    def test_send_a_week_after_another(self) -> None:
        """Sending a second focus email a week after the first one."""

        focus.main(['send', '--disable-sentry'])

        self.mock_now.return_value += datetime.timedelta(days=9)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
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
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))

        self.mock_now.return_value += datetime.timedelta(days=30)

        mailjetmock.clear_sent_messages()

        focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
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
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(2, len(user_data.get('emailsSent')))
        self.assertIn(user_data['emailsSent'][1]['campaignId'], _GOLDEN_FOCUS_CAMPAIGNS)

    @mock.patch('logging.info')
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
        self.assertEqual({'pascal@bayes.org'}, {m.recipient['Email'] for m in emails_sent})
        self.assertLessEqual(len(emails_sent), len(_GOLDEN_FOCUS_CAMPAIGNS))

        user_data = self._db.user_test.user.find_one()
        assert user_data
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

    @mock.patch('logging.info')
    @mock.patch('random.random', new=lambda: 0.5)
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
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent', [])))

        # A month later, there should be another email.
        for unused_data in range(30):
            self.mock_now.return_value += datetime.timedelta(days=1)
            focus.main(['send', '--disable-sentry'])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        user_data = self._db.user_test.user.find_one()
        assert user_data
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

    def test_dont_send_to_mistyped_emails(self) -> None:
        """Do not send focus emails to users with an incorrect email address."""

        self._db.user_test.user.update_one({}, {'$set': {
            'profile.email': 'pascal@ corpet.net',
        }})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        self._db.user_test.user.update_one({}, {'$set': {
            'profile.email': 'pascal@corpet',
        }})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch('logging.warning')
    def test_dont_send_to_example(self, mock_warning: mock.MagicMock) -> None:
        """Do not send focus emails to users with an example email address."""

        self._db.user_test.user.update_one({}, {'$set': {
            'profile.email': 'pascal@example.com',
        }})

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_warning.assert_not_called()

    def test_restrict_campaign(self) -> None:
        """Restrict to only one campaign."""

        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_one({'campaignId': 'galita-2'})

        focus.main(['send', '--disable-sentry'])
        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual('galita-2', user_data['emailsSent'][0]['campaignId'])

    @mock.patch('bob_emploi.frontend.server.mail.mail_send.send_template')
    @mock.patch('logging.warning')
    def test_error_while_sending(
            self, mock_warning: mock.MagicMock, mock_send_template: mock.MagicMock) -> None:
        """Error when sending a focus email get caught and logged as warning."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertFalse(user_data.get('emailsSent'))

        mock_warning.assert_called_once()
        self.assertEqual('Error while sending an email: %s', mock_warning.call_args[0][0])

    @mock.patch('bob_emploi.frontend.server.mail.mail_send.send_template')
    def test_error_while_dry_run(self, mock_send_template: mock.MagicMock) -> None:
        """Error when sending a focus email in dry run mode."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        with self.assertRaises(requests.exceptions.HTTPError):
            focus.main(['dry-run', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertFalse(user_data.get('emailsSent'))

    def test_error_no_secret_salt(self) -> None:
        """Error when trying to send without a secret salt."""

        with mock.patch(
                focus.auth_token.__name__ + '.SECRET_SALT', new=focus.auth_token.FAKE_SECRET_SALT):
            with self.assertRaises(ValueError):
                focus.main(['send', '--disable-sentry'])

    @mock.patch(focus.report.__name__ + '._setup_sentry_logging')
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
        user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        user.profile.frustrations.append(user_profile_pb2.SELF_CONFIDENCE)
        user.projects.add()

        campaign_id = focus.send_focus_email_to_user(
            'ghost', user,
            database=focus.mongo.NoPiiMongoDatabase(self._db.test),
            instant=datetime.datetime.now())

        self.assertIn(campaign_id, _GOLDEN_FOCUS_CAMPAIGNS)
        self.assertEqual([campaign_id], [e.campaign_id for e in user.emails_sent])
        self.assertGreater(user.send_coaching_email_after.ToDatetime(), datetime.datetime.now())

        self.assertFalse(mailjetmock.get_all_sent_messages())

    def test_ghost_email_none(self) -> None:
        """Test the ghost mode for users that don't want any emails."""

        user = user_pb2.User()
        user.profile.coaching_email_frequency = email_pb2.EMAIL_NONE
        user.profile.frustrations.append(user_profile_pb2.SELF_CONFIDENCE)
        user.projects.add()

        campaign_id = focus.send_focus_email_to_user(
            'ghost', user,
            database=focus.mongo.NoPiiMongoDatabase(self._db.test),
            instant=datetime.datetime.now())

        self.assertFalse(campaign_id)
        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'coaching-campaign': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'coaching-campaign'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_coaching=True,
        ),
    })
    @mock.patch.dict(mailjet_templates.MAP, {
        'coaching-campaign': {'mailjetTemplate': 0},
    })
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'coaching-campaign': 'Campagne de coaching',
    }[campaign_id])
    def test_focus_with_project_score_zero(self) -> None:
        """Test no email sent if project score is 0"""

        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'post-covid', 'scoringModel': 'constant(0)'},
        ])

        mailjetmock.clear_sent_messages()

        user = user_pb2.User()
        user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        user.profile.frustrations.append(user_profile_pb2.SELF_CONFIDENCE)
        user.projects.add()

        focus.main(['send', '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'post-covid': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'post-covid'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=False,
        ),
    })
    def test_focus_with_no_scoring_model(self) -> None:
        """Test email sent if there is no scoring model"""

        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'post-covid'},
        ])

        mailjetmock.clear_sent_messages()

        user = user_pb2.User()
        user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        user.profile.frustrations.append(user_profile_pb2.SELF_CONFIDENCE)
        user.projects.add()

        focus.main(['send', '--disable-sentry'])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertEqual(user_data['emailsSent'][0]['campaignId'], 'post-covid')

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'big-important': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'big-important'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=True,
        ),
        'small-very-important': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'small-very-important'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=False,
        ),
        'big-no-priority': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'big-no-priority'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=True,
        ),
        'big-less-important': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'big-less-important'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=True,
        ),
    })
    @mock.patch.dict(mailjet_templates.MAP, {
        'big-important': {'mailjetTemplate': 0},
        'small-very-important': {'mailjetTemplate': 1},
        'big-no-priority': {'mailjetTemplate': 2},
        'big-less-important': {'mailjetTemplate': 3},
    })
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'big-important': 'Un mail gros et important',
        'small-very-important': 'Un mail petit et très important',
        'big-no-priority': 'Un mail gros et pas important',
        'big-less-important': 'Un mail gros et moins important',
    }[campaign_id])
    @mock.patch('random.random')
    def test_send_priority(self, mock_random_random: mock.MagicMock) -> None:
        """Send priority focus emails first."""

        # Avoid random influence in the order calculation
        mock_random_random.return_value = 0
        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'big-important', 'scoringModel': 'constant(2.5)'},
            {'campaignId': 'small-very-important', 'scoringModel': 'constant(3)'},
            {'campaignId': 'big-no-priority'},
            {'campaignId': 'big-less-important', 'scoringModel': 'constant(1)'},
        ])

        focus.main([
            'send', '--disable-sentry',
            '--restrict-campaigns', 'big-important', 'small-very-important', 'big-no-priority',
            'big-less-important',
        ])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertEqual('big-important', user_data['emailsSent'][0]['campaignId'])

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'first-one': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'first-one'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_coaching=True,
        ),
        'second-one': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'second-one'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_coaching=True,
        ),
        'third-one': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'third-one'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_coaching=True,
        ),
    })
    @mock.patch.dict(mailjet_templates.MAP, {
        'first-one': {'mailjetTemplate': 0},
        'second-one': {'mailjetTemplate': 0},
        'third-one': {'mailjetTemplate': 0},
    })
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'first-one': 'Un premier email',
        'second-one': 'Un deuxième email',
        'third-one': 'Un troisième email',
    }[campaign_id])
    @mock.patch(focus.report.__name__ + '.notify_slack')
    def test_slack(self, mock_notify_slack: mock.MagicMock) -> None:
        """Send message to slack."""

        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'first-one', 'scoringModel': 'constant(3)'},
            {'campaignId': 'third-one', 'scoringModel': 'constant(.1)'},
        ])

        # Note that random will not be flaky:
        #  the diff score is (3 - .1) / 3 * _SCORES_WEIGHT = 5 * 2.9 / 3
        #  the max random diff is _RANDOM_WEIGHTS = 4
        # So the difference in score will always be bigger than the random diff and thus first-one
        # will always be selected.
        focus.main([
            'send', '--disable-sentry',
        ])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        mock_notify_slack.assert_called_once_with(textwrap.dedent('''\
            Focus emails sent today:
             • *first-one*: 1 email
             • *third-one*: 0 email'''))

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'just-big': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'just-big'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=True,
        ),
        'small-very-important': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'small-very-important'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=False,
        ),
    })
    @mock.patch.dict(mailjet_templates.MAP, {
        'just-big': {'mailjetTemplate': 0},
        'small-very-important': {'mailjetTemplate': 1},
    })
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'just-big': 'Un mail gros',
        'small-very-important': 'Un mail petit et très important',
    }[campaign_id])
    @mock.patch('random.random')
    def test_send_shuffle_random(self, mock_random_random: mock.MagicMock) -> None:
        """Test random in shuffle."""

        mock_random_random.side_effect = real_random
        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'just-big', 'scoringModel': 'constant(0.5)'},
            {'campaignId': 'small-very-important', 'scoringModel': 'constant(3)'},
        ])

        focus.main([
            'send', '--disable-sentry',
            '--restrict-campaigns', 'just-big', 'small-very-important',
        ])

        mock_random_random.assert_called()

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertIn(
            user_data['emailsSent'][0]['campaignId'], {'just-big', 'small-very-important'})

    @mock.patch(focus.__name__ + '._FOCUS_CAMPAIGNS', {
        'just-big': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'just-big'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=True,
        ),
        'small-very-important': campaign.Campaign(
            typing.cast(mailjet_templates.Id, 'small-very-important'),
            get_vars=lambda user, **unused_kwargs: {'key': 'value'},
            sender_name='Sender', sender_email='sender@example.com', is_big_focus=False,
        ),
    })
    @mock.patch.dict(mailjet_templates.MAP, {
        'just-big': {'mailjetTemplate': 0},
        'small-very-important': {'mailjetTemplate': 1},
    })
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'big-important': 'Un mail gros',
        'small-very-important': 'Un mail petit et très important',
    }[campaign_id])
    @mock.patch('random.random')
    def test_send_shuffle(self, mock_random_random: mock.MagicMock) -> None:
        """Send the mail with a better score first."""

        mock_random_random.return_value = 0

        self._db.test.focus_emails.drop()
        self._db.test.focus_emails.insert_many([
            {'campaignId': 'just-big', 'scoringModel': 'constant(0.5)'},
            {'campaignId': 'small-very-important', 'scoringModel': 'constant(3)'},
        ])

        focus.main([
            'send', '--disable-sentry',
            '--restrict-campaigns', 'just-big', 'small-very-important',
        ])

        self.assertEqual(
            ['pascal@bayes.org'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

        user_data = self._db.user_test.user.find_one()
        assert user_data
        self.assertEqual(1, len(user_data.get('emailsSent')))
        self.assertEqual('small-very-important', user_data['emailsSent'][0]['campaignId'])


if __name__ == '__main__':
    unittest.main()
