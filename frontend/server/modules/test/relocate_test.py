"""Unit tests for the module TODO: module name."""

import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.server.test import scoring_test


class GoodMobilityTestCase(scoring_test.HundredScoringModelTestBase):
    """Unit tests for the module."""

    model_id = 'project-mobility-score'

    def setUp(self):
        super(GoodMobilityTestCase, self).setUp()
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.departements.insert_many([
            {'_id': '{:02d}'.format(dep)} for dep in range(1, 96)
        ])
        self.database.local_diagnosis.insert_many([
            {
                '_id': '{:02d}:A1234'.format(dep),
                'imt': {
                    'yearlyAvgOffersPer10Candidates': dep,
                },
            } for dep in range(1, 96)
        ])

    def test_top_departement(self):
        """User is already in the top département."""

        self.persona.project.mobility.city.departement_id = '95'
        self.assert_not_enough_data()

    def test_unknown_mobility(self):
        """User's mobility is unknown."""

        self.persona.project.mobility.city.departement_id = '01'
        self.persona.project.mobility.area_type = geo_pb2.UNKNOWN_AREA_TYPE
        self.assert_not_enough_data()

    def test_mobility_super_plus(self):
        """User is mobile and it's a very good thing."""

        self.persona.project.mobility.city.departement_id = '01'
        self.persona.project.mobility.area_type = geo_pb2.COUNTRY
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_required(self):
        """User is not mobile and it's a very bad thing."""

        self.persona.project.mobility.city.departement_id = '01'
        self.persona.project.mobility.area_type = geo_pb2.CITY
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_good_thing(self):
        """User is somehow mobile and it's a good thing to have."""

        self.persona.project.mobility.city.departement_id = '01'
        self.persona.project.mobility.area_type = geo_pb2.REGION
        score = self._score_persona(self.persona)
        self.assert_good_score(score, limit=40, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_not_awful(self):
        """User is not that mobile but is in a somehow good département already."""

        self.persona.project.mobility.city.departement_id = '80'
        self.persona.project.mobility.area_type = geo_pb2.DEPARTEMENT
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, limit=50, msg='Fail for "{}"'.format(self.persona.name))
        self.assert_good_score(score, limit=35, msg='Fail for "{}"'.format(self.persona.name))


class ProfileMobilityTestCase(scoring_test.HundredScoringModelTestBase):
    """Unit tests for the module."""

    model_id = 'profile-mobility-scorer'

    def test_unknown_mobility(self):
        """User's mobility is unknown."""

        self.persona.project.mobility.area_type = geo_pb2.UNKNOWN_AREA_TYPE
        self.assert_not_enough_data()

    def test_mobility_great(self):
        """User is very mobile."""

        self.persona.project.mobility.area_type = geo_pb2.COUNTRY
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_worse(self):
        """User is not mobile."""

        self.persona.project.mobility.area_type = geo_pb2.CITY
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
