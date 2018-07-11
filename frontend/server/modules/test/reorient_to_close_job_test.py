"""Unit tests for the reorient-jobbing module."""

import datetime
import json
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceReorientCloseTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "reorient-jobbing" advice."""

    model_id = 'advice-reorient-to-close-job'

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(AdviceReorientCloseTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.mobility.city.departement_id = '09'
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Aide caviste'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1401', 'name': 'Aide arboricole'},
                    'mobilityType': job_pb2.CLOSE,
                }],
        })

    def test_search_for_very_long_time(self):
        """User searching for 13 months should have a high score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=397))
        project = self.persona.scoring_project(self.database, now=self.now)
        score, explanations = self.model.score_and_explain(project)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(self.persona.name))
        self.assertEqual(['vous cherchez depuis 13 mois'], explanations)

    def test_search_for_long_time(self):
        """User searching for 11 months should have a medium score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=335))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(self.persona.name))

    def test_search_for_quite_long_time(self):
        """User searching for 7 months should have a low score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=214))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg='Failed for "{}"'.format(self.persona.name))

    def test_search_just_started(self):
        """User searching for 15 days should have a medium score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        if self.persona.project.passionate_level >= project_pb2.PASSIONATING_JOB:
            self.persona.project.passionate_level = project_pb2.ALIMENTARY_JOB
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=15))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(self.persona.name))

    def test_passionate_search_just_started(self):
        """User passionate about their job and searching for 15 days should have a low score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=15))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg='Failed for "{}"'.format(self.persona.name))

    def test_search_reasonable_time(self):
        """User searching for 4 months should have a 0 score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=124))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(self.persona.name))

    def test_search_not_started(self):
        """User has not started their research should have a medium score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        if self.persona.project.passionate_level >= project_pb2.PASSIONATING_JOB:
            self.persona.project.passionate_level = project_pb2.ALIMENTARY_JOB
        self.persona.project.job_search_has_not_started = True
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(self.persona.name))

    def test_passionate_search_not_started(self):
        """User passionate about their job that has not started their research
        should have a low score."""

        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 45:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self.persona.project.job_search_has_not_started = True
        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg='Failed for "{}"'.format(self.persona.name))

    def test_user_old(self):
        """Users older than 44 y.o should have a zero score."""

        self.persona.user_profile.year_of_birth = datetime.date.today().year - 50
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(self.persona.name))

    def test_not_enough_offers(self):
        """Users with job with more offers than recommended jobs don't trigger the
        advice."""

        self.database.local_diagnosis.drop()
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 40,
                }
        })
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(self.persona.name))

    def test_not_enough_recommendations(self):
        """Users without enough recommended jobs don't trigger the advice."""

        self.database.local_diagnosis.drop()
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Aide caviste'},
                    'mobilityType': job_pb2.CLOSE,
                }],
        })
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(self.persona.name))

    def test_recommendations_in_both_categories(self):
        """Users with a total of two recommended jobs should have a high score."""

        self.database.local_diagnosis.drop()
        self.database.local_diagnosis.insert_one({
            '_id': '09:M1601',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Aide caviste'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1401', 'name': 'Aide arboricole'},
                    'mobilityType': job_pb2.EVOLUTION,
                }],
        })
        self. persona.user_profile.year_of_birth = datetime.date.today().year - 40
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            now.get() - datetime.timedelta(days=397))
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(self.persona.name))


class ReorientCloseEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/reorient-to-close endpoint."""

    def setUp(self):
        super(ReorientCloseEndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'reorient-to-close-job',
            'triggerScoringModel': 'advice-reorient-to-close-job',
        })
        self._db.local_diagnosis.insert_one({
            '_id': '45:A1234',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Aide caviste'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1401', 'name': 'Aide arboricole'},
                    'mobilityType': job_pb2.CLOSE,
                }],
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[self._add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def _add_project_modifier(self, user):
        """Modifier to add a custom project."""

        user['projects'] = user.get('projects', []) + [{
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '45'}},
        }]

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/reorient-to-close-job/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_four_jobs(self):
        """Basic test with four recommended jobs."""

        self._db.local_diagnosis.drop()
        self._db.local_diagnosis.insert_one({
            '_id': '45:A1234',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Superhero'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1401', 'name': 'Aide arboricole'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1412', 'name': 'Hero'},
                    'mobilityType': job_pb2.EVOLUTION,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1402', 'name': 'Aide caviste'},
                    'mobilityType': job_pb2.EVOLUTION,
                }],
        })

        response = self.app.get(
            '/api/advice/reorient-to-close-job/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        jobs = self.json_from_response(response)
        self.assertEqual(
            [
                {
                    'name': 'Superhero',
                    'offersPercentGain': 200,
                },
                {
                    'name': 'Aide arboricole',
                    'offersPercentGain': 50.0,
                }
            ],
            jobs['closeJobs'])
        self.assertEqual(
            [
                {
                    'name': 'Hero',
                    'offersPercentGain': 200,
                },
                {
                    'name': 'Aide caviste',
                    'offersPercentGain': 50.0,
                }
            ],
            jobs['evolutionJobs'])


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def test_advice_reorient_to_close_extra_data(self):
        """Test that the advisor computes extra data for the "reorient to close job" advice."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchStartedAt': '2015-11-01T13:00:00Z',
        }
        profile = {
            'yearOfBirth': 1985,
            'gender': 'FEMININE',
        }
        self._db.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt':
                {
                    'yearlyAvgOffersPer10Candidates': 4,
                },
            'lessStressfulJobGroups': [
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 12}},
                    'jobGroup': {'romeId': 'A1413', 'name': 'Superhero'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 6}},
                    'jobGroup': {'romeId': 'A1401', 'name': 'Aide arboricole'},
                    'mobilityType': job_pb2.CLOSE,
                },
                {
                    'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': 3}},
                    'jobGroup': {'romeId': 'A1412', 'name': 'Aide agricole'},
                    'mobilityType': job_pb2.CLOSE,
                }],
        })
        self._db.advice_modules.insert_one({
            'adviceId': 'reorient-to-close-job',
            'triggerScoringModel': 'advice-reorient-to-close-job',
            'extraDataFieldName': 'reorient_data',
            'isReadyForProd': True,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'profile': profile, 'projects': [project]}),
            content_type='application/json')

        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'reorient-to-close-job')
        jobs = advice.get('reorientData', {}).get('jobs')
        self.assertEqual(
            ['Superhero', 'Aide arboricole'], [job['name'] for job in jobs])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
