"""Unit tests for some of the campaigns defined in the all_campaigns module."""

import datetime
import re
import unittest
from unittest import mock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class SpontaneousVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the spontaneous_vars focus email."""

    campaign_id = 'focus-spontaneous'

    def setUp(self) -> None:
        super().setUp()

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
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'
        self.project.city.city_id = '69123'
        self.project.seniority = project_pb2.SENIOR
        self.project.created_at.FromDatetime(datetime.datetime.now())
        self.project.weekly_applications_estimate = project_pb2.A_LOT
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        self.project.job_search_length_months = 3

    def test_basic(self) -> None:
        """Basic usage."""

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
            'weeklyApplicationsCount': '15',
            'weeklyApplicationsOption': 'A_LOT',
            'whatILoveAbout': 'where I can belong',
            'whySpecificCompany': 'different business styles',
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
        self.project.job_search_length_months = -1
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_job_group_info(self) -> None:
        """No job group info, no email."""

        self.project.target_job.job_group.rome_id = 'Z1234'
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_contact_mode(self) -> None:
        """No contact mode, no email."""

        self.database.job_group_info.update_one(
            {'_id': 'A1234'}, {'$unset': {'preferredApplicationMedium': 1}})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_in_a_workplace(self) -> None:
        """No "in a workplace" phrasing, no email."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'inAWorkplace': 1},
            '$set': {'preferredApplicationMedium': 'APPLY_IN_PERSON'},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_like_your_workplace(self) -> None:
        """No "like your workplace" phrasing, no email."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'likeYourWorkplace': 1},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_to_the_workplace(self) -> None:
        """No "to the workplace", or "workplaces" phrasing, fallback on entreprises."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'toTheWorkplace': 1, 'placePlural': 1},
        })
        self._assert_user_receives_campaign()
        self.assertEqual('des entreprises', self._variables.pop('someCompanies'))
        self.assertEqual("à l'entreprise", self._variables.pop('toTheWorkplace'))

    def test_missing_what_i_love_about(self) -> None:
        """No "what I love about" phrasing, no email."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'whatILoveAbout': 1},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_feminine_version_of_what_i_love_about(self) -> None:
        """Use the genderized version of "what I love about" phrasing."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {'$set': {
            'whatILoveAbout': 'where I can belong as a man',
            'whatILoveAboutFeminine': 'where I can belong as a woman',
        }})

        self.user.profile.gender = user_pb2.FEMININE
        self._assert_user_receives_campaign()
        self.assertEqual('where I can belong as a woman', self._variables.pop('whatILoveAbout'))

    def test_missing_why_specific_company(self) -> None:
        """No "why this specific company" phrasing, no email."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'whySpecificCompany': 1},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_weekly_application_count_some(self) -> None:
        """Check phrasing of weekly application count for SOME."""

        self.project.weekly_applications_estimate = project_pb2.SOME
        self._assert_user_receives_campaign()
        self.assertEqual('5', self._variables.pop('weeklyApplicationsCount'))
        self.assertEqual('SOME', self._variables.pop('weeklyApplicationsOption'))

    def test_weekly_application_count_less_than_2(self) -> None:
        """Check phrasing of weekly application count for LESS_THAN_2."""

        self.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self._assert_user_receives_campaign()
        self.assertEqual('', self._variables.pop('weeklyApplicationsCount'))
        self.assertEqual('LESS_THAN_2', self._variables.pop('weeklyApplicationsOption'))


class SelfDevelopmentVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the self development campaign."""

    campaign_id = 'focus-self-develop'

    def setUp(self) -> None:
        super().setUp()
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.last_name = 'Benguigui'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.year_of_birth = 1958
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_MAXIMUM
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        self.project.job_search_length_months = 6
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.seniority = project_pb2.SENIOR

    def test_basic(self) -> None:
        """Basic usage."""

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
        self.project.job_search_length_months = -1
        self._assert_user_receives_campaign(should_be_sent=False)


class BodyLanguageVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the body language campaign."""

    campaign_id = 'focus-body-language'

    def test_basic(self) -> None:
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
        self.user.profile.frustrations.append(user_pb2.NO_OFFERS)
        self._assert_user_receives_campaign(should_be_sent=False)


class EmploymentVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test for the RER campaign."""

    campaign_id = 'employment-status'

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.email = 'patrick@bayes.org'
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.job_search_length_months = 6
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'
        self.project.city.city_id = '69123'
        self.project.seniority = project_pb2.SENIOR
        self.project.weekly_applications_estimate = project_pb2.A_LOT

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

    @mock.patch('logging.warning', mock.MagicMock)
    def test_just_signed_up(self) -> None:
        """If user has just signed up, no email."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=3))
        self.user.projects[0].job_search_length_months = 6
        self._assert_user_receives_campaign(False)

    def test_status_updated_recently(self) -> None:
        """Test that employment_vars returns None for user whose employment status has been updated
        recently."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.projects[0].job_search_length_months = 6
        status = self.user.employment_status.add()
        status.situation = 'SEEKING'
        status.created_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=17))

        self._assert_user_receives_campaign(False)

    def test_status_updated_long_ago(self) -> None:
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

    def test_basic(self) -> None:
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
        base_url = f'https://www.bob-emploi.fr?userId={self.user.user_id}'
        self._assert_regex_field(
            'loginUrl', rf'^{re.escape(base_url)}&authToken=\d+\.[a-f0-9]+$')
        self._assert_regex_field(
            'stopSeekingUrl', r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$')

        empty_vars = {key for key, value in self._variables.items() if not value}
        for empty_var in empty_vars:
            del self._variables[empty_var]

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

    def setUp(self) -> None:
        super().setUp()
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        # TODO(cyrille): Move tests on firstName and gender to a test on get_default_variables.
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

    def test_basic(self) -> None:
        """Basic usage."""

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

    @mock.patch('logging.info', mock.MagicMock)
    def test_job_search_not_started(self) -> None:
        """Job search not started, no email."""

        self.project.job_search_has_not_started = True
        self._assert_user_receives_campaign(should_be_sent=False)


class Galita2VarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of galita1 mail campaign variables."""

    campaign_id = 'galita-2'

    def test_basic(self) -> None:
        """Basic usage."""

        # TODO(cyrille): Again, move tests on firstName and gender to a test
        # on get_default_variables.
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH
        self.project.target_job.masculine_name = 'Maçon'
        self.project.previous_job_similarity = project_pb2.NEVER_DONE
        self.project.kind = project_pb2.FIND_A_NEW_JOB

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'isReorienting': '',
            'ofJobName': 'de maçon',
        })


class Galita3VarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of galita3 mail campaign variables."""

    campaign_id = 'galita-3'

    def test_basic(self) -> None:
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

    def test_with_deep_link(self) -> None:
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

        self._assert_has_logged_url(
            'deepLinkToAdvice',
            '/projet/123/methode/follow-up',
        )


class ViralSharingVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of viral mail campaign variables."""

    campaign_id = 'viral-sharing-1'

    def test_recent_user(self) -> None:
        """User registered less than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=150))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_not_good_hash_user(self) -> None:
        """User hash is not selected."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=400))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        # Golden value: its SHA1 starts with 6.
        self.user.user_id = '7b18313aa35d807e631ea3f2'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_old_user(self) -> None:
        """User registered more than a year ago."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=400))
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        # Golden value: its SHA1 starts with 1.
        self.user.user_id = '7b18313aa35d807e631ea3f3'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
        })


class HandicapComTestCase(mail_blast_test.CampaignTestBase):
    """Test of handicap-week newsletter email."""

    campaign_id = 'handicap-week'

    def test_newsletter(self) -> None:
        """User asked for the newsletter."""

        self.user.profile.name = 'Patrick'
        self.user.profile.is_newsletter_enabled = True
        self._assert_user_receives_campaign()
        self._assert_remaining_variables({
            'firstName': 'Patrick',
        })

    def test_no_newsletter(self) -> None:
        """User didn't ask for the newsletter."""

        self.user.profile.is_newsletter_enabled = False
        self._assert_user_receives_campaign(should_be_sent=False)


class OpenClassroomsVarsTestCase(mail_blast_test.CampaignTestBase):
    """Test of open classrooms mail campaign variables."""

    campaign_id = 'open-classrooms'

    def setUp(self) -> None:
        super().setUp()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
        })
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.name = 'Nathalie'
        self.user.profile.year_of_birth = datetime.datetime.now().year - 20
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=100))
        self.user.profile.highest_degree = job_pb2.BAC_BACPRO
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_MAXIMUM
        self.project.target_job.job_group.rome_id = 'A1234'

    def test_basic(self) -> None:
        """Basic usage."""

        self.project.kind = project_pb2.FIND_A_NEW_JOB
        self.project.passionate_level = project_pb2.ALIMENTARY_JOB

        self._assert_user_receives_campaign()

        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'firstName': 'Nathalie',
            'gender': 'FEMININE',
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

        self._assert_has_unsubscribe_link()

        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'firstName': 'Nathalie',
            'gender': 'FEMININE',
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

        self._assert_has_unsubscribe_link()

        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_remaining_variables({
            'firstName': 'Nathalie',
            'gender': 'FEMININE',
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


if __name__ == '__main__':
    unittest.main()
