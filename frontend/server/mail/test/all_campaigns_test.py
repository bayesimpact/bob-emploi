"""Unit tests for some of the campaigns defined in the all_campaigns module."""

import datetime
import os
import unittest
from unittest import mock

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper


class SelfDevelopmentVarsTestCase(campaign_helper.CampaignTestBase):
    """Test for the self development campaign."""

    campaign_id = 'focus-self-develop'

    def setUp(self) -> None:
        super().setUp()
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.last_name = 'Benguigui'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.year_of_birth = 1958
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_MAXIMUM
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.seniority = project_pb2.SENIOR

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_remaining_variables({
            'hasEnoughExperience': 'True',
            'hasVideo': 'True',
            'isAdministrativeAssistant': '',
            'isOld': 'True',
            'isOldNotWoman': 'True',
            'isYoung': '',
            'isYoungNotWoman': '',
            'jobName': 'juriste',
        })

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project, no email."""

        self.project.is_incomplete = True
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_job_search_not_started(self) -> None:
        """Job search not started, no email."""

        self.project.job_search_has_not_started = True
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_undefined_project(self) -> None:
        """Undefined project, an email is sent but without a job name."""

        self.project.ClearField('target_job')
        self._assert_user_receives_campaign()
        self.assertEqual('', self._variables.pop('jobName'))


class BodyLanguageVarsTestCase(campaign_helper.CampaignTestBase):
    """Test for the body language campaign."""

    campaign_id = 'focus-body-language'

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        del self.user.profile.frustrations[:]
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_MAXIMUM
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFERS)
        self.user.profile.frustrations.append(user_profile_pb2.INTERVIEW)
        self.user.profile.frustrations.append(user_profile_pb2.ATYPIC_PROFILE)
        self.user.emails_sent.add(campaign_id='focus-network', status=email_pb2.EMAIL_SENT_CLICKED)

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'worstFrustration': 'INTERVIEW',
        })

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project, no email."""

        self.project.is_incomplete = True
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_relevant_frustration(self) -> None:
        """No relevant frustration, no email."""

        del self.user.profile.frustrations[:]
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFERS)
        self._assert_user_receives_campaign(should_be_sent=False)


_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


@mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
class EmploymentVarsTestCase(campaign_helper.CampaignTestBase):
    """Test for the RER campaign."""

    campaign_id = 'employment-status'

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.email = 'patrick@bayes.org'
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.created_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=270))
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'
        self.project.city.city_id = '69123'
        self.project.seniority = project_pb2.SENIOR
        self.project.weekly_applications_estimate = project_pb2.A_LOT

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_regex_field(
            'seekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*en-recherche$')
        self._assert_regex_field(
            'stopSeekingUrl',
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*ne-recherche-plus$')
        self._assert_remaining_variables({
            'registeredSince': 'trois mois',
        })

    def test_i18n(self) -> None:
        """Email in English."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.locale = 'en'
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.created_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=270))
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'
        self.project.city.city_id = '69123'
        self.project.seniority = project_pb2.SENIOR
        self.project.weekly_applications_estimate = project_pb2.A_LOT

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_regex_field(
            'seekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*en-recherche$')
        self._assert_regex_field(
            'stopSeekingUrl',
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*ne-recherche-plus$')
        self._assert_remaining_variables({
            'registeredSince': 'three months',
        })

    @mock.patch('logging.warning', mock.MagicMock)
    def test_just_signed_up(self) -> None:
        """If user has just signed up, no email."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=3))
        self.project.created_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=3))
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=183))
        self._assert_user_receives_campaign(False)

    @mock.patch('logging.warning', mock.MagicMock)
    def test_just_signed_up_apha(self) -> None:
        """If user has just signed up but is in alpha, send an email."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=3))
        self.user.features_enabled.alpha = True
        self.project.created_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=3))
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=183))
        self._assert_user_receives_campaign()

    def test_status_updated_recently(self) -> None:
        """Test that employment_vars returns None for user whose employment status has been updated
        recently."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        status = self.user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=17))

        self._assert_user_receives_campaign(False)

    def test_status_updated_long_ago(self) -> None:
        """Test that employment_vars returns something for user whose employment status has not been
        updated recently."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=180))
        status = self.user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=58))

        self._assert_user_receives_campaign()


class Galita1VarsTestCase(campaign_helper.CampaignTestBase):
    """Test of galita1 mail campaign variables."""

    campaign_id = 'galita-1'

    def setUp(self) -> None:
        super().setUp()
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        # TODO(cyrille): Move tests on firstName and gender to a test on get_default_variables.
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_profile_pb2.MOTIVATION)
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({})

    @mock.patch('logging.info', mock.MagicMock)
    def test_job_search_not_started(self) -> None:
        """Job search not started, no email."""

        self.project.job_search_has_not_started = True
        self._assert_user_receives_campaign(should_be_sent=False)


class Galita2VarsTestCase(campaign_helper.CampaignTestBase):
    """Test of galita2 mail campaign variables."""

    campaign_id = 'galita-2'

    def test_basic(self) -> None:
        """Basic usage."""

        # TODO(cyrille): Again, move tests on firstName and gender to a test
        # on get_default_variables.
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.target_job.masculine_name = 'Maçon'
        self.project.previous_job_similarity = project_pb2.NEVER_DONE
        self.project.kind = project_pb2.FIND_A_NEW_JOB

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'isReorienting': '',
        })


class Galita2ShortVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of galita2 short mail campaign variables."""

    campaign_id = 'galita-2-short'

    def test_basic(self) -> None:
        """Basic usage."""

        # TODO(cyrille): Again, move tests on firstName and gender to a test
        # on get_default_variables.
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.target_job.masculine_name = 'Maçon'
        self.project.previous_job_similarity = project_pb2.NEVER_DONE
        self.project.kind = project_pb2.FIND_A_NEW_JOB

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({})


class Galita3VarsTestCase(campaign_helper.CampaignTestBase):
    """Test of galita3 mail campaign variables."""

    campaign_id = 'galita-3'

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'deepLinkToAdvice': ' ',
        })

    def test_with_deep_link(self) -> None:
        """With a follow-up advice."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH

        self.project.project_id = '123'
        advice = self.project.advices.add()
        advice.advice_id = 'follow-up'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_url()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_has_logged_url(
            'deepLinkToAdvice',
            '/projet/123/methode/follow-up',
        )


class Galita3ShortVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of galita3-short mail campaign variables."""

    campaign_id = 'galita-3-short'

    @mock.patch('logging.warning')
    def test_basic(self, mock_logging: mock.MagicMock) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self._assert_user_receives_campaign()
        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')
        self._assert_remaining_variables({
            'advicePageUrl': 'https://www.ionos.fr/startupguide/productivite/mail-de-relance-candidature',
            'hasImageUrl': False,
            'weeklyApplicationsEstimate': 'UNKNOWN_NUMBER_ESTIMATE_OPTION',
        })
        self.assertFalse(mock_logging.called)

    def test_en_content(self) -> None:
        """User with EN locale."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_profile_pb2.NO_OFFER_ANSWERS)
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.user.profile.locale = 'en_UK'
        self._assert_user_receives_campaign()
        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')
        self._assert_remaining_variables({
            'advicePageUrl': 'https://zety.com/blog/how-to-follow-up-on-a-job-application',
            'hasImageUrl': True,
            'weeklyApplicationsEstimate': 'UNKNOWN_NUMBER_ESTIMATE_OPTION',
        })


class PostCovidVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of post-covid mail campaign variables."""

    campaign_id = 'post-covid'

    def test_basic(self) -> None:
        """Basic usage."""

        self.database.job_group_info.insert_one({
            '_id': 'B1801',
            'covidRisk': 'COVID_RISKY',
        })

        self.project.project_id = '123'
        self.project.target_job.masculine_name = 'Maçon'
        self.project.target_job.job_group.rome_id = 'B1801'
        advice = self.project.advices.add()
        advice.advice_id = 'network-application-good'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_url()
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_has_logged_url(
            'deepLinkAdviceUrl',
            '/projet/123/methode/network-application-good',
        )

        self.assertEqual('de maçon', self._variables.pop('ofJobName'))

    def test_not_affected_user(self) -> None:
        """User who should not receive campaign because not affected by COVID."""

        self.database.job_group_info.insert_one({'_id': 'A1234'})

        self.project.project_id = '123'
        self.project.target_job.masculine_name = 'Maçon'
        self.project.target_job.job_group.rome_id = 'A1234'
        advice = self.project.advices.add()
        advice.advice_id = 'network-application-good'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_network_advice_user(self) -> None:
        """User who should not receive campaign because they don't have network advice."""

        self.database.job_group_info.insert_one({
            '_id': 'B1801',
            'covidRisk': 'COVID_RISKY',
        })

        self.project.project_id = '123'
        self.project.target_job.masculine_name = 'Maçon'
        self.project.target_job.job_group.rome_id = 'B1801'

        self._assert_user_receives_campaign(should_be_sent=False)


class OpenClassroomsVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of open classrooms mail campaign variables."""

    campaign_id = 'open-classrooms'

    def setUp(self) -> None:
        super().setUp()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
        })
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.name = 'Nathalie'
        self.user.profile.year_of_birth = datetime.datetime.now().year - 20
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=100))
        self.user.profile.highest_degree = job_pb2.BAC_BACPRO
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_MAXIMUM
        self.project.target_job.job_group.rome_id = 'A1234'

    def test_basic(self) -> None:
        """Basic usage."""

        self.project.kind = project_pb2.FIND_A_NEW_JOB
        self.project.passionate_level = project_pb2.ALIMENTARY_JOB

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_default_vars(first_name='Nathalie', gender='FEMININE')
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'hasAtypicProfile': '',
            'hasFamilyAndManagementIssue': '',
            'hasSeniority': '',
            'hasSimpleApplication': 'True',
            'isFrustratedOld': '',
            'isReorienting': '',
            'ofFirstName': 'de Nathalie',
        })

    def test_old_user(self) -> None:
        """User registered more than 6 months ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=200))
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_is_too_old(self) -> None:
        """User has more than 54 years old."""

        self.user.profile.year_of_birth = datetime.datetime.now().year - 60

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_is_too_young(self) -> None:
        """User has less than 18 years old."""

        self.user.profile.year_of_birth = datetime.datetime.now().year - 16

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_degree_is_too_high(self) -> None:
        """User has a degree higher than BAC or BAC PRO."""

        self.user.profile.highest_degree = job_pb2.LICENCE_MAITRISE

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_is_a_passionate_worker(self) -> None:
        """User doesn't want to reorient and is happy with their job."""

        self.project.kind = project_pb2.FIND_A_NEW_JOB
        self.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_wants_reorientation(self) -> None:
        """User wants to reorient."""

        self.project.kind = project_pb2.REORIENTATION

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')

        self._assert_has_default_vars(first_name='Nathalie', gender='FEMININE')

        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'hasAtypicProfile': '',
            'hasFamilyAndManagementIssue': '',
            'hasSeniority': '',
            'hasSimpleApplication': 'True',
            'isFrustratedOld': '',
            'isReorienting': 'True',
            'ofFirstName': 'de Nathalie',
        })

    def test_user_has_stopped_seeking(self) -> None:
        """User has reponded to the RER that they had stop seeking."""

        employment_status = self.user.employment_status.add()
        employment_status.seeking = user_pb2.STOP_SEEKING

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_happy_user_is_still_seeking(self) -> None:
        """User has reponded to the RER that they are still seeking but is happy with their job."""

        self.project.kind = project_pb2.FIND_A_NEW_JOB
        self.project.passionate_level = project_pb2.LIKEABLE_JOB
        employment_status = self.user.employment_status.add()
        employment_status.seeking = user_pb2.STILL_SEEKING
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_unhappy_user_is_still_seeking(self) -> None:
        """User has reponded to the RER that they are still seeking for an alimentary job."""

        self.project.kind = project_pb2.FIND_A_NEW_JOB
        self.project.passionate_level = project_pb2.ALIMENTARY_JOB
        employment_status = self.user.employment_status.add()
        employment_status.seeking = user_pb2.STILL_SEEKING

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')

        self._assert_has_default_vars(first_name='Nathalie', gender='FEMININE')

        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'hasAtypicProfile': '',
            'hasFamilyAndManagementIssue': '',
            'hasSeniority': '',
            'hasSimpleApplication': 'True',
            'isFrustratedOld': '',
            'isReorienting': '',
            'ofFirstName': 'de Nathalie',
        })

    def test_user_has_no_job_group_info(self) -> None:
        """User has no job group info."""

        self.project.kind = project_pb2.REORIENTATION
        self.project.target_job.job_group.rome_id = 'A1235'
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project, no email."""

        self.project.is_incomplete = True
        self._assert_user_receives_campaign(should_be_sent=False)


class ActionPlanVarsTestCase(campaign_helper.CampaignTestBase):
    """Tests for the action-plan campaign."""

    campaign_id = 'action-plan'

    def test_no_actions(self) -> None:
        """User has no selected actions."""

        del self.project.actions[:]
        self.project.action_plan_started_at.GetCurrentTime()
        self.project.actions.add(
            action_id='training',
            status=action_pb2.ACTION_UNREAD)
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_action_plan_not_started(self) -> None:
        """User hasn't started their plan yet."""

        self.project.actions.add(
            action_id='training',
            status=action_pb2.ACTION_CURRENT)
        self.project.ClearField('action_plan_started_at')
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_basic(self) -> None:
        """Basic behaviour."""

        del self.project.actions[:]
        self.project.action_plan_started_at.FromDatetime(datetime.datetime(2021, 11, 12))
        self.project.actions.add(
            action_id='for-today',
            title="Une action que je veux faire aujourd'hui",
            status=action_pb2.ACTION_CURRENT,
        ).expected_completion_at.FromDatetime(datetime.datetime.now())
        self.project.actions.add(
            action_id='for-tomorrow',
            title='Une action que je veux faire demain',
            status=action_pb2.ACTION_CURRENT,
        ).expected_completion_at.FromDatetime(
            datetime.datetime.today().replace(hour=10) + datetime.timedelta(hours=27))
        self.project.actions.add(
            action_id='for-week',
            title='Une action que je veux faire la semaine prochaine',
            status=action_pb2.ACTION_CURRENT,
        ).expected_completion_at.FromDatetime(
            datetime.datetime.today().replace(hour=22) + datetime.timedelta(hours=27))
        self.project.actions.add(
            action_id='not-selected',
            title='Une action que je ne veux pas faire',
            status=action_pb2.ACTION_UNREAD,
        )
        self.project.actions.add(
            action_id='done',
            title="Une action que j'ai déjà faite",
            status=action_pb2.ACTION_DONE,
        )
        self._assert_user_receives_campaign()
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'UNKNOWN_EMAIL_FREQUENCY',
        })
        self._assert_has_logged_url(field='actionPlanUrl', path='/projet/0/plan-action')

        actions = self._variables.pop('actions')

        self._assert_remaining_variables({
            'creationDate': '2021-11-12',
            'numActionsBySections': {
                'today': 1, 'tomorrow': 1, 'week': 1, 'done': 1, 'unscheduled': 0},
        })
        self.assertEqual([
            "Une action que je veux faire aujourd'hui"
        ], [a['title'] for a in actions.get('today')])
        self.assertEqual([
            'Une action que je veux faire demain'
        ], [a['title'] for a in actions.get('tomorrow')])
        self.assertEqual([
            'Une action que je veux faire la semaine prochaine'
        ], [a['title'] for a in actions.get('week')])
        self.assertEqual([
            "Une action que j'ai déjà faite"
        ], [a['title'] for a in actions.get('done')])


class DwpInterviewVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of dwp interview mail campaign variables."""

    campaign_id = 'dwp-interview'

    def setUp(self) -> None:
        super().setUp()
        self.user.origin.source = 'dwp'
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=100))

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_default_vars(gender='FEMININE')

    def test_recent_user(self) -> None:
        """User registered less than 3 weeks ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=10))
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_is_not_dwp(self) -> None:
        """User is not coming from dwp."""

        self.user.origin.source = ''

        self._assert_user_receives_campaign(should_be_sent=False)


class DwpInterviewApologiesTestCase(campaign_helper.CampaignTestBase):
    """Test of dwp interview apologies mail campaign trigger."""

    campaign_id = 'dwp-interview-apologies'

    def setUp(self) -> None:
        super().setUp()
        self.user.origin.source = 'dwp'
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=100))
        self.user.emails_sent.add(campaign_id='dwp-interview')

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_default_vars(gender='FEMININE')

    def test_recent_user(self) -> None:
        """User registered less than 3 weeks ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=10))
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_is_not_dwp(self) -> None:
        """User is not coming from dwp."""

        self.user.origin.source = ''

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_user_did_not_receive_first(self) -> None:
        """User did not receive the first dwp-interview email."""

        del self.user.emails_sent[:]

        self._assert_user_receives_campaign(should_be_sent=False)


class ConfidenceBoostVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of confidence-boost mail campaign variables."""

    campaign_id = 'confidence-boost'

    def setUp(self) -> None:
        super().setUp()
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=10))

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_default_vars(gender='FEMININE')


if __name__ == '__main__':
    unittest.main()
