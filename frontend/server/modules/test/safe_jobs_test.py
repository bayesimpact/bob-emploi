"""Unit tests for the reorient-jobbing module."""

from typing import Any
import unittest

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test
from bob_emploi.frontend.api import boolean_pb2


class AdviceExploreSafeJobsTest(scoring_test.ScoringModelTestBase):
    """Unit tests for the "explore-safe-jobs" advice module."""

    model_id = 'advice-explore-safe-jobs'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()
        self.database.job_group_info.insert_many([
            {
                '_id': 'very-safe',
                'automationRisk': 20,
                'covidRisk': 'COVID_SAFE',
            },
            {
                '_id': 'covid-safe',
                'covidRisk': 'COVID_SAFE',
            },
            {
                '_id': 'unknown-risk',
            },
            {
                '_id': 'very-risky',
                'automationRisk': 90,
                'covidRisk': 'COVID_RISKY',
            },
        ])

    def test_job_already_safe(self) -> None:
        """Users with a job that is already safe should not have this module."""

        self.persona.project.target_job.job_group.rome_id = 'very-safe'
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_job_unknown_risk(self) -> None:
        """Users with a job with unknown risk."""

        self.persona.project.target_job.job_group.rome_id = 'unknown-risk'
        score = self._score_persona(self.persona)
        self.assertGreater(score, 1, msg=f'Failed for "{self.persona.name}"')
        self.assertLess(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_undefined_project(self) -> None:
        """Users with undefined project."""

        self.persona.project.ClearField('target_job')
        self.persona.project.has_clear_project = boolean_pb2.TRUE
        score = self._score_persona(self.persona)
        self.assertGreater(score, 1, msg=f'Failed for "{self.persona.name}"')
        self.assertLess(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_job_very_risky(self) -> None:
        """Users with a job that is very risky should really have this module."""

        self.persona.project.target_job.job_group.rome_id = 'very-risky'
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_no_risky_data(self) -> None:
        """No risk information in the dataset."""

        self.database.job_group_info.update_many({}, {
            '$unset': {
                'automationRisk': 1,
                'covidRisk': 1,
            },
        })
        self._assert_missing_fields_to_score_persona(
            {'data.job_group_info.covid_risk', 'data.job_group_info.automation_risk'}, self.persona,
        )


class AdviceExploreSafeJobsDataTest(base_test.ServerTestCase):
    """Unit tests for the advice/explore-safe-jobs endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'explore-safe-jobs',
            'triggerScoringModel': 'advice-explore-safe-jobs',
        })
        self._db.job_group_info.insert_many([
            {
                '_id': 'very-safe',
                'automationRisk': 20,
                'covidRisk': 'COVID_SAFE',
                'name': 'Very Safe Jobs',
            },
            {
                '_id': 'covid-safe',
                'covidRisk': 'COVID_SAFE',
                'name': 'Covid Safe Jobs',
            },
            {
                '_id': 'unknown-risk',
                'name': 'Unknown Risk',
            },
            {
                '_id': 'very-risky',
                'automationRisk': 90,
                'covidRisk': 'COVID_RISKY',
            },
        ])
        self._db.local_diagnosis.insert_one({
            '_id': '45:A1234',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 1,
                },
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[self._add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def _add_project_modifier(self, user: dict[str, Any]) -> None:
        """Modifier to add a custom project."""

        user['projects'] = user.get('projects', []) + [{
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'city': {'departementId': '45'},
        }]
        user['profile'] = user.get('profile', {})
        user['profile']['gender'] = 'FEMININE'
        user['profile']['locale'] = 'en'

    def test_get_data(self) -> None:
        """Basic test to get safe jobs."""

        response = self.app.get(
            f'/api/advice/explore-safe-jobs/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        job_list = self.json_from_response(response)
        self.assertEqual({'isSafeFromAutomation', 'isSafeFromCovid', 'jobGroups'}, job_list.keys())
        self.assertEqual(
            ['Covid Safe Jobs', 'Unknown Risk', 'Very Safe Jobs'],
            sorted(job_group.get('name', '') for job_group in job_list['jobGroups']))
        self.assertTrue(job_list.get('isSafeFromAutomation'))
        self.assertTrue(job_list.get('isSafeFromCovid'))


if __name__ == '__main__':
    unittest.main()
