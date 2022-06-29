"""Unit tests for the application_tips module."""

import datetime
import json
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceImproveInterviewTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Improve Your Interview Skills" advice."""

    model_id = 'advice-improve-interview'

    def test_not_enough_interviews(self) -> None:
        """Users does not get enough interviews."""

        persona = self._random_persona().clone()
        self._enforce_search_length_duration(persona.project, min_months=3, max_months=6)
        persona.project.total_interview_count = 1
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_many_interviews(self) -> None:
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = 21
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_in_methods_to_diploma_category(self) -> None:
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'enhance-methods-to-interview'
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_in_bravo_category(self) -> None:
        """Users has very few interviews but is in bravo category."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'bravo'
        self._enforce_search_length_duration(persona.project, min_months=3, max_months=6)
        persona.project.total_interview_count = 1
        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg=f'Failed for "{persona.name}"')

    def test_many_interviews_long_time(self) -> None:
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = 21
        self._enforce_search_length_duration(persona.project, max_months=6)
        score = self._score_persona(persona)
        self.assertGreaterEqual(score, 3, msg=f'Failed for "{persona.name}"')


class AdviceImproveResumeTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Improve Your Resume" advice."""

    model_id = 'advice-improve-resume'

    def test_not_enough_interviews(self) -> None:
        """Users does not get enough interviews."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        persona.project.city.departement_id = '14'
        self._enforce_search_length_duration(persona.project, min_months=3, max_months=6)
        if persona.project.weekly_applications_estimate < project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 1
        self.database.local_diagnosis.insert_one({
            '_id': '14:I1202',
            'imt': {
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_many_interviews(self) -> None:
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        persona.project.city.departement_id = '14'
        persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 21
        self.database.local_diagnosis.insert_one({
            '_id': '14:I1202',
            'imt': {
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_no_applications(self) -> None:
        """Users has never sent an application."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = -1
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_imt_data_missing(self) -> None:
        """Users does not get enough interview although IMT is missing."""

        persona = self._random_persona().clone()
        self._enforce_search_length_duration(persona.project, min_months=3, max_months=6)
        if persona.project.weekly_applications_estimate < project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 1
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_bravo_frustrated(self) -> None:
        """User is mostly good, but is frustrated about their resume."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'bravo'
        persona.user_profile.frustrations.append(user_profile_pb2.RESUME)
        score = self._score_persona(persona)
        self.assertNotEqual(score, 0, msg=f'Failed for "{persona.name}"')


class ProjectResumeEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/improve-resume endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_many([
            {
                'adviceId': 'improve-resume',
                'triggerScoringModel': 'advice-improve-resume',
            },
            {
                'adviceId': 'fresh-resume',
                'triggerScoringModel': 'advice-fresh-resume',
            },
        ])
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/improve-interview/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self) -> None:
        """Basic test with one quality and one improvement tip only."""

        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Re-read your CV', 'type': 'CV_IMPROVEMENT'},
        ])
        response = self.app.get(
            f'/api/advice/improve-resume/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {
                'qualities': [{'content': 'Testing'}],
                'improvements': [{'content': 'Re-read your CV'}],
            },
            tips)

    def test_filtered_tips(self) -> None:
        """Tips not useful for this project is filtered."""

        self._db.application_tips.insert_many([
            {'content': 'Not a good one', 'filters': ['constant(0)'], 'type': 'QUALITY'},
            {'content': 'Keep this one', 'filters': ['constant(1)'], 'type': 'QUALITY'},
        ])
        response = self.app.get(
            f'/api/advice/improve-resume/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {'qualities': [{'content': 'Keep this one', 'filters': ['constant(1)']}]},
            tips)

    def test_sorted_tips(self) -> None:
        """More specialized tips come first."""

        self._db.application_tips.insert_many([
            {'content': 'Specialized', 'filters': ['constant(2)'], 'type': 'QUALITY'},
            {'content': 'Generic', 'type': 'QUALITY'},
            {
                'content': 'Very specialized',
                'filters': ['constant(1)', 'constant(1)'],
                'type': 'QUALITY',
            },
        ])
        response = self.app.get(
            f'/api/advice/improve-resume/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])

    def test_translated_tips(self) -> None:
        """Tips are genderized and translated for the user."""

        self._db.application_tips.insert_one({
            'content': 'Vous êtes spéciale',
            'contentMasculine': 'Vous êtes spécial',
            'type': 'QUALITY'
        })
        self.add_translations([{
            'string': 'Vous êtes spécial',
            'fr@tu': 'Tu es spécial',
        }])

        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['gender'] = 'MASCULINE'
        user_info['profile']['locale'] = 'fr@tu'

        self.app.post(
            'api/user',
            content_type='application/json',
            data=json.dumps(user_info),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        response = self.app.get(
            f'/api/advice/improve-resume/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response).get('qualities')
        assert tips
        tip = tips.pop()
        self.assertFalse(tips)
        self.assertEqual({'content': 'Tu es spécial'}, tip)

    def test_fresh_resume_expanded_card(self) -> None:
        """Get expanded data from a "Fresh Resume" advice card instead of "Improve Resume"."""

        self._db.application_tips.insert_one({
            'content': 'Re-read your CV', 'type': 'CV_IMPROVEMENT',
        })
        response = self.app.get(
            f'/api/advice/fresh-resume/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        tips = self.json_from_response(response)
        self.assertEqual(
            ['Re-read your CV'],
            [t.get('content') for t in tips.get('improvements', [])])


class ProjectInterviewEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/improve-interview endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'improve-interview',
            'triggerScoringModel': 'advice-improve-interview',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/improve-interview/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self) -> None:
        """Basic test with one quality and one improvement tip only."""

        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Google your interviewer', 'type': 'INTERVIEW_PREPARATION'},
        ])
        response = self.app.get(
            f'/api/advice/improve-interview/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {
                'qualities': [{'content': 'Testing'}],
                'preparations': [{'content': 'Google your interviewer'}],
            },
            tips)

    def test_filtered_tips(self) -> None:
        """Tips not useful for this project is filtered."""

        self._db.application_tips.insert_many([
            {'content': 'Not a good one', 'filters': ['constant(0)'], 'type': 'QUALITY'},
            {'content': 'Keep this one', 'filters': ['constant(1)'], 'type': 'QUALITY'},
        ])
        response = self.app.get(
            f'/api/advice/improve-interview/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {'qualities': [{'content': 'Keep this one', 'filters': ['constant(1)']}]},
            tips)

    def test_sorted_tips(self) -> None:
        """More specialized tips come first."""

        self._db.application_tips.insert_many([
            {'content': 'Specialized', 'filters': ['constant(2)'], 'type': 'QUALITY'},
            {'content': 'Generic', 'type': 'QUALITY'},
            {
                'content': 'Very specialized',
                'filters': ['constant(1)', 'constant(1)'],
                'type': 'QUALITY',
            },
        ])
        response = self.app.get(
            f'/api/advice/improve-interview/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])


class EnhanceMethodsToInterviewTestCase(scoring_test.ScoringModelTestBase):
    """Tests for the enhance-methods-to-interview category scorer."""

    model_id = 'category-enhance-methods-to-interview'

    def test_search_not_started(self) -> None:
        """User hasn't started their search, we cannot tell anything."""

        persona = self._random_persona().clone()
        persona.project.job_search_has_not_started = True
        with self.assertRaises(scoring.NotEnoughDataException) as err:
            self._score_persona(persona)
        self.assertIn('not started', str(err.exception))

    def test_missing_interviews(self) -> None:
        """User didn't give their amount of interviews."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.ClearField('total_interview_count')
        self._assert_missing_fields_to_score_persona({'projects.0.totalInterviewCount'}, persona)

    def test_missing_applications(self) -> None:
        """User didn't give their estimate of applications."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.ClearField('weekly_applications_estimate')
        persona.project.total_interview_count = 2
        self._assert_missing_fields_to_score_persona(
            {'projects.0.weeklyApplicationsEstimate'}, persona)

    def test_many_applications_no_interview(self) -> None:
        """User does a lot of applications, with no result."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.total_interview_count = -1
        persona.project.weekly_applications_estimate = project_pb2.A_LOT
        self.assertEqual(3, self._score_persona(persona))

    def test_many_interviews(self) -> None:
        """User alread has had many interviews."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.total_interview_count = 6
        self.assertEqual(0, self._score_persona(persona))

    def test_some_applications_few_interviews(self) -> None:
        """User has some interviews, but not enough."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.total_interview_count = 2
        persona.project.weekly_applications_estimate = project_pb2.SOME
        score = self._score_persona(persona)
        self.assertLess(0, score)
        self.assertGreater(3, score)


class RelevanceMethodsToInterviewTestCase(scoring_test.ScoringModelTestBase):
    """Tests for the enhance-methods-to-interview relevance scorer."""

    model_id = 'relevance-enhance-methods-to-interview'

    def test_search_not_started(self) -> None:
        """User hasn't started their search, we cannot tell anything."""

        persona = self._random_persona().clone()
        persona.project.job_search_has_not_started = True
        self.assertEqual(1, self._score_persona(persona))

    def test_missing_interviews(self) -> None:
        """User didn't give their amount of interviews."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.ClearField('total_interview_count')
        persona.project.weekly_applications_estimate = project_pb2.A_LOT
        self.assertEqual(1, self._score_persona(persona))

    def test_missing_applications(self) -> None:
        """User didn't give their estimate of applications."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.ClearField('weekly_applications_estimate')
        persona.project.total_interview_count = -1
        self.assertEqual(1, self._score_persona(persona))

    def test_many_interviews(self) -> None:
        """User alread has had many interviews."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=90))
        persona.project.total_interview_count = 6
        self.assertEqual(3, self._score_persona(persona))


class BetterApplicationModesTestCase(scoring_test.ScoringModelTestBase):
    """Tests for the search-methods category scorer."""

    model_id = 'category-search-methods'

    def setUp(self) -> None:
        super().setUp()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })

    def test_missing_application_mode(self) -> None:
        """User didn't give their preferred application modes."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.ClearField('preferred_application_mode')
        self._assert_missing_fields_to_score_persona(
            {'projects.0.preferredApplicationMode'}, persona)

    def test_missing_application_info(self) -> None:
        """User didn't give their preferred application modes."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1235'
        persona.project.preferred_application_mode = job_pb2.SPONTANEOUS_APPLICATION
        self._assert_missing_fields_to_score_persona(
            {'data.job_group_info.A1235.application_modes'}, persona)
        with self.assertRaises(scoring.NotEnoughDataException) as err:
            self._score_persona(persona)
        self.assertIn('job has no application modes info', str(err.exception))

    def test_has_correct_application_mode(self) -> None:
        """User applies the right way."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.preferred_application_mode = job_pb2.SPONTANEOUS_APPLICATION
        self.assertEqual(0, self._score_persona(persona))

    def test_has_good_application_mode(self) -> None:
        """User uses the second best application mode."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.preferred_application_mode = job_pb2.PLACEMENT_AGENCY
        self.assertEqual(1, self._score_persona(persona))

    def test_has_no_good_application_mode(self) -> None:
        """User doesn't use one of the best application modes."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.preferred_application_mode = job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS
        self.assertEqual(3, self._score_persona(persona))


if __name__ == '__main__':
    unittest.main()
