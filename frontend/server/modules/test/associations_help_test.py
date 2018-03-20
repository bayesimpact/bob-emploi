"""Unit tests for the associations_help module."""

import datetime
import json
import unittest

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceAssociationHelpTestCase(scoring_test.ScoringModelTestBase('advice-association-help')):
    """Unit tests for the "Find an association to help you" advice."""

    def test_no_data(self):
        """No associations data."""

        persona = self._random_persona().clone()
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_motivated(self):
        """User is motivated."""

        persona = self._random_persona().clone()
        scoring_project = persona.scoring_project(self.database)
        self.database.associations.insert_one({'name': 'SNC'})
        del persona.user_profile.frustrations[:]
        if persona.project.job_search_length_months >= 12:
            persona.project.job_search_length_months = 11
        if scoring_project.get_search_length_at_creation() >= 12:
            persona.project.job_search_started_at.FromDatetime(
                persona.project.created_at.ToDatetime() - datetime.timedelta(days=336))
        score = self._score_persona(persona)
        self.assertEqual(2, score, msg='Failed for "{}"'.format(persona.name))

    def test_need_motivation(self):
        """User needs motivation."""

        persona = self._random_persona().clone()
        self.database.associations.insert_one({'name': 'SNC'})
        persona.user_profile.frustrations.append(user_pb2.MOTIVATION)
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg='Failed for "{}"'.format(persona.name))

    def test_many_assos_and_long_search(self):
        """User searches for a long time and there are a lot of associations."""

        persona = self._random_persona().clone()
        self.database.associations.insert_many(
            [{'name': 'SNC'}, {'name': 'SND'}, {'name': 'SNE'}, {'name': 'SNF'}])
        persona.project.job_search_length_months = 6
        persona.project.job_search_started_at.FromDatetime(
            persona.project.created_at.ToDatetime() - datetime.timedelta(days=183))
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg='Failed for "{}"'.format(persona.name))

    def test_very_long_search(self):
        """User searches for a very long time."""

        persona = self._random_persona().clone()
        self.database.associations.insert_one({'name': 'SNC'})
        persona.project.job_search_length_months = 12
        persona.project.job_search_started_at.FromDatetime(
            persona.project.created_at.ToDatetime() - datetime.timedelta(days=366))
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg='Failed for "{}"'.format(persona.name))


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def test_advice_association_help_extra_data(self):
        """Test that the advisor computes extra data for the "Find an association" advice."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.associations.insert_many([
            {'name': 'Pôle emploi'},
            {'name': 'SNC', 'filters': ['for-departement(14,15,16)']},
            {'name': 'Ressort', 'filters': ['for-departement(69)']},
        ])
        self._db.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-association-help',
            'extraDataFieldName': 'associations_data',
            'isReadyForProd': True,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')

        self.assertEqual('SNC', advice.get('associationsData').get('associationName'))


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../association-help endpoint."""

    def setUp(self):
        super(EndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'association-help',
            'triggerScoringModel': 'advice-association-help',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/association-help/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_one_association(self):
        """Basic test with one association only."""

        self._db.associations.insert_one({'name': 'SNC'})
        response = self.app.get(
            '/api/advice/association-help/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual({'associations': [{'name': 'SNC'}]}, associations)

    def test_filtered_associations(self):
        """Association not useful for this project is filtered."""

        self._db.associations.insert_many([
            {'name': 'Not a good one', 'filters': ['constant(0)']},
            {'name': 'Keep this one', 'filters': ['constant(1)']},
        ])
        response = self.app.get(
            '/api/advice/association-help/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual(
            {'associations': [{'name': 'Keep this one', 'filters': ['constant(1)']}]},
            associations)

    def test_sorted_associations(self):
        """More specialized associations come first."""

        self._db.associations.insert_many([
            {'name': 'Specialized', 'filters': ['constant(2)']},
            {'name': 'Generic'},
            {'name': 'Very specialized', 'filters': ['constant(1)', 'constant(1)']},
        ])
        response = self.app.get(
            '/api/advice/association-help/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        associations = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [j.get('name') for j in associations.get('associations', [])])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
