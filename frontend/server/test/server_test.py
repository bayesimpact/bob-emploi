"""Tests for the server module."""

import datetime
import json
import typing
import unittest
from unittest import mock
from urllib import parse

import requests_mock

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock


class OtherEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the other small endpoints."""

    def test_health_check(self) -> None:
        """Basic call to "/"."""

        response = self.app.get('/')
        self.assertEqual(200, response.status_code)

    def _create_user_joe_the_cheminot(self) -> typing.Tuple[str, str]:
        """Joe is a special user used to analyse feedback."""

        user_data = {
            'profile': {'name': 'Joe'},
            'projects': [
                {'projectId': 'another-id', 'title': "Cultivateur d'escargots à Lyon"},
                {'projectId': 'pid', 'title': 'Cheminot à Caen', 'seniority': 1},
                {'projectId': 'last-id', 'title': 'Polénisateur à Brest', 'seniority': 2}],
        }
        return self.create_user_with_token(data=user_data, email='foo@bar.fr')

    @mock.patch(server.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    @requests_mock.mock()
    def test_feedback(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic call to "/api/feedback"."""

        mock_requests.post('slack://bob-bots', json={
            'text': ':mega: Aaaaaaaaaaaaawesome',
        })

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data=f'{{"userId": "{user_id}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            ['Aaaaaaaaaaaaawesome!\nsecond line'],
            [d.get('feedback') for d in self._user_db.feedbacks.find()])

    def test_feedback_no_user(self) -> None:
        """Testing /api/feedback with missing user ID."""

        self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(200, response.status_code)

    def test_feedback_wrong_user(self) -> None:
        """Testing /api/feedback with wrong user ID, this should fail."""

        auth_token = self._create_user_joe_the_cheminot()[1]

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "baduserid", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_feedback_missing_project(self) -> None:
        """Testing /api/feedback with missing project ID but correct user ID."""

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data=f'{{"userId": "{user_id}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    @mock.patch(now.__name__ + '.get')
    def test_usage_stats(self, mock_now: mock.MagicMock) -> None:
        """Testing /api/usage/stats endpoint."""

        self._user_db.user.insert_many([
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2017-06-03T12:00:00Z'},
            {'registeredAt': '2017-06-03T13:00:00Z'},
            {
                'registeredAt': '2017-06-04T12:00:00Z',
                'featuresEnabled': {'excludeFromAnalytics': True},
            },
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 5}}]},
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 2}}]},
            {
                'registeredAt': '2017-06-10T11:00:00Z',
                'projects': [{'feedback': {'score': 2}}],
                'featuresEnabled': {'excludeFromAnalytics': True},
            },
        ])
        mock_now.return_value = datetime.datetime(
            2017, 6, 10, 12, 30, tzinfo=datetime.timezone.utc)

        response = self.app.get('/api/usage/stats')
        self.assertEqual(
            {
                'totalUserCount': 8,
                'weeklyNewUserCount': 3,
            },
            self.json_from_response(response))

    def test_redirect_eterritoire(self) -> None:
        """Check the /api/redirect/eterritoire endpoint."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69123')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr/lyon/69123', response.location)

    def test_redirect_eterritoire_missing(self) -> None:
        """Check the /api/redirect/eterritoire endpoint for missing city."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69006')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr', response.location)

    def test_compute_advices_for_missing_project(self) -> None:
        """Check the /api/project/compute-advices endpoint without projects."""

        response = self.app.post(
            '/api/project/compute-advices', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_compute_advices_for_project(self) -> None:
        """Check the /api/project/compute-advices endpoint without projects."""

        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-advices',
            data='{"projects": [{}]}', content_type='application/json')
        advice = self.json_from_response(response)
        self.assertEqual({'advices': [{'adviceId': 'one-ring', 'numStars': 1}]}, advice)

    def test_generate_tokens(self) -> None:
        """Check the /api/user/.../generate-auth-tokens."""

        user_id, auth_token = self.create_user_with_token(email='pascal@example.com')
        response = self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token})
        tokens = self.json_from_response(response)
        self.assertEqual(
            {'auth', 'employment-status', 'nps', 'reset', 'settings', 'unsubscribe', 'user'},
            tokens.keys())
        auth.check_token(user_id, tokens['unsubscribe'], role='unsubscribe')
        auth.check_token(user_id, tokens['employment-status'], role='employment-status')
        auth.check_token(user_id, tokens['nps'], role='nps')
        auth.check_token(user_id, tokens['settings'], role='settings')
        auth.check_token(user_id, tokens['auth'], role='')
        # Try reset token as auth token.
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email":"pascal@example.com","userId":"{user_id}",'
            f'"authToken":"{tokens["reset"]}","hashedPassword":"dummy"}}')
        self.assertEqual(200, response.status_code)
        self.assertEqual(user_id, tokens['user'])

    def test_generate_tokens_missing_auth(self) -> None:
        """Check that the /api/user/.../generate-auth-tokens is protected."""

        user_id, unused_auth_token = self.create_user_with_token(email='pascal@example.com')
        response = self.app.get(f'/api/user/{user_id}/generate-auth-tokens')
        self.assertEqual(401, response.status_code)

    def test_diagnose_missing_project(self) -> None:
        """Check the /api/project/diagnose endpoint without projects."""

        self._db.diagnostic_sentences.insert_one({
            'order': 1,
            'sentenceTemplate': 'Yay',
        })
        response = self.app.post(
            '/api/project/diagnose', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_diagnose_for_project(self) -> None:
        """Check the /api/project/diagnose endpoint."""

        self._db.diagnostic_sentences.insert_one({
            'order': 1,
            'sentenceTemplate': 'Yay',
        })
        self._db.diagnostic_submetrics_scorers.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(3)',
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
        })
        response = self.app.post(
            '/api/project/diagnose',
            data='{"projects": [{}]}', content_type='application/json')
        diagnostic = self.json_from_response(response)
        self.assertEqual({'overallScore', 'subDiagnostics', 'text'}, diagnostic.keys())


class ProjectRequirementsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the requirements endpoints."""

    def setUp(self) -> None:
        super(ProjectRequirementsEndpointTestCase, self).setUp()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'romeId': 'A1234',
            'requirements': {
                'extras': [{'name': 'foo'}],
                'diplomas': [{'name': 'bar'}],
            },
        })

    def test_unknown_job_group(self) -> None:
        """Test with an unknown job group."""

        response = self.app.get('/api/job/requirements/UNKNOWN_JOB_GROUP')
        self.assertEqual(200, response.status_code)
        self.assertEqual('{}', response.get_data(as_text=True))

    def test_job_requirements(self) -> None:
        """Test the endpoint using only the job group ID."""

        response = self.app.get('/api/job/requirements/A1234')
        requirements = self.json_from_response(response)
        self.assertEqual(set(['diplomas', 'extras']), set(requirements))
        # Point check.
        self.assertEqual('bar', requirements['diplomas'][0]['name'])


class JobApplicationModesEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the application modes endpoint."""

    def setUp(self) -> None:
        super(JobApplicationModesEndpointTestCase, self).setUp()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'romeId': 'A1234',
            'applicationModes': {'FAP1': {'modes': [
                {'mode': 'SPONTANEOUS_APPLICATION', 'percentage': 50},
                {'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS', 'percentage': 30},
                {'mode': 'PLACEMENT_AGENCY', 'percentage': 15},
                {'mode': 'OTHER_CHANNELS', 'percentage': 5},
            ]}},
        })

    def test_unknown_job_group(self) -> None:
        """Test with an unknown job group."""

        response = self.app.get('/api/job/application-modes/UNKNOWN_JOB_GROUP')
        self.assertEqual(404, response.status_code)

    def test_job_requirements(self) -> None:
        """Test the endpoint using only the job group ID."""

        response = self.app.get('/api/job/application-modes/A1234')
        job_group_info = self.json_from_response(response)
        # Point check.
        all_modes = job_group_info.get('applicationModes', {}).get('FAP1', {}).get('modes', [])
        self.assertEqual([50, 30, 15, 5], [mode.get('percentage') for mode in all_modes])


class ProjectAdviceTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the /advice/tips endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'other-work-env',
            'isReadyForProd': True,
            'triggerScoringModel': 'constant(3)',
            'tipTemplateIds': ['tip1', 'tip2'],
        })
        self._db.tip_templates.insert_many([
            {
                '_id': 'tip1',
                'actionTemplateId': 'tip1',
                'title': 'First tip',
                'title_feminine': 'First tip for women',
            },
            {
                '_id': 'tip2',
                'actionTemplateId': 'tip2',
                'title': 'Second tip',
            },
        ])
        patcher = mailjetmock.patch()
        patcher.start()
        self.addCleanup(patcher.stop)
        server.clear_cache()
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']
        user_info['projects'][0]['advices'][0]['status'] = 'ADVICE_ACCEPTED'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_bad_advice_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/tips/unknown-advice/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Conseil &quot;unknown-advice&quot; inconnu.',
            response.get_data(as_text=True))

    def test_get_tips(self) -> None:
        """Test getting tips."""

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)

    def test_translated_tips(self) -> None:
        """Test getting translated tips."""

        self._db.translations.insert_one({
            'string': 'First tip',
            'fr_FR@tu': 'Premier tip',
        })
        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['canTutoie'] = True
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['Premier tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)

    def test_feminine_tips(self) -> None:
        """Test getting genderized tips."""

        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['gender'] = 'FEMININE'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip for women', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)
        self.assertFalse(any([t.get('titleFeminine') for t in advice_tips.get('tips', [])]))


class CacheClearEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the cache/clear endpoint."""

    def _get_requirements(self, job_group_id: str) -> typing.List[str]:
        response = self.app.get(f'/api/job/requirements/{job_group_id}')
        requirements = json.loads(response.get_data(as_text=True))
        return [d['name'] for d in requirements['diplomas']]

    def _update_job_group_db(self, data: typing.List[typing.Dict[str, typing.Any]]) -> None:
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_many(data)

    def test_mongo_db_updated(self) -> None:
        """Test access to project/requirements after a MongoDB update."""

        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'diplomas': [
                {'name': '1234'},
                {'name': '1235'},
            ]},
        }])
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Update DB with new data.
        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'diplomas': [{'name': '6789'}]},
        }])

        # DB content is cached, no change.
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Clear cache using the endpoint.
        response = self.app.get('/api/cache/clear')
        self.assertEqual(200, response.status_code)
        self.assertEqual('Server cache cleared.', response.get_data(as_text=True))

        # Updated DB content is now served.
        self.assertEqual(['6789'], self._get_requirements('A1234'))


@mailjetmock.patch()
class MigrateAdvisorEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user/migrate-to-advisor endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'isReadyForProd': True,
                'triggerScoringModel': 'constant(3)',
            },
        ])
        server.clear_cache()

    def test_migrate_user(self) -> None:
        """Test a simple user migration."""

        user_id, auth_token = self.create_user_with_token([base_test.add_project], advisor=False)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))

    def test_migrate_user_already_in_advisor(self) -> None:
        """Test a user migration for a user already in advisor."""

        user_id, auth_token = self.create_user_with_token(advisor=True)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))

    def test_migrate_user_multiple_projects(self) -> None:
        """Test a migration for a user with multiple projects."""

        user_id, auth_token = self.create_user_with_token(
            [base_test.add_project, base_test.add_project], advisor=True)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))


class JobsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the jobs endpoint."""

    def test_unknown_job_group(self) -> None:
        """Get jobs for unknown job group."""

        response = self.app.get('/api/jobs/Z1234')
        self.assertEqual(404, response.status_code)

    def test_job_group(self) -> None:
        """Get all jobs info for a job group."""

        self._db.job_group_info.insert_one({
            '_id': 'C1234',
            'romeId': 'C1234',
            'name': 'unusedName',
            'jobs': [
                {'name': 'Pilote', 'codeOgr': '1234'},
                {'name': 'Pompier', 'codeOgr': '5678'},
            ],
            'requirements': {
                'skillsShortText': 'unused short text',
                'specificJobs': [
                    {'percentSuggested': 12, 'codeOgr': '1234'},
                ],
            },
        })
        response = self.app.get('/api/jobs/C1234')
        job_group = self.json_from_response(response)
        self.assertEqual({
            'jobs': [
                {'name': 'Pilote', 'codeOgr': '1234'},
                {'name': 'Pompier', 'codeOgr': '5678'},
            ],
            'requirements': {
                'specificJobs': [
                    {'percentSuggested': 12, 'codeOgr': '1234'},
                ],
            },
        }, job_group)


class EmploymentStatusTestCase(base_test.ServerTestCase):
    """Unit tests for employment-status endpoints."""

    def test_employment_status(self) -> None:
        """Test expected use case of employment-survey endpoints."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '1',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        assert response.location
        redirect_args = dict(parse.parse_qsl(parse.urlparse(response.location).query))
        self.assertIn('id', redirect_args)
        self.assertEqual(survey_token, redirect_args['token'])
        self.assertEqual(user_id, redirect_args['user'])
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STILL_SEEKING')

        survey_response = {
            'situation': 'lalala',
            'bobHasHelped': 'bidulechose'
        }
        response2 = self.app.post(
            f'/api/employment-status/{user_id}',
            data=json.dumps(survey_response),
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response2.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertTrue(len(user['employmentStatus']) == 1)
        status = user['employmentStatus'][0]
        for key, value in survey_response.items():
            self.assertEqual(status[key], value)
        # check other fields have not been lost.
        self.assertEqual(user['profile']['email'], 'foo@bar.com')

    def test_employment_status_stop_seeking(self) -> None:
        """Test expected use case of employment-survey when user click on stop seeking."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '2',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STOP_SEEKING')

    def test_employment_status_seeking_string(self) -> None:
        """Test passing seeking parameter as string."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STOP_SEEKING')

    def test_employment_status_seeking_wrong_string(self) -> None:
        """Test passing seeking parameter as string."""

        user_id = self.create_user(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'ERRONEOUS',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(422, response.status_code)

    def test_missing_parameters(self) -> None:
        """EmploymentSurvey endpoint expect user and token parameters"""

        user_id = self.create_user(email='foo@bar.com')
        auth_token = auth.create_token(user_id, role='employment-survey')
        response = self.app.get('/api/employment-status', query_string={
            'token': auth_token,
            'seeking': '1',
        })
        self.assertEqual(422, response.status_code)
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'seeking': '1',
        })
        self.assertEqual(422, response.status_code)

    def test_employment_status_invalid_token(self) -> None:
        """EmploymentSurvey endpoint should fail if called with an invalid token."""

        user_id = self.create_user(email='foo@bar.com')
        auth_token = auth.create_token(user_id, role='invalid-role')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': auth_token,
            'seeking': '1',
        })
        self.assertEqual(403, response.status_code)

    def test_update_employment_status(self) -> None:
        """Update the employment status through the POST endpoint."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(['STILL_SEEKING'], [s.get('seeking') for s in user['employmentStatus']])

    def test_update_existing_employment_status(self) -> None:
        """Update an existing employment status through the POST endpoint."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])

    @mock.patch(server.now.__name__ + '.get')
    def test_update_create_new_employment_status(self, mock_now: mock.MagicMock) -> None:
        """Create a new employment status when update is a day later."""

        mock_now.return_value = datetime.datetime.now()
        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        # Waiting 36 hours before updating the status: we then create a new one.
        mock_now.return_value = datetime.datetime.now() + datetime.timedelta(hours=36)
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STOP_SEEKING', 'STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])

    def test_convert_user_proto(self) -> None:
        """Converts a proto of a user with advice selection from JSON to compressed format."""

        response = self.app.post(
            '/api/user/proto',
            data='{"user":{"profile":{"familySituation": "SINGLE_PARENT_SITUATION","frustrations":['
            '"NO_OFFERS", "SELF_CONFIDENCE", "TIME_MANAGEMENT"],"gender":"FEMININE",'
            '"hasCarDrivingLicense": true,"highestDegree": "NO_DEGREE","lastName": "Dupont",'
            '"name": "Angèle","yearOfBirth": 1999}},"adviceIds":["a","b","c"]}',
            headers={'Accept': 'application/x-protobuf-base64'},
            content_type='application/json')

        proto_token = response.get_data(as_text=True)
        self.assertLessEqual(len(proto_token), 80, msg=proto_token)

        response_json = self.app.post(
            '/api/user/proto',
            data=proto_token,
            content_type='application/x-protobuf-base64')
        user_with_advice = self.json_from_response(response_json)

        self.assertEqual(['a', 'b', 'c'], user_with_advice.get('adviceIds'))
        self.assertEqual('Angèle', user_with_advice.get('user', {}).get('profile', {}).get('name'))


class LaborStatsTestCase(base_test.ServerTestCase):
    """Unit tests for compute-labor-stats endpoint."""

    def test_compute_use_case_labor_stats(self) -> None:
        """Test expected use case of compute-labor-stats endpoint."""

        self._db.job_group_info.insert_one({
            '_id': 'A1235',
            'romeId': 'A1235',
            'name': 'The job',
            'jobs': [{
                'codeOgr': 'the-job',
                'name': 'This is the job we are looking for',
                'feminineName': 'Feminine',
                'masculineName': 'Masculine',
            }],
        })

        self._db.local_diagnosis.insert_one({
            '_id': '56:A1235',
            'imt': {
                'yearlyAvgOffersPer10Candidates': 5,
            },
        })

        response = self.app.post(
            '/api/compute-labor-stats',
            data='{"projects": [{\
                "city": {"departementId": "56"},\
                "targetJob": {"jobGroup": {"romeId": "A1235"}}}\
            ]}',
            headers={'Authorization': 'Bearer blabla'})
        labor_stats = self.json_from_response(response)
        imt = labor_stats.get('localStats', {}).get('imt', {})

        self.assertEqual('The job', labor_stats.get('jobGroupInfo', {}).get('name'))
        self.assertEqual(5, imt.get('yearlyAvgOffersPer10Candidates'))


if __name__ == '__main__':
    unittest.main()
