"""Unit tests for the user endpoints."""

import datetime
import hashlib
import json
import time
import unittest

from bson import objectid
import mock
import mongomock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test

_TIME = time.time


def _clean_up_variable_flags(features_enabled):
    del_features = []
    for feature in features_enabled:
        for prefix in (
                'actionFeedbackModal', 'advisor', 'hideDiscoveryNav',
                'lbbIntegration', 'stickyActions', 'alpha',
                'poleEmploi', 'assessment', 'excludeFromAnalytics'):
            if feature.startswith(prefix):
                del_features.append(feature)
    for feature in del_features:
        del features_enabled[feature]


class UserEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user endpoint to save the profile."""

    def test_use_unguessable_object_id(self):
        """Test that we don't use the standard MongoDB ObjectID.

        The time from the objectId is random, so it might sometimes happen that
        it is close to the current time, but with a low probability.
        """

        user_id = self.create_user()
        id_generation_time = objectid.ObjectId(user_id).generation_time.replace(tzinfo=None)
        yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
        tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
        self.assertTrue(id_generation_time < yesterday or id_generation_time > tomorrow)

    @mock.patch(now.__name__ + '.get')
    def test_app_use_endpoint(self, mock_now):
        """Test the app/use endpoint."""

        mock_now.side_effect = datetime.datetime.now
        before = datetime.datetime.now()
        user_id, auth_token = self.create_user_with_token()

        mock_now.side_effect = None
        later = before + datetime.timedelta(hours=25)
        mock_now.return_value = later

        response = self.app.post(
            '/api/app/use/{}'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)

        self.assertGreaterEqual(user_info['requestedByUserAtDate'], before.isoformat())
        self.assertEqual(user_info['requestedByUserAtDate'][:16], later.isoformat()[:16])

    def test_delete_user(self):
        """Test deleting a user and all their data."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'year_of_birth': 1973},
            'projects': [{}],
            'emailsSent': [{'mailjetMessageId': 1234}],
        }
        user_id, auth_token = self.create_user_with_token(data=user_info, email='foo@bar.fr')
        tokens = self.json_from_response(self.app.get(
            '/api/user/{}/generate-auth-tokens'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token}))
        unsubscribe_token = tokens['unsubscribe']
        response = self.app.delete(
            '/api/user',
            data='{{"userId": "{}"}}'.format(user_id),
            headers={'Authorization': 'Bearer ' + unsubscribe_token})
        self.assertEqual(200, response.status_code)
        auth_object = self._user_db.user_auth.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(auth_object)
        user_data = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertEqual('REDACTED', user_data['profile']['email'])
        self.assertEqual('REDACTED', user_data['profile']['name'])
        self.assertEqual(1973, user_data['profile']['yearOfBirth'])
        self.assertIn('deletedAt', user_data)
        self.assertEqual([{}], user_data.get('emailsSent'))
        # Pop _id field which is not JSON serializable
        user_data.pop('_id')
        self.assertNotIn('foo@bar.fr', json.dumps(user_data))

    def test_delete_user_missing_token(self):
        """Test trying user deletion without token."""

        response = self.app.delete('/api/user', data='{"profile": {"email": "foo@bar.fr"}}')
        self.assertEqual(403, response.status_code)

    def test_delete_user_token(self):
        """Delete a user without its ID but with an auth token."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'year_of_birth': 1973},
            'projects': [{}]}
        user_id = self.create_user(data=user_info, email='foo@bar.fr')
        token = server.auth.create_token('foo@bar.fr', role='unsubscribe')
        response = self.app.delete(
            '/api/user',
            data='{"profile": {"email": "foo@bar.fr"}}',
            headers={'Authorization': 'Bearer {}'.format(token)})
        self.assertEqual(200, response.status_code)
        auth_object = self._user_db.user_auth.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(auth_object)
        user_data = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertEqual('REDACTED', user_data['profile']['email'])
        self.assertEqual('REDACTED', user_data['profile']['name'])
        self.assertEqual(1973, user_data['profile']['yearOfBirth'])
        self.assertIn('deletedAt', user_data)
        # Pop _id field which is not JSON serializable
        user_data.pop('_id')
        self.assertNotIn('foo@bar.fr', json.dumps(user_data))

    @mock.patch(server.auth.__name__ + '._ADMIN_AUTH_TOKEN', new='custom-auth-token')
    def test_delete_user_with_admin_auth_token(self):
        """Delete a user with an admin auth token."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'year_of_birth': 1973},
            'projects': [{}]}
        user_id = self.create_user(data=user_info, email='foo@bar.fr')
        response = self.app.delete(
            '/api/user',
            data='{"profile": {"email": "foo@bar.fr"}}',
            headers={'Authorization': 'Bearer custom-auth-token'})
        self.assertEqual(200, response.status_code)
        user_data = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertEqual('REDACTED', user_data['profile']['email'])

    def test_get_user(self):
        """Basic Usage of retrieving a user from DB."""

        user_info = {'profile': {'gender': 'FEMININE'}, 'projects': [{
            'jobSearchLengthMonths': 6,
        }]}
        user_id, auth_token = self.create_user_with_token(data=user_info)
        user_info['userId'] = user_id

        user_info2 = self.get_user_info(user_info['userId'], auth_token)
        self.assertIn('registeredAt', user_info2)
        user_info2.pop('registeredAt')
        self.assertIn('projects', user_info2)
        projects = user_info2.pop('projects')
        user_info.pop('projects')
        user_info2.pop('featuresEnabled')
        user_info2.pop('revision')
        user_info2.pop('hashedEmail')
        self.assertEqual(user_info, user_info2)

        self.assertEqual(1, len(projects), projects)
        self.assertFalse(projects[0].get('jobSearchHasNotStarted'))
        job_search_started_at = datetime.datetime.strptime(
            projects[0].get('jobSearchStartedAt'), '%Y-%m-%dT%H:%M:%SZ')
        self.assertLess(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=180))
        self.assertGreater(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=200))

    def test_get_user_unauthorized(self):
        """When calling get user with unauthorized_token, endpoint should return error."""

        user_info = {'profile': {'gender': 'FEMININE'}, 'projects': [{
            'jobSearchLengthMonths': 6,
        }]}
        user_id, auth_token = self.create_user_with_token(data=user_info)
        unauthorized_token = 'Bearer 1509481.11027aabc4833f0177a06a7948ec78f220a00c78'
        response = self.app.get(
            '/api/user/' + user_id,
            headers={'Authorization': 'Bearer ' + unauthorized_token})
        self.assertEqual(403, response.status_code)
        user_info = {'profile': {'city': {'name': 'foobar'}}, 'projects': [{}]}
        user_id2 = self.create_user(data=user_info, email='foo@bar.fr')
        response2 = self.app.get(
            '/api/user/' + user_id2,
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)

    def test_user(self):
        """Basic usage."""

        time_before = datetime.datetime.now() - datetime.timedelta(seconds=1)
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", '
            '"profile": {{"city": {{"name": "fobar"}}, "email": "foo@bar.fr"}}, '
            '"projects": [{{"title": "Yay title"}}]}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)

        # Pop or delete variable fields.
        registered_at = user_info.pop('registeredAt')
        projects = user_info.pop('projects')
        _clean_up_variable_flags(user_info['featuresEnabled'])

        # sha1('bob-emploifoo@bar.fr') = 'bb96b62f3ded5182d555e2452cc4125a1ea4201d'
        self.assertEqual(
            {
                'featuresEnabled': {},
                'hashedEmail': 'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
                'profile': {
                    'city': {'name': 'fobar'},
                    'email': 'foo@bar.fr',
                },
                'revision': 1,
                'userId': user_id,
            },
            user_info)

        # Check registered_at field.
        registration_date = datetime.datetime.strptime(registered_at, '%Y-%m-%dT%H:%M:%SZ')
        self.assertLessEqual(time_before, registration_date)
        self.assertLessEqual(registration_date, datetime.datetime.now())

        # Check user_id field.
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])
        self.assertFalse(
            [u['_id'] for u in self._user_db.user.find({'userId': {'$exists': True}})],
            msg="User ID should not be stored in DB, it's already the key")

        # Check projects field.
        self.assertEqual(1, len(projects))
        self.assertEqual('Yay title', projects[0]['title'])
        self.assertNotIn('actions', projects[0])

        stored_user_info = self.user_info_from_db(user_id)
        self.assertEqual(registered_at, stored_user_info.pop('registeredAt'))
        self.assertEqual(projects, stored_user_info.pop('projects'))
        _clean_up_variable_flags(stored_user_info['featuresEnabled'])
        # sha1('bob-emploifoo@bar.fr') = 'bb96b62f3ded5182d555e2452cc4125a1ea4201d'
        self.assertEqual(
            {
                'featuresEnabled': {},
                'hashedEmail': 'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
                'profile': {
                    'city': {'name': 'fobar'},
                    'email': 'foo@bar.fr',
                },
                'revision': 1,
            },
            stored_user_info)

        # Check the app is available for user.
        self.assertFalse(user_info.get('appNotAvailable'))

    @mock.patch(server.__name__ + '.advisor.maybe_advise')
    @mock.patch(server.__name__ + '.time.time')
    @mock.patch(server.__name__ + '.logging.warning')
    def test_log_long_requests(self, mock_warning, mock_time, mock_advise):
        """Log timing for long requests."""

        # Variable as a list to be used in closures below.
        time_delay = [0]

        def _delayed_time(*unused_args, **unused_kwargs):
            return _TIME() + time_delay[0]
        mock_time.side_effect = _delayed_time

        def _wait_for_it(*unused_args, **unused_kwargs):
            time_delay[0] += 6
        mock_advise.side_effect = _wait_for_it

        self.create_user([base_test.add_project], advisor=False)
        self.assertGreaterEqual(mock_warning.call_count, 10)
        first_warning_args = mock_warning.call_args_list[0][0]
        self.assertEqual('Long request: %d seconds', first_warning_args[0])
        self.assertGreaterEqual(first_warning_args[1], 2)
        self.assertEqual(
            {'%.4f: Tick %s (%.4f since last tick)'},
            set(c[0][0] for c in mock_warning.call_args_list[1:]))

    def test_save_user_keeps_points(self):
        """Clients cannot modify Bob Points just by saving a user."""

        initial_user_info = {'profile': {'gender': 'FEMININE'}}
        user_id, auth_token = self.create_user_with_token(
            email='joe@lafrite.com', data=initial_user_info)

        # Modify current points without the API.
        self._user_db.user.update_one(
            {'_id': mongomock.ObjectId(user_id)},
            {'$set': {'appPoints': {'current': 150}}})

        # Try to modify the current points and the gender.
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", '
            '"profile": {{"gender": "MASCULINE", "email": "joe@lafrite.com"}},'
            '"appPoints": {{"current": 1500}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)

        self.assertEqual(
            'MASCULINE', user_info.get('profile', {}).get('gender'),
            msg='Gender was updated')
        self.assertEqual(
            150, user_info.get('appPoints', {}).get('current'),
            msg='App points were not updated')

    # TODO(pascal): Add tests for user ID mod when we have new features
    # enabled that way. See code at 6cfd9e0.

    def test_update_project(self):
        """User project is updated."""

        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        # Populate user.
        self.app.post(
            '/api/user',
            data=json.dumps({
                'userId': user_id,
                'profile': {'email': 'foo@bar.fr'},
                'projects': [{
                    'isIncomplete': True,
                    'projectId': '0',
                    'title': 'Awesome Title',
                }],
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        response = self.app.post(
            '/api/user/{}/project/0'.format(user_id),
            data=json.dumps({
                'projectId': '0',
                'totalInterviewCount': 5,
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        project_info = self.json_from_response(response)
        self.assertTrue(project_info.get('projectId'))
        self.assertFalse(project_info.get('isIncomplete'))
        self.assertEqual(5, project_info.get('totalInterviewCount'))

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual(1, len(user_info.get('projects', [])))
        self.assertEqual(project_info, user_info['projects'].pop())

    def test_project_diagnosis_added(self):
        """Local diagnosis should be added to a new project."""

        project = {
            'mobility': {
                'city': {'departementId': '38'},
            },
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"email":"foo@bar.fr"}}, '
            '"projects": [{}]}}'.format(user_id, json.dumps(project)),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        projects = user_info.pop('projects')
        self.assertEqual(1, len(projects))
        project = projects.pop()

    def test_project_in_advisor(self):
        """New project should get advised and diagnosed."""

        project = {
            'mobility': {
                'city': {'departementId': '38'},
            },
            'localStats': {
                'lessStressfulJobGroups': [{}],
            },
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bayes.org')
        self._db.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'isReadyForProd': True,
                'triggerScoringModel': 'constant(3)',
            },
            {
                'adviceId': 'network-application',
                'isReadyForProd': True,
                'triggerScoringModel': 'constant(2)',
            },
        ])
        self._db.diagnostic_sentences.insert_one({
            'order': 1,
            'sentenceTemplate': 'You are a star.',
        })
        self._db.diagnostic_submetrics_sentences.insert_many([
            {
                'triggerScoringModel': 'constant(3)',
                'positiveSentenceTemplate': "Vous avez de l'expérience.",
                'submetric': submetric,
                'weight': 1,
                'negativeSentenceTemplate': "Vous manquez d'expérience.",
            }
            for submetric in {'PROFILE_DIAGNOSTIC', 'PROJECT_DIAGNOSTIC', 'JOB_SEARCH_DIAGNOSTIC'}
        ])
        server.clear_cache()
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"email":"foo@bayes.org"}}, '
            '"featuresEnabled": {{"advisor": "ACTIVE"}}, '
            '"projects": [{}]}}'.format(user_id, json.dumps(project)),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        project = user_info['projects'][0]
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))

        self.assertEqual(
            {'overallScore', 'subDiagnostics', 'text'},
            project.get('diagnostic', {}).keys())

        all_advices = [
            {
                'adviceId': 'spontaneous-application',
                'numStars': 3,
                'status': 'ADVICE_RECOMMENDED',
            },
            {
                'adviceId': 'network-application',
                'numStars': 2,
                'status': 'ADVICE_RECOMMENDED',
            },
        ]
        self.assertEqual(all_advices, project.get('advices'))

    def test_post_user_with_no_id(self):
        """Called with no ID the endpoint should return an error."""

        user_id, auth_token = self.create_user_with_token()

        response2 = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"name": "very different"}}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_with_unknown_id(self):
        """Called with an unknown user ID the endpoint should return an error."""

        user_id, auth_token = self.create_user_with_token()
        # Change the last digit.
        fake_user_id = user_id[:-1] + ('1' if user_id[-1:] != '1' else '0')

        response2 = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"city": {{"name": "very different"}}}}}}'
            .format(fake_user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_with_invalid_token(self):
        """Called with an invalid auth token the endpoint should return an error."""

        user_id = self.create_user()
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"city": {{"name": "very different"}}}}}}'
            .format(user_id),
            headers={'Authorization': 'Bearer 513134513451345', 'Content-Type': 'application/json'})
        self.assertEqual(403, response.status_code)

    def test_post_user_with_unauthorized_token(self):
        """Called with an invalid auth token the endpoint should return an error."""

        user_id = self.create_user()
        unauthorized_token = 'Bearer 1509481.11027aabc4833f0177a06a7948ec78f220a00c78'
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"city": {{"name": "very different"}}}}}}'
            .format(user_id),
            headers={'Authorization': unauthorized_token, 'Content-Type': 'application/json'})
        self.assertEqual(403, response.status_code)

    def test_post_user_changing_email(self):
        """It should not be possible to change the email as it is used for auth."""

        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"email": "very-different@bar.fr"}}}}'
            .format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_project_with_no_status(self):
        """Called with a project with an ID but no status."""

        project = {
            'projectId': 'abc',
            'mobility': {
                'city': {'departementId': '38'},
            },
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "profile": {{"email":"foo@bar.fr"}}, '
            '"projects": [{}]}}'.format(user_id, json.dumps(project)),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        # This is mostly a regression test: we used to trigger a 500 with this
        # scenario.
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

    def test_update(self):
        """Called with a user that has an ID should update it."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data='{{"profile": {{"name": "very different", '
            '"email": "foo@bar.fr"}}, "revision": 2, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info2 = self.json_from_response(response2)
        user_id2 = user_info2.pop('userId')
        user_info2.pop('registeredAt')
        self.assertEqual('very different', user_info2['profile']['name'])
        self.assertEqual(user_id, user_id2)
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])
        user_in_db = self.user_info_from_db(user_id)
        self.assertEqual('very different', user_in_db['profile']['name'])

    def test_update_revision(self):
        """Updating a user to an old revision does not work and return the new version."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        self.app.post(
            '/api/user',
            data='{{"profile": {{"name": "new name", '
            '"email": "foo@bar.fr"}}, "revision": 15, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        response = self.app.post(
            '/api/user',
            data='{{"profile": {{"name": "old name", '
            '"email": "foo@bar.fr"}}, "revision": 10, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        user_info = self.json_from_response(response)
        self.assertEqual('new name', user_info['profile'].get('name'))
        self.assertEqual(16, user_info['revision'])

    def test_create_project(self):
        """An ID and the timestamp should be added to a new project."""

        user_id, auth_token = self.create_user_with_token(data={}, email='foo@bar.fr')
        self._db.local_diagnosis.insert_one({
            '_id': '69:A1234',
            'bmo': {
                'percentDifficult': 5,
                'percentSeasonal': 10,
            },
            'salary': {
                'shortText': '17 400 - 17 400',
                'medianSalary': 17400.0,
                'unit': 'ANNUAL_GROSS_SALARY',
                'maxSalary': 17400.0,
                'minSalary': 17400.0
            },
            'unemploymentDuration': {'days': 84},
        })

        response = self.app.post(
            '/api/user', data='{{"projects": [{{"targetJob": {{"jobGroup": '
            '{{"romeId": "A1234"}}}}, "mobility":{{"city":{{"departementId": "69"}}}}}}],'
            '"profile":{{"email":"foo@bar.fr"}},"userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info2 = self.json_from_response(response)
        self.assertEqual(1, len(user_info2['projects']))
        project = user_info2['projects'].pop()
        self.assertEqual('0', project.get('projectId'))
        self.assertIn('createdAt', project)
        self.assertEqual(
            84,
            project.get('localStats', {})
            .get('unemploymentDuration', {})
            .get('days'))
        self.assertFalse(project.get('coverImageUrl'))

    def test_create_project_no_data(self):
        """A project with no backend data still gets some basic values."""

        user_id, auth_token = self.create_user_with_token(data={}, email='foo@bar.fr')

        response = self.app.post(
            '/api/user', data='{{"projects": [{{"targetJob": {{"jobGroup": '
            '{{"romeId": "no-data"}}}}}}], "profile":{{"email":"foo@bar.fr"}},"userId": "{}"}}'
            .format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info2 = self.json_from_response(response)
        self.assertEqual(1, len(user_info2['projects']))
        project = user_info2['projects'].pop()
        self.assertIn('projectId', project)
        self.assertIn('createdAt', project)

    def test_unverified_data_zone_on_profile(self):
        """Called with a user in an unverified data zone."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"profile": {{"city": {{"postcodes": "12345"}}, '
            '"latestJob": {{"jobGroup": {{"romeId": "A1234"}}}}, '
            '"email": "foo@bar.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertTrue(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertTrue(user_in_db.get('appNotAvailable'))

    def test_unverified_data_zone_regexp(self):
        """Called with a user in an unverified data zone but in the allowed regex."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id, auth_token = self.create_user_with_token(email='foo@pole-emploi.fr')

        response = self.app.post(
            '/api/user',
            data='{{"profile": {{"city": {{"postcodes": "12345"}}, '
            '"latestJob": {{"jobGroup": {{"romeId": "A1234"}}}}, '
            '"email": "foo@pole-emploi.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertFalse(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertFalse(user_in_db.get('appNotAvailable'))

    def test_unverified_data_zone_whitelist(self):
        """Called with a user in an unverified data zone but in the whitelist."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        self._user_db.show_unverified_data_users.insert_one({'_id': 'foo@bar.fr'})
        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"profile": {{"city": {{"postcodes": "12345"}}, '
            '"latestJob": {{"jobGroup": {{"romeId": "A1234"}}}}, '
            '"email": "foo@bar.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertFalse(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertFalse(user_in_db.get('appNotAvailable'))

    def test_unverified_data_zone_on_project(self):
        """Called with a user with no latest job and a project in an unverified data zone."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"projects": [{{"targetJob": {{"jobGroup": {{"romeId": "A1234"}}}},'
            '"mobility": {{"city": {{"postcodes": "12345"}}}}}}],'
            '"profile": {{"email": "foo@bar.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertTrue(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertTrue(user_in_db.get('appNotAvailable'))

    def test_unverified_data_zone_on_profile_not_project(self):
        """Called with a user with profile in unverified data zone but not project."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"projects": [{{"targetJob": {{"jobGroup": {{"romeId": "A6789"}}}},'
            '"mobility": {{"city": {{"postcodes": "67890"}}}}}}],'
            '"profile": {{"city": {{"postcodes": "12345"}}, '
            '"latestJob": {{"jobGroup": {{"romeId": "A1234"}}}}, '
            '"email": "foo@bar.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertTrue(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertTrue(user_in_db.get('appNotAvailable'))

    def test_unverified_data_zone_on_project_not_profile(self):
        """Called with a user with project in unverified data zone but not profile."""

        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{{"projects": [{{"targetJob": {{"jobGroup": {{"romeId": "A1234"}}}},'
            '"mobility": {{"city": {{"postcodes": "12345"}}}}}}],'
            '"profile": {{"city": {{"postcodes": "67890"}}, '
            '"latestJob": {{"jobGroup": {{"romeId": "A6789"}}}}, '
            '"email": "foo@bar.fr"}}, "userId": "{}"}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertFalse(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertFalse(user_in_db.get('appNotAvailable'))

    def test_update_settings(self):
        """Update user settings."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'yearOfBirth': 1973},
            'projects': [{}],
        }
        user_id, auth_token = self.create_user_with_token(data=user_info)
        tokens = self.json_from_response(self.app.get(
            '/api/user/{}/generate-auth-tokens'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token}))
        settings_token = tokens['settings']

        response = self.app.post(
            '/api/user/{}/settings'.format(user_id),
            data='{"coachingEmailFrequency": "EMAIL_ONCE_A_MONTH"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + settings_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'), msg=updated_user)
        self.assertEqual(
            'EMAIL_ONCE_A_MONTH', updated_user['profile'].get('coachingEmailFrequency'))

    def test_update_email_settings_invalidate(self):
        """Updating user settings for email frequency invalidates the next email date."""

        user_info = {
            'profile': {'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH'},
        }
        user_id, auth_token = self.create_user_with_token(data=user_info)
        tokens = self.json_from_response(self.app.get(
            '/api/user/{}/generate-auth-tokens'.format(user_id),
            headers={'Authorization': 'Bearer ' + auth_token}))
        settings_token = tokens['settings']

        # Fake sending a coaching email and updating the user.
        self._user_db.user.update_one({'_id': objectid.ObjectId(user_id)}, {'$set': {
            'sendCoachingEmailAfter': '2018-01-15T15:24:34Z',
        }})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertTrue(updated_user.get('sendCoachingEmailAfter'))

        self.app.post(
            '/api/user/{}/settings'.format(user_id),
            data='{"coachingEmailFrequency": "EMAIL_MAXIMUM"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + settings_token})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertFalse(updated_user.get('sendCoachingEmailAfter'))

    def test_update_email_frequency_invalidate(self):
        """Updating user's profile and changing email frequency invalidates the next email date."""

        user_info = {
            'profile': {'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH'},
        }
        user_id, auth_token = self.create_user_with_token(data=user_info)

        # Fake sending a coaching email and updating the user.
        self._user_db.user.update_one({'_id': objectid.ObjectId(user_id)}, {'$set': {
            'sendCoachingEmailAfter': '2018-01-15T15:24:34Z',
        }})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertTrue(updated_user.get('sendCoachingEmailAfter'))

        updated_user['profile']['coachingEmailFrequency'] = 'EMAIL_MAXIMUM'
        self.app.post(
            '/api/user',
            data=json.dumps(updated_user),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertFalse(updated_user.get('sendCoachingEmailAfter'))

    def test_update_profile_with_quick_diagnostic(self):
        """Update the user but with the quick diagnostic route."""

        user_info = {'profile': {'name': 'Albert', 'yearOfBirth': 1973}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(user_id),
            data=json.dumps({'user': {'profile': {'name': 'Alfred'}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Alfred', updated_user.get('profile', {}).get('name'))
        self.assertEqual(1973, updated_user.get('profile', {}).get('yearOfBirth'))

    def test_create_project_with_quick_diagnostic(self):
        """Create a project but with the quick diagnostic route."""

        user_info = {'profile': {'name': 'Albert'}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(user_id),
            data=json.dumps({'user': {'projects': [{'targetJob': {'name': 'Fou'}}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Fou', updated_user['projects'][0]['targetJob']['name'])

    def test_update_project_with_quick_diagnostic(self):
        """Update the project but with the quick diagnostic route."""

        user_info = {'projects': [{'projectId': '0'}], 'profile': {'name': 'Albert'}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            '/api/user/{}/update-and-quick-diagnostic/0'.format(user_id),
            data=json.dumps({'user': {'projects': [{'targetJob': {'name': 'Fou'}}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Fou', updated_user['projects'][0]['targetJob']['name'])

    def test_update_custom_frustrations_with_quick_diagnostic(self):
        """Update the custom frustrations with the quick diagnostic route."""

        user_info = {'profile': {'customFrustrations': ['Pascal']}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(user_id),
            data=json.dumps({'user': {'profile': {'customFrustrations': ['Bad jokes']}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual(['Bad jokes'], updated_user.get('profile', {}).get('customFrustrations'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
