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
from bob_emploi.frontend import scoring
from bob_emploi.frontend import server

# TODO(pascal): Split this smaller test modules.
# pylint: disable=too-many-lines

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
        'intensity': 'PROJECT_PRETTY_INTENSE',
    }]


def _clean_up_variable_flags(features_enabled):
    del_features = []
    for feature in features_enabled:
        for prefix in (
                'actionFeedbackModal', 'advisor', 'hideDiscoveryNav',
                'lbbIntegration', 'stickyActions', 'alpha', 'netPromoterScoreEmail'):
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

    @mock.patch(requests.__name__ + '.post')
    def test_feedback(self, mock_post):
        """Basic call to "/api/feedback"."""
        server.SLACK_FEEDBACK_URL = 'https://slack.example.com/url'
        response = self.app.post(
            '/api/feedback',
            data='{"userId": "my-user", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "source": "ADVICE_FEEDBACK"}',
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
        self.assertIn('\n> Aaaaaaaaaaaaawesome!\n> second line', text)
        self.assertIn(feedback_id, text, msg='Show the MongoDB ID of the feedback in slack')


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
        self.assertEqual(400, response.status_code)

    def test_delete_user_credential_mismatch_email(self):
        """Test trying user deletion without correct email."""
        user_info = {'profile': {'city': {'name': 'foobar'}}, 'projects': [{}]}
        user_id = self.create_user(data=user_info)
        response = self.app.delete(
            '/api/user',
            data='{"userId": "%s", "profile": {"email": "wrong@email.fr"}}' % user_id)
        self.assertEqual(403, response.status_code)

    def test_get_user(self):
        """Basic Usage of retrieving a user from DB."""
        user_info = {'profile': {'gender': 'FEMININE'}, 'projects': [{}]}
        user_id = self.create_user(data=user_info)
        user_info['userId'] = user_id

        user_info2 = self.get_user_info(user_info['userId'])
        self.assertIn('registeredAt', user_info2)
        user_info2.pop('registeredAt')
        self.assertIn('projects', user_info2)
        user_info2.pop('projects')
        user_info.pop('projects')
        user_info2.pop('featuresEnabled')
        self.assertEqual(user_info, user_info2)

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

    def test_sticky_action(self):
        """Populate the sticky action fields."""
        def _set_project_rome(user):
            user['projects'][0]['targetJob']['jobGroup']['romeId'] = 'A5678'
        user_id = self.create_user([
            _add_project, _set_project_rome, _add_chantier(0, 'c1')], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'sticky',
            'actionTemplateId': 'sticky',
            'title': 'foo',
            'goal': 'My goal',
            'stepIds': ['step1', 'step2'],
            'chantiers': ['c1'],
        })
        self._db.sticky_action_steps.insert_many([
            {
                '_id': 'step1',
                'title': 'First step',
                'link': 'http://www.google.com?search=%romeId',
            },
            {
                '_id': 'step2',
                'title': 'Second step',
            },
        ])
        server.clear_cache()

        actions = self._refresh_action_plan(user_id)
        self.assertEqual(['sticky'], [action.get('actionTemplateId') for action in actions])
        self.assertEqual('My goal', actions[0].get('goal'))
        self.assertEqual(
            ['First step', 'Second step'],
            [step.get('title') for step in actions[0].get('steps', [])])
        self.assertEqual(
            'http://www.google.com?search=A5678',
            actions[0]['steps'][0]['link'])

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

        project_actions = self._refresh_action_plan(user_id)
        self.assertEqual([], project_actions, msg='No actions generated for projects in Advisor')

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
            data='{"profile": {"city": {"name": "very different"}, '
            '"email": "foo@bar.fr"}, "userId": "%s"}' % user_id,
            content_type='application/json')
        user_info2 = self.json_from_response(response2)
        user_id2 = user_info2.pop('userId')
        user_info2.pop('registeredAt')
        self.assertEqual({'name': 'very different'}, user_info2['profile']['city'])
        self.assertEqual(user_id, user_id2)
        self.assertEqual([user_id], [str(u['_id']) for u in self._db.user.find()])
        user_in_db = self.user_info_from_db(user_id)
        self.assertEqual('very different', user_in_db['profile']['city']['name'])

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

    def test_stop_actions(self):
        """Complete stopped actions fields on save."""
        user_id = self.create_user(email='foo@bar.fr')
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'a1',
            'actionTemplateId': 'a1',
            'coolDownDurationDays': 7,
        })
        server.clear_cache()

        before = datetime.datetime.now()
        response = self.app.post(
            '/api/user', data='{"projects": [{"actions":['
            '{"status":"ACTION_UNREAD", "actionTemplateId": "a1"},'
            '{"status":"ACTION_CURRENT", "actionTemplateId": "a1"},'
            '{"status":"ACTION_DONE", "actionTemplateId": "a1"},'
            '{"status":"ACTION_SNOOZED", "actionTemplateId": "a1"},'
            '{"status":"ACTION_DECLINED", "actionTemplateId": "a1"}]}],'
            '"profile": {"email": "foo@bar.fr"},'
            '"userId": "%s"}' % user_id,
            content_type='application/json')
        after = datetime.datetime.now()
        user_info = self.json_from_response(response)
        actions = user_info['projects'][0]['actions']
        self.assertEqual([False, False, True, True, True], ['stoppedAt' in a for a in actions])
        for action in actions:
            if 'stoppedAt' not in action:
                continue
            self.assertGreaterEqual(action['stoppedAt'], before.isoformat(), msg=action)
            self.assertLessEqual(action['stoppedAt'], after.isoformat(), msg=action)
        self.assertEqual([False, False, True, True, False], ['endOfCoolDown' in a for a in actions])
        action_done = actions[2]
        self.assertGreater(action_done['endOfCoolDown'], after.isoformat())
        self.assertGreaterEqual(
            action_done['endOfCoolDown'], (before + datetime.timedelta(days=7)).isoformat())
        self.assertLessEqual(
            action_done['endOfCoolDown'], (after + datetime.timedelta(days=7)).isoformat())
        action_snoozed = actions[3]
        self.assertLessEqual(action_snoozed['endOfCoolDown'], after.isoformat())

    @mock.patch(server.__name__ + '.random.randint')
    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_on_next_day(self, mock_now, mock_randint):
        """Do not generate new actions just when actions are marked as done."""
        mock_randint.side_effect = lambda min_int, max_int: max_int
        mock_now.side_effect = datetime.datetime.now
        self._db.chantiers.insert_one({
            '_id': 'white',
            'chantierId': 'white',
            'kind': 'CORE_JOB_SEARCH',
        })
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([{
            '_id': 'a%d' % i,
            'chantiers': ['c1'],
            'actionTemplateId': 'a%d' % i,
        } for i in range(25)] + [{
            '_id': 'w%d' % i,
            'chantiers': ['white'],
            'actionTemplateId': 'w%d' % i,
        } for i in range(25)])
        server.clear_cache()
        user_id = self.create_user([_add_project, _add_chantier(0, 'c1')], advisor=False)
        user_info = self._refresh_action_plan(user_id, get_user_info=True)
        initial_actions = user_info['projects'][0]['actions']

        # Mark 1 white action and 1 other action done.
        white_action = next(
            a for a in initial_actions if a['actionTemplateId'].startswith('w'))
        white_action['status'] = 'ACTION_DONE'
        other_action = next(
            a for a in initial_actions if not a['actionTemplateId'].startswith('w'))
        other_action['status'] = 'ACTION_DONE'
        response = self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json')

        user_info_after = self.json_from_response(response)
        self.assertEqual([], user_info_after['projects'][0].get('pastActions', []))
        self.assertEqual(len(initial_actions), len(user_info_after['projects'][0]['actions']))

        # One day later.
        mock_now.side_effect = None
        mock_now.return_value = datetime.datetime.now() + datetime.timedelta(hours=25)

        user_info_next_day = self._refresh_action_plan(user_id, get_user_info=True)
        actions = user_info_next_day['projects'][0]['actions']
        self.assertGreaterEqual(len(actions), 3, msg=actions)
        self.assertLessEqual(len(actions), 4, msg=actions)
        past_actions = user_info_next_day['projects'][0]['pastActions']
        self.assertEqual(
            set(a['actionId'] for a in initial_actions),
            set(a['actionId'] for a in past_actions))

    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_same_day(self, mock_now):
        """Test that we do not generate new actions on the same day."""
        mock_now.return_value = datetime.datetime(2016, 11, 26, 14, 0, 0)
        user_id = self.create_user([_add_project, _add_chantier(0, 'c1')])
        initial_actions = self._refresh_action_plan(user_id)
        # The same day, at 20:00.
        mock_now.return_value = datetime.datetime(2016, 11, 26, 20, 0, 0)
        actions = self._refresh_action_plan(user_id)
        self.assertEqual(initial_actions, actions)

    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_at_night(self, mock_now):
        """Test that we do not generate new actions before 3am the next day."""
        mock_now.return_value = datetime.datetime(2016, 11, 26, 14, 0, 0)
        user_id = self.create_user([_add_project, _add_chantier(0, 'c1')])
        initial_actions = self._refresh_action_plan(user_id)
        # The next day, at 2:00.
        mock_now.return_value = datetime.datetime(2016, 11, 27, 2, 0, 0)
        actions = self._refresh_action_plan(user_id)
        self.assertEqual(initial_actions, actions)

    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_at_late_night(self, mock_now):
        """Test that we generate new actions after 3am the next day."""
        mock_now.return_value = datetime.datetime(2016, 11, 26, 14, 0, 0)
        user_id = self.create_user([_add_project, _add_chantier(0, 'c1')], advisor=False)
        initial_actions = self._refresh_action_plan(user_id)
        # The next day, at 2:00.
        mock_now.return_value = datetime.datetime(2016, 11, 27, 4, 0, 0)
        actions = self._refresh_action_plan(user_id)
        self.assertNotEqual(initial_actions, actions)

    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_at_night_next_day(self, mock_now):
        """Test that we generate new actions at night if more than 24 hours."""
        mock_now.return_value = datetime.datetime(2016, 11, 26, 14, 0, 0)
        user_id = self.create_user([_add_project, _add_chantier(0, 'c1')], advisor=False)
        initial_actions = self._refresh_action_plan(user_id)
        # Two days later, at 2:00.
        mock_now.return_value = datetime.datetime(2016, 11, 28, 2, 0, 0)
        actions = self._refresh_action_plan(user_id)
        self.assertNotEqual(initial_actions, actions)

    @mock.patch(server.__name__ + '.random.randint')
    @mock.patch(now.__name__ + '.get')
    def test_generate_actions_on_next_day_login(self, mock_now, mock_randint):
        """Generate new actions when logging in the next day."""
        mock_randint.side_effect = lambda min_int, max_int: max_int
        mock_now.side_effect = datetime.datetime.now
        self._db.chantiers.insert_one({
            '_id': 'white',
            'chantierId': 'white',
            'kind': 'CORE_JOB_SEARCH',
        })
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([{
            '_id': 'a%d' % i,
            'chantiers': ['c1'],
            'actionTemplateId': 'a%d' % i,
        } for i in range(25)] + [{
            '_id': 'w%d' % i,
            'chantiers': ['white'],
            'actionTemplateId': 'w%d' % i,
        } for i in range(25)])
        server.clear_cache()
        user_id = self.create_user(
            [_add_project, _add_chantier(0, 'c1')], email='nextday@log.in', advisor=False)
        user_info = self._refresh_action_plan(user_id, get_user_info=True)
        initial_actions = user_info['projects'][0]['actions']

        # Mark 1 white action and 1 other action done.
        white_action = next(
            a for a in initial_actions if a['actionTemplateId'].startswith('w'))
        white_action['status'] = 'ACTION_DONE'
        other_action = next(
            a for a in initial_actions if not a['actionTemplateId'].startswith('w'))
        other_action['status'] = 'ACTION_DONE'
        self.app.post('/api/user', data=json.dumps(user_info), content_type='application/json')

        # One day later.
        mock_now.side_effect = None
        mock_now.return_value = datetime.datetime.now() + datetime.timedelta(hours=25)

        user_info_next_day = self._refresh_action_plan(user_id, get_user_info=True)
        self.assertEqual(user_id, user_info_next_day.get('userId'))
        actions = user_info_next_day['projects'][0]['actions']
        self.assertGreaterEqual(len(actions), 3, msg=actions)
        self.assertLessEqual(len(actions), 4, msg=actions)
        past_actions = user_info_next_day['projects'][0]['pastActions']
        self.assertEqual(
            set(a['actionId'] for a in initial_actions),
            set(a['actionId'] for a in past_actions))

    @mock.patch(server.__name__ + '.random.randint')
    def test_actions_priority_level(self, mock_randint):
        """Add actions with higher priority level first."""
        mock_randint.return_value = 4
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
        ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([
            {
                '_id': 'd%d' % i,
                'actionTemplateId': 'd%d' % i,
                'chantiers': ['c1'],
                'priorityLevel': 1,
            }
            for i in range(1, 3)] + [{
                '_id': 'e%d' % i,
                'actionTemplateId': 'e%d' % i,
                'chantiers': ['c1'],
                'priorityLevel': 2,
            } for i in range(1, 3)] + [{
                '_id': 'd42',
                'actionTemplateId': 'd42',
                'chantiers': ['c1'],
            }])
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)

        self.assertEqual(4, len(project_actions), msg=project_actions)
        self.assertEqual(
            ['e1', 'e2'],
            sorted(a.get('actionTemplateId') for a in project_actions[:2]))
        self.assertEqual(
            ['d1', 'd2'],
            sorted(a.get('actionTemplateId') for a in project_actions[2:]))

    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_CLIENT_ID')
    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_SECRET')
    @mock.patch(server.__name__ + '.action.companies.emploi_store.Client')
    def test_lbb_action(self, mock_es_client, unused_mock_secret, unused_mock_client_id):
        """Add an action using the LBB integration."""
        def _set_project_city(user):
            user['projects'][0]['mobility']['city']['cityId'] = '69123'
        user_id = self.create_user_that(
            lambda user_data: user_data['featuresEnabled']['lbbIntegration'] == 'ACTIVE',
            modifiers=[
                _add_project,
                _add_chantier(0, 'c1'),
                _set_project_city,
            ],
            advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'lbb',
            'actionTemplateId': 'lbb',
            'chantiers': ['c1'],
            'specialGenerator': 'LA_BONNE_BOITE',
            'title': 'Essayer une entreprise',
        })
        server.clear_cache()
        mock_es_client().get_lbb_companies.return_value = iter([{
            'name': 'Bayes Impact',
            'siret': '12345',
            'city': 'Lyon',
            'naf_text': 'Startup caritative',
            'headcount_text': '5 à 10 salariés',
            'stars': 2.0,
        }])
        mock_es_client.reset_mock()
        project_actions = self._refresh_action_plan(user_id)

        self.assertEqual(['lbb'], [a.get('actionTemplateId') for a in project_actions])
        self.assertEqual(
            "Essayer l'entreprise : Bayes Impact (Lyon)",
            project_actions[0].get('title'))
        self.assertEqual(
            'Bayes Impact',
            project_actions[0].get('applyToCompany', {}).get('name'))
        self.assertEqual(
            'Startup caritative',
            project_actions[0].get('applyToCompany', {}).get('activitySectorName'))
        self.assertEqual(3, project_actions[0].get('applyToCompany', {}).get('hiringPotential'))
        self.assertEqual('69123', mock_es_client().get_lbb_companies.call_args[1]['city_id'])

    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_CLIENT_ID')
    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_SECRET')
    @mock.patch(server.__name__ + '.action.companies.emploi_store.Client')
    def test_lbb_action_not_in_experiment(
            self, mock_es_client, unused_mock_secret, unused_mock_client_id):
        """Add an action without the LBB integration."""
        user_id = self.create_user_that(
            lambda user_data: user_data['featuresEnabled']['lbbIntegration'] != 'ACTIVE',
            modifiers=[
                _add_project,
                _add_chantier(0, 'c1'),
            ],
            advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'lbb',
            'actionTemplateId': 'lbb',
            'chantiers': ['c1'],
            'specialGenerator': 'LA_BONNE_BOITE',
        })
        server.clear_cache()
        mock_es_client().get_lbb_companies.return_value = iter([{
            'name': 'Bayes Impact',
            'siret': '12345',
            'city': 'Lyon',
            'naf_text': 'Startup caritative',
            'headcount_text': '5 à 10 salariés',
        }])
        mock_es_client.reset_mock()

        project_actions = self._refresh_action_plan(user_id)

        self.assertEqual(['lbb'], [a.get('actionTemplateId') for a in project_actions])
        self.assertFalse(project_actions[0].get('applyToCompany'))
        self.assertFalse(mock_es_client.called)

    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_CLIENT_ID')
    @mock.patch(server.__name__ + '.action.companies._EMPLOI_STORE_DEV_SECRET')
    @mock.patch(server.__name__ + '.action.companies.emploi_store.Client')
    def test_lbb_action_dupes(self, mock_es_client, unused_mock_secret, unused_mock_client_id):
        """Add two actions using the LBB integration with different companies."""
        def _set_project_city(user):
            user['projects'][0]['mobility']['city']['cityId'] = '69123'
        user_id = self.create_user_that(
            lambda user_data: user_data['featuresEnabled']['lbbIntegration'] == 'ACTIVE',
            modifiers=[
                _add_project,
                _add_chantier(0, 'c1'),
                _set_project_city,
                _add_action(0, 'c1', actions_field='pastActions', **{
                    'applyToCompany': {'siret': '12345'}}),
            ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'lbb',
            'actionTemplateId': 'lbb',
            'chantiers': ['c1'],
            'specialGenerator': 'LA_BONNE_BOITE',
        })
        server.clear_cache()
        mock_es_client().get_lbb_companies.return_value = iter([
            {
                'name': 'Bayes Impact',
                'siret': '12345',
                'city': 'Lyon',
                'naf_text': 'Startup caritative',
                'headcount_text': '5 à 10 salariés',
            },
            {
                'name': 'Liberté Living Lab',
                'siret': '67890',
                'city': 'Paris',
                'naf_text': 'Coworking',
                'headcount_text': '5 à 10 salariés',
            },
        ])
        mock_es_client.reset_mock()
        project_actions = self._refresh_action_plan(user_id)

        self.assertEqual(
            'Liberté Living Lab',
            project_actions[0].get('applyToCompany', {}).get('name'))

    def test_link_action_template(self):
        """Use vars in links."""

        def _update_user(user):
            project = user['projects'][0]
            project['targetJob']['jobGroup']['romeId'] = 'A1234'
            project['mobility']['city']['departementId'] = '69'

        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
            _update_user,
        ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'a',
            'actionTemplateId': 'a',
            'link': 'http://go/to/%departementId/%romeId',
            'chantiers': ['c1'],
        })
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)

        self.assertEqual(
            'http://go/to/69/A1234', project_actions[0].get('link'), msg=project_actions)

    def test_avoid_current_action_templates(self):
        """Avoid generating an action when the same one is already current."""
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
            _add_action(0, 'd1', status='ACTION_UNREAD'),
        ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([
            {
                '_id': 'd1',
                'actionTemplateId': 'd1',
                'chantiers': ['c1'],
            },
        ])
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)
        self.assertFalse(project_actions)

    def test_avoid_sticky_action_templates(self):
        """Avoid generating an action when the same one is already sticky."""
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
            _add_action(0, 'd1', status='ACTION_STUCK', actions_field='stickyActions'),
        ])
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([
            {
                '_id': 'd1',
                'actionTemplateId': 'd1',
                'chantiers': ['c1'],
            },
        ])
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)
        self.assertFalse(project_actions)

    def test_block_during_cool_down_time(self):
        """Block an action generation when an action has just been done."""
        yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
        tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
            _add_action(
                0, 'd1', status='ACTION_DONE',
                stoppedAt=yesterday.isoformat()+'Z',
                endOfCoolDown=tomorrow.isoformat()+'Z',
                actions_field='pastActions'),
        ])
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'd1',
            'actionTemplateId': 'd1',
            'chantiers': ['c1'],
        })
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)
        self.assertEqual([], project_actions)

    def test_unblock_after_cool_down_time(self):
        """Generate an action after the end of the cool down time."""
        yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
            _add_action(
                0, 'd1', status='ACTION_DONE',
                stoppedAt=yesterday.isoformat()+'Z',
                endOfCoolDown=yesterday.isoformat()+'Z',
                actions_field='pastActions'),
        ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            '_id': 'd1',
            'actionTemplateId': 'd1',
            'chantiers': ['c1'],
        })
        server.clear_cache()
        project_actions = self._refresh_action_plan(user_id)
        self.assertEqual(['d1'], [a.get('actionTemplateId') for a in project_actions])

    @mock.patch(scoring.__name__ + '.filter_using_score')
    def test_filtered_action_templates(self, mock_filter_using_score):
        """Do not generate actions filtered out by the scoring module."""
        user_id = self.create_user(modifiers=[
            _add_project,
            _add_chantier(0, 'c1'),
        ], advisor=False)
        self._db.action_templates.drop()
        self._db.action_templates.insert_many([
            {
                '_id': 'd1',
                'actionTemplateId': 'd1',
                'chantiers': ['c1'],
                'filters': ['foo', 'bar'],
            },
        ])
        server.clear_cache()

        mock_filter_using_score.return_value = iter([])

        project_actions = self._refresh_action_plan(user_id)
        self.assertEqual([], project_actions)

        self.assertGreaterEqual(mock_filter_using_score.call_count, 1)
        call_args = mock_filter_using_score.call_args[0]
        self.assertEqual(['d1'], [t.action_template_id for t in call_args[0]])
        self.assertEqual(['foo', 'bar'], call_args[1](call_args[0][0]))

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


class ProjectJobBoardsTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../jobboards endpoint."""

    def setUp(self):
        super(ProjectJobBoardsTipsTestCase, self).setUp()
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
        after = datetime.datetime.now()
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
