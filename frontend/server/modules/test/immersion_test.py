"""Unit tests for the immersion module."""

import datetime
import json
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class ImmersionMissionLocaleTest(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Immersion with Mission Locale" advice scoring model."""

    model_id = 'advice-immersion-milo'

    def test_too_old(self) -> None:
        """User is too old for the missions locales."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 1982
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_already_worked_as_such(self) -> None:
        """User has worked in a similar position."""

        persona = self._random_persona().clone()
        if persona.project.previous_job_similarity == project_pb2.NEVER_DONE:
            persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_young_and_new(self) -> None:
        """User is a good target."""

        persona = self._random_persona().clone()
        persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        persona.user_profile.year_of_birth = datetime.date.today().year - 22
        score = self._score_persona(persona)
        self.assertGreaterEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_perfect(self) -> None:
        """User is the perfect target."""

        persona = self._random_persona().clone()
        persona.project.network_estimate = 1
        persona.project.passionate_level = project_pb2.PASSIONATING_JOB
        persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        persona.user_profile.year_of_birth = datetime.date.today().year - 22
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../immersion-milo endpoint."""

    def setUp(self) -> None:
        super(EndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'immersion-milo',
            'triggerScoringModel': 'advice-immersion-milo',
        })
        self._db.associations.insert_many([
            {
                'link': 'http://link.to/snc-gers',
                'name': 'SNC Gers',
                'filters': [
                    'for-departement(32)',
                ],
            },
            {
                'link': 'http://link.to/mission-locale-du-nord',
                'name': 'Missions locales',
                'filters': [
                    'for-departement(59)',
                ],
            },
            {
                'link': 'http://link.to/mission-locale-du-gers',
                'name': 'Missions locales',
                'filters': [
                    'for-departement(32)',
                    # This will be ignored as we look only for departement filtering.
                    'constant(0)',
                ],
            },
        ])

    def test_basic(self) -> None:
        """Test basic usage."""

        response = self.app.post(
            '/api/advice/immersion-milo',
            data=json.dumps({
                'projects': [{'city': {'departementId': '32'}}],
                'profile': {
                    'yearOfBirth': datetime.date.today().year - 22,
                },
            }),
            content_type='application/json')

        response_json = self.json_from_response(response)
        self.assertEqual(
            {'agenciesListLink': 'http://link.to/mission-locale-du-gers'},
            response_json)

    def test_no_city(self) -> None:
        """User has no city in its project."""

        response = self.app.post(
            '/api/advice/immersion-milo',
            data=json.dumps({
                'projects': [{}],
                'profile': {
                    'yearOfBirth': datetime.date.today().year - 22,
                },
            }),
            content_type='application/json')

        response_json = self.json_from_response(response)
        self.assertEqual({}, response_json)

    def test_departement_without_mission_locale(self) -> None:
        """We don't have a link for the user's mission locale."""

        response = self.app.post(
            '/api/advice/immersion-milo',
            data=json.dumps({
                'projects': [{'city': {'departementId': 'aaa'}}],
                'profile': {
                    'yearOfBirth': datetime.date.today().year - 22,
                },
            }),
            content_type='application/json')

        response_json = self.json_from_response(response)
        self.assertEqual({}, response_json)


if __name__ == '__main__':
    unittest.main()
