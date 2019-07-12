"""Unit tests for the reorient-jobbing module."""

import typing
import unittest

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2


class AdviceReorientJobbingTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "reorient-jobbing" advice."""

    model_id = 'advice-reorient-jobbing'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.city.departement_id = '09'
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 1,
                },
        })
        self.database.reorient_jobbing.insert_one(
            {
                '_id': '09',
                'departementJobStats':
                    {
                        'jobs': [
                            {
                                'romeId': 'A1413',
                                'masculineName': 'Aide caviste',
                                'feminineName': 'Aide caviste',
                                'name': 'Aide caviste',
                                'marketScore': 6,
                            },
                            {
                                'romeId': 'A1401',
                                'feminineName': 'Aide arboricole',
                                'masculineName': 'Aide arboricole',
                                'name': 'Aide arboricole',
                                'marketScore': 3,
                            },
                        ],
                    },
            }
        )

    def test_license(self) -> None:
        """Users with a license should not be concerned by reorientation."""

        self.persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_bts(self) -> None:
        """Users with a degree equivalent to bac +2 should have reorientation
        advice with low priority."""

        self.persona.user_profile.highest_degree = job_pb2.BTS_DUT_DEUG
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg=f'Failed for "{self.persona.name}"')

    def test_bac(self) -> None:
        """Users with a degree equivalent to baccalaureat should have reorientation
        with medium priority."""

        self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        if self.persona.project.passionate_level == project_pb2.LIFE_GOAL_JOB:
            self.persona.project.passionate_level = project_pb2.ALIMENTARY_JOB
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Failed for "{self.persona.name}"')

    def test_cap(self) -> None:
        """Users with CAP or BEP degree or equivalent should have reorientation
        with high priority."""

        self.persona.user_profile.highest_degree = job_pb2.CAP_BEP
        if self.persona.project.passionate_level == project_pb2.LIFE_GOAL_JOB:
            self.persona.project.passionate_level = project_pb2.ALIMENTARY_JOB
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_not_enough_offers(self) -> None:
        """Users with job with more offers than recommended jobs don't trigger the
        advice."""

        self.database.local_diagnosis.drop()
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 7,
                },
        })
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_cap_passionate_job(self) -> None:
        """Users with CAP/BEP degree with who is passionate about its job should
        have a low score."""

        self.database.job_group_info.insert_one({
            '_id': 'M1601',
            'growth20122022': .16,
        })
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.user_profile.highest_degree = job_pb2.CAP_BEP
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg=f'Failed for "{self.persona.name}"')

    def test_bac_passionate_job(self) -> None:
        """Users with BAC degree with who is passionate about its job should
        have a low score."""

        self.database.job_group_info.insert_one({
            '_id': 'M1601',
            'growth20122022': .16,
        })
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg=f'Failed for "{self.persona.name}"')

    def test_cap_passionate_but_no_future_job(self) -> None:
        """Users with CAP/BEP degree who is passionate about its job but their job has no
        no future, should have a medium score."""

        self.database.job_group_info.insert_one({
            '_id': 'M1601',
            'growth20122022': -.16,
        })
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.user_profile.highest_degree = job_pb2.CAP_BEP
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Failed for "{self.persona.name}"')

    def test_bac_passionate_but_no_future_job(self) -> None:
        """Users with BAC degree who is passionate about its job but their job has no
        no future, should have a low score."""

        self.database.job_group_info.insert_one({
            '_id': 'M1601',
            'growth20122022': -.16,
        })
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg=f'Failed for "{self.persona.name}"')

    def test_not_enough_recommendations(self) -> None:
        """Users with job with more offers than recommended jobs don't trigger the
        advice."""

        self.database.reorient_jobbing.drop()
        self.database.reorient_jobbing.insert_one(
            {
                '_id': '09',
                'departementJobStats':
                    {
                        'jobs': [
                            {
                                'romeId': 'A1413',
                                'masculineName': 'Aide caviste',
                                'feminineName': 'Aide caviste',
                                'name': 'Aide caviste',
                                'marketScore': 6,
                            },
                        ],
                    },
            }
        )
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')


class ReorientJobbingEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/reorient-jobbing endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'reorient-jobbing',
            'triggerScoringModel': 'advice-reorient-jobbing',
        })
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

    def _add_project_modifier(self, user: typing.Dict[str, typing.Any]) -> None:
        """Modifier to add a custom project."""

        user['projects'] = user.get('projects', []) + [{
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'city': {'departementId': '45'},
        }]
        user['profile'] = user.get('profile', {})
        user['profile']['gender'] = 'FEMININE'

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/reorient-jobbing/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_jobs(self) -> None:
        """Basic test with two recommended jobs."""

        self._db.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 1,
                },
        })

        self._db.reorient_jobbing.insert_one(
            {
                '_id': '45',
                'departementJobStats':
                    {
                        'jobs': [
                            {
                                'romeId': 'A1413',
                                'masculineName': 'Superman',
                                'feminineName': 'Wonderwoman',
                                'name': 'Superhero',
                                'marketScore': 6,
                            },
                            {
                                'romeId': 'A1401',
                                'feminineName': 'Aide arboricole',
                                'masculineName': 'Aide arboricole',
                                'name': 'Aide arboricole',
                                'marketScore': 4,
                            },
                        ],
                    },
            }
        )
        response = self.app.get(
            f'/api/advice/reorient-jobbing/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        jobs = self.json_from_response(response)
        self.assertEqual(
            [
                {
                    'name': 'Wonderwoman',
                    'offersPercentGain': 500.0,
                },
                {
                    'name': 'Aide arboricole',
                    'offersPercentGain': 300.0,
                }
            ],
            jobs['reorientJobbingJobs'])


if __name__ == '__main__':
    unittest.main()
