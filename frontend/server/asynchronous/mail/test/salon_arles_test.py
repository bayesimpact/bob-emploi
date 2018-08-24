"""Unit tests for the module mail.salon_arles."""

import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class SalonArlesTestCase(mail_blast_test.CampaignTestBase):
    """Unit tests for the salon_arles module."""

    campaign_id = 'salon-arles'

    def test_local(self):
        """Test user is a local from Arles, not willing to move."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.target_job.job_group.rome_id = 'G1204'
        self.project.mobility.area_type = geo_pb2.CITY
        self.project.mobility.city.city_id = '13004'
        self.project.mobility.city.departement_id = '13'
        self.project.mobility.city.region_id = '93'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'isLocal': 'True',
        })

    def test_local_wrong_job_group(self):
        """Test user is a local from Arles but not in the right job group."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.target_job.job_group.rome_id = 'A1204'
        self.project.mobility.area_type = geo_pb2.CITY
        self.project.mobility.city.city_id = '13004'
        self.project.mobility.city.departement_id = '13'
        self.project.mobility.city.region_id = '93'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_ready_to_move(self):
        """Test user is ready to move."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.target_job.job_group.rome_id = 'G1204'
        self.project.mobility.area_type = geo_pb2.COUNTRY
        self.project.mobility.city.city_id = '69123'
        self.project.mobility.city.departement_id = '69'
        self.project.mobility.city.region_id = '84'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'isLocal': '',
        })

    def test_not_ready_to_move(self):
        """Test user is not ready to move."""

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.target_job.job_group.rome_id = 'G1204'
        self.project.mobility.area_type = geo_pb2.REGION
        self.project.mobility.city.city_id = '69123'
        self.project.mobility.city.departement_id = '69'
        self.project.mobility.city.region_id = '84'

        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
