"""Unit tests for the application_tips module."""

import json
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceImproveInterviewTestCase(scoring_test.ScoringModelTestBase('advice-improve-interview')):
    """Unit tests for the "Improve Your Interview Skills" advice."""

    def test_not_enough_interviews(self):
        """Users does not get enough interviews."""

        persona = self._random_persona().clone()
        if persona.project.job_search_length_months < 3:
            persona.project.job_search_length_months = 3
        if persona.project.job_search_length_months > 6:
            persona.project.job_search_length_months = 6
        persona.project.total_interview_count = 1
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_many_interviews(self):
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = 21
        persona.project.job_search_length_months = 2
        if persona.project.job_search_length_months > 6:
            persona.project.job_search_length_months = 6
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}":'.format(persona.name))

    def test_many_interviews_long_time(self):
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = 21
        if persona.project.job_search_length_months > 6:
            persona.project.job_search_length_months = 6
        score = self._score_persona(persona)
        self.assertGreaterEqual(score, 3, msg='Failed for "{}":'.format(persona.name))


class AdviceImproveResumeTestCase(scoring_test.ScoringModelTestBase('advice-improve-resume')):
    """Unit tests for the "Improve Your Resume" advice."""

    def test_not_enough_interviews(self):
        """Users does not get enough interviews."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        persona.project.mobility.city.departement_id = '14'
        if persona.project.job_search_length_months < 3:
            persona.project.job_search_length_months = 3
        if persona.project.job_search_length_months > 6:
            persona.project.job_search_length_months = 6
        if persona.project.weekly_applications_estimate < project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 1
        self.database.local_diagnosis.insert_one({
            '_id': '14:I1202',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}":'.format(persona.name))

    def test_many_interviews(self):
        """Users has maximum interviews."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        persona.project.mobility.city.departement_id = '14'
        persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 21
        self.database.local_diagnosis.insert_one({
            '_id': '14:I1202',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_no_applications(self):
        """Users has never sent an application."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = -1
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_imt_data_missing(self):
        """Users does not get enough interview although IMT is missing."""

        persona = self._random_persona().clone()
        if persona.project.job_search_length_months < 3:
            persona.project.job_search_length_months = 3
        if persona.project.job_search_length_months > 6:
            persona.project.job_search_length_months = 6
        if persona.project.weekly_applications_estimate < project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.total_interview_count = 1
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}":'.format(persona.name))


class ProjectResumeEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/improve-resume endpoint."""

    def setUp(self):
        super(ProjectResumeEndpointTestCase, self).setUp()
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

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/improve-interview/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self):
        """Basic test with one quality and one improvement tip only."""

        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Re-read your CV', 'type': 'CV_IMPROVEMENT'},
        ])
        response = self.app.get(
            '/api/advice/improve-resume/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {
                'qualities': [{'content': 'Testing'}],
                'improvements': [{'content': 'Re-read your CV'}],
            },
            tips)

    def test_filtered_tips(self):
        """Tips not useful for this project is filtered."""

        self._db.application_tips.insert_many([
            {'content': 'Not a good one', 'filters': ['constant(0)'], 'type': 'QUALITY'},
            {'content': 'Keep this one', 'filters': ['constant(1)'], 'type': 'QUALITY'},
        ])
        response = self.app.get(
            '/api/advice/improve-resume/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {'qualities': [{'content': 'Keep this one', 'filters': ['constant(1)']}]},
            tips)

    def test_sorted_tips(self):
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
            '/api/advice/improve-resume/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])

    def test_fresh_resume_expanded_card(self):
        """Get expanded data from a "Fresh Resume" advice card instead of "Improve Resume"."""

        self._db.application_tips.insert_one({
            'content': 'Re-read your CV', 'type': 'CV_IMPROVEMENT',
        })
        response = self.app.get(
            '/api/advice/fresh-resume/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})
        tips = self.json_from_response(response)
        self.assertEqual(
            ['Re-read your CV'],
            [t.get('content') for t in tips.get('improvements', [])])


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def test_advice_improve_success_rate_extra_data(self):
        """Test that the advisor computes extra data for the "Improve Success Rate" advice."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchLengthMonths': 6, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'skills': [{'name': 'Humour'}, {'name': 'Empathie'}],
                'skillsShortText': '**Humour** et **empathie**',
            },
        })
        self._db.advice_modules.insert_one({
            'adviceId': 'improve-success',
            'triggerScoringModel': 'advice-improve-resume',
            'extraDataFieldName': 'improve_success_rate_data',
            'isReadyForProd': True,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'improve-success')
        self.assertFalse(
            advice.get('improveSuccessRateData', {}).get('requirements', {}).get('skills'))
        self.assertEqual(
            '**Humour** et **empathie**',
            advice.get('improveSuccessRateData', {}).get('requirements', {}).get('skillsShortText'))

    def test_advice_improve_success_rate_no_extra_data(self):
        """Test that the advisor has no extra data when there is no personnalization."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'departementId': '14'}},
            'jobSearchLengthMonths': 6, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.local_diagnosis.insert_one({
            '_id': '14:A1234',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            },
        })
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'skills': [{'name': 'Humour'}, {'name': 'Empathie'}],
            },
        })
        self._db.advice_modules.insert_one({
            'adviceId': 'improve-success',
            'triggerScoringModel': 'advice-improve-resume',
            'extraDataFieldName': 'improve_success_rate_data',
            'isReadyForProd': True,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'improve-success')
        self.assertFalse(any(key.endswith('Data') for key in advice.keys()), advice.keys())


class ProjectInterviewEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the advice/improve-interview endpoint."""

    def setUp(self):
        super(ProjectInterviewEndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'improve-interview',
            'triggerScoringModel': 'advice-improve-interview',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/improve-interview/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self):
        """Basic test with one quality and one improvement tip only."""

        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Google your interviewer', 'type': 'INTERVIEW_PREPARATION'},
        ])
        response = self.app.get(
            '/api/advice/improve-interview/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {
                'qualities': [{'content': 'Testing'}],
                'preparations': [{'content': 'Google your interviewer'}],
            },
            tips)

    def test_filtered_tips(self):
        """Tips not useful for this project is filtered."""

        self._db.application_tips.insert_many([
            {'content': 'Not a good one', 'filters': ['constant(0)'], 'type': 'QUALITY'},
            {'content': 'Keep this one', 'filters': ['constant(1)'], 'type': 'QUALITY'},
        ])
        response = self.app.get(
            '/api/advice/improve-interview/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            {'qualities': [{'content': 'Keep this one', 'filters': ['constant(1)']}]},
            tips)

    def test_sorted_tips(self):
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
            '/api/advice/improve-interview/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
