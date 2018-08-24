"""Unit tests for the online_salons module."""

import datetime
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.server.test import scoring_test


# TODO(cyrille): Test for ordering of salons.
class OnlineSalonsScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit test for the "Online Salon" scoring model."""

    model_id = 'advice-online-salons'

    def setUp(self):
        super(OnlineSalonsScoringModelTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.now = datetime.datetime(2018, 6, 15)
        self.database.online_salons.insert_one({
            'applicationDates': 'du 05/03/2018 au 30/04/2018',
            'domain': 'Service à la personne',
            'applicationEndDate': '2018-07-01T00:00:00Z',
            'jobGroupIds': ['K1302', 'K1303', 'K1304'],
            'locations': [{
                'areaType': 'CITY',
                'city': {
                    'cityId': '62510',
                    'departementId': '62',
                    'name': 'Liévin',
                    'regionId': '32',
                },
            }],
            'offerCount': 3,
            'openDates': 'du 20/02/2018 au 30/06/2018',
            'startDate': '2018-02-20T00:00:00Z',
            'title': 'Salon en ligne SAP',
            'url': 'https://salonenligne.pole-emploi.fr/candidat/detaildusalon?salonId=640',
        })

    def test_in_city(self):
        """Test that people in Liévin match."""

        self.persona.project.mobility.city.city_id = '62510'
        self.persona.project.mobility.city.departement_id = '62'
        self.persona.project.mobility.city.region_id = '32'
        self.persona.project.target_job.job_group.rome_id = 'K1304'
        score = self._score_persona(self.persona)
        self.assertGreater(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_not_in_job_group(self):
        """Test that people in another job group don't match."""

        self.persona.project.mobility.city.city_id = '62510'
        self.persona.project.mobility.city.departement_id = '62'
        self.persona.project.mobility.city.region_id = '32'
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_in_departement(self):
        """Test that people willing to move in departement match."""

        self.persona.project.mobility.area_type = geo_pb2.DEPARTEMENT
        self.persona.project.mobility.city.city_id = '62100'
        self.persona.project.mobility.city.departement_id = '62'
        self.persona.project.mobility.city.region_id = '32'
        self.persona.project.target_job.job_group.rome_id = 'K1304'
        score = self._score_persona(self.persona)
        self.assertGreater(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_in_region(self):
        """Test that people willing to move in region match."""

        self.persona.project.mobility.area_type = geo_pb2.REGION
        self.persona.project.mobility.city.city_id = '59350'
        self.persona.project.mobility.city.departement_id = '59'
        self.persona.project.mobility.city.region_id = '32'
        self.persona.project.target_job.job_group.rome_id = 'K1304'
        score = self._score_persona(self.persona)
        self.assertGreater(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_in_other_region(self):
        """Test that people unwilling to move to Liévin don't match."""

        self.persona.project.mobility.area_type = geo_pb2.REGION
        self.persona.project.mobility.city.city_id = '31555'
        self.persona.project.mobility.city.departement_id = '31'
        self.persona.project.mobility.city.region_id = '76'
        self.persona.project.target_job.job_group.rome_id = 'K1304'
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_extra_data(self):
        """Compute extra data."""

        self.persona.project.mobility.area_type = geo_pb2.DEPARTEMENT
        self.persona.project.mobility.city.city_id = '62100'
        self.persona.project.mobility.city.departement_id = '62'
        self.persona.project.mobility.city.region_id = '32'
        self.persona.project.target_job.job_group.rome_id = 'K1304'
        project = self.persona.scoring_project(self.database, now=self.now)
        result = self.model.get_expanded_card_data(project)
        self.assertGreater(len(result.salons), 0, msg='Failed for "{}"'.format(self.persona.name))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
