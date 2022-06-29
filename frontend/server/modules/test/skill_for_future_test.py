"""Unit tests for the skills for the future module."""

import unittest

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class SkillForFutureTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the skills for the future scoring model."""

    model_id = 'advice-skill-for-future'

    def setUp(self) -> None:
        super().setUp()
        self.database.job_group_info.insert_one({
            '_id': 'D1101',
            'skillsForFuture': [{'name': 'Empathie'}],
        })

    def test_with_data(self) -> None:
        """User is working in a job that has skills ideas."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1101'
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_with_no_data(self) -> None:
        """User is working in a job that does not have skills ideas."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'E1101'
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/skill-for-future endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'skill-for-future',
            'triggerScoringModel': 'advice-skill-for-future',
        })
        self._db.job_group_info.insert_one({
            '_id': 'D1101',
            'skillsForFuture': [{'name': 'Empathie'}, {'name': 'Apprentissage actif'}],
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_with_data(self) -> None:
        """Basic test with skills recommendation."""

        user_id, auth_token = self.create_user_with_token(
            data={'projects': [{'targetJob': {'jobGroup': {'romeId': 'D1101'}}}]})
        user_info = self.get_user_info(user_id, auth_token)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get(
            f'/api/advice/skill-for-future/{user_id}/{project_id}',
            headers={'Authorization': 'Bearer ' + auth_token})

        self.assertEqual(
            {'skills': [
                {'name': 'Empathie'}, {'name': 'Apprentissage actif'},
            ]},
            self.json_from_response(response))

    def test_no_data(self) -> None:
        """Basic test with no data."""

        response = self.app.get(
            f'/api/advice/skill-for-future/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual({}, self.json_from_response(response))


if __name__ == '__main__':
    unittest.main()
