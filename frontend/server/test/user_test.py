"""Unit tests for the user endpoints."""

import datetime
import json
import time
import typing
from typing import Any, Callable, Dict
import unittest
from unittest import mock

from bson import objectid
import mongomock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test

_TIME = time.time


# TODO(pascal): Break up this module and drop the next line.
# pylint: disable=too-many-lines


def _clean_up_variable_flags(features_enabled: Dict[str, Any]) -> None:
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

    @mock.patch(now.__name__ + '.get')
    def test_app_use_endpoint(self, mock_now: mock.MagicMock) -> None:
        """Test the app/use endpoint."""

        mock_now.side_effect = datetime.datetime.now
        before = datetime.datetime.now()
        user_id, auth_token = self.create_user_with_token()

        mock_now.side_effect = None
        later = before + datetime.timedelta(hours=25)
        mock_now.return_value = later

        response = self.app.post(
            f'/api/app/use/{user_id}',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)

        self.assertGreaterEqual(user_info['requestedByUserAtDate'], before.isoformat())
        self.assertEqual(user_info['requestedByUserAtDate'][:16], later.isoformat()[:16])

    def test_delete_user(self) -> None:
        """Test deleting a user and all their data."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'year_of_birth': 1973},
            'projects': [{}],
            'emailsSent': [{'mailjetMessageId': 1234}],
            'supportTickets': [{'ticketId': 'support-ticket'}],
        }
        user_id, auth_token = self.create_user_with_token(data=user_info, email='foo@bar.fr')
        tokens = self.json_from_response(self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token}))
        unsubscribe_token = tokens['unsubscribe']
        response = self.app.delete(
            '/api/user',
            data=f'{{"userId": "{user_id}"}}',
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
        self.assertNotIn('support-ticket', json.dumps(user_data))

    def test_delete_user_missing_token(self) -> None:
        """Test trying user deletion without token."""

        response = self.app.delete('/api/user', data='{"profile": {"email": "foo@bar.fr"}}')
        self.assertEqual(403, response.status_code)

    def test_try_delete_user_token(self) -> None:
        """Try to delete a user without its ID but with an auth token."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'year_of_birth': 1973},
            'projects': [{}]}
        user_id = self.create_user(data=user_info, email='foo@bar.fr')
        token = server.auth.create_token('foo@bar.fr', role='unsubscribe')
        response = self.app.delete(
            '/api/user',
            data='{"profile": {"email": "foo@bar.fr"}}',
            headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(403, response.status_code)
        self.assertIn('seulement pour le super-admin', response.get_data(as_text=True))
        user_data = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertEqual('foo@bar.fr', user_data['profile']['email'])

    @mock.patch(server.auth.__name__ + '._ADMIN_AUTH_TOKEN', new='custom-auth-token')
    def test_delete_user_with_admin_auth_token(self) -> None:
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

    def test_try_login_in_after_deletion(self) -> None:
        """Test accessing data of a deleted user."""

        user_id, auth_token = self.create_user_with_token()
        tokens = self.json_from_response(self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token}))
        unsubscribe_token = tokens['unsubscribe']
        self.app.delete(
            '/api/user',
            data=f'{{"userId": "{user_id}"}}',
            headers={'Authorization': 'Bearer ' + unsubscribe_token})

        response = self.app.post(
            f'/api/app/use/{user_id}',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(404, response.status_code)

        auth_response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"authToken": "{tokens["auth"]}", "userId": "{user_id}"}}')
        self.assertEqual(404, auth_response.status_code)

    def test_get_user(self) -> None:
        """Basic Usage of retrieving a user from DB."""

        user_info = {'profile': {'gender': 'FEMININE'}, 'projects': [{
            'jobSearchLengthMonths': 6,
        }]}
        user_id, auth_token = self.create_user_with_token(data=user_info)
        user_info['userId'] = user_id

        user_info2 = self.get_user_info(typing.cast(str, user_info['userId']), auth_token)
        self.assertIn('profile', user_info2)
        self.assertIn('email', user_info2['profile'])
        user_info2['profile'].pop('email')
        user_info2['profile'].pop('name')
        user_info2['profile'].pop('lastName')
        self.assertIn('registeredAt', user_info2)
        user_info2.pop('registeredAt')
        self.assertIn('projects', user_info2)
        projects = user_info2.pop('projects')
        user_info.pop('projects')
        user_info2.pop('featuresEnabled')
        user_info2.pop('revision')
        user_info2.pop('hashedEmail')
        user_info2.pop('hasAccount')
        user_info2.pop('hasPassword')
        self.assertEqual(user_info, user_info2)

        self.assertEqual(1, len(projects), projects)
        project = projects[0]
        self.assertFalse(project.get('jobSearchHasNotStarted'))
        job_search_started_at = datetime.datetime.strptime(
            project.get('jobSearchStartedAt'), '%Y-%m-%dT%H:%M:%SZ')
        self.assertLess(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=180))
        self.assertGreater(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=200))

    def test_get_user_unauthorized(self) -> None:
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

    def test_user(self) -> None:
        """Basic usage."""

        time_before = datetime.datetime.now() - datetime.timedelta(seconds=1)
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", '
            '"profile": {"city": {"name": "fobar"}, "email": "foo@bar.fr"}, '
            '"projects": [{"title": "Yay title"}]}',
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

    def test_user_changes_project(self) -> None:
        """Local stats are reset when saving a user with a new project."""

        self._db.local_diagnosis.insert_many([
            {
                '_id': '31:A1234',
                'jobOffersChange': 5,
            },
            {
                '_id': '69:A1234',
                'jobOffersChange': 10,
            },
        ])
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        user_info = self.get_user_info(user_id, auth_token)
        user_info['projects'] = [{
            'city': {'departementId': '69'},
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
        }]
        response = self.app.post(
            '/api/user',
            data=json.dumps(user_info),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        lyon_local_stats = user_info['projects'][0].get('localStats')
        self.assertTrue(lyon_local_stats)

        user_info['projects'][0]['city']['departementId'] = '31'
        response = self.app.post(
            '/api/user',
            data=json.dumps(user_info),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        toulouse_local_stats = user_info['projects'][0].get('localStats')
        self.assertTrue(toulouse_local_stats)
        self.assertNotEqual(lyon_local_stats, toulouse_local_stats)

    @mock.patch(server.__name__ + '.advisor.maybe_advise')
    @mock.patch('time.time')
    @mock.patch('logging.warning')
    @mock.patch('logging.info')
    def test_log_long_requests(
            self, mock_info: mock.MagicMock, mock_warning: mock.MagicMock,
            mock_time: mock.MagicMock, mock_advise: mock.MagicMock) -> None:
        """Log timing for long requests."""

        # Variable as a list to be used in closures below.
        time_delay = [0]
        log_calls = []

        def _delayed_time(*unused_args: Any, **unused_kwargs: Any) -> float:
            return _TIME() + time_delay[0]
        mock_time.side_effect = _delayed_time

        def _wait_for_it(*unused_args: Any, **unused_kwargs: Any) -> None:
            time_delay[0] += 6
        mock_advise.side_effect = _wait_for_it

        def _log_call(level: str) -> Callable[..., None]:
            def _log_me(*unused_args: Any, **unused_kwargs: Any) -> None:
                log_calls.append(level)
            return _log_me
        mock_warning.side_effect = _log_call('warning')
        mock_info.side_effect = _log_call('info')

        self.create_user([base_test.add_project], advisor=False)
        mock_warning.assert_called_once()
        # Checking the last log call is with `warning` level.
        self.assertEqual('warning', log_calls.pop())
        warning_args = mock_warning.call_args[0]
        self.assertEqual('Long request: %d seconds', warning_args[0])
        self.assertGreaterEqual(warning_args[1], 2)
        self.assertGreaterEqual(mock_info.call_count, 10)
        # Checking all other log calls are with `info` level.
        self.assertEqual({'info'}, set(log_calls), msg=log_calls)
        self.assertEqual(
            {'%.4f: Tick %s (%.4f since last tick)'},
            set(c[0][0] for c in mock_info.call_args_list))

    def test_user_feature_flags_from_clients(self) -> None:
        """Client trying to change feature flags."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"city": {"name": "fobar"}, "email": "foo@bar.fr"}, '
            '"featuresEnabled": {"bobPoints": "NOT_IN_EXPERIMENT"}}' % user_id,
            headers={'Authorization': 'Bearer ' + auth_token},
            content_type='application/json')
        user_info = self.json_from_response(response)
        self.assertEqual({'name': 'fobar'}, user_info.get('profile', {}).get('city'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('bobPoints'))
        self.assertFalse(
            self.user_info_from_db(user_id).get('featuresEnabled', {}).get('bobPoints'))

    def test_update_project(self) -> None:
        """User project is updated by a diff."""

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
            f'/api/user/{user_id}/project/0',
            data=json.dumps({
                'projectId': '0',
                'totalInterviewCount': 5,
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        project_info = self.json_from_response(response)
        self.assertTrue(project_info.get('projectId'))
        self.assertTrue(project_info.get('isIncomplete'))
        self.assertEqual(5, project_info.get('totalInterviewCount'))

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual(1, len(user_info.get('projects', [])))
        self.assertEqual(project_info, user_info['projects'].pop())

    def test_update_advice_module(self) -> None:
        """User advice_module is updated."""

        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        # Populate user.
        self.app.post(
            '/api/user',
            data=json.dumps({
                'userId': user_id,
                'profile': {'email': 'foo@bar.fr'},
                'projects': [{
                    'projectId': '0',
                    'title': 'Awesome Title',
                    'advices': [{
                        'adviceId': 'commute',
                        'numStars': 3,
                        'status': 'ADVICE_RECOMMENDED',
                    }],
                }],
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        response = self.app.post(
            f'/api/user/{user_id}/project/0/advice/commute',
            data=json.dumps({'status': 'ADVICE_READ'}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        advice_info = self.json_from_response(response)
        self.assertEqual('commute', advice_info.get('adviceId'))
        self.assertEqual(3, advice_info.get('numStars'))

        user_info = self.get_user_info(user_id, auth_token)
        self.assertEqual(1, len(user_info.get('projects', [])))
        self.assertEqual(1, len(user_info['projects'][0].get('advices', [])))
        self.assertEqual(advice_info, user_info['projects'][0]['advices'].pop())

    def test_update_advice_module_missing(self) -> None:
        """User advice_module is updated but advice does not exist."""

        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        # Populate user.
        self.app.post(
            '/api/user',
            data=json.dumps({
                'userId': user_id,
                'profile': {'email': 'foo@bar.fr'},
                'projects': [{
                    'projectId': '0',
                    'title': 'Awesome Title',
                    'advices': [{
                        'adviceId': 'commute',
                        'numStars': 3,
                        'status': 'ADVICE_RECOMMENDED',
                    }],
                }],
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        response = self.app.post(
            f'/api/user/{user_id}/project/0/advice/unknown',
            data=json.dumps({'status': 'ADVICE_READ'}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(404, response.status_code)

    def test_project_diagnosis_added(self) -> None:
        """Local diagnosis should be added to a new project."""

        project = {
            'city': {'departementId': '38'},
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"email":"foo@bar.fr"}}, '
            f'"projects": [{json.dumps(project)}]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        projects = user_info.pop('projects')
        self.assertEqual(1, len(projects))
        project = projects.pop()

    def test_project_in_advisor(self) -> None:
        """New project should get advised and diagnosed."""

        project = {
            'city': {'departementId': '38'},
            'localStats': {
                'lessStressfulJobGroups': [{}],
            },
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bayes.org')
        self._db.diagnostic_category.insert_many([
            {
                'categoryId': 'bravo',
                'strategiesIntroduction': 'Voici vos stratégies',
                'order': 2,
            },
        ])
        self._db.diagnostic_overall.insert_one({
            'categoryId': 'bravo',
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans votre recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
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
        self.app.get('/api/cache/clear')
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"email":"foo@bayes.org"}}, '
            '"featuresEnabled": {"advisor": "ACTIVE"}, '
            f'"projects": [{json.dumps(project)}]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        project = user_info['projects'][0]
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))

        self.assertEqual(
            {'categories', 'categoryId', 'overallScore', 'overallSentence', 'text'},
            set(typing.cast(Dict[str, Any], project.get('diagnostic', {}))))

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

    def test_post_user_with_no_id(self) -> None:
        """Called with no ID the endpoint should return an error."""

        user_id, auth_token = self.create_user_with_token()

        response2 = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"name": "very different"}}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_with_unknown_id(self) -> None:
        """Called with an unknown user ID the endpoint should return an error."""

        user_id, auth_token = self.create_user_with_token()
        # Change the last digit.
        fake_user_id = user_id[:-1] + ('1' if user_id[-1:] != '1' else '0')

        response2 = self.app.post(
            '/api/user',
            data=f'{{"userId": "{fake_user_id}", "profile": '
            '{"city": {"name": "very different"}}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_with_invalid_token(self) -> None:
        """Called with an invalid auth token the endpoint should return an error."""

        user_id = self.create_user()
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"city": {{"name": "very different"}}}}}}',
            headers={'Authorization': 'Bearer 513134513451345', 'Content-Type': 'application/json'})
        self.assertEqual(403, response.status_code)

    def test_post_user_with_unauthorized_token(self) -> None:
        """Called with an invalid auth token the endpoint should return an error."""

        user_id = self.create_user()
        unauthorized_token = 'Bearer 1509481.11027aabc4833f0177a06a7948ec78f220a00c78'
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"city": {{"name": "very different"}}}}}}',
            headers={'Authorization': unauthorized_token, 'Content-Type': 'application/json'})
        self.assertEqual(403, response.status_code)

    def test_post_user_changing_email(self) -> None:
        """It should not be possible to change the email as it is used for auth."""

        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"email": "very-different@bar.fr"}}}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._user_db.user.find()))

    def test_post_user_project_with_no_status(self) -> None:
        """Called with a project with an ID but no status."""

        project = {
            'projectId': 'abc',
            'city': {'departementId': '38'},
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id, auth_token = self.authenticate_new_user_token(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{"email":"foo@bar.fr"}}, '
            f'"projects": [{json.dumps(project)}]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        # This is mostly a regression test: we used to trigger a 500 with this
        # scenario.
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

    def test_update(self) -> None:
        """Called with a user that has an ID should update it."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data='{"profile": {"name": "very different", '
            f'"email": "foo@bar.fr"}}, "revision": 2, "userId": "{user_id}"}}',
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

    def test_update_revision(self) -> None:
        """Updating a user to an old revision does not work and return the new version."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.fr')

        self.app.post(
            '/api/user',
            data='{"profile": {"name": "new name", '
            f'"email": "foo@bar.fr"}}, "revision": 15, "userId": "{user_id}"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        response = self.app.post(
            '/api/user',
            data='{"profile": {"name": "old name", '
            f'"email": "foo@bar.fr"}}, "revision": 10, "userId": "{user_id}"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        user_info = self.json_from_response(response)
        self.assertEqual('new name', user_info['profile'].get('name'))
        self.assertEqual(16, user_info['revision'])

    def test_create_project(self) -> None:
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
            '/api/user', data='{"projects": [{"targetJob": {"jobGroup": '
            '{"romeId": "A1234"}}, "city":{"departementId": "69"}}],'
            f'"profile":{{"email":"foo@bar.fr"}},"userId": "{user_id}"}}',
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

    def test_create_project_no_data(self) -> None:
        """A project with no backend data still gets some basic values."""

        user_id, auth_token = self.create_user_with_token(data={}, email='foo@bar.fr')

        response = self.app.post(
            '/api/user', data='{"projects": [{"targetJob": {"jobGroup": '
            '{"romeId": "no-data"}}}], "profile":{"email":"foo@bar.fr"},'
            f'"userId": "{user_id}"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info2 = self.json_from_response(response)
        self.assertEqual(1, len(user_info2['projects']))
        project = user_info2['projects'].pop()
        self.assertIn('projectId', project)
        self.assertIn('createdAt', project)

    def test_update_settings(self) -> None:
        """Update user settings."""

        user_info = {
            'profile': {'city': {'name': 'foobar'}, 'name': 'Albert', 'yearOfBirth': 1973},
            'projects': [{}],
        }
        user_id, auth_token = self.create_user_with_token(data=user_info)
        tokens = self.json_from_response(self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token}))
        settings_token = tokens['settings']

        response = self.app.post(
            f'/api/user/{user_id}/settings',
            data='{"coachingEmailFrequency": "EMAIL_ONCE_A_MONTH"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + settings_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'), msg=updated_user)
        self.assertEqual(
            'EMAIL_ONCE_A_MONTH', updated_user['profile'].get('coachingEmailFrequency'))

    def test_update_email_settings_invalidate(self) -> None:
        """Updating user settings for email frequency invalidates the next email date."""

        user_info = {
            'profile': {'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH'},
        }
        user_id, auth_token = self.create_user_with_token(data=user_info)
        tokens = self.json_from_response(self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token}))
        settings_token = tokens['settings']

        # Fake sending a coaching email and updating the user.
        self._user_db.user.update_one({'_id': objectid.ObjectId(user_id)}, {'$set': {
            'sendCoachingEmailAfter': '2018-01-15T15:24:34Z',
        }})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertTrue(updated_user.get('sendCoachingEmailAfter'))

        self.app.post(
            f'/api/user/{user_id}/settings',
            data='{"coachingEmailFrequency": "EMAIL_MAXIMUM"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + settings_token})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertFalse(updated_user.get('sendCoachingEmailAfter'))

    def test_update_email_frequency_invalidate(self) -> None:
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

    def test_update_profile_with_quick_diagnostic(self) -> None:
        """Update the user but with the quick diagnostic route."""

        user_info = {'profile': {
            'name': 'Albert', 'lastName': 'Einstein',
            'yearOfBirth': 1973, 'frustrations': ['NO_OFFERS']}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'profile': {'name': 'Alfred'}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Alfred', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Einstein', updated_user.get('profile', {}).get('lastName', ''))
        self.assertEqual(1973, updated_user.get('profile', {}).get('yearOfBirth'))
        self.assertEqual(['NO_OFFERS'], updated_user.get('profile', {}).get('frustrations'))

    def test_update_profile_with_quick_diagnostic_and_field_path(self) -> None:
        """Update the user with the quick diagnostic route and a field path."""

        user_info = {'profile': {
            'name': 'Albert', 'lastName': 'Einstein', 'yearOfBirth': 1973,
            'frustrations': ['NO_OFFERS']}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic',
            data=json.dumps({
                'user': {'profile': {'name': 'Alfred', 'yearOfBirth': 1982}},
                'fieldMask': 'profile.name,profile.lastName',
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Alfred', updated_user.get('profile', {}).get('name', ''))
        self.assertEqual('', updated_user.get('profile', {}).get('lastName', ''))
        self.assertEqual(1973, updated_user.get('profile', {}).get('yearOfBirth'))
        self.assertEqual(['NO_OFFERS'], updated_user.get('profile', {}).get('frustrations'))

    def test_create_project_with_quick_diagnostic(self) -> None:
        """Create a project but with the quick diagnostic route."""

        user_info = {'profile': {'name': 'Albert'}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [{'targetJob': {'name': 'Fou'}}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Fou', updated_user['projects'][0]['targetJob']['name'])

    def test_update_project_with_quick_diagnostic(self) -> None:
        """Update the project but with the quick diagnostic route."""

        user_info = {'projects': [
            {'projectId': '0', 'employmentTypes': ['CDI']}], 'profile': {'name': 'Albert'}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic/0',
            data=json.dumps({'user': {'projects': [{
                'targetJob': {'name': 'Fou'},
                'employmentTypes': ['CDD_OVER_3_MONTHS']}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Fou', updated_user['projects'][0]['targetJob']['name'])
        self.assertEqual(['CDD_OVER_3_MONTHS'], updated_user['projects'][0]['employmentTypes'])

    def test_update_custom_frustrations_with_quick_diagnostic(self) -> None:
        """Update the custom frustrations with the quick diagnostic route."""

        user_info = {'profile': {'customFrustrations': ['Pascal']}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'profile': {'customFrustrations': ['Bad jokes']}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual(['Bad jokes'], updated_user.get('profile', {}).get('customFrustrations'))

    def test_update_frustrations_with_empty_field_with_quick_diagnostic(self) -> None:
        """Update the custom frustrations with the quick diagnostic route."""

        user_info = {'profile': {'frustrations': ['NO_OFFERS']}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'profile': {'frustrations': [0]}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        updated_user = self.get_user_info(user_id, auth_token)
        self.assertFalse(updated_user.get('profile', {}).get('frustrations'))

    def test_update_project_employment_type_with_quick_diagnostic(self) -> None:
        """Update the project with empty employment type with the quick diagnostic route."""

        user_info = {'projects': [
            {'projectId': '0', 'employmentTypes': ['CDI']}], 'profile': {'name': 'Albert'}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/update-and-quick-diagnostic/0',
            data=json.dumps({'user': {'projects': [{
                'targetJob': {'name': 'Fou'},
                'employmentTypes': [0]}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertEqual('Albert', updated_user.get('profile', {}).get('name'))
        self.assertEqual('Fou', updated_user['projects'][0]['targetJob']['name'])
        self.assertFalse(updated_user['projects'][0].get('employmentTypes'))

    @mock.patch(server.__name__ + '.now')
    def test_update_strategy(self, mock_now: mock.MagicMock) -> None:
        """Set parameters for an opened strategy in a project."""

        mock_now.get.return_value = datetime.datetime(2019, 4, 15)
        user_info = {'projects': [{'projectId': '0'}]}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        response = self.app.post(
            f'/api/user/{user_id}/project/0/strategy/other-leads',
            data=json.dumps({
                'reachedGoals': {'goal-1': True, 'goal-2': False},
                'strategyId': 'other-leads',
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        updated_strategy = self.json_from_response(response)
        self.assertEqual('other-leads', updated_strategy.get('strategyId'))
        self.assertTrue(updated_strategy.get('reachedGoals', {}).get('goal-1'))
        self.assertEqual('2019-04-15T00:00:00Z', updated_strategy.get('startedAt'))

        updated_strategy['reachedGoals']['goal-1'] = False
        updated_strategy['startedAt'] = '2019-05-15T00:00:00Z'
        response = self.app.post(
            f'/api/user/{user_id}/project/0/strategy/other-leads',
            data=json.dumps(updated_strategy),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        updated_strategy = self.json_from_response(response)
        self.assertEqual('other-leads', updated_strategy.get('strategyId'))
        self.assertFalse(updated_strategy.get('reachedGoals', {}).get('goal-1'))
        self.assertFalse(updated_strategy.get('reachedGoals', {}).get('goal-2', True))
        self.assertEqual('2019-04-15T00:00:00Z', updated_strategy.get('startedAt'))

    def test_stop_strategy(self) -> None:
        """Stop an opened strategy in a project."""

        user_info = {'projects': [{'projectId': '0'}]}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        self.app.post(
            f'/api/user/{user_id}/project/0/strategy/other-leads',
            data=json.dumps({
                'reachedGoals': {'goal-1': True, 'goal-2': False},
                'strategyId': 'other-leads',
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertTrue(updated_user['projects'][0].get('openedStrategies'))

        response = self.app.delete(
            f'/api/user/{user_id}/project/0/strategy/other-leads',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        updated_user = self.get_user_info(user_id, auth_token)
        self.assertFalse(updated_user['projects'][0].get('openedStrategies'))

    @mock.patch(now.__name__ + '.get')
    def test_returning_can_tutoie(self, mock_now: mock.MagicMock) -> None:
        """User returning with a canTutoie field set."""

        mock_now.return_value = datetime.datetime(2019, 3, 6)
        user_info = {'profile': {'canTutoie': True}}
        user_id, auth_token = self.create_user_with_token(data=user_info)

        mock_now.return_value = datetime.datetime(2020, 3, 6)
        response = self.app.post(
            f'/api/app/use/{user_id}', headers={'Authorization': f'Bearer {auth_token}'})
        user = self.json_from_response(response)
        self.assertFalse(user.get('profile', {}).get('canTutoie'))
        self.assertEqual('fr@tu', user.get('profile', {}).get('locale'))


if __name__ == '__main__':
    unittest.main()
