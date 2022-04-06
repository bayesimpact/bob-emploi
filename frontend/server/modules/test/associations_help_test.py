"""Unit tests for the associations_help module."""

import unittest

from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceAssociationHelpTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Find an association to help you" advice."""

    model_id = 'advice-association-help'

    def test_no_data(self) -> None:
        """No associations data."""

        persona = self._random_persona().clone()
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_motivated(self) -> None:
        """User is motivated."""

        persona = self._random_persona().clone()
        self.database.associations.insert_one({'name': 'SNC'})
        del persona.user_profile.frustrations[:]
        self._enforce_search_length_duration(persona.project, max_months=11)
        score = self._score_persona(persona)
        self.assertEqual(2, score, msg=f'Failed for "{persona.name}"')

    def test_need_motivation(self) -> None:
        """User needs motivation."""

        persona = self._random_persona().clone()
        self.database.associations.insert_one({'name': 'SNC'})
        persona.user_profile.frustrations.append(user_profile_pb2.MOTIVATION)
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=f'Failed for "{persona.name}"')

    def test_many_assos_and_long_search(self) -> None:
        """User searches for a long time and there are a lot of associations."""

        persona = self._random_persona().clone()
        self.database.associations.insert_many(
            [{'name': 'SNC'}, {'name': 'SND'}, {'name': 'SNE'}, {'name': 'SNF'}])
        self._enforce_search_length_duration(persona.project, exact_months=6)
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=f'Failed for "{persona.name}"')

    def test_very_long_search(self) -> None:
        """User searches for a very long time."""

        persona = self._random_persona().clone()
        self.database.associations.insert_one({'name': 'SNC'})
        self._enforce_search_length_duration(persona.project, exact_months=12)
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=f'Failed for "{persona.name}"')


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../association-help endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'association-help',
            'triggerScoringModel': 'advice-association-help',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/association-help/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_one_association(self) -> None:
        """Basic test with one association only."""

        self._db.associations.insert_one({'name': 'SNC'})
        response = self.app.get(
            f'/api/advice/association-help/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual({'associations': [{'name': 'SNC'}]}, associations)

    def test_filtered_associations(self) -> None:
        """Association not useful for this project is filtered."""

        self._db.associations.insert_many([
            {'name': 'Not a good one', 'filters': ['constant(0)']},
            {'name': 'Keep this one', 'filters': ['constant(1)']},
        ])
        response = self.app.get(
            f'/api/advice/association-help/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual(
            {'associations': [{'name': 'Keep this one', 'filters': ['constant(1)']}]},
            associations)

    def test_sorted_associations(self) -> None:
        """More specialized associations come first."""

        self._db.associations.insert_many([
            {'name': 'Specialized', 'filters': ['constant(2)']},
            {'name': 'Generic'},
            {'name': 'Very specialized', 'filters': ['constant(1)', 'constant(1)']},
        ])
        response = self.app.get(
            f'/api/advice/association-help/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [j.get('name') for j in associations.get('associations', [])])


if __name__ == '__main__':
    unittest.main()
