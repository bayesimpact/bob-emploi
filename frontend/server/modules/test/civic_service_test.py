"""Unit tests for the civic service module."""

import datetime
import json
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceCivicServiceTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the civic service advice scoring model."""

    model_id = 'advice-civic-service'

    def setUp(self) -> None:
        super().setUp()
        self.now = datetime.datetime(2018, 2, 2)

    def test_is_young_with_handicap(self) -> None:
        """User already is young and has handicap."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = True
        persona.user_profile.year_of_birth = 1989
        persona.project.seniority = project_pb2.INTERN
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_is_young_without_handicap(self) -> None:
        """User is young and has no handicap."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = True
        persona.user_profile.year_of_birth = 1995
        persona.project.seniority = project_pb2.INTERN
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_old(self) -> None:
        """User is older than required age for civic service."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = False
        persona.user_profile.year_of_birth = 1987
        persona.project.seniority = project_pb2.INTERN
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_young(self) -> None:
        """User is younger than required age for civic service."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 2007
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_has_experience(self) -> None:
        """User has too much experience."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.JUNIOR
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class CivicServiceEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/civic-service endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self.now = datetime.datetime(2018, 2, 2)
        self._db.advice_modules.insert_one({
            'adviceId': 'civic-service',
            'triggerScoringModel': 'advice-civic-service',
        })

    def test_two_missions(self) -> None:
        """Basic test with two recommended missions."""

        self._db.local_missions.insert_one(
            {
                '_id': '45',
                'missions': [
                    {
                        'title': 'Promouvoir et développer la pratique du basketball pour tous',
                        'description': 'Perfectionnement et accompagnement du jeune basketteur',
                        'domain': 'Sport',
                        'startDate': '23 février 2018',
                        'duration': '8 mois',
                    },
                    {
                        'title': 'Accompagnement projet de territoire',
                        'description': 'soutenir les projets du pôle Territoires',
                        'domain': 'Culture et loisirs',
                        'startDate': '19 février 2018',
                        'duration': '10 mois',
                    }
                ],
            }
        )
        response = self.app.post(
            '/api/advice/civic-service',
            data=json.dumps({
                'projects': [{'city': {'departementId': '45'}}],
                'profile': {
                    'yearOfBirth': datetime.date.today().year - 22,
                },
            }),
            content_type='application/json')

        missions_data = self.json_from_response(response)
        self.assertEqual(
            [
                {
                    'title': 'Promouvoir et développer la pratique du basketball pour tous',
                    'description': 'Perfectionnement et accompagnement du jeune basketteur',
                    'domain': 'Sport',
                    'startDate': '23 février 2018',
                    'duration': '8 mois',
                },
                {
                    'title': 'Accompagnement projet de territoire',
                    'description': 'soutenir les projets du pôle Territoires',
                    'domain': 'Culture et loisirs',
                    'startDate': '19 février 2018',
                    'duration': '10 mois',
                }
            ],
            missions_data.get('missions'))

    def test_bad_departement(self) -> None:
        """Test with bad departement."""

        self._db.local_missions.insert_one(
            {
                '_id': '45',
                'missions': [
                    {
                        'title': 'Promouvoir et développer la pratique du basketball pour tous',
                        'description': 'Perfectionnement et accompagnement du jeune basketteur',
                        'domain': 'Sport',
                        'startDate': '23 février 2018',
                        'duration': '8 mois',
                    }
                ],
            }
        )
        response = self.app.post(
            '/api/advice/civic-service',
            data=json.dumps({
                'projects': [{'city': {'departementId': 'XX'}}],
                'profile': {
                    'yearOfBirth': datetime.date.today().year - 22,
                },
            }),
            content_type='application/json')

        response_json = self.json_from_response(response)
        self.assertEqual({}, response_json)


if __name__ == '__main__':
    unittest.main()
