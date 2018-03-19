"""Tests for the server module."""

import datetime
import json
import re
import unittest
from urllib import parse

from bson import objectid
import mock
import mongomock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test


def _add_chantier(project_index, new_chantier):
    def _modifier(user):
        if 'activatedChantiers' not in user['projects'][project_index]:
            user['projects'][project_index]['activatedChantiers'] = {}
        user['projects'][project_index]['activatedChantiers'][new_chantier] = True
    return _modifier


class OtherEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the other small endpoints."""

    def test_health_check(self):
        """Basic call to "/"."""

        response = self.app.get('/')
        self.assertEqual(200, response.status_code)

    def _create_user_joe_the_cheminot(self):
        """Joe is a special user used to analyse feedback."""

        user_data = {
            'profile': {'name': 'Joe'},
            'projects': [
                {'projectId': 'another-id', 'title': "Cultivateur d'escargots à Lyon"},
                {'projectId': 'pid', 'title': 'Cheminot à Caen', 'seniority': 1},
                {'projectId': 'last-id', 'title': 'Polénisateur à Brest', 'seniority': 2}],
        }
        return self.create_user_with_token(data=user_data, email='foo@bar.fr')

    def test_feedback(self):
        """Basic call to "/api/feedback"."""

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{{"userId": "{}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}}'
            .format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            ['Aaaaaaaaaaaaawesome!\nsecond line'],
            [d.get('feedback') for d in self._db.feedbacks.find()])

    def test_feedback_no_user(self):
        """Testing /api/feedback with missing user ID."""

        self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(200, response.status_code)

    def test_feedback_wrong_user(self):
        """Testing /api/feedback with wrong user ID, this should fail."""

        auth_token = self._create_user_joe_the_cheminot()[1]

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "baduserid", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_feedback_missing_project(self):
        """Testing /api/feedback with missing project ID but correct user ID."""

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{{"userId": "{}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "", "source": "ADVICE_FEEDBACK"}}'
            .format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    @mock.patch(now.__name__ + '.get')
    def test_usage_stats(self, mock_now):
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
                'dailyScoresCount': {'2': 1, '5': 1},
                'totalUserCount': 8,
                'weeklyNewUserCount': 3,
            },
            self.json_from_response(response))

    def test_redirect_eterritoire(self):
        """Check the /api/redirect/eterritoire endpoint."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69123')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr/lyon/69123', response.location)

    def test_redirect_eterritoire_missing(self):
        """Check the /api/redirect/eterritoire endpoint for missing city."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69006')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr', response.location)

    def test_compute_advices_for_missing_project(self):
        """Check the /api/project/compute-advices endpoint without projects."""

        response = self.app.post(
            '/api/project/compute-advices', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_compute_advices_for_project(self):
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

    def test_generate_tokens(self):
        """Check the /api/user/.../generate-auth-tokens."""

        user_id, auth_token = self.create_user_with_token(email='pascal@example.com')
        response = self.app.get(
            '/api/user/{}/generate-auth-tokens'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        tokens = self.json_from_response(response)
        self.assertEqual(
            {'auth', 'employment-status', 'nps', 'unsubscribe', 'user'}, tokens.keys())
        auth.check_token('pascal@example.com', tokens['unsubscribe'], role='unsubscribe')
        auth.check_token(user_id, tokens['employment-status'], role='employment-status')
        auth.check_token(user_id, tokens['nps'], role='nps')
        auth.check_token(user_id, tokens['auth'], role='')
        self.assertEqual(user_id, tokens['user'])

    def test_generate_tokens_missing_auth(self):
        """Check that the /api/user/.../generate-auth-tokens is protected."""

        user_id, unused_auth_token = self.create_user_with_token(email='pascal@example.com')
        response = self.app.get('/api/user/{}/generate-auth-tokens'.format(user_id))
        self.assertEqual(401, response.status_code)

    def test_diagnose_missing_project(self):
        """Check the /api/project/diagnose endpoint without projects."""

        self._db.diagnostic_sentences.insert_one({
            'order': 1,
            'sentenceTemplate': 'Yay',
        })
        response = self.app.post(
            '/api/project/diagnose', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_diagnose_for_project(self):
        """Check the /api/project/diagnose endpoint."""

        self._db.diagnostic_sentences.insert_one({
            'order': 1,
            'sentenceTemplate': 'Yay',
        })
        self._db.diagnostic_submetrics_sentences.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(3)',
            'positiveSentenceTemplate': "Vous avez de l'expérience.",
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
            'negativeSentenceTemplate': "Vous manquez d'expérience.",
        })
        response = self.app.post(
            '/api/project/diagnose',
            data='{"projects": [{}]}', content_type='application/json')
        diagnostic = self.json_from_response(response)
        self.assertEqual({'overallScore', 'subDiagnostics', 'text'}, diagnostic.keys())

    def test_categorize_missing_project(self):
        """Check the /api/project/compute-categories endpoint without projects."""

        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'categories': ['three-stars'],
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-categories', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_categorize_project_missing_advice(self):
        """Check the /api/project/compute-categories endpoint with a project without advice."""

        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'categories': ['three-stars'],
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-categories',
            data='{"projects": [{}]}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_categorize_advice_for_project(self):
        """Check the /api/project/compute-categories endpoint."""

        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'categories': ['hidden-market'],
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-categories',
            data='{"projects": [{"advices": [{"adviceId": "one-ring", "numStars": 2}]}]}',
            content_type='application/json')
        advice_category = self.json_from_response(response)
        self.assertEqual(
            {'adviceCategories': [{'categoryId': 'hidden-market', 'adviceIds': ['one-ring']}]},
            advice_category)


class UsersCountsEndpointTestCase(base_test.ServerTestCase):
    """Unit test for the users counts endpoint."""

    def test_users_count(self):
        """The counts of users should be returned."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'departementCount': {
                '31': 365,
            },
            'jobGroupCount': {
                'L1510': 256
            }
        })
        response = self.app.get('api/users/counts')
        user_counts = self.json_from_response(response)
        self.assertIsNotNone(user_counts)
        self.assertEqual(365, user_counts.get('departementCount', {}).get('31'))
        self.assertEqual(256, user_counts.get('jobGroupCount', {}).get('L1510'))

    def test_get_most_recent_user_counts(self):
        """Test that we get most recent counts for all IDs."""

        self._db.user_count.insert_many([
            {
                'aggregatedAt': '2016-11-15T16:51:55Z',
                'departementCount': {
                    '31': 365,
                },
                'jobGroupCount': {
                    'L1510': 256
                }
            },
            {
                'aggregatedAt': '2016-12-15T16:51:55Z',
                'departementCount': {
                    '31': 700,
                },
                'jobGroupCount': {
                    'L1510': 300
                }
            },
        ])
        response = self.app.get('api/users/counts')
        user_counts = self.json_from_response(response)
        self.assertIsNotNone(user_counts)
        self.assertEqual(700, user_counts.get('departementCount', {}).get('31'))
        self.assertEqual(300, user_counts.get('jobGroupCount', {}).get('L1510'))

    def test_no_such_count_for(self):
        """Test that we get nothing if database is empty."""

        response = self.app.get('api/users/counts')
        self.assertEqual(500, response.status_code)


class ProjectRequirementsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the requirements endpoints."""

    def test_no_input(self):
        """Test with no input."""

        response = self.app.post(
            '/api/project/requirements', data='{}',
            content_type='application/json')
        self.assertEqual(200, response.status_code)
        self.assertEqual('{}', response.get_data(as_text=True))

    def test_target_job(self):
        """Test with a target job."""

        response = self.app.post(
            '/api/project/requirements', data='{"targetJob":{"jobGroup":{'
            '"romeId":"A1234"}}}',
            content_type='application/json')
        requirements = self.json_from_response(response)
        self.assertEqual(set(['skills', 'diplomas', 'extras']), set(requirements))
        # Point check.
        self.assertEqual('1235', requirements['skills'][1]['skill']['skillId'])

    def test_job_endpoint(self):
        """Test the endpoint using only the job group ID."""

        response = self.app.get('/api/job/requirements/A1234')
        requirements = self.json_from_response(response)
        self.assertEqual(set(['skills', 'diplomas', 'extras']), set(requirements))
        # Point check.
        self.assertEqual('1235', requirements['skills'][1]['skill']['skillId'])


class ProjectAdviceTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../advice/.../tips endpoint."""

    def setUp(self):  # pylint: disable=invalid-name,missing-docstring
        super(ProjectAdviceTipsTestCase, self).setUp()
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
            },
            {
                '_id': 'tip2',
                'actionTemplateId': 'tip2',
                'title': 'Second tip',
            },
        ])
        server.clear_cache()
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']
        user_info['projects'][0]['advices'][0]['status'] = 'ADVICE_ACCEPTED'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/project/{}/foo/advice/other-work-env/tips'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_bad_advice_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/project/{}/{}/advice/unknown-advice/tips'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Conseil &quot;unknown-advice&quot; inconnu.',
            response.get_data(as_text=True))

    def test_get_tips(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/project/{}/{}/advice/other-work-env/tips'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)


class CacheClearEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the cache/clear endpoint."""

    def _get_requirements(self, job_group_id):
        response = self.app.post(
            '/api/project/requirements', data='{{"targetJob":{{"jobGroup":{{'
            '"romeId":"{}"}}}}}}'.format(job_group_id),
            content_type='application/json')
        requirements = json.loads(response.get_data(as_text=True))
        return [s['skill']['skillId'] for s in requirements['skills']]

    def _update_job_group_db(self, data):
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_many(data)

    def test_mongo_db_updated(self):
        """Test access to project/requirements after a MongoDB update."""

        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'skills': [
                {'skill': {'skillId': '1234'}},
                {'skill': {'skillId': '1235'}},
            ]},
        }])
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Update DB with new data.
        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'skills': [{'skill': {'skillId': '6789'}}]},
        }])

        # DB content is cached, no change.
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Clear cache using the endpoint.
        response = self.app.get('/api/cache/clear')
        self.assertEqual(200, response.status_code)
        self.assertEqual('Server cache cleared.', response.get_data(as_text=True))

        # Updated DB content is now served.
        self.assertEqual(['6789'], self._get_requirements('A1234'))


class CreateDashboardExportTestCase(base_test.ServerTestCase):
    """Unit test for create_dashboard_export endpoint."""

    def setUp(self):  # pylint: disable=invalid-name,missing-docstring
        super(CreateDashboardExportTestCase, self).setUp()
        self._db.chantiers.drop()
        self._db.chantiers.insert_many([
            {
                '_id': 'c1',
                'chantierId': 'c1',
                'title': 'Chantier 1',
            },
            {
                '_id': 'c2',
                'chantierId': 'c2',
                'title': 'Chantier 2',
            }
        ])

    def test_user_id_missing(self):
        """Test misssing ID."""

        response = self.app.post('/api/dashboard-export/open/.')
        self.assertEqual(401, response.status_code)

    def test_create_export(self):
        """Standard usage.

        The time from the objectId is random, so it might sometimes happen that
        it is close to the current time, but with a low probability.
        """

        user_id, auth_token = self.create_user_with_token([
            base_test.add_project,
            base_test.add_project,
            _add_chantier(0, 'c1'),
            _add_chantier(1, 'c2'),
        ])
        before = datetime.datetime.now()
        response = self.app.post(
            '/api/dashboard-export/open/{}'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        after = datetime.datetime.now() + datetime.timedelta(seconds=1)
        self.assertEqual(302, response.status_code)
        self.assertRegex(
            response.location,
            r'^http://localhost/historique-des-actions/[a-f0-9]+$')
        dashboard_export_id = re.sub(r'^.*/', '', response.location)

        dashboard_export = self._db.dashboard_exports.find_one({
            '_id': mongomock.ObjectId(dashboard_export_id)})
        self.assertGreaterEqual(
            dashboard_export['createdAt'], before.isoformat(), msg=dashboard_export)
        self.assertLessEqual(dashboard_export['createdAt'], after.isoformat(), msg=dashboard_export)
        stored_user_info = self.user_info_from_db(user_id)
        self.assertEqual(stored_user_info['projects'], dashboard_export['projects'])
        self.assertEqual(
            set(['Chantier 1', 'Chantier 2']),
            set([c['title'] for c in dashboard_export['chantiers'].values()]))
        export_object_id = objectid.ObjectId(dashboard_export_id)
        id_generation_time = export_object_id.generation_time.replace(tzinfo=None)
        yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
        tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
        self.assertTrue(id_generation_time < yesterday or id_generation_time > tomorrow)

    def test_create_export_missing_chantier(self):
        """Standard usage."""

        user_id, auth_token = self.create_user_with_token([
            base_test.add_project,
            _add_chantier(0, 'unknown-chantier-id'),
            _add_chantier(0, 'c1'),
        ])
        response = self.app.post(
            '/api/dashboard-export/open/{}'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertRegex(
            response.location,
            r'^http://localhost/historique-des-actions/[a-f0-9]+$')
        dashboard_export_id = re.sub(r'^.*/', '', response.location)

        dashboard_export = self._db.dashboard_exports.find_one({
            '_id': mongomock.ObjectId(dashboard_export_id)})
        stored_user_info = self.user_info_from_db(user_id)
        self.assertEqual(stored_user_info['projects'], dashboard_export['projects'])
        self.assertEqual(
            set(['Chantier 1']),
            set([c['title'] for c in dashboard_export['chantiers'].values()]))

    def test_retrieve_export_missing_id(self):
        """Test to get a 404 when ID does not exist."""

        not_existing_id = '580f4f8ac9b89b00072ec1ca'
        response = self.app.get(
            '/api/dashboard-export/{}'.format(not_existing_id), content_type='application/json')
        self.assertEqual(404, response.status_code)

    def test_retrieve_export_bad_id(self):
        """Test to get a 4xx error when ID is not well formatted."""

        not_existing_id = 'abc'
        response = self.app.get(
            '/api/dashboard-export/{}'.format(not_existing_id), content_type='application/json')
        self.assertEqual(400, response.status_code)

    def test_open_export(self):
        """Test basic usage of the endpoint to create and open a dashboard export."""

        user_id, auth_token = self.create_user_with_token([
            base_test.add_project,
            base_test.add_project,
            _add_chantier(0, 'c1'),
            _add_chantier(1, 'c2'),
        ])
        creation_response = self.app.post(
            '/api/dashboard-export/open/{}'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(302, creation_response.status_code)
        self.assertRegex(
            creation_response.location,
            r'^http://localhost/historique-des-actions/[a-f0-9]+$')


class MigrateAdvisorEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user/migrate-to-advisor endpoint."""

    def setUp(self):  # pylint: disable=invalid-name,missing-docstring
        super(MigrateAdvisorEndpointTestCase, self).setUp()
        self._db.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'isReadyForProd': True,
                'triggerScoringModel': 'constant(3)',
            },
        ])
        server.clear_cache()

    def test_migrate_user(self):
        """Test a simple user migration."""

        user_id, auth_token = self.create_user_with_token([base_test.add_project], advisor=False)
        response = self.app.post(
            '/api/user/{}/migrate-to-advisor'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))

    def test_migrate_user_already_in_advisor(self):
        """Test a user migration for a user already in advisor."""

        user_id, auth_token = self.create_user_with_token(advisor=True)
        response = self.app.post(
            '/api/user/{}/migrate-to-advisor'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))

    def test_migrate_user_multiple_projects(self):
        """Test a migration for a user with multiple projects."""

        user_id, auth_token = self.create_user_with_token(
            [base_test.add_project, base_test.add_project], advisor=True)
        response = self.app.post(
            '/api/user/{}/migrate-to-advisor'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))


class JobsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the jobs endpoint."""

    def test_unknown_job_group(self):
        """Get jobs for unknown job group."""

        response = self.app.get('/api/jobs/Z1234')
        self.assertEqual(404, response.status_code)

    def test_job_group(self):
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

    def test_employment_status(self):
        """Test expected use case of employment-survey endpoint."""

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
        redirect_args = dict(parse.parse_qsl(parse.urlparse(response.location).query))
        self.assertIn('id', redirect_args)
        self.assertEqual(survey_token, redirect_args['token'])
        self.assertEqual(user_id, redirect_args['user'])
        self.assertEqual(redirect_args['id'], '0')
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STILL_SEEKING')
        survey_response = {
            'situation': 'lalala',
            'bobHasHelped': 'bidulechose'
        }
        response2 = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'id': redirect_args['id'],
            **survey_response
        })
        self.assertEqual(200, response2.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertTrue(len(user['employmentStatus']) == 1)
        status = user['employmentStatus'][0]
        for key, value in survey_response.items():
            self.assertEqual(status[key], value)
        # check other fields have not been lost.
        self.assertEqual(user['profile']['email'], 'foo@bar.com')

    def test_employment_status_stop_seeking(self):
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

    def test_employment_status_seeking_string(self):
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

    def test_employment_status_seeking_wrong_string(self):
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

    def test_missing_parameters(self):
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

    def test_employment_status_invalid_token(self):
        """EmploymentSurvey endpoint should fail if called with an invalid token."""

        user_id = self.create_user(email='foo@bar.com')
        auth_token = auth.create_token(user_id, role='invalid-role')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': auth_token,
            'seeking': '1',
        })
        self.assertEqual(403, response.status_code)

    def test_employment_status_invalid_id(self):
        """EmploymentSurvey endpoint should not save anything if called with an invalid ID."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '1',
            'redirect': 'http://www.tutut.org'
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        redirect_args = dict(parse.parse_qsl(parse.urlparse(response.location).query))
        self.assertIn('id', redirect_args)
        self.assertEqual(survey_token, redirect_args['token'])
        self.assertEqual(user_id, redirect_args['user'])
        self.assertEqual(redirect_args['id'], '0')
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STILL_SEEKING')
        survey_response = {
            'situation': 'lalala',
            'bobHasHelped': 'bidulechose'
        }
        response2 = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'id': int(redirect_args['id']) + 3,
            **survey_response
        })
        self.assertEqual(422, response2.status_code)
        for key in survey_response:
            self.assertNotIn(key, user['employmentStatus'][0])

    def test_update_employment_status(self):
        """Update the employment status through the POST endpoint."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = auth.create_token(user_id, role='employment-status')
        response = self.app.post(
            '/api/employment-status/{}'.format(user_id),
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(['STILL_SEEKING'], [s.get('seeking') for s in user['employmentStatus']])

    def test_update_existing_employment_status(self):
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
            '/api/employment-status/{}'.format(user_id),
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])

    @mock.patch(server.now.__name__ + '.get')
    def test_update_create_new_employment_status(self, mock_now):
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
            '/api/employment-status/{}'.format(user_id),
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STOP_SEEKING', 'STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
