"""Unit tests for some of the campaigns defined in the all_campaigns module."""

import datetime
import hashlib
import re
import unittest

import mock

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class SpontaneousVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the spontaneous_vars focus email."""

    campaign_id = 'focus-spontaneous'

    def test_basic(self):
        """Basic usage."""

        self.database.job_group_info.insert_one({
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
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.last_name = 'Benguigui'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH
        project = self.user.projects[0]
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.created_at.FromDatetime(datetime.datetime.now())
        project.weekly_applications_estimate = project_pb2.A_LOT
        project.job_search_length_months = 3

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')

        self._assert_remaining_variables({
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
            'inWorkPlace': 'dans un cabinet',
            'jobName': 'juriste',
            'lastName': 'Benguigui',
            'likeYourWorkplace': 'comme le vôtre',
            'someCompanies': 'des cabinets juridiques',
            'toTheWorkplace': 'au cabinet',
            'weeklyApplicationOptions': '15',
            'whatILoveAbout': 'where I can belong',
            'whySpecificCompany': 'different business styles',
        })


class SelfDevelopmentVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the self development campaign."""

    campaign_id = 'focus-self-develop'

    def test_basic(self):
        """Basic usage."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.last_name = 'Benguigui'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.year_of_birth = 1958
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_MAXIMUM
        project = self.user.projects[0]
        project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        project.job_search_length_months = 6
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.seniority = project_pb2.SENIOR

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_remaining_variables({
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
        })


class BodyLanguageVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the body language campaign."""

    campaign_id = 'focus-body-language'

    def test_basic(self):
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        del self.user.profile.frustrations[:]
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_MAXIMUM
        self.user.profile.frustrations.append(user_pb2.NO_OFFERS)
        self.user.profile.frustrations.append(user_pb2.INTERVIEW)
        self.user.profile.frustrations.append(user_pb2.ATYPIC_PROFILE)
        self.user.emails_sent.add(campaign_id='focus-network', status=user_pb2.EMAIL_SENT_CLICKED)

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'worstFrustration': 'INTERVIEW',
        })


class EmploymentVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the RER campaign."""

    campaign_id = 'employment-status'

    def test_basic(self):
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.email = 'patrick@bayes.org'
        project = self.user.projects[0]
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.job_search_length_months = 6
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.weekly_applications_estimate = project_pb2.A_LOT

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_regex_field(
            'seekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$')
        self._assert_regex_field(
            'stopSeekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$')
        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'registeredMonthsAgo': 'trois',
        })

    def test_status_updated_recently(self):
        """Test that employment_vars returns None for user whose employment status has been updated
        recently."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.projects[0].job_search_length_months = 6
        status = self.user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=17))

        self._assert_user_receives_campaign(False)

    def test_status_updated_long_ago(self):
        """Test that employment_vars returns something for user whose employment status has not been
        updated recently."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=180))
        self.user.projects[0].job_search_length_months = 6
        status = self.user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=58))

        self._assert_user_receives_campaign()


class NewDiagnosticVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the new diagnostic campaign."""

    campaign_id = 'new-diagnostic'

    def test_basic(self):
        """Basic usage."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.name = 'Patrick'
        self.user.profile.year_of_birth = 1965
        self.user.profile.family_situation = user_pb2.FAMILY_WITH_KIDS
        self.user.profile.frustrations.append(user_pb2.NO_OFFERS)
        self.user.profile.frustrations.append(user_pb2.INTERVIEW)
        self.user.profile.frustrations.append(user_pb2.ATYPIC_PROFILE)

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_regex_field(
            'loginUrl',
            r'^{}&authToken=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr?userId={}'.format(self.user.user_id))))
        self._assert_regex_field(
            'stopSeekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$')

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'mayHaveSeekingChildren': 'True',
            'frustration_NO_OFFERS': 'True',
            'frustration_INTERVIEW': 'True',
            'frustration_ATYPIC_PROFILE': 'True',
        })


class Galita1VarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of galita1 mail campaign variables."""

    campaign_id = 'galita-1'

    def test_basic(self):
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        # TODO(cyrille): Move tests on firstName and gender to a test on get_default_variables.
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })


class Galita3VarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of galita3 mail campaign variables."""

    campaign_id = 'galita-3'

    def test_basic(self):
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'deepLinkToAdvice': ' ',
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })

    def test_with_deep_link(self):
        """With a follow-up advice."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.frustrations.append(user_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

        self.project.project_id = '123'
        advice = self.project.advices.add()
        advice.advice_id = 'follow-up'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self.assertEqual(
            'https://www.bob-emploi.fr/projet/123/follow-up',
            self._variables.pop('deepLinkToAdvice'))


class ViralSharingVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of viral mail campaign variables."""

    campaign_id = 'viral-sharing-1'

    def test_recent_user(self):
        """User registered less than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        self._assert_user_receives_campaign(should_be_sent=False)

    @mock.patch(hashlib.__name__ + '.sha1')
    def test_not_good_hash_user(self, mock_hasher):
        """User hash is not selected."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        mock_hasher().digest.return_value = '012345'.encode('utf-8')
        mock_hasher().hexdigest.return_value = '012345'

        self._assert_user_receives_campaign(should_be_sent=False)

    @mock.patch(hashlib.__name__ + '.sha1')
    def test_old_user(self, mock_hasher):
        """User registered more than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=400))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        mock_hasher().digest.return_value = '12345'.encode('utf-8')
        mock_hasher().hexdigest.return_value = '12345'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
