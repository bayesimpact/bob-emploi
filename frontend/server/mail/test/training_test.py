"""Unit tests for the How To Get Your Diploma mail module."""

import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server.mail.test import campaign_helper


class GetDiplomaCampaignTest(campaign_helper.CampaignTestBase):
    """Tests for the get-diploma campaign."""

    campaign_id = 'get-diploma'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.opened_strategies.add(strategy_id='get-diploma')
        self.project.city.departement_id = '31'
        self.project.city.ClearField('departement_name')
        self.project.city.ClearField('departement_prefix')
        self.project.target_job.masculine_name = 'Steward'

        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })

        patcher = mock.patch(carif.__name__ + '.get_trainings')
        self.mock_get_trainings = patcher.start()
        self.mock_get_trainings.return_value = []
        self.addCleanup(patcher.stop)

    def test_basic_mail_blast(self) -> None:
        """Basic usage of a mail blast."""

        self._assert_user_receives_campaign()

    def test_basic_focus(self) -> None:
        """Basic usage of focus."""

        self._assert_user_receives_focus()

    def test_not_started_strategy(self) -> None:
        """User did not started the get-diploma strategy."""

        del self.project.opened_strategies[:]
        self._assert_user_receives_focus(should_be_sent=False)

    def test_undefined_project(self) -> None:
        """User does not know which job to target."""

        self.project.ClearField('target_job')
        self._assert_user_receives_focus(should_be_sent=False)

    def test_no_trainings(self) -> None:
        """No trainings."""

        del self.project.advices[:]

        self._assert_user_receives_focus()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self.assertEqual('en Haute-Garonne', self._variables.pop('inDepartement'))
        self.assertEqual('de steward', self._variables.pop('ofJobName'))
        self._assert_has_logged_url('loginUrl', '/projet/0')
        self._assert_remaining_variables({
            'deepTrainingAdviceUrl': '',
            'numTrainings': 0,
            'trainings': [],
        })

    def test_with_trainings(self) -> None:
        """With trainings."""

        self.project.advices.add(advice_id='training')
        self.mock_get_trainings.return_value = [
            training_pb2.Training(name='Fedback 101', city_name='Lyon'),
            training_pb2.Training(name='Customer Care', city_name='Brussels'),
            training_pb2.Training(name='Drongo', city_name='Paris'),
            training_pb2.Training(name='Cheveux de riche', city_name='Paris'),
        ]

        self._assert_user_receives_focus()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self.assertEqual('en Haute-Garonne', self._variables.pop('inDepartement'))
        self.assertEqual('de steward', self._variables.pop('ofJobName'))
        self._assert_has_logged_url('loginUrl', '/projet/0')
        self._assert_has_logged_url(
            'deepTrainingAdviceUrl',
            '/projet/0/methode/training'
        )
        self._assert_remaining_variables({
            'numTrainings': 3,
            'trainings': [
                {'cityName': 'Lyon', 'name': 'Fedback 101'},
                {'cityName': 'Brussels', 'name': 'Customer Care'},
                {'cityName': 'Paris', 'name': 'Drongo'},
            ],
        })


class DiplomaShortCampaignTest(campaign_helper.CampaignTestBase):
    """Tests for the get-diploma-short campaign."""

    campaign_id = 'get-diploma-short'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.target_job.masculine_name = 'Steward'
        self.project.diagnostic.category_id = 'missing-diploma'

        patcher = mock.patch(carif.__name__ + '.get_trainings')
        self.mock_get_trainings = patcher.start()
        self.mock_get_trainings.return_value = []
        self.addCleanup(patcher.stop)

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()
        self.assertEqual('de steward', self._variables.pop('ofJobName'))
        self._assert_has_default_vars()


if __name__ == '__main__':
    unittest.main()
