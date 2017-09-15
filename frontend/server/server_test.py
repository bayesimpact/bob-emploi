# -*- coding: utf-8
"""Tests for the server module."""
import datetime
import hashlib
import json
import re
import time
import unittest

from bson import objectid
import mock
import mongomock
import requests

from bob_emploi.frontend import base_test
from bob_emploi.frontend import now
from bob_emploi.frontend import server

# TODO(pascal): Split this smaller test modules.
# pylint: disable=too-many-lines

# Allow access to server's top constant pulled from os environment so that we
# can test the various features controlled by those env vars.
# pylint: disable=protected-access

_TIME = time.time


def _set_departement(departement):
    def _modifier(user):
        user['profile']['locationDepartement'] = departement
    return _modifier


def _add_chantier(project_index, new_chantier):
    def _modifier(user):
        if 'activatedChantiers' not in user['projects'][project_index]:
            user['projects'][project_index]['activatedChantiers'] = {}
        user['projects'][project_index]['activatedChantiers'][new_chantier] = True
    return _modifier


def _add_action(project_index, action_template_id, actions_field='actions', **kwargs):
    def _modifier(user):
        if actions_field not in user['projects'][project_index]:
            user['projects'][project_index][actions_field] = []
        user['projects'][project_index][actions_field].append(dict(
            {'actionTemplateId': action_template_id}, **kwargs))
    return _modifier


def _add_project(user):
    user['projects'] = user.get('projects', []) + [{
        'targetJob': {'jobGroup': {'romeId': 'A1234'}},
        'mobility': {'city': {'cityId': '31555'}},
    }]


def _clean_up_variable_flags(features_enabled):
    del_features = []
    for feature in features_enabled:
        for prefix in (
                'actionFeedbackModal', 'advisor', 'hideDiscoveryNav',
                'lbbIntegration', 'stickyActions', 'alpha', 'netPromoterScoreEmail',
                'poleEmploi'):
            if feature.startswith(prefix):
                del_features.append(feature)
    for feature in del_features:
        del features_enabled[feature]


class OtherEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the other small endpoints."""

    def test_health_check(self):
        """Basic call to "/"."""
        response = self.app.get('/')
        self.assertEqual(200, response.status_code)

    def test_config(self):
        """Basic call to "/api/config"."""
        response = self.app.get('/api/config')
        config = self.json_from_response(response)
        self.assertTrue(config.get('googleSSOClientId'))

    def _create_user_joe_the_cheminot(self):
        """Joe is a special user used to analyse feedback."""
        user_data = {
            'profile': {'name': 'Joe'},
            'projects': [
                {'projectId': 'another-id', 'title': "Cultivateur d'escargots à Lyon"},
                {'projectId': 'pid', 'title': 'Cheminot à Caen', 'seniority': 1},
                {'projectId': 'last-id', 'title': 'Polénisateur à Brest', 'seniority': 2}],
        }
        return self.create_user(data=user_data, email='foo@bar.fr')

    @mock.patch(requests.__name__ + '.post')
    def test_feedback(self, mock_post):
        """Basic call to "/api/feedback"."""
        server._SLACK_FEEDBACK_URL = 'https://slack.example.com/url'

        user_id = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "%s", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}' % user_id,
            content_type='application/json')
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            ['Aaaaaaaaaaaaawesome!\nsecond line'],
            [d.get('feedback') for d in self._db.feedbacks.find()])
        feedback_id = str(next(self._db.feedbacks.find())['_id'])

        # Check slack call.
        mock_post.assert_called_once()
        self.assertEqual(('https://slack.example.com/url',), mock_post.call_args[0])
        self.assertEqual({'json'}, set(mock_post.call_args[1]))
        self.assertEqual({'text'}, set(mock_post.call_args[1]['json']))
        text = mock_post.call_args[1]['json']['text']
        self.assertNotIn('my-user', text, msg='Do not leak user ID to slack')
        self.assertIn('"one-advice"', text)
        self.assertIn('from Joe, Cheminot à Caen, with experience of "internship"', text)
        self.assertIn('\n> Aaaaaaaaaaaaawesome!\n> second line', text)
        self.assertIn(feedback_id, text, msg='Show the MongoDB ID of the feedback in slack')

    @mock.patch(requests.__name__ + '.post')
    def test_feedback_no_user(self, mock_post):
        """Testing /api/feedback with missing user ID."""
        server._SLACK_FEEDBACK_URL = 'https://slack.example.com/url'

        self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(200, response.status_code)
        text = mock_post.call_args[1]['json']['text']
        self.assertIn('\n> Aaaaaaaaaaaaawesome!\n> second line', text)
        self.assertNotIn('from', text)
        self.assertNotIn('Cheminot', text)
        self.assertNotIn('internship', text)

    def test_feedback_wrong_user(self):
        """Testing /api/feedback with wrong user ID, this should fail."""
        server._SLACK_FEEDBACK_URL = 'https://slack.example.com/url'
        self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "baduserid", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(400, response.status_code)

    @mock.patch(requests.__name__ + '.post')
    def test_feedback_missing_project(self, mock_post):
        """Testing /api/feedback with missing project ID but correct user ID."""
        server._SLACK_FEEDBACK_URL = 'https://slack.example.com/url'
        user_id = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "%s", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "", "source": "ADVICE_FEEDBACK"}' % user_id,
            content_type='application/json')
        text = mock_post.call_args[1]['json']['text']
        self.assertIn('from Joe', text)
        self.assertIn('\n> Aaaaaaaaaaaaawesome!\n> second line', text)
        self.assertEqual(200, response.status_code)

    def test_feedback_wrong_project(self):
        """Testing /api/feedback with ok user ID and wrong project ID, this should fail."""
        server._SLACK_FEEDBACK_URL = 'https://slack.example.com/url'
        user_id = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "%s", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "nop", "source": "ADVICE_FEEDBACK"}' % user_id,
            content_type='application/json')
        self.assertEqual(404, response.status_code)

    @mock.patch(now.__name__ + '.get')
    def test_usage_stats(self, mock_now):
        """Testing /api/usage/stats endpoint."""
        self._db.user.insert_many([
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2017-06-03T12:00:00Z'},
            {'registeredAt': '2017-06-03T13:00:00Z', 'profile': {'email': 'real@email.fr'}},
            {'registeredAt': '2017-06-04T12:00:00Z', 'profile': {'email': 'fake@example.com'}},
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 5}}]},
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 2}}]},
        ])
        mock_now.return_value = datetime.datetime(
            2017, 6, 10, 12, 30, tzinfo=datetime.timezone.utc)

        response = self.app.get('/api/usage/stats')
        self.assertEqual(
            {
                'dailyScoresCount': {'2': 1, '5': 1},
                'totalUserCount': 7,
                'weeklyNewUserCount': 4,
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


class NPSSurveyEndpointTestCase(base_test.ServerTestCase):
    """Tests for the /api/user/nps-survey-response endpoint."""

    def setUp(self):
        super(NPSSurveyEndpointTestCase, self).setUp()
        server._ADMIN_AUTH_TOKEN = ''

    def test_set_nps_survey_response(self):
        """Calls to "/api/user/<user_email>/nps-survey-response"."""
        user_email = 'foo@bar.fr'
        user_id = self.create_user(email=user_email)
        old_user_data = self.get_user_info(user_id)
        # Make sure we actually have some fields in the user data, as we will check later
        # that old fields are not overridden.
        self.assertTrue(old_user_data)

        # Simulate when the user fills the survey.
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "%s", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}' % user_email,
            content_type='application/json')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

        # Simulate when one team member curates 'which_advices_were_useful_comment' to normalize it
        # in 'curated_useful_advice_ids'.
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "%s", "curatedUsefulAdviceIds":["improve-resume"]}' % user_email,
            content_type='application/json')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

        # Check the data was correctly saved in the database.
        new_user_data = self.get_user_info(user_id)
        nps_survey_response = new_user_data.pop('netPromoterScoreSurveyResponse', None)
        other_fields_in_new_user_data = new_user_data
        self.assertEqual({
            'score': 10,
            'wereAdvicesUsefulComment': 'So\ncool!',
            'whichAdvicesWereUsefulComment': 'The CV tip',
            'generalFeedbackComment': 'RAS',
            'curatedUsefulAdviceIds': ['improve-resume'],
        }, nps_survey_response)

        # Check that we did not override any other field than netPromoterScoreSurveyResponse.
        self.assertEqual(old_user_data, other_fields_in_new_user_data)

    def test_set_nps_survey_response_wrong_email(self):
        """Testing /api/user/<user_email>/nps-survey-response with wrong user email."""
        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)

        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "otherfoo@bar.fr", "score": 10}',
            content_type='application/json')
        self.assertEqual(404, response.status_code, response.get_data(as_text=True))

    def test_set_nps_survey_response_missing_auth(self):
        """Endpoint protected and no auth token sent"."""
        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        server._ADMIN_AUTH_TOKEN = 'cryptic-admin-auth-token-123'
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "%s", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}' % user_email,
            content_type='application/json')
        self.assertEqual(401, response.status_code)

    def test_set_nps_survey_response_wrong_auth(self):
        """Endpoint protected and wrong auth token sent"."""
        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        server._ADMIN_AUTH_TOKEN = 'cryptic-admin-auth-token-123'
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "%s", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}' % user_email,
            content_type='application/json',
            headers={'Authorization': 'wrong-token'})
        self.assertEqual(403, response.status_code)

    def test_set_nps_survey_response_correct_auth(self):
        """Endpoint protected and correct auth token sent"."""
        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        server._ADMIN_AUTH_TOKEN = 'cryptic-admin-auth-token-123'
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "%s", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}' % user_email,
            content_type='application/json',
            headers={'Authorization': 'cryptic-admin-auth-token-123'})
        self.assertEqual(200, response.status_code)


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
        user_id = self.create_user()

        mock_now.side_effect = None
        later = before + datetime.timedelta(hours=25)
        mock_now.return_value = later

        response = self.app.post('/api/app/use/%s' % user_id)
        user_info = self.json_from_response(response)

        self.assertGreaterEqual(user_info['requestedByUserAtDate'], before.isoformat())
        self.assertEqual(user_info['requestedByUserAtDate'][:16], later.isoformat()[:16])

    def test_delete_user(self):
        """Test deleting a user and all their data."""
        user_info = {'profile': {'city': {'name': 'foobar'}}, 'projects': [{}]}
        user_id = self.create_user(data=user_info, email='foo@bar.fr')
        response = self.app.delete(
            '/api/user',
            data='{"userId": "%s", "profile": {"email": "foo@bar.fr"}}' % user_id)
        self.assertEqual(200, response.status_code)
        auth_object = self._db.user_auth.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(auth_object)
        user_data = self._db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(user_data)

    def test_delete_user_missing_id(self):
        """Test trying user deletion without user_id."""
        response = self.app.delete('/api/user', data='{"profile": {"email": "foo@bar.fr"}}')
        self.assertEqual(403, response.status_code)

    def test_delete_user_credential_mismatch_email(self):
        """Test trying user deletion without correct email."""
        user_info = {'profile': {'city': {'name': 'foobar'}}, 'projects': [{}]}
        user_id = self.create_user(data=user_info)
        response = self.app.delete(
            '/api/user',
            data='{"userId": "%s", "profile": {"email": "wrong@email.fr"}}' % user_id)
        self.assertEqual(403, response.status_code)

    def test_delete_user_token(self):
        """Delete a user without its ID but with an auth token."""
        user_info = {'profile': {'city': {'name': 'foobar'}}, 'projects': [{}]}
        user_id = self.create_user(data=user_info, email='foo@bar.fr')
        token = server.auth.create_token('foo@bar.fr', role='unsubscribe')
        response = self.app.delete(
            '/api/user',
            data='{"profile": {"email": "foo@bar.fr"}}',
            headers={'Authorization': 'Bearer %s' % token})
        self.assertEqual(200, response.status_code)
        auth_object = self._db.user_auth.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(auth_object)
        user_data = self._db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertFalse(user_data)

    def test_get_user(self):
        """Basic Usage of retrieving a user from DB."""
        user_info = {'profile': {'gender': 'FEMININE'}, 'projects': [{
            'jobSearchLengthMonths': 6,
        }]}
        user_id = self.create_user(data=user_info)
        user_info['userId'] = user_id

        user_info2 = self.get_user_info(user_info['userId'])
        self.assertIn('registeredAt', user_info2)
        user_info2.pop('registeredAt')
        self.assertIn('projects', user_info2)
        projects = user_info2.pop('projects')
        user_info.pop('projects')
        user_info2.pop('featuresEnabled')
        user_info2.pop('revision')
        self.assertEqual(user_info, user_info2)

        self.assertEqual(1, len(projects), projects)
        self.assertFalse(projects[0].get('jobSearchHasNotStarted'))
        job_search_started_at = datetime.datetime.strptime(
            projects[0].get('jobSearchStartedAt'), '%Y-%m-%dT%H:%M:%SZ')
        self.assertLess(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=180))
        self.assertGreater(
            job_search_started_at, datetime.datetime.now() - datetime.timedelta(days=200))

    def test_user(self):
        """Basic usage."""
        time_before = datetime.datetime.now() - datetime.timedelta(seconds=1)
        user_id = self.authenticate_new_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"city": {"name": "fobar"}, "email": "foo@bar.fr"}, '
            '"projects": [{"title": "Yay title"}]}' % user_id,
            content_type='application/json')
        user_info = self.json_from_response(response)

        # Pop or delete variable fields.
        registered_at = user_info.pop('registeredAt')
        projects = user_info.pop('projects')
        _clean_up_variable_flags(user_info['featuresEnabled'])

        self.assertEqual(
            {
                'featuresEnabled': {},
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
        self.assertEqual([user_id], [str(u['_id']) for u in self._db.user.find()])

        # Check projects field.
        self.assertEqual(1, len(projects))
        self.assertEqual('Yay title', projects[0]['title'])
        self.assertNotIn('actions', projects[0])

        stored_user_info = self.user_info_from_db(user_id)
        self.assertEqual(registered_at, stored_user_info.pop('registeredAt'))
        self.assertEqual(projects, stored_user_info.pop('projects'))
        _clean_up_variable_flags(stored_user_info['featuresEnabled'])
        self.assertEqual(
            {
                'featuresEnabled': {},
                'profile': {
                    'city': {'name': 'fobar'},
                    'email': 'foo@bar.fr',
                },
                'revision': 1,
                'userId': user_id,
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
            time_delay[0] += 2
        mock_advise.side_effect = _wait_for_it

        self.create_user([_add_project], advisor=False)
        self.assertGreaterEqual(mock_warning.call_count, 10)
        first_warning_args = mock_warning.call_args_list[0][0]
        self.assertEqual('Long request: %d seconds', first_warning_args[0])
        self.assertGreaterEqual(first_warning_args[1], 2)
        self.assertEqual(
            {'%.4f: Tick %s (%.4f since last tick)'},
            set(c[0][0] for c in mock_warning.call_args_list[1:]))

    # TODO(pascal): Add a test back (check history before 97d087e for instance)
    # to check that users cannot modify feature flags. For now we do not have a
    # feature flag that is supposed to be stable.

    def test_feature_flag_mod_draws(self):
        """Assign feature flags based on user ID mod."""
        draws = []
        for i in range(40):
            user_id = self.create_user(email='foo%d@bar.fr' % i)
            draws.append(self.get_user_info(user_id).get('featuresEnabled'))

        num_users_in_experiment = sum(1 for d in draws if d.get('lbbIntegration') == 'ACTIVE')
        num_users_in_control = sum(1 for d in draws if d.get('lbbIntegration') == 'CONTROL')
        # Check that at least one user got assigned the chantier icons
        # (probability that it fails exist, it's 0.5^40 = 9e-13).
        self.assertGreater(num_users_in_experiment, 0)
        self.assertGreater(num_users_in_control, 0)

        self.assertEqual(40, num_users_in_experiment + num_users_in_control)

    def test_feature_flag_mod_persistant(self):
        """Assign feature flags based on user ID mod: check that it's always the same."""
        user_id = self.create_user_that(
            lambda user_data: user_data['featuresEnabled']['lbbIntegration'] == 'ACTIVE')

        # Change the DataBase behind the server's back.
        self._db.user.update_one(
            {'_id': mongomock.ObjectId(user_id)}, {'$unset': {'featuresEnabled': 1}})
        user = self.get_user_info(user_id)
        self.assertEqual('ACTIVE', user.get('featuresEnabled', {}).get('lbbIntegration'))

    def test_project_diagnosis_added(self):
        """Local diagnosis should be added to a new project."""
        project = {
            'mobility': {
                'city': {'departementId': '38'},
            },
            'minSalary': 1000,
            'targetJob': {'jobGroup': {'romeId': 'M1403'}},
        }
        user_id = self.authenticate_new_user(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"email":"foo@bar.fr"}, '
            '"projects": [%s]}' % (user_id, json.dumps(project)),
            content_type='application/json')
        user_info = self.json_from_response(response)
        projects = user_info.pop('projects')
        self.assertEqual(1, len(projects))
        project = projects.pop()

    def test_project_in_advisor(self):
        """New project should get advised if the user is in the experiment."""
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
        user_id = self.authenticate_new_user(email='foo@bayes.org')
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
        server.clear_cache()
        response = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"email":"foo@bayes.org"}, '
            '"featuresEnabled": {"advisor": "ACTIVE"}, '
            '"projects": [%s]}' % (user_id, json.dumps(project)),
            content_type='application/json')
        user_info = self.json_from_response(response)
        project = user_info['projects'][0]
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
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
        user_id = self.create_user()

        response2 = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"name": "very different"}}}',
            content_type='application/json')
        self.assertEqual(400, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._db.user.find()))

    def test_post_user_with_unknown_id(self):
        """Called with an unknown user ID the endpoint should return an error."""
        user_id = self.create_user()
        # Change the last digit.
        fake_user_id = user_id[:-1] + ('1' if user_id[-1:] != '1' else '0')

        response2 = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"city": {"name": "very different"}}}' % fake_user_id,
            content_type='application/json')
        self.assertEqual(404, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._db.user.find()))

    def test_post_user_changing_email(self):
        """It should not be possible to change the email as it is used for auth."""
        user_id = self.authenticate_new_user(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"email": "very-different@bar.fr"}}' % user_id,
            content_type='application/json')
        self.assertEqual(403, response2.status_code)
        self.assertEqual([user_id], list(str(u['_id']) for u in self._db.user.find()))

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
        user_id = self.authenticate_new_user(email='foo@bar.fr')
        response = self.app.post(
            '/api/user',
            data='{"userId": "%s", "profile": {"email":"foo@bar.fr"}, '
            '"projects": [%s]}' % (user_id, json.dumps(project)),
            content_type='application/json')
        # This is mostly a regression test: we used to trigger a 500 with this
        # scenario.
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

    def test_update(self):
        """Called with a user that has an ID should update it."""
        user_id = self.create_user(email='foo@bar.fr')

        response2 = self.app.post(
            '/api/user',
            data='{"profile": {"name": "very different", '
            '"email": "foo@bar.fr"}, "revision": 2, "userId": "%s"}' % user_id,
            content_type='application/json')
        user_info2 = self.json_from_response(response2)
        user_id2 = user_info2.pop('userId')
        user_info2.pop('registeredAt')
        self.assertEqual('very different', user_info2['profile']['name'])
        self.assertEqual(user_id, user_id2)
        self.assertEqual([user_id], [str(u['_id']) for u in self._db.user.find()])
        user_in_db = self.user_info_from_db(user_id)
        self.assertEqual('very different', user_in_db['profile']['name'])

    def test_update_revision(self):
        """Updating a user to an old revision does not work and return the new version."""
        user_id = self.create_user(email='foo@bar.fr')

        self.app.post(
            '/api/user',
            data='{"profile": {"name": "new name", '
            '"email": "foo@bar.fr"}, "revision": 15, "userId": "%s"}' % user_id,
            content_type='application/json')

        response = self.app.post(
            '/api/user',
            data='{"profile": {"name": "old name", '
            '"email": "foo@bar.fr"}, "revision": 10, "userId": "%s"}' % user_id,
            content_type='application/json')

        user_info = self.json_from_response(response)
        self.assertEqual('new name', user_info['profile'].get('name'))
        self.assertEqual(16, user_info['revision'])

    def test_create_project(self):
        """An ID and the timestamp should be added to a new project."""
        user_id = self.create_user(data={}, email='foo@bar.fr')
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
            '{"romeId": "A1234"}}, "mobility":{"city":{"departementId": "69"}}}],'
            '"profile":{"email":"foo@bar.fr"},"userId": "%s"}' % user_id,
            content_type='application/json')
        user_info2 = self.json_from_response(response)
        self.assertEqual(1, len(user_info2['projects']))
        project = user_info2['projects'].pop()
        self.assertEqual('0', project.get('projectId'))
        self.assertIn('createdAt', project)
        self.assertIn('source', project)
        self.assertEqual(
            84,
            project.get('localStats', {})
            .get('unemploymentDuration', {})
            .get('days'))
        self.assertEqual('PROJECT_MANUALLY_CREATED', project['source'])
        self.assertFalse(project.get('coverImageUrl'))

    def test_create_project_no_data(self):
        """A project with no backend data still gets some basic values."""
        user_id = self.create_user(data={}, email='foo@bar.fr')

        response = self.app.post(
            '/api/user', data='{"projects": [{"targetJob": {"jobGroup": '
            '{"romeId": "no-data"}}}], "profile":{"email":"foo@bar.fr"},"userId": "%s"}' % user_id,
            content_type='application/json')
        user_info2 = self.json_from_response(response)
        self.assertEqual(1, len(user_info2['projects']))
        project = user_info2['projects'].pop()
        self.assertIn('projectId', project)
        self.assertIn('createdAt', project)
        self.assertIn('source', project)
        self.assertEqual('PROJECT_MANUALLY_CREATED', project['source'])

    def test_unverified_data_zone_on_profile(self):
        """Called with a user in an unverified data zone."""
        self._db.unverified_data_zones.insert_one({
            '_id': hashlib.md5('12345:A1234'.encode('utf-8')).hexdigest(),
            'postcodes': '12345',
            'romeId': 'A1234',
        })
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"postcodes": "12345"}, '
            '"latestJob": {"jobGroup": {"romeId": "A1234"}}, '
            '"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
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
        user_id = self.create_user(email='foo@pole-emploi.fr')

        response = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"postcodes": "12345"}, '
            '"latestJob": {"jobGroup": {"romeId": "A1234"}}, '
            '"email": "foo@pole-emploi.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
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
        self._db.show_unverified_data_users.insert_one({'_id': 'foo@bar.fr'})
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"profile": {"city": {"postcodes": "12345"}, '
            '"latestJob": {"jobGroup": {"romeId": "A1234"}}, '
            '"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
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
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"projects": [{"targetJob": {"jobGroup": {"romeId": "A1234"}},'
            '"mobility": {"city": {"postcodes": "12345"}}}],'
            '"profile": {"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
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
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"projects": [{"targetJob": {"jobGroup": {"romeId": "A6789"}},'
            '"mobility": {"city": {"postcodes": "67890"}}}],'
            '"profile": {"city": {"postcodes": "12345"}, '
            '"latestJob": {"jobGroup": {"romeId": "A1234"}}, '
            '"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
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
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"projects": [{"targetJob": {"jobGroup": {"romeId": "A1234"}},'
            '"mobility": {"city": {"postcodes": "12345"}}}],'
            '"profile": {"city": {"postcodes": "67890"}, '
            '"latestJob": {"jobGroup": {"romeId": "A6789"}}, '
            '"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
        user_info = self.json_from_response(response)
        self.assertFalse(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertFalse(user_in_db.get('appNotAvailable'))

    def test_unverified_data_for_new_rome(self):
        """Called with a user with no latest job and a project in an unverified data zone."""
        user_id = self.create_user(email='foo@bar.fr')

        response = self.app.post(
            '/api/user',
            data='{"projects": [{"targetJob": {"jobGroup": {"romeId": "L1510"}},'
            '"mobility": {"city": {"postcodes": "12345"}}}],'
            '"profile": {"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
        user_info = self.json_from_response(response)
        self.assertTrue(user_info.get('appNotAvailable'))
        user_in_db = self.user_info_from_db(user_id)
        self.assertTrue(user_in_db.get('appNotAvailable'))


class ProjectRequirementsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/requirements endpoint."""

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


class ProjectAssociationsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../associations endpoint."""

    def setUp(self):
        super(ProjectAssociationsTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/associations' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_one_association(self):
        """Basic test with one association only."""
        self._db.associations.insert_one({'name': 'SNC'})
        response = self.app.get('/api/project/%s/%s/associations' % (self.user_id, self.project_id))

        associations = self.json_from_response(response)
        self.assertEqual({'associations': [{'name': 'SNC'}]}, associations)

    def test_filtered_associations(self):
        """Association not useful for this project is filtered."""
        self._db.associations.insert_many([
            {'name': 'Not a good one', 'filters': ['constant(0)']},
            {'name': 'Keep this one', 'filters': ['constant(1)']},
        ])
        response = self.app.get('/api/project/%s/%s/associations' % (self.user_id, self.project_id))

        associations = self.json_from_response(response)
        self.assertEqual(
            {'associations': [{'name': 'Keep this one', 'filters': ['constant(1)']}]},
            associations)

    def test_sorted_associations(self):
        """More specialized associations come first."""
        self._db.associations.insert_many([
            {'name': 'Specialized', 'filters': ['constant(2)']},
            {'name': 'Generic'},
            {'name': 'Very specialized', 'filters': ['constant(1)', 'constant(1)']},
        ])
        response = self.app.get('/api/project/%s/%s/associations' % (self.user_id, self.project_id))

        associations = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [j.get('name') for j in associations.get('associations', [])])


class ProjectEventsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../events endpoint."""

    def setUp(self):
        super(ProjectEventsTestCase, self).setUp()
        self.user_id = self.create_user(
            # TODO(pascal): Remove the email when events are available for all users.
            email='p@example.com', modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/events' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_events(self):
        """Basic test with no events."""
        response = self.app.get('/api/project/%s/%s/events' % (self.user_id, self.project_id))

        events = self.json_from_response(response)
        self.assertEqual({}, events)

    @mock.patch(server.now.__name__ + '.get')
    def test_with_events(self, mock_now):
        """Basic test with alpha user and constant events."""
        mock_now.return_value = datetime.datetime(2017, 8, 21)
        self._db.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

        response = self.app.get('/api/project/%s/%s/events' % (self.user_id, self.project_id))

        events = self.json_from_response(response)
        self.assertEqual(
            [
                'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'Le Salon du Travail et de la Mobilité Professionnelle',
            ],
            [e.get('title') for e in events.get('events')])

    @mock.patch(server.now.__name__ + '.get')
    def test_with_old_events(self, mock_now):
        """Basic test with alpha user and constant events, some being in the past."""
        mock_now.return_value = datetime.datetime(2017, 9, 17)
        self._db.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

        response = self.app.get('/api/project/%s/%s/events' % (self.user_id, self.project_id))

        events = self.json_from_response(response)
        self.assertEqual(
            ['Le Salon du Travail et de la Mobilité Professionnelle'],
            [e.get('title') for e in events.get('events')])


class ProjectJobBoardsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../jobboards endpoint."""

    def setUp(self):
        super(ProjectJobBoardsTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/jobboards' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_one_jobboard(self):
        """Basic test with one job board only."""
        self._db.jobboards.insert_one({'title': 'Indeed'})
        response = self.app.get('/api/project/%s/%s/jobboards' % (self.user_id, self.project_id))

        jobboards = self.json_from_response(response)
        self.assertEqual({'jobBoards': [{'title': 'Indeed'}]}, jobboards)

    def test_filtered_jobboards(self):
        """Job board not useful for this project is filtered."""
        self._db.jobboards.insert_many([
            {'title': 'Not a good one', 'filters': ['constant(0)']},
            {'title': 'Keep this one', 'filters': ['constant(1)']},
        ])
        response = self.app.get('/api/project/%s/%s/jobboards' % (self.user_id, self.project_id))

        jobboards = self.json_from_response(response)
        self.assertEqual(
            {'jobBoards': [{'title': 'Keep this one', 'filters': ['constant(1)']}]},
            jobboards)

    def test_sorted_jobboards(self):
        """More specialized job boards come first."""
        self._db.jobboards.insert_many([
            {'title': 'Specialized', 'filters': ['constant(2)']},
            {'title': 'Generic'},
            {'title': 'Very specialized', 'filters': ['constant(1)', 'constant(1)']},
        ])
        response = self.app.get('/api/project/%s/%s/jobboards' % (self.user_id, self.project_id))

        jobboards = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [j.get('title') for j in jobboards.get('jobBoards', [])])


class ProjectInterviewTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../interview-tips endpoint."""

    def setUp(self):
        super(ProjectInterviewTipsTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/interview-tips' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self):
        """Basic test with one quality and one improvement tip only."""
        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Google your interviewer', 'type': 'INTERVIEW_PREPARATION'},
        ])
        response = self.app.get(
            '/api/project/%s/%s/interview-tips' % (self.user_id, self.project_id))

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
            '/api/project/%s/%s/interview-tips' % (self.user_id, self.project_id))

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
            '/api/project/%s/%s/interview-tips' % (self.user_id, self.project_id))

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])


class ProjectResumeTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../resumet-ips endpoint."""

    def setUp(self):
        super(ProjectResumeTipsTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/resume-tips' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_two_tips(self):
        """Basic test with one quality and one improvement tip only."""
        self._db.application_tips.insert_many([
            {'content': 'Testing', 'type': 'QUALITY'},
            {'content': 'Re-read your CV', 'type': 'CV_IMPROVEMENT'},
        ])
        response = self.app.get('/api/project/%s/%s/resume-tips' % (self.user_id, self.project_id))

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
        response = self.app.get('/api/project/%s/%s/resume-tips' % (self.user_id, self.project_id))

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
        response = self.app.get('/api/project/%s/%s/resume-tips' % (self.user_id, self.project_id))

        tips = self.json_from_response(response)
        self.assertEqual(
            ['Very specialized', 'Specialized', 'Generic'],
            [t.get('content') for t in tips.get('qualities', [])])


class ProjectCommuteTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../commute endpoint."""

    def setUp(self):
        super(ProjectCommuteTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/commute' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_cities(self):
        """Basic test with no cities."""
        response = self.app.get('/api/project/%s/%s/commute' % (self.user_id, self.project_id))

        self.assertEqual({}, self.json_from_response(response))

    def test_lyon(self):
        """Cities available close to Lyon."""
        user_id = self.create_user(
            data={'projects': [{
                'mobility': {'city': {'cityId': '69123'}},
                'targetJob': {'jobGroup': {'romeId': 'A6789'}},
            }]})
        self._db.cities.insert_one({
            '_id': '69123',
            'name': 'Lyon',
            'longitude': 4.8363116,
            'latitude': 45.7640454,
            'population': 400000,
        })
        self._db.hiring_cities.insert_one({
            '_id': 'A6789',
            'hiringCities': [
                {
                    'offers': 10,
                    'city': {
                        'cityId': '69124',
                        'name': 'Brindas',
                        'longitude': 4.6965532,
                        'latitude': 45.7179675,
                        'population': 10000,
                    },
                },
                {
                    'offers': 40,
                    'city': {
                        'cityId': '69123',
                        'name': 'Lyon',
                        'longitude': 4.8363116,
                        'latitude': 45.7640454,
                        'population': 400000,
                    },
                },
            ],
        })
        user_info = self.get_user_info(user_id)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get('/api/project/%s/%s/commute' % (user_id, project_id))

        self.assertEqual(
            ['Brindas'],
            [m.get('name') for m in self.json_from_response(response).get('cities', [])])


class ProjectVolunteerTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../volunteer endpoint."""

    def setUp(self):
        super(ProjectVolunteerTestCase, self).setUp()
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/volunteer' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_missions(self):
        """Basic test with no missions."""
        response = self.app.get('/api/project/%s/%s/volunteer' % (self.user_id, self.project_id))

        self.assertEqual({}, self.json_from_response(response))

    def test_actual_missions(self):
        """Missions available."""
        user_id = self.create_user(
            data={'projects': [{'mobility': {'city': {'departementId': '75'}}}]})
        self._db.volunteering_missions.insert_one({
            '_id': '75',
            'missions': [
                {'title': 'Mission n°1'},
                {'title': 'Mission n°2'},
            ],
        })
        user_info = self.get_user_info(user_id)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get('/api/project/%s/%s/volunteer' % (user_id, project_id))

        self.assertEqual(
            ['Mission n°1', 'Mission n°2'],
            [m.get('title') for m in self.json_from_response(response).get('missions')])

    def test_global_missions(self):
        """Missions available both locally and globally."""
        user_id = self.create_user(
            data={'projects': [{'mobility': {'city': {'departementId': '75'}}}]})
        self._db.volunteering_missions.insert_many([
            {
                '_id': '',
                'missions': [
                    {'title': 'Global Mission'},
                ],
            },
            {
                '_id': '75',
                'missions': [
                    {'title': 'Mission n°1'},
                    {'title': 'Mission n°2'},
                ],
            },
        ])
        user_info = self.get_user_info(user_id)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get('/api/project/%s/%s/volunteer' % (user_id, project_id))

        missions = self.json_from_response(response).get('missions', [])
        self.assertEqual(
            ['Mission n°1', 'Mission n°2', 'Global Mission'],
            [m.get('title') for m in missions])
        self.assertEqual(
            [False, False, True],
            [m.get('isAvailableEverywhere', False) for m in missions])


class ProjectAdviceTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../advice/.../tips endpoint."""

    def setUp(self):
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
        self.user_id = self.create_user(modifiers=[_add_project], advisor=True)
        user_info = self.get_user_info(self.user_id)
        self.project_id = user_info['projects'][0]['projectId']
        user_info['projects'][0]['advices'][0]['status'] = 'ADVICE_ACCEPTED'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json'))

    def test_bad_project_id(self):
        """Test with a non existing project ID."""
        response = self.app.get('/api/project/%s/foo/advice/other-work-env/tips' % self.user_id)

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_bad_advice_id(self):
        """Test with a non existing project ID."""
        response = self.app.get(
            '/api/project/%s/%s/advice/unknown-advice/tips' % (
                self.user_id, self.project_id))

        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Conseil &quot;unknown-advice&quot; inconnu.',
            response.get_data(as_text=True))

    def test_get_tips(self):
        """Test with a non existing project ID."""
        response = self.app.get(
            '/api/project/%s/%s/advice/other-work-env/tips' % (
                self.user_id, self.project_id))
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)


class CacheClearEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the cache/clear endpoint."""

    def _get_requirements(self, job_group_id):
        response = self.app.post(
            '/api/project/requirements', data='{"targetJob":{"jobGroup":{'
            '"romeId":"%s"}}}' % job_group_id,
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

    def setUp(self):
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
        self.assertEqual(400, response.status_code)

    def test_create_export(self):
        """Standard usage.

        The time from the objectId is random, so it might sometimes happen that
        it is close to the current time, but with a low probability.
        """
        user_id = self.create_user([
            _add_project,
            _add_project,
            _add_chantier(0, 'c1'),
            _add_chantier(1, 'c2'),
        ])
        before = datetime.datetime.now()
        response = self.app.post('/api/dashboard-export/open/%s' % user_id)
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
        user_id = self.create_user([
            _add_project,
            _add_chantier(0, 'unknown-chantier-id'),
            _add_chantier(0, 'c1'),
        ])
        response = self.app.post('/api/dashboard-export/open/%s' % user_id)
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
            '/api/dashboard-export/%s' % not_existing_id, content_type='application/json')
        self.assertEqual(404, response.status_code)

    def test_retrieve_export_bad_id(self):
        """Test to get a 4xx error when ID is not well formatted."""
        not_existing_id = 'abc'
        response = self.app.get(
            '/api/dashboard-export/%s' % not_existing_id, content_type='application/json')
        self.assertEqual(400, response.status_code)

    def test_open_export(self):
        """Test basic usage of the endpoint to create and open a dashboard export."""
        user_id = self.create_user([
            _add_project,
            _add_project,
            _add_chantier(0, 'c1'),
            _add_chantier(1, 'c2'),
        ])
        creation_response = self.app.post('/api/dashboard-export/open/%s' % user_id)
        self.assertEqual(302, creation_response.status_code)
        self.assertRegex(
            creation_response.location,
            r'^http://localhost/historique-des-actions/[a-f0-9]+$')


class LikesEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user/likes endpoint."""

    def test_save_likes(self):
        """Test saving likes."""
        user_id = self.create_user()
        response = self.app.post(
            '/api/user/likes',
            data='{"userId": "%s", "likes": {"landing": 1, "dashboard": -1}}' % user_id,
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id)
        self.assertEqual({'landing': 1, 'dashboard': -1}, user_info.get('likes'))
        self.assertTrue(user_info.get('profile', {}).get('email'))

    def test_save_only_likes(self):
        """Test that saving likes does not save the gender."""
        user_id = self.create_user(data={'profile': {'gender': 'FEMININE'}})
        response = self.app.post(
            '/api/user/likes',
            data='{"userId": "%s", "likes": {"landing": 1}, '
            '"profile": {"gender": "MASCULINE"}}' % user_id,
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id)
        self.assertEqual({'landing': 1}, user_info.get('likes'))
        self.assertEqual('FEMININE', user_info.get('profile', {}).get('gender'))

    def test_missing_id(self):
        """Save likes without a user ID."""
        response = self.app.post(
            '/api/user/likes',
            data='{"likes": {"landing": 1, "dashboard": -1}}',
            content_type='application/json')
        self.assertEqual(400, response.status_code)

    def test_missing_user(self):
        """Save likes with the ID that does not correspond to any user."""
        user_id = self.create_user()
        # Change the last digit.
        fake_user_id = user_id[:-1] + ('1' if user_id[-1:] != '1' else '0')

        response = self.app.post(
            '/api/user/likes',
            data='{"userId": "%s", "likes": {"landing": 1, "dashboard": -1}}' % fake_user_id,
            content_type='application/json')
        self.assertEqual(404, response.status_code)

    def test_feature_with_dot(self):
        """Test saving a liked feature that has an ID with a "."."""
        user_id = self.create_user()
        response = self.app.post(
            '/api/user/likes',
            data='{"userId": "%s", "likes": {"landing.dashboard": -1}}' % user_id,
            content_type='application/json')
        self.assertEqual(422, response.status_code)


class MigrateAdvisorEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user/migrate-to-advisor endpoint."""

    def setUp(self):
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
        user_id = self.create_user([_add_project], advisor=False)
        response = self.app.post('/api/user/%s/migrate-to-advisor' % user_id)
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id)
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))

    def test_migrate_user_already_in_advisor(self):
        """Test a user migration for a user already in advisor."""
        user_id = self.create_user(advisor=True)
        response = self.app.post('/api/user/%s/migrate-to-advisor' % user_id)
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id)
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertEqual('ACTIVE', user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))

    def test_migrate_user_multiple_projects(self):
        """Test a migration for a user with multiple projects."""
        user_id = self.create_user([_add_project, _add_project], advisor=True)
        response = self.app.post('/api/user/%s/migrate-to-advisor' % user_id)
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id)
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


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
