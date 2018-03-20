"""Unit tests for the bob_emploi.frontend.asynchronous.mail.mail_blast module."""

import datetime
import random
import re
import unittest
from urllib import parse

from google.protobuf import json_format
import mock
import mongomock

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import mail_blast


def CampaignTestBase(campaign_id):  # pylint: disable=invalid-name
    """Creates a base class for unit tests of a campaign."""

    class _TestCase(unittest.TestCase):

        @classmethod
        def setUpClass(cls):
            super(_TestCase, cls).setUpClass()
            cls._campaign_id = campaign_id

        def setUp(self):
            super(_TestCase, self).setUp()

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
            # TODO(cyrille): Replace these values by personas.
            self.user = user_pb2.User(user_id='%024x' % random.randrange(16**24))
            self.user.registered_at.FromDatetime(
                datetime.datetime.now() - datetime.timedelta(days=90))
            self.user.profile.gender = user_pb2.MASCULINE
            self.user.profile.name = 'Patrick'
            self.user.profile.email = 'patrick@bayes.org'
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

            self._variables = None

        @mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
        @mock.patch(mail_blast.mail.__name__ + '.send_template')
        def _assert_user_receives_campaign(self, mock_mail=None, should_be_sent=True):
            json_user = json_format.MessageToDict(self.user)
            json_user['_id'] = mongomock.ObjectId(json_user.pop('userId'))
            self._user_database.user.insert_one(json_user)
            mock_mail().status_code = 200
            mock_mail().json.return_value = {'Sent': [{'MessageID': 18014679230180635}]}
            mock_mail.reset_mock()
            year = self.user.registered_at.ToDatetime().year
            mail_blast.main([
                self._campaign_id,
                'send',
                '--disable-sentry',
                '--registered-from',
                str(year),
                '--registered-to',
                str(year + 1),
            ])
            if not should_be_sent:
                self.assertFalse(mock_mail.called)
                return
            mock_mail.assert_called_once()
            self._variables = mock_mail.call_args[0][2]

        def _assert_regex_field(self, field, regex):
            try:
                field_value = self._variables.pop(field)
            except KeyError:
                self.fail('Variables do not contain field "{}"'.format(field))
            self.assertRegex(field_value, regex)

        def _assert_has_unsubscribe_link(self, field='unsubscribeLink'):
            self._assert_regex_field(
                field,
                r'^{}&auth=\d+\.[a-f0-9]+$'.format(re.escape(
                    'https://www.bob-emploi.fr/unsubscribe.html?email={}'.format(
                        parse.quote(self.user.profile.email)))))

        def _assert_has_status_update_link(self, field='statusUpdateLink'):
            self._assert_regex_field(
                field,
                r'^{}&token=\d+\.[a-f0-9]+&gender=MASCULINE$'.format(re.escape(
                    'https://www.bob-emploi.fr/statut/mise-a-jour?user={}'
                    .format(self.user.user_id))))

        def _assert_remaining_variables(self, variables):
            self.assertEqual(variables, self._variables)

    return _TestCase


class SpontaneousVarsTestCase(unittest.TestCase):
    """Test for the spontaneous_vars function."""

    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    def test_basic(self, mock_database):
        """Basic usage."""

        mock_database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
            'applicationModes': {
                'juriste': {
                    'modes': [{'mode': 'SPONTANEOUS_APPLICATION', 'percentage': 100}],
                },
            },
            'preferredApplicationMedium': 'APPLY_BY_EMAIL',
            'toTheWorkplace': 'au cabinet',
            'placePlural': 'des cabinets juridiques',
            'inAWorkplace': 'dans un cabinet',
            'likeYourWorkplace': 'comme le vôtre',
            'atVariousCompanies': 'Auchan, Carrefour ou Lidl',
            'whatILoveAbout': 'where I can belong',
            'whySpecificCompany': 'different business styles',
        })
        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.weekly_applications_estimate = project_pb2.A_LOT

        spontaneous_vars = mail_blast.spontaneous_vars(user, 'focus-email')

        # Verify variable var.
        unsubscribe_link = spontaneous_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))
        status_update_link = spontaneous_vars.pop('statusUpdateUrl')
        self.assertRegex(
            status_update_link,
            r'^{}&token=\d+\.[a-f0-9]+&gender=MASCULINE$'.format(re.escape(
                'https://www.bob-emploi.fr/statut/mise-a-jour?user={}'
                .format(user.user_id))))

        self.assertEqual(
            {
                'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
                'atVariousCompanies': 'Auchan, Carrefour ou Lidl',
                'contactMode': 'BY_EMAIL',
                'deepLinkLBB':
                    'https://labonneboite.pole-emploi.fr/entreprises/commune/69123/'
                    'rome/A1234?utm_medium=web&utm_source=bob&utm_campaign=bob-email',
                'emailInUrl': 'patrick%40bayes.org',
                'experienceAsText': 'plus de 6 ans',
                'firstName': 'Patrick',
                'gender': 'MASCULINE',
                'hasReadPreviousEmail': '',
                'inWorkPlace': 'dans un cabinet',
                'jobName': 'juriste',
                'lastName': 'Benguigui',
                'likeYourWorkplace': 'comme le vôtre',
                'registeredMonthsAgo': 'trois',
                'someCompanies': 'des cabinets juridiques',
                'toTheWorkplace': 'au cabinet',
                'weeklyApplicationOptions': '15',
                'whatILoveAbout': 'where I can belong',
                'whySpecificCompany': 'different business styles',
            },
            spontaneous_vars)


class SelfDevelopmentVarsTestCase(unittest.TestCase):
    """Test for the self_development_vars function."""

    def test_basic(self):
        """Basic usage."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.seniority = project_pb2.SENIOR

        self_development_vars = mail_blast.self_development_vars(user)

        # Verify variable var.
        unsubscribe_link = self_development_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))

        self.assertEqual(
            {
                'firstName': 'Patrick',
                'gender': 'MASCULINE',
                'hasEnoughExperience': 'True',
                'isAdministrativeAssistant': '',
                'isOld': 'True',
                'isOldNotWoman': 'True',
                'isYoung': '',
                'isYoungNotWoman': '',
                'jobName': 'juriste',
                'ofJobName': 'de juriste',
                'registeredMonthsAgo': 'trois',
            },
            self_development_vars)


class BodyLanguageVarsTestCase(unittest.TestCase):
    """Test for the body_language_vars function."""

    def test_basic(self):
        """Basic usage."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        user.profile.frustrations.append(user_pb2.NO_OFFERS)
        user.profile.frustrations.append(user_pb2.INTERVIEW)
        user.profile.frustrations.append(user_pb2.ATYPIC_PROFILE)
        user.emails_sent.add(campaign_id='focus-network', status=user_pb2.EMAIL_SENT_CLICKED)
        project = user.projects.add()
        project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.seniority = project_pb2.SENIOR

        body_language_vars = mail_blast.body_language_vars(user)

        # Verify variable var.
        unsubscribe_link = body_language_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))

        self.assertEqual(
            {
                'firstName': 'Patrick',
                'gender': 'MASCULINE',
                'hasReadLastFocusEmail': 'True',
                'registeredMonthsAgo': 'trois',
                'worstFrustration': 'INTERVIEW',
            },
            body_language_vars)


class EmploymentVarsTestCase(unittest.TestCase):
    """Test for the employment_vars function."""

    def test_basic(self):
        """Basic usage."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.weekly_applications_estimate = project_pb2.A_LOT

        employment_vars = mail_blast.employment_vars(user)

        self.assertRegex(
            employment_vars.pop('unsubscribeLink'),
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))
        self.assertEqual(employment_vars['firstName'], 'Patrick')
        self.assertEqual(employment_vars['registeredMonthsAgo'], 'trois')
        self.assertRegex(
            employment_vars['seekingUrl'],
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$'
        )
        self.assertRegex(
            employment_vars['stopSeekingUrl'],
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$'
        )

    def test_status_updated_recently(self):
        """Test that employment_vars returns None for user whose employment status has been updated
        recently."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        status = user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=17))
        self.assertFalse(mail_blast.employment_vars(user))

    def test_status_updated_long_ago(self):
        """Test that employment_vars returns something for user whose employment status has not been
        updated recently."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=180))
        status = user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=58))
        self.assertTrue(mail_blast.employment_vars(user))


class NewDiagnosticVarsTestCase(unittest.TestCase):
    """Test for the new_diagnostic_vars function."""

    def test_basic(self):
        """Basic usage."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        user.user_id = '123456'
        user.profile.gender = user_pb2.MASCULINE
        user.profile.email = 'patrick@bayes.org'
        user.profile.name = 'Patrick'
        user.profile.year_of_birth = 1965
        user.profile.family_situation = user_pb2.FAMILY_WITH_KIDS
        user.profile.frustrations.append(user_pb2.NO_OFFERS)
        user.profile.frustrations.append(user_pb2.INTERVIEW)
        user.profile.frustrations.append(user_pb2.ATYPIC_PROFILE)

        new_diagnostic_vars = mail_blast.new_diagnostic_vars(user)

        # Verify variable vars.
        unsubscribe_link = new_diagnostic_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))
        login_url = new_diagnostic_vars.pop('loginUrl')
        self.assertRegex(
            login_url,
            r'^{}&authToken=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr?userId=123456')))
        stop_seeking_url = new_diagnostic_vars.pop('stopSeekingUrl')
        self.assertRegex(
            stop_seeking_url,
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$')

        self.assertEqual(
            {
                'firstName': 'Patrick',
                'gender': 'MASCULINE',
                'mayHaveSeekingChildren': 'True',
                'frustration_NO_OFFERS': 'True',
                'frustration_INTERVIEW': 'True',
                'frustration_ATYPIC_PROFILE': 'True',
            },
            new_diagnostic_vars)


class Galita1VarsTestCase(CampaignTestBase('galita-1')):
    """Test of galita1 mail campaign variables."""

    def test_basic(self):
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        # TODO(cyrille): Move tests on firstName and gender to a test on get_default_variables.
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_pb2.MOTIVATION)

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })


class ViralSharingVarsTestCase(CampaignTestBase('viral-sharing-1')):
    """Test of galita1 mail campaign variables."""

    def test_recent_user(self):
        """User registered less than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        self._assert_user_receives_campaign(should_be_sent=False)

    @mock.patch(mail_blast.hashlib.__name__ + '.sha1')
    def test_not_good_hash_user(self, mock_hasher):
        """User hash is not selected."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        mock_hasher().digest.return_value = '12345'.encode('utf-8')
        mock_hasher().hexdigest.return_value = '12345'

        self._assert_user_receives_campaign(should_be_sent=False)

    @mock.patch(mail_blast.hashlib.__name__ + '.sha1')
    def test_old_user(self, mock_hasher):
        """User registered more than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=400))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        mock_hasher().digest.return_value = '012345'.encode('utf-8')
        mock_hasher().hexdigest.return_value = '012345'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })


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
class FocusEmailTestCase(unittest.TestCase):
    """Tests for the blast_campaign function."""

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(mail_blast.mail.__name__ + '.send_template')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    def test_blast_campaign(self, mock_db, mock_user_db, mock_mail, mock_logging):
        """Basic test."""

        mock_mail().status_code = 200
        mock_mail().json.return_value = {'Sent': [{'MessageID': 18014679230180635}]}
        mock_mail.reset_mock()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.insert_many([
            {
                '_id': '%d' % month,
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

        self.assertEqual(
            3, mock_mail.call_count,
            msg='3 emails expected: one per month from April to June\n{}'.format(
                mock_mail.call_args_list))
        self.assertEqual(
            {'sender_email': 'margaux@bob-emploi.fr', 'sender_name': 'Margaux de Bob'},
            mock_mail.call_args[1])
        february_user = mock_user_db.user.find_one({'_id': '2'})
        self.assertFalse(february_user.get('emailsSent'))

        april_user = mock_user_db.user.find_one({'_id': '4'})
        self.assertEqual(
            [{'sentAt', 'mailjetTemplate', 'campaignId', 'mailjetMessageId'}],
            [e.keys() for e in april_user.get('emailsSent', [])])
        self.assertEqual('focus-network', april_user['emailsSent'][0]['campaignId'])
        self.assertEqual(18014679230180635, int(april_user['emailsSent'][0]['mailjetMessageId']))

        mock_logging.assert_any_call('Email sent to %s', 'email4@corpet.net')
        mock_logging.assert_called_with('%d emails sent.', 3)

    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(mail_blast.now.__name__ + '.get')
    @mock.patch(mail_blast.mail.__name__ + '.send_template')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_change_policy(self, mock_user_db, mock_mail, mock_now, unused_mock_db):
        """Test with non-default emailing policy."""

        mock_mail().status_code = 200
        mock_mail().json.return_value = {'Sent': [{'MessageID': 18014679230180635}]}
        mock_mail.reset_mock()
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

        self.assertEqual(
            1, mock_mail.call_count,
            msg='1 emails expected:\n{}'.format(
                mock_mail.call_args_list))

    @mock.patch(mail_blast.logging.__name__ + '.info')
    @mock.patch(mail_blast.mail.__name__ + '.send_template')
    @mock.patch(
        mail_blast.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_stop_seeking(self, mock_user_db, mock_db, mock_mail, mock_logging):
        """Basic test."""

        mock_mail().status_code = 200
        mock_mail().json.return_value = {'Sent': [{'MessageID': 18014679230180635}]}
        mock_mail.reset_mock()
        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })
        mock_user_db.user.insert_many([
            {
                '_id': '%s' % seeking,
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
            1, mock_mail.call_count,
            msg='1 email expected: only for the user who is still seeking\n{}'.format(
                mock_mail.call_args_list))
        mock_logging.assert_any_call('Email sent to %s', 'emailSTILL_SEEKING@corpet.net')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
