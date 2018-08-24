"""Unit tests for the module TODO: module name."""

import json
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceBetterJobInGroupTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Find a better job in job group" advice."""

    model_id = 'advice-better-job-in-group'

    def test_no_data(self):
        """No data for job group."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'foo'},
                {'codeOgr': '5678', 'name': 'foo'},
            ],
        })
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_should_try_other_job(self):
        """There's a job with way more offers, and the user wants to reorient."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.target_job.code_ogr = '5678'
        persona.project.kind = project_pb2.REORIENTATION
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'foo'},
                {'codeOgr': '5678', 'name': 'foo'},
            ],
            'requirements': {
                'specificJobs': [{
                    'codeOgr': '1234',
                    'percentSuggested': 100,
                }],
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_already_best_job(self):
        """User is targetting the best job in their group."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.target_job.code_ogr = '1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'foo'},
                {'codeOgr': '5678', 'name': 'foo'},
            ],
            'requirements': {
                'specificJobs': [{
                    'codeOgr': '1234',
                    'percentSuggested': 100,
                }],
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_already_good_job(self):
        """User is targetting a correct job in their group, but not the best."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.target_job.code_ogr = '1234'
        persona.project.job_search_length_months = 2
        persona.project.kind = project_pb2.FIND_A_FIRST_JOB
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'foo'},
                {'codeOgr': '5678', 'name': 'foo'},
            ],
            'requirements': {
                'specificJobs': [
                    {
                        'codeOgr': '5678',
                        'percentSuggested': 50,
                    },
                    {
                        'codeOgr': '1234',
                        'percentSuggested': 45,
                    },
                ],
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_bad_job_group(self):
        """Never recommend a reconversion inside this job group, it's too diverse."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2401'
        persona.project.target_job.code_ogr = '5678'
        persona.project.kind = project_pb2.REORIENTATION
        self.database.job_group_info.insert_one({
            '_id': 'K2401',
            'jobs': [
                {'codeOgr': '1234', 'name': 'foo'},
                {'codeOgr': '5678', 'name': 'foo'},
            ],
            'requirements': {
                'specificJobs': [{
                    'codeOgr': '1234',
                    'percentSuggested': 100,
                }],
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def test_advice_better_job_in_group_extra_data(self):
        """Test that the advisor computes extra data for the "Better Job in Group" advice."""

        project = {
            'targetJob': {'codeOgr': '1234', 'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'jobs': [
                {'codeOgr': '1234', 'name': 'Pilote'},
                {'codeOgr': '5678', 'name': 'Pompier'},
                {'codeOgr': '9012', 'name': 'Facteur'},
            ],
            'requirements': {
                'specificJobs': [
                    {
                        'codeOgr': '5678',
                        'percentSuggested': 55,
                    },
                    {
                        'codeOgr': '1234',
                        'percentSuggested': 45,
                    },
                ],
            },
        })
        self._db.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-better-job-in-group',
            'extraDataFieldName': 'better_job_in_group_data',
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

        self.assertEqual(
            'Pompier', advice.get('betterJobInGroupData', {}).get('betterJob', {}).get('name'))
        self.assertEqual(1, advice.get('betterJobInGroupData', {}).get('numBetterJobs'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
