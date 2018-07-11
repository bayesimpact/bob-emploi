"""Unit tests for the holiday mail module."""

import datetime

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class ChristmasVarsTestCase(mail_blast_test.CampaignTestBase):
    """Unit tests for the christmas_vars method."""

    campaign_id = 'christmas'

    def test_basic(self):
        """Basic usage."""

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


class NewYearTestCase(mail_blast_test.CampaignTestBase):
    """Test for the new_year_vars function."""

    campaign_id = 'new-year'

    def test_basic(self):
        """Basic usage."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.kind = project_pb2.FIND_ANOTHER_JOB
        self.project.passionate_level = project_pb2.LIFE_GOAL_JOB

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'goal': 'trouver un poste qui vous épanouira',
        })
