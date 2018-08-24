"""Unit tests for the bob_emploi.frontend.asynchronous.mail.mail_blast module."""

import datetime
import random
import re
import unittest
from urllib import parse

from bson import objectid
from google.protobuf import json_format
import mock
import mongomock

from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import campaign
from bob_emploi.frontend.server.asynchronous.mail import mail_blast
from bob_emploi.frontend.server.test import mailjetmock


_FAKE_CAMPAIGNS = {'fake-user-campaign': campaign.Campaign(
    '000000', {},
    lambda user, **unused_kwargs: {'key': 'value'},
    'Sender', 'sender@example.com',
    users_collection=campaign.BOB_USERS)}


class CampaignTestBase(unittest.TestCase):
    """Base class for unit tests of a campaign."""

    # Need to be overriden in subclasses.
    campaign_id = None
    # May be overriden in subclasses.
    mongo_collection = 'user'

    @classmethod
    def setUpClass(cls):
        super(CampaignTestBase, cls).setUpClass()
        if cls.campaign_id is None:
            raise NotImplementedError(
                'The class "{}" is missing a campaing_id'.format(cls.__name__))

    def setUp(self):
        super(CampaignTestBase, self).setUp()

        self.database = mongomock.MongoClient().test
        db_patcher = mock.patch(mail_blast.__name__ + '._DB', self.database)
        db_patcher.start()
        self.addCleanup(db_patcher.stop)
        self._user_database = mongomock.MongoClient().test
        user_db_patcher = mock.patch(mail_blast.__name__ + '._USER_DB', self._user_database)
        user_db_patcher.start()
        self.addCleanup(user_db_patcher.stop)
        # TODO(cyrille): Use this to mock time whenever necessary.
        self.now = None
        # Default values that shouldn't be expected, and should be overridden when necessary.
        user_name = 'Patrick'
        user_email = 'patrick@bayes.org'
        user_user_id = '%024x' % random.randrange(16**24)
        user_registration_date = datetime.datetime.now() - datetime.timedelta(days=90)
        if self.mongo_collection == 'user':
            # TODO(cyrille): Replace these values by personas.
            self.user = user_pb2.User(user_id=user_user_id)
            self.user.registered_at.FromDatetime(user_registration_date)
            self.user.profile.gender = user_pb2.MASCULINE
            self.user.profile.name = user_name
            self.user.profile.email = user_email
            self.user.profile.year_of_birth = 1990
            self.project = self.user.projects.add()
            self.project.target_job.masculine_name = 'Coiffeur'
            self.project.target_job.feminine_name = 'Coiffeuse'
            self.project.target_job.name = 'Coiffeur / Coiffeuse'
            self.project.target_job.code_ogr = '123456'
            self.project.target_job.job_group.rome_id = 'B1234'
            self.project.target_job.job_group.name = 'Coiffure'
            self.project.network_estimate = 1
            self.project.mobility.city.city_id = '69003'
            self.project.mobility.city.name = 'Lyon'
            self.project.mobility.city.departement_id = '69'
            self.project.mobility.city.departement_prefix = 'dans le '
            self.project.mobility.city.departement_name = 'Rhône'
            self.project.mobility.city.region_id = '84'
            self.project.mobility.city.region_name = 'Auvergne-Rhône-Alpes'

        elif self.mongo_collection == 'helper':
            self.user = helper_pb2.Helper(user_id=user_user_id)
            self.user.registered_at.FromDatetime(user_registration_date)
            self.user.name = user_name
            self.user.email = user_email
            self.user.email_confirmed = True
            self.promise = self.user.promises.add()
            self.promise.kind = helper_pb2.HELP_RESUME

        elif self.mongo_collection == 'cvs_and_cover_letters':
            self.user = review_pb2.DocumentToReview(user_id=user_user_id)

        self._variables = None

    @mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
    @mailjetmock.patch()
    def _assert_user_receives_campaign(self, should_be_sent=True):
        json_user = json_format.MessageToDict(self.user)
        json_user['_id'] = mongomock.ObjectId(json_user.pop('userId'))
        self._user_database.get_collection(self.mongo_collection).insert_one(json_user)
        if self.mongo_collection == 'cvs_and_cover_letters':
            # This is not actually needed, we just need to avoid calling self.user.registered_at.
            year = 2018
        else:
            year = self.user.registered_at.ToDatetime().year
        mail_blast.main([
            self.campaign_id,
            'send',
            '--disable-sentry',
            '--registered-from',
            str(year),
            '--registered-to',
            str(year + 1),
        ])
        all_sent_messages = mailjetmock.get_all_sent_messages()
        if not should_be_sent:
            self.assertFalse(all_sent_messages)
            return
        self.assertEqual(1, len(all_sent_messages), msg=all_sent_messages)
        self.assertEqual(self.campaign_id, all_sent_messages[0].properties['CustomCampaign'])
        self._variables = all_sent_messages[0].properties['Variables']

    def _assert_regex_field(self, field, regex):
        try:
            field_value = self._variables.pop(field)
        except KeyError:
            self.fail('Variables do not contain field "{}":\n{}'.format(field, self._variables))
        self.assertRegex(field_value, regex)

    def _assert_url_field(self, field, url, **args_matcher):
        try:
            field_value = self._variables.pop(field)
        except KeyError:
            self.fail('Variables do not contain field "{}"\n{}'.format(field, self._variables))
        self.assertEqual(url, field_value[:len(url)], msg=field_value)
        self.assertEqual('?', field_value[len(url):len(url) + 1], msg=field_value)
        args = parse.parse_qs(field_value[len(url) + 1:])
        for key, matcher in args_matcher.items():
            self.assertIn(key, args, msg=field_value)
            msg = 'For key {} of {}'.format(key, field_value)
            if isinstance(matcher, str):
                self.assertEqual(matcher, args[key][0], msg=msg)
            else:
                self.assertRegex(args[key][0], matcher, msg=msg)
        self.assertFalse(
            args.keys() - args_matcher.keys(), msg='Not all URL arguments are accounted for')

    def _assert_has_unsubscribe_link(self, field='unsubscribeLink'):
        if self.mongo_collection == 'user':
            self._assert_has_unsubscribe_url(field)
        elif self.mongo_collection == 'helper':
            self.assertEqual(
                self._variables.pop(field),
                'https://www.bob-emploi.fr/api/mayday/unsubscribe?userId={}'.format(
                    self.user.user_id))
        else:
            self.fail('"{}" mongo collection is not known.'.format(self.mongo_collection))

    def _assert_has_unsubscribe_url(self, field='unsubscribeLink', **kwargs):
        self._assert_url_field(
            field, 'https://www.bob-emploi.fr/unsubscribe.html',
            **dict({
                'user': self.user.user_id,
                'auth': re.compile(r'^\d+\.[a-f0-9]+$'),
            }, **kwargs))

    def _assert_has_status_update_link(self, field='statusUpdateLink'):
        # TODO(pascal): Use _assert_url_field.
        self._assert_regex_field(
            field,
            r'^{}&token=\d+\.[a-f0-9]+&gender=MASCULINE$'.format(re.escape(
                'https://www.bob-emploi.fr/statut/mise-a-jour?user={}'
                .format(self.user.user_id))))

    def _assert_remaining_variables(self, variables):
        self.assertEqual(variables, self._variables)


class EmailPolicyTestCase(unittest.TestCase):
    """Tests for the EmailPolicy class."""

    def _make_email(
            self, campaign_id, days_ago=0, hours_ago=0, status=user_pb2.EMAIL_SENT_SENT,
            status_updated_days_after=8):
        email = user_pb2.EmailSent(campaign_id=campaign_id, status=status)
        email.sent_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days_ago, hours_ago))
        if status_updated_days_after:
            email.last_status_checked_at.FromDatetime(
                email.sent_at.ToDatetime() + datetime.timedelta(status_updated_days_after))
        return email

    def test_no_previous_mails(self):
        """Basic test."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        self.assertTrue(email_policy.can_send('focus-network', []))

    def test_email_sent_recently(self):
        """Test email sent recently."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        emails_sent = [self._make_email('other-mail', days_ago=6)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('other-mail', days_ago=8)]
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))

    def test_email_send_campaign_again(self):
        """Test same campaign mail sent recently."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=14)
        emails_sent = [self._make_email('focus-network', days_ago=13)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('focus-network', days_ago=15)]
        self.assertTrue(email_policy.can_send('focus-network', emails_sent))

    def test_email_send_campaign_again_later(self):
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

    def test_email_not_send_campaign_again(self):
        """Test policy where we don't resend the same campaign."""

        email_policy = mail_blast.EmailPolicy(
            days_since_any_email=7, days_since_same_campaign_unread=0)
        emails_sent = [self._make_email('focus-network', days_ago=13)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))
        emails_sent = [self._make_email('focus-network', days_ago=365)]
        self.assertFalse(email_policy.can_send('focus-network', emails_sent))

    def test_several_email_sent(self):
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

    def test_mail_status_not_updated(self):
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
        self.assertFalse(email_policy.can_send('focus-marvel', emails_sent))


@mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
class BlastCampaignTest(unittest.TestCase):
    """Tests for the blast_campaign function."""

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    def test_blast_campaign(self, mock_db, mock_user_db, mock_logging):
        """Basic test."""

        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.insert_many([
            {
                '_id': objectid.ObjectId('7b18313aa35d807e631ea3d%d' % month),
                'registeredAt': '2017-%02d-15T00:00:00Z' % month,
                'profile': {
                    'name': '{} user'.format(month),
                    'email': 'email{}@corpet.net'.format(month),
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
            msg='3 emails expected: one per month from April to June\n{}'.format(
                mails_sent))
        self.assertEqual(
            {'margaux@bob-emploi.fr'},
            {m.properties['From']['Email'] for m in mails_sent})
        february_user = mock_user_db.user.find_one(
            {'_id': objectid.ObjectId('7b18313aa35d807e631ea3d2')})
        self.assertFalse(february_user.get('emailsSent'))

        april_user = mock_user_db.user.find_one(
            {'_id': objectid.ObjectId('7b18313aa35d807e631ea3d4')})
        self.assertEqual(
            [{'sentAt', 'mailjetTemplate', 'campaignId', 'mailjetMessageId'}],
            [e.keys() for e in april_user.get('emailsSent', [])])
        self.assertEqual('focus-network', april_user['emailsSent'][0]['campaignId'])
        self.assertEqual(
            next(mailjetmock.get_messages_sent_to('email4@corpet.net')).message_id,
            int(april_user['emailsSent'][0]['mailjetMessageId']))

        mock_logging.assert_any_call('Email sent to %s', 'email4@corpet.net')
        mock_logging.assert_called_with('%d emails sent.', 3)

    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(mail_blast.now.__name__ + '.get')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_change_policy(self, mock_user_db, mock_now, unused_mock_db):
        """Test with non-default emailing policy."""

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
    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_stop_seeking(self, mock_user_db, mock_db, mock_logging):
        """Basic test."""

        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-04-15T00:00:00Z',
                'profile': {
                    'name': '{} user'.format(seeking),
                    'email': 'email{}@corpet.net'.format(seeking),
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
        mock_logging.assert_any_call('Email sent to %s', 'emailSTILL_SEEKING@corpet.net')

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_blast_helpers(self, mock_user_db, mock_logging):
        """Send a campaign to helpers (and not users)."""

        mock_user_db.user.insert_one({
            'registeredAt': '2018-04-15T00:00:00Z',
            'profile': {
                'email': 'user@corpet.net',
            },
        })
        mock_user_db.helper.insert_one({
            'email': 'helper@corpet.net',
            'promises': [{'kind': 'HELP_COVER_LETTER'}],
            'registeredAt': '2018-04-15T00:00:00Z',
        })
        mail_blast.main([
            'mayday-confirmation', 'send',
            '--registered-from', '2018-04-01',
            '--registered-to', '2018-05-10',
            '--disable-sentry'])

        self.assertEqual(
            ['helper@corpet.net'],
            [m.recipient['Email'] for m in mailjetmock.get_all_sent_messages()])
        self.assertFalse(mock_user_db.user.find_one().get('emailsSent'))
        self.assertTrue(mock_user_db.helper.find_one().get('emailsSent'))

        mock_logging.assert_any_call('Email sent to %s', 'helper@corpet.net')
        mock_logging.assert_called_with('%d emails sent.', 1)

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    @mock.patch(mail_blast.campaign.__name__ + '._CAMPAIGNS', new=_FAKE_CAMPAIGNS)
    @mock.patch(mail_blast.hashlib.__name__ + '.sha1')
    def test_blast_hash_start(self, mock_hasher, mock_user_db, mock_logging):
        """Send mail to users with given hash start."""

        hash_values = ['12345', '01234']
        mock_hasher.reset_mock()
        mock_hasher().hexdigest.side_effect = hash_values

        mock_user_db.user.insert_many([
            {
                'registeredAt': '2017-04-15T00:00:00Z',
                'profile': {
                    'name': 'user {}'.format(hash_value),
                    'email': 'email{}@corpet.net'.format(hash_value),
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
            1, len(sent_messages),
            msg='1 email expected: only for the user whith hash starting with 1\n{}'.format(
                sent_messages))
        mock_logging.assert_any_call('Email sent to %s', 'email12345@corpet.net')


@mock.patch(campaign.__name__ + '._CAMPAIGNS', new={'fake-document': campaign.Campaign(
    mailjet_template='123456',
    users_collection=campaign.BOB_ACTION_DOCUMENTS,
    mongo_filters={},
    get_vars=lambda document, **unused_kwargs: {'kind': document.kind},
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
)})
class BobActionDocumentsCollectionTestCase(unittest.TestCase):
    """Testing blasts for the document collection."""

    def setUp(self):
        super(BobActionDocumentsCollectionTestCase, self).setUp()
        self._user_database = mongomock.MongoClient().test
        user_db_patcher = mock.patch(mail_blast.__name__ + '._USER_DB', self._user_database)
        user_db_patcher.start()
        self.addCleanup(user_db_patcher.stop)
        self._user_database.cvs_and_cover_letters.insert_one({
            '_id': objectid.ObjectId('5b2173b9362bf80840db6c2a'),
            'name': 'Nathalie',
            'anonymizedUrl': 'https://dl.airtable.com/fakeurl.pdf',
            'kind': 'DOCUMENT_COVER_LETTER',
            'ownerEmail': 'nathalie@bayes.org',
            'numDoneReviews': 1,
        })

    @mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
    @mailjetmock.patch()
    def test_send(self):
        """Test really sending to a document owner."""

        mail_blast.main(['fake-document', 'send', '--disable-sentry'])
        messages = mailjetmock.get_all_sent_messages()
        self.assertTrue(messages)
        self.assertEqual(1, len(messages))
        message = messages.pop()
        self.assertEqual('Nathalie ', message.recipient['Name'])
        self.assertEqual('nathalie@bayes.org', message.recipient['Email'])

    @mailjetmock.patch()
    def test_dry_run(self):
        """Test a dry run for documents."""

        mail_blast.main(['fake-document', 'dry-run', '--dry-run-email', 'cyrille@bayes.org'])
        messages = mailjetmock.get_all_sent_messages()
        self.assertTrue(messages)
        self.assertEqual(1, len(messages))
        message = messages.pop()
        self.assertEqual('Nathalie ', message.recipient['Name'])
        self.assertEqual('cyrille@bayes.org', message.recipient['Email'])

    @mock.patch(mail_blast.campaign.logging.__name__ + '.info')
    def test_list(self, mock_logging):
        """Test a list for documents blast."""

        mail_blast.main(['fake-document', 'list'])
        messages = mailjetmock.get_all_sent_messages()
        self.assertFalse(messages)
        mock_logging.assert_any_call(
            '%s: %s %s', 'fake-document', '5b2173b9362bf80840db6c2a', 'nathalie@bayes.org')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
