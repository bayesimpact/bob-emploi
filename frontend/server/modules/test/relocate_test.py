"""Unit tests for the module TODO: module name."""

import typing
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import scoring_test


class GoodMobilityTestCase(scoring_test.HundredScoringModelTestBase):
    """Unit tests for the module."""

    model_id = 'project-mobility-score'

    def setUp(self) -> None:
        super().setUp()
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.departements.insert_many([{
            '_id': '{:02d}'.format(dep),
            'name': 'Departement {:02d}'.format(dep),
        } for dep in range(1, 96)])
        self.database.local_diagnosis.insert_many([
            {
                '_id': '{:02d}:A1234'.format(dep),
                'imt': {
                    'yearlyAvgOffersPer10Candidates': dep,
                },
                'numLessStressfulDepartements': 95 - dep,
            } for dep in range(1, 96)
        ])

    def test_top_departement(self) -> None:
        """User is already in the top département."""

        self.persona.project.city.departement_id = '95'
        self.assert_not_enough_data()

    def test_deprecated_top_departement(self) -> None:
        """User is already in the top département, but we don't know it yet in the database."""

        self.persona.project.city.departement_id = '95'
        # Remove newly imported data.
        self.database.local_diagnosis.update_many({}, {'$unset': {
            'numLessStressfulDepartements': 1,
        }})
        self.assert_not_enough_data()

    def test_unknown_mobility(self) -> None:
        """User's mobility is unknown."""

        self.persona.project.city.departement_id = '01'
        self.persona.project.area_type = geo_pb2.UNKNOWN_AREA_TYPE
        self.assert_not_enough_data()

    def test_mobility_super_plus(self) -> None:
        """User is mobile and it's a very good thing."""

        self.persona.project.city.departement_id = '01'
        self.persona.project.area_type = geo_pb2.COUNTRY
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_required(self) -> None:
        """User is not mobile and it's a very bad thing."""

        self.persona.project.city.departement_id = '01'
        self.persona.project.area_type = geo_pb2.CITY
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_good_thing(self) -> None:
        """User is somehow mobile and it's a good thing to have."""

        self.persona.project.city.departement_id = '01'
        self.persona.project.area_type = geo_pb2.REGION
        score = self._score_persona(self.persona)
        self.assert_good_score(score, limit=40, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_not_awful(self) -> None:
        """User is not that mobile but is in a somehow good département already."""

        self.persona.project.city.departement_id = '80'
        self.persona.project.area_type = geo_pb2.DEPARTEMENT
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, limit=50, msg='Fail for "{}"'.format(self.persona.name))
        self.assert_good_score(score, limit=35, msg='Fail for "{}"'.format(self.persona.name))


class ProfileMobilityTestCase(scoring_test.HundredScoringModelTestBase):
    """Unit tests for the module."""

    model_id = 'profile-mobility-scorer'

    def test_unknown_mobility(self) -> None:
        """User's mobility is unknown."""

        self.persona.project.area_type = geo_pb2.UNKNOWN_AREA_TYPE
        self.assert_not_enough_data()

    def test_mobility_great(self) -> None:
        """User is very mobile."""

        self.persona.project.area_type = geo_pb2.COUNTRY
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_mobility_worse(self) -> None:
        """User is not mobile."""

        self.persona.project.area_type = geo_pb2.CITY
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))


class AdviceRelocateScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Test the scoring model for advice-relocate"""

    model_id = 'advice-relocate'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.departements.insert_many([{
            '_id': '{:02d}'.format(dep),
            'name': 'Département {:02d}'.format(dep)
        } for dep in range(1, 96)])

    def test_num_better_departements(self) -> None:
        """We know there are some departements where the user could move."""

        self.persona.project.city.departement_id = '01'
        self.persona.project.area_type = geo_pb2.COUNTRY
        self.database.local_diagnosis.insert_one({
            '_id': '01:A1234',
            'imt': {'yearlyAvgOffersPer10Candidates': 1},
            'numLessStressfulDepartements': 5,
        })
        self.assertEqual(2, self._score_persona(self.persona))

    def test_expanded_card_data(self) -> None:
        """Test the data sent asynchronously for this piece of advice."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'bestDepartements': [{
                'departementId': '{:02d}'.format(d),
                'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 11 - d}},
            } for d in range(2, 10)],
        })
        self.database.local_diagnosis.insert_one({
            '_id': '01:A1234',
            'imt': {'yearlyAvgOffersPer10Candidates': 1},
        })
        self.persona.project.city.departement_id = '01'
        expanded_card_data = typing.cast(
            project_pb2.RelocateData, self.model.get_expanded_card_data(
                self.persona.scoring_project(self.database)))
        self.assertEqual(8, len(expanded_card_data.departement_scores))
        first_offer = expanded_card_data.departement_scores[0]
        self.assertEqual(9, first_offer.offer_ratio)
        self.assertEqual('Département 02', first_offer.name)


if __name__ == '__main__':
    unittest.main()
