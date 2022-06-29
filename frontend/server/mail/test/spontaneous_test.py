"""Unit tests for the spontaneous campaigns."""

import datetime
import os
import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper

_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


class SpontaneousVarsTestCase(campaign_helper.CampaignTestBase):
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
            'romeId': 'A1234',
            'toTheWorkplace': 'au cabinet',
            'placePlural': 'des cabinets juridiques',
            'inAWorkplace': 'dans un cabinet',
            'likeYourWorkplace': 'comme le vôtre',
            'atVariousCompanies': 'Auchan, Carrefour ou Lidl',
            'whatILoveAbout': 'where I can belong',
            'whySpecificCompany': 'different business styles',
        })
        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.last_name = 'Benguigui'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
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

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
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

        self.user.profile.gender = user_profile_pb2.FEMININE
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

    def test_i18n_sender_name_default(self) -> None:
        """Check sender name has not been translated (default version)."""

        self._assert_user_receives_campaign()
        self._assert_sender_name("Joanna et l'équipe de Bob")

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_i18n_sender_name(self) -> None:
        """Check sender name has been translated."""

        self.user.profile.locale = 'en_UK'
        self._assert_user_receives_campaign()
        self._assert_sender_name('Joanna and the Bob team')

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_i18n_static(self) -> None:
        """Check static sentences have been translated."""

        self.user.profile.locale = 'en'
        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'toTheWorkplace': 1, 'placePlural': 1},
        })
        self._assert_user_receives_campaign()
        self.assertEqual('some companies', self._variables.pop('someCompanies'))
        self.assertEqual('to the workplace', self._variables.pop('toTheWorkplace'))

    def test_translate_for_gender(self) -> None:
        """Check that 'what I love about' is translated with gender."""

        self.database.job_group_info.update_one({'_id': 'A1234'}, {
            '$unset': {'whatILoveAboutFeminine': 1},
        })
        self.database.translations.insert_one({
            'string': 'where I can belong_FEMININE',
            'fr': 'where I can belong as a woman',
        })
        self.user.profile.gender = user_profile_pb2.FEMININE
        self._assert_user_receives_campaign()
        self.assertEqual('where I can belong as a woman', self._variables.pop('whatILoveAbout'))


class SpontaneousShortCampaignTest(campaign_helper.CampaignTestBase):
    """Test for the spontaneous-short campaign."""

    campaign_id = 'spontaneous-short'

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self.assertTrue(self._variables.get('advicePageUrl'))

    def test_english(self) -> None:
        """Send spontaneous short in English."""

        self.user.profile.locale = 'en_UK'

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self.assertTrue(self._variables.get('advicePageUrl'))

    @mock.patch('logging.warning')
    def test_spanish(self, mock_warning: mock.MagicMock) -> None:
        """Send spontaneous short in Spanish."""

        self.user.profile.locale = 'es'

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self.assertFalse(self._variables.get('advicePageUrl'))

        warning_messages = [
            call_args[0][0] % call_args[0][1:]
            for call_args in mock_warning.call_args_list
        ]
        no_advice_webpage_messages = [
            message for message in warning_messages
            if 'No advice webpage given' in message
        ]
        self.assertEqual(1, len(no_advice_webpage_messages), msg=no_advice_webpage_messages)


if __name__ == '__main__':
    unittest.main()
