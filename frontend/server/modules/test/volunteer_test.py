"""Unit tests for the volunteer module."""

import unittest

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class VolunteerAdviceTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Volunteer" advice."""

    model_id = 'advice-volunteer'

    def setUp(self) -> None:
        super().setUp()
        self.database.volunteering_missions.insert_one({
            '_id': '75',
            'missions': [{'title': 'Mission n°1'}],
        })

    def test_no_mission_data(self) -> None:
        """No volunteering missions data."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = '56'

        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_very_long_search(self) -> None:
        """Job seeker has been searching for a looong time."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = '75'
        self._enforce_search_length_duration(persona.project, exact_months=20)

        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_just_started_searching(self) -> None:
        """Job seeker has just started searching."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = '75'
        self._enforce_search_length_duration(persona.project, exact_months=1)

        score = self._score_persona(persona)

        self.assertEqual(score, 1, msg=f'Failed for "{persona.name}"')


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/volunteer endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'volunteer',
            'triggerScoringModel': 'advice-volunteer',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/volunteer/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_missions(self) -> None:
        """Basic test with no missions."""

        response = self.app.get(
            f'/api/advice/volunteer/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual({}, self.json_from_response(response))

    def test_actual_missions(self) -> None:
        """Missions available."""

        user_id, auth_token = self.create_user_with_token(
            data={'projects': [{'city': {'departementId': '75'}}]})
        self._db.volunteering_missions.insert_one({
            '_id': '75',
            'missions': [
                {'title': 'Mission n°1'},
                {'title': 'Mission n°2'},
            ],
        })
        user_info = self.get_user_info(user_id, auth_token)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get(
            f'/api/advice/volunteer/{user_id}/{project_id}',
            headers={'Authorization': 'Bearer ' + auth_token})

        self.assertEqual(
            ['Mission n°1', 'Mission n°2'],
            [m.get('title') for m in self.json_from_response(response).get('missions', [])])

    def test_global_missions(self) -> None:
        """Missions available both locally and globally."""

        user_id, auth_token = self.create_user_with_token(
            data={'projects': [{'city': {'departementId': '75'}}]})
        self._db.volunteering_missions.insert_many([
            {
                '_id': '',
                'missions': [
                    {'title': 'Global Mission'},
                ],
            },
            {
                '_id': '75',
                'missions': [
                    {'title': 'Mission n°1'},
                    {'title': 'Mission n°2'},
                ],
            },
        ])
        user_info = self.get_user_info(user_id, auth_token)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get(
            f'/api/advice/volunteer/{user_id}/{project_id}',
            headers={'Authorization': 'Bearer ' + auth_token})

        missions = self.json_from_response(response).get('missions', [])
        self.assertEqual(
            ['Mission n°1', 'Mission n°2', 'Global Mission'],
            [m.get('title') for m in missions])
        self.assertEqual(
            [False, False, True],
            [m.get('isAvailableEverywhere', False) for m in missions])


if __name__ == '__main__':
    unittest.main()
