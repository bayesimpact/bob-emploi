"""Unit tests for the bob_emploi.frontend.server.mail.mail_blast module."""

import datetime
import os
import typing
from typing import Optional
import unittest
from unittest import mock

from bson import objectid
import mongomock
import pymongo
import requests

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import mail_blast
from bob_emploi.frontend.server.mail.templates import mailjet_templates
from bob_emploi.frontend.server.test import mailjetmock


_FAKE_CAMPAIGNS = {'fake-user-campaign': campaign.Campaign(
    typing.cast(mailjet_templates.Id, 'fake-user-campaign'), {},
    lambda user, **unused_kwargs: {'key': 'value'},
    'Sender', 'sender@example.com')}


class EmailPolicyTestCase(unittest.TestCase):
    """Tests for the EmailPolicy class."""

    def _make_email(
            self, campaign_id: str, days_ago: int = 0, hours_ago: int = 0,
            status: 'user_pb2.EmailSentStatus.V' = user_pb2.EMAIL_SENT_SENT,
            status_updated_days_after: Optional[int] = 8) -> user_pb2.EmailSent:
        email = user_pb2.EmailSent(campaign_id=campaign_id, status=status)
        email.sent_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days_ago, hours_ago))
        if status_updated_days_after:
            email.last_status_checked_at.FromDatetime(
                email.sent_at.ToDatetime() + datetime.timedelta(status_updated_days_after))
        return email

    def test_no_previous_mails(self) -> None:
        """Basic test."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        self.assertTrue(email_policy.can_send('focus-network', []))

    def test_email_sent_recently(self) -> None:
        """Test email sent recently."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        emails_sent = [self._make_email('other-mail', days_ago=6)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('other-mail', days_ago=8)]
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))

    def test_email_send_campaign_again(self) -> None:
        """Test same campaign mail sent recently."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        emails_sent = [self._make_email('focus-network', days_ago=13)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('focus-network', days_ago=15)]
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))

    def test_email_send_campaign_again_later(self) -> None:
        """Test same campaign mail sent a while ago."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14,
            days_since_same_campaign=90)
        emails_sent = [
            # We sent the email, but user ignored it.
            self._make_email('focus-network', days_ago=100),
            # We re-sent the email and users clicked a link in it.
            self._make_email('focus-network', days_ago=93, status=user_pb2.EMAIL_SENT_CLICKED),
        ]
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))

        emails_sent = [
            # We sent the email, but user ignored it.
            self._make_email('focus-network', days_ago=91),
            # We re-sent the email and users clicked a link in it.
            self._make_email('focus-network', days_ago=78, status=user_pb2.EMAIL_SENT_CLICKED),
        ]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))

    def test_email_not_send_campaign_again(self) -> None:
        """Test policy where we don't resend the same campaign."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=0)
        emails_sent = [self._make_email('focus-network', days_ago=13)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('focus-network', days_ago=365)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))

    def test_several_email_sent(self) -> None:
        """Test a common case where several emails has been sent."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=0)
        emails_sent = []
        emails_sent.append(self._make_email('nps-survey', days_ago=30))
        emails_sent.append(self._make_email('focus-network', days_ago=13))
        self.assertTrue(email_policy.can_send('focus-spontaneous', emails_sent))
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent.append(self._make_email('other', days_ago=2))
        self.assertFalse(email_policy.can_send('focus-spontaneous', emails_sent))
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))

    def test_mail_status_not_updated(self) -> None:
        """Test the case where mail status has not been updated."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        emails_sent = []
        emails_sent.append(self._make_email(
            'focus-network', days_ago=60, status_updated_days_after=8))
        emails_sent.append(self._make_email(
            'focus-spontaneous', days_ago=60, status_updated_days_after=4))
        emails_sent.append(self._make_email(
            'focus-marvel', days_ago=60, status_updated_days_after=None))
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))
        self.assertFalse(email_policy.can_send('focus-spontaneous', emails_sent))
        self.assertFalse(email_policy.can_send(
            typing.cast(mailjet_templates.Id, 'focus-marvel'), emails_sent))


@mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
@mongomock.patch(('mydata.com', 'myprivatedata.com'))
@mock.patch.dict(
    os.environ,
    values={
        'MONGO_URL': 'mongodb://mydata.com/test',
        'USERS_MONGO_URL': 'mongodb://myprivatedata.com/user_test',
    },
)
class BlastCampaignTest(unittest.TestCase):
    """Tests for the blast_campaign function."""

    def tearDown(self) -> None:
        mongo.cache.clear()
        super().tearDown()

    @mock.patch(mail_blast.logging.__name__ + '.info')
    def test_blast_campaign(self, mock_logging: mock.MagicMock) -> None:
        """Basic test."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_many([
            {
                '_id': objectid.ObjectId('7b18313aa35d807e631ea3d%d' % month),
                'registeredAt': '2017-%02d-15T00:00:00Z' % month,
                'profile': {
                    'name': f'{month} user',
                    'email': f'email{month}@corpet.net',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            }
            for month in range(2, 9)
        ])
        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'Already sent',
                    'email': 'already-sent@corpet.net',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
                'emailsSent': [{'campaignId': 'focus-network'}],
            },
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'Test user',
                    'email': 'test-user@example.com',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'REDACTED',
                    'email': 'REDACTED',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
        ])
        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(
            ['email4@corpet.net', 'email5@corpet.net', 'email6@corpet.net'],
            sorted(m.recipient['Email'] for m in mails_sent),
            msg=f'3 emails expected: one per month from April to June\n{mails_sent}')
        self.assertEqual(
            {'joanna@bob-emploi.fr'},
            {m.properties['From']['Email'] for m in mails_sent})
        february_user = mock_user_db.user.find_one(
            {'_id': objectid.ObjectId('7b18313aa35d807e631ea3d2')})
        assert february_user
        self.assertFalse(february_user.get('emailsSent'))

        april_user = mock_user_db.user.find_one(
            {'_id': objectid.ObjectId('7b18313aa35d807e631ea3d4')})
        assert april_user
        self.assertEqual(
            [{
                'sentAt', 'mailjetTemplate', 'campaignId',
                'mailjetMessageId', 'subject', 'isCoaching',
            }],
            [e.keys() for e in april_user.get('emailsSent', [])])
        self.assertEqual('focus-network', april_user['emailsSent'][0]['campaignId'])
        self.assertEqual(
            next(mailjetmock.get_messages_sent_to('email4@corpet.net')).message_id,
            int(april_user['emailsSent'][0]['mailjetMessageId']))

        mock_logging.assert_any_call('Email sent to %s', '7b18313aa35d807e631ea3d4')
        mock_logging.assert_called_with('%d emails sent.', 3)

    @mock.patch(mail_blast.now.__name__ + '.get')
    def test_change_policy(self, mock_now: mock.MagicMock) -> None:
        """Test with non-default emailing policy."""

        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_user_db.user.drop()
        mock_now.return_value = datetime.datetime(2017, 5, 24)
        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'Sent other mail recently',
                    'email': 'sent-other-recently@corpet.net',
                    'frustrations': ['MOTIVATION'],
                },
                'projects': [{}],
                'emailsSent': [{
                    'campaignId': 'focus-network',
                    'sentAt': '2017-05-15T00:00:00Z',
                }],
            },
            {
                'registeredAt': '2017-04-15T00:00:00Z',
                'profile': {
                    'name': 'Sent other mail less recently',
                    'email': 'sent-other-less-recently@corpet.net',
                    'frustrations': ['MOTIVATION'],
                },
                'projects': [{}],
                'emailsSent': [{
                    'campaignId': 'focus-network',
                    'sentAt': '2017-04-15T00:00:00Z',
                }],
            },
        ])
        mail_blast.main([
            'galita-1', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--days-since-any-email', '10',
            '--disable-sentry'])

        emails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(emails_sent), msg=emails_sent)

    @mock.patch(mail_blast.logging.__name__ + '.info')
    def test_stop_seeking(self, unused_mock_logging: mock.MagicMock) -> None:
        """Basic test."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-04-15T00:00:00Z',
                'profile': {
                    'name': f'{seeking} user',
                    'email': f'email{seeking}@corpet.net',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
                'employmentStatus': [
                    {'seeking': seeking, 'createdAt': '2017-06-15T00:00:00Z'}
                ]
            }
            for seeking in ('STILL_SEEKING', 'STOP_SEEKING')
        ])

        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])

        self.assertEqual(
            ['emailSTILL_SEEKING@corpet.net'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(mail_blast.campaign.__name__ + '._CAMPAIGNS', new=_FAKE_CAMPAIGNS)
    @mock.patch.dict(mailjet_templates.MAP, {'fake-user-campaign': {'mailjetTemplate': 0}})
    @mock.patch(campaign.__name__ + '.get_campaign_subject', lambda campaign_id: {
        'fake-user-campaign': 'Un faux email de campagne',
    }[campaign_id])
    @mock.patch(mail_blast.hashlib.__name__ + '.sha1')
    def test_blast_hash_start(
            self, mock_hasher: mock.MagicMock, unused_mock_logging: mock.MagicMock) -> None:
        """Send mail to users with given hash start."""

        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_user_db.user.drop()
        hash_values = ['12345', '01234']
        mock_hasher.reset_mock()
        mock_hasher().hexdigest.side_effect = hash_values

        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-04-15T00:00:00Z',
                'profile': {
                    'name': f'user {hash_value}',
                    'email': f'email{hash_value}@corpet.net',
                },
            }
            for hash_value in hash_values
        ])

        mail_blast.main([
            'fake-user-campaign', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry', '--user-hash', '1'])

        sent_messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(
            ['email12345@corpet.net'], [m.recipient['Email'] for m in sent_messages],
            msg=f'1 email expected: only for the user whith hash starting with 1\n{sent_messages}')

    @mock.patch('logging.info', mock.MagicMock)
    def test_bounced(self) -> None:
        """Do not send emails if the user had a bounce."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'The user',
                'email': 'the-user@gmail.com',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
            'emailsSent': [{'campaignId': 'other-email', 'status': 'EMAIL_SENT_BOUNCE'}],
        })
        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user = mock_user_db.user.find_one({})
        assert user
        self.assertEqual(['other-email'], [e.get('campaignId') for e in user.get('emailsSent', [])])

    @mock.patch('logging.info', mock.MagicMock)
    def test_hard_bounced(self) -> None:
        """Do not send emails if the user had a hard bounce."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'The user',
                'email': 'the-user@gmail.com',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
            'emailsSent': [{'campaignId': 'other-email', 'status': 'EMAIL_SENT_HARDBOUNCED'}],
        })
        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user = mock_user_db.user.find_one({})
        assert user
        self.assertEqual(['other-email'], [e.get('campaignId') for e in user.get('emailsSent', [])])

    def test_fake_secret_salt(self) -> None:
        """Raise an error when using the fake secret salt when trying to send."""

        auth = mail_blast.auth

        with mock.patch(auth.__name__ + '.SECRET_SALT', new=auth.FAKE_SECRET_SALT):
            with self.assertRaises(ValueError):
                mail_blast.main([
                    'focus-network', 'send',
                    '--registered-from', '2017-04-01',
                    '--registered-to', '2017-07-10',
                    '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch('logging.error')
    def test_missing_sentry_dsn(self, mock_error: mock.MagicMock) -> None:
        """Log an error when used without SENTRY_DSN env var."""

        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_error.assert_called_with(
            'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')

    @mock.patch('logging.error')
    def test_incoherent_policy_durations(self, mock_error: mock.MagicMock) -> None:
        """Log an error when flags to define policy are not coherent."""

        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry',
            '--days-since-same-campaign', '7',
            '--days-since-same-campaign-unread', '15'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_error.assert_called_with(
            'Please use coherent values in the policy durations.')

    @mock.patch('logging.info', mock.MagicMock)
    def test_days_from(self) -> None:
        """Compute from and to date relatively to today."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'The user',
                'email': 'the-user@gmail.com',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
        })
        with mock.patch(mail_blast.now.__name__ + '.get') as mock_now:
            mock_now.return_value = datetime.datetime(2017, 7, 11, 12, 0, 0, 0)
            mail_blast.main([
                'focus-network', 'send',
                '--registered-from-days-ago', '90',
                '--registered-to-days-ago', '1',
                '--disable-sentry'])

        self.assertEqual(
            ['the-user@gmail.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        user = mock_user_db.user.find_one({})
        assert user
        self.assertEqual(
            ['focus-network'], [e.get('campaignId') for e in user.get('emailsSent', [])])

    @mock.patch('logging.info', mock.MagicMock)
    def test_wrong_id(self) -> None:
        """Filter based on ID."""

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_many([
            {
                '_id': objectid.ObjectId('444444444444444444444444'),
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'The user',
                    'email': 'the-user@gmail.com',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
            {
                '_id': objectid.ObjectId('5b2173b9362bf80840db6c2a'),
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'The filtered user',
                    'email': 'the-filtered-user@gmail.com',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
        ])
        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry', '--user-id-start', '44'])

        self.assertEqual(
            ['the-user@gmail.com'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        users = mock_user_db.user.find({})
        self.assertEqual(
            {
                'the-user@gmail.com': ['focus-network'],
                'the-filtered-user@gmail.com': [],
            },
            {
                u['profile']['email']: [e.get('campaignId') for e in u.get('emailsSent', [])]
                for u in users
            })

    @mock.patch('bob_emploi.frontend.server.mail.mail_send.send_template')
    @mock.patch('logging.warning')
    def test_error_while_sending(
            self, mock_warning: mock.MagicMock, mock_send_template: mock.MagicMock) -> None:
        """Error when sending an email get caught and logged as warning."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'The user',
                'email': 'the-user@gmail.com',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
        })

        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user = mock_user_db.user.find_one({})
        assert user
        self.assertEqual([], [e.get('campaignId') for e in user.get('emailsSent', [])])

        mock_warning.assert_called_once()
        self.assertEqual('Error while sending an email: %s', mock_warning.call_args[0][0])

    @mock.patch('bob_emploi.frontend.server.mail.mail_send.send_template')
    def test_error_while_sending_dry_run(self, mock_send_template: mock.MagicMock) -> None:
        """Error when sending an email in dry run mode is raised."""

        mock_send_template().raise_for_status.side_effect = requests.exceptions.HTTPError

        mock_db = pymongo.MongoClient('mongodb://mydata.com/test').test
        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_db.job_group_info.drop()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.drop()
        mock_user_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'The user',
                'email': 'the-user@gmail.com',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
        })

        with self.assertRaises(requests.exceptions.HTTPError):
            mail_blast.main([
                'focus-network', 'dry-run',
                '--registered-from', '2017-04-01',
                '--registered-to', '2017-07-10',
                '--disable-sentry'])

        self.assertFalse(mailjetmock.get_all_sent_messages())
        user = mock_user_db.user.find_one({})
        assert user
        self.assertEqual([], [e.get('campaignId') for e in user.get('emailsSent', [])])

    def test_wrong_email(self) -> None:
        """Users with wrong email don't get sent an email."""

        mock_user_db = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test
        mock_user_db.user.drop()
        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'The user',
                    'email': 'the-user@gmail .com',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
            {
                'registeredAt': '2017-05-15T00:00:00Z',
                'profile': {
                    'name': 'The user',
                    'email': 'the-user@gmail',
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            },
        ])
        mail_blast.main([
            'focus-network', 'send',
            '--registered-from', '2017-04-01',
            '--registered-to', '2017-07-10',
            '--disable-sentry'])
        self.assertFalse(mailjetmock.get_all_sent_messages())


if __name__ == '__main__':
    unittest.main()
