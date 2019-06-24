"""Unit tests for the holiday mail module."""

import datetime
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class ChristmasVarsTestCase(mail_blast_test.CampaignTestBase):
    """Unit tests for the christmas_vars method."""

    campaign_id = 'christmas'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=180))
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.seniority = project_pb2.SENIOR
        commute_advice = self.project.advices.add(advice_id='commute')
        commute_advice.commute_data.cities.append('Boé')
        relocate_advice = self.project.advices.add(advice_id='relocate')
        relocate_advice.relocate_data.departement_scores.add(name='Haute-Garonne')

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'hasFreelancers': True,
        })
        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'couldFreelance': 'True',
            'emailInUrl': 'patrick%40bayes.org',
            'inCommuteCity': 'à Boé',
            'inRelocateDepartement': 'en Haute-Garonne',
            'startedSearchingSince': 'depuis six mois',
        })

    def test_has_not_started(self) -> None:
        """User has not started searching."""

        self.project.ClearField('job_search_started_at')
        self.project.job_search_has_not_started = True

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self.assertEqual('', self._variables['startedSearchingSince'])

    def test_started_recently(self) -> None:
        """User has started their jobsearch recently."""

        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=30))

        self._assert_user_receives_campaign()

        self.assertEqual('depuis peu', self._variables['startedSearchingSince'])

    def test_started_a_long_long_time_ago(self) -> None:
        """User has started their jobsearch a long long time ago."""

        self.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=300))

        self._assert_user_receives_campaign()

        self.assertEqual('depuis un moment', self._variables['startedSearchingSince'])

    def test_no_departements_info(self) -> None:
        """Missing departements info."""

        self.database.departements.drop()

        self._assert_user_receives_campaign()

        self.assertFalse(self._variables.get('inRelocateDepartement'))

    def test_no_job_group_info(self) -> None:
        """Missing job group info."""

        self.database.job_group_info.drop()

        self._assert_user_receives_campaign()

        self.assertFalse(self._variables.get('couldFreelance'))


class NewYearTestCase(mail_blast_test.CampaignTestBase):
    """Test for the new_year_vars function."""

    campaign_id = 'new-year'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.kind = project_pb2.FIND_ANOTHER_JOB
        self.project.passionate_level = project_pb2.LIFE_GOAL_JOB

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'goal': 'trouver un poste qui vous épanouira',
        })

    def test_just_a_job(self) -> None:
        """User is just looking for any job."""

        self.project.passionate_level = project_pb2.ALIMENTARY_JOB

        self._assert_user_receives_campaign()

        self.assertEqual('décrocher un nouveau poste', self._variables['goal'])

    def test_reorientation(self) -> None:
        """User is trying to find a new job."""

        self.project.passionate_level = project_pb2.ALIMENTARY_JOB
        self.project.kind = project_pb2.REORIENTATION

        self._assert_user_receives_campaign()

        self.assertEqual('décrocher votre prochain emploi', self._variables['goal'])


if __name__ == '__main__':
    unittest.main()
