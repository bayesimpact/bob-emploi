"""Unit tests for the jobboards module."""

import json
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceJobBoardsTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Other Work Environments" advice."""

    model_id = 'advice-job-boards'

    def test_frustrated(self):
        """Frustrated by not enough offers."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_lot_of_offers(self):
        """User has many offers already."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.weekly_offers_estimate = project_pb2.A_LOT

        score = self._score_persona(persona)

        # We do want to show the chantier but not pre-select it.
        self.assertEqual(1, score, msg='Failed for "{}"'.format(persona.name))

    def test_extra_data(self):
        """Compute extra data."""

        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_one({'title': 'Remix Jobs'})
        result = self.model.compute_extra_data(project)
        self.assertTrue(result, msg='Failed for "{}"'.format(persona.name))
        self.assertEqual(
            'Remix Jobs', result.job_board_title, msg='Failedfor "{}"'.format(persona.name))

    def test_filter_data(self):
        """Get the job board with the most filters."""

        persona = self._random_persona().clone()
        persona.project.mobility.city.departement_id = '69'
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_many([
            {'title': 'Remix Jobs'},
            {'title': 'Specialized for me', 'filters': ['for-departement(69)']},
            {'title': 'Specialized NOT for me', 'filters': ['for-departement(31)']},
        ])
        result = self.model.compute_extra_data(project)
        self.assertTrue(result)
        self.assertEqual('Specialized for me', result.job_board_title)

    def test_filter_pole_emploi(self):
        """Never show Pôle emploi,"""

        persona = self._random_persona().clone()
        persona.project.mobility.city.departement_id = '69'
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_many([
            {'title': 'Pôle emploi', 'isWellKnown': True},
            {'title': 'Remix Jobs'},
        ])
        result = self.model.compute_extra_data(project)
        self.assertTrue(result)
        self.assertEqual('Remix Jobs', result.job_board_title)


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def test_advice_job_boards_extra_data(self):
        """Test that the advisor computes extra data for the "Find a Job Board" advice."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.jobboards.insert_one({'title': 'Indeed', 'filters': ['for-departement(14)']})
        self._db.advice_modules.insert_one({
            'adviceId': 'job-boards',
            'triggerScoringModel': 'advice-job-boards',
            'extraDataFieldName': 'job_boards_data',
            'isReadyForProd': True,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'job-boards')
        self.assertEqual('Indeed', advice.get('jobBoardsData', {}).get('jobBoardTitle'))
        self.assertFalse(advice.get('jobBoardsData', {}).get('isSpecificToJobGroup'))
        self.assertTrue(advice.get('jobBoardsData', {}).get('isSpecificToRegion'))


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../jobboards endpoint."""

    def setUp(self):
        super(EndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'find-a-jobboard',
            'triggerScoringModel': 'advice-job-boards',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/find-a-jobboard/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_one_jobboard(self):
        """Basic test with one job board only."""

        self._db.jobboards.insert_one({'title': 'Indeed'})
        response = self.app.get(
            '/api/advice/find-a-jobboard/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        jobboards = self.json_from_response(response)
        self.assertEqual({'jobBoards': [{'title': 'Indeed'}]}, jobboards)

    def test_filtered_jobboards(self):
        """Job board not useful for this project is filtered."""

        self._db.jobboards.insert_many([
            {'title': 'Not a good one', 'filters': ['constant(0)']},
            {'title': 'Keep this one', 'filters': ['constant(1)']},
        ])
        response = self.app.get(
            '/api/advice/find-a-jobboard/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        jobboards = self.json_from_response(response)
        self.assertEqual(
            {'jobBoards': [{'title': 'Keep this one', 'filters': ['constant(1)']}]},
            jobboards)

    def test_sorted_jobboards(self):
        """More specialized job boards come first."""

        self._db.jobboards.insert_many([
            {'title': 'Specialized', 'filters': ['constant(2)']},
            {'title': 'Generic'},
            {'title': 'Very specialized', 'filters': ['constant(1)', 'constant(1)']},
        ])
        response = self.app.get(
            '/api/advice/find-a-jobboard/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        jobboards = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [j.get('title') for j in jobboards.get('jobBoards', [])])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
