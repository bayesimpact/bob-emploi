"""Base classes for tests of the server module."""
import binascii
import hashlib
import json
import unittest

import mock
import mongomock

from bob_emploi.frontend import server


def sha1(*args):
    """Compute the sha1 of the given args and return an hex string of it."""
    hasher = hashlib.sha1()
    for arg in args:
        hasher.update(arg.encode('utf-8'))
    return binascii.hexlify(hasher.digest()).decode('ascii')


class ServerTestCase(unittest.TestCase):
    """Base test case for class testing the server module."""

    def setUp(self):
        """Set up mock environment."""
        super(ServerTestCase, self).setUp()
        # Simulate a clean load of the modules.

        self.app = server.app.test_client()
        self._db = mongomock.MongoClient().get_database('test')
        server._DB = self._db  # pylint: disable=protected-access
        server._JOB_GROUPS_INFO.reset_cache()  # pylint: disable=protected-access
        server._CHANTIERS.reset_cache()  # pylint: disable=protected-access
        server.advisor._EMAIL_ACTIVATION_ENABLED = False  # pylint: disable=protected-access
        self._db.chantiers.insert_many([
            {'_id': 'c1', 'chantierId': 'c1'},
            {'_id': 'c2', 'chantierId': 'c2'},
            {'_id': 'c3', 'chantierId': 'c3'},
        ])
        self._db.action_templates.insert_many([
            {
                '_id': 'a%d' % i,
                'actionTemplateId': 'a%d' % i,
                'chantiers': ['c%d' % (i % 3 + 1)],
            }
            for i in range(30)])
        self._db.local_diagnosis.insert_one({
            '_id': '38:M1403',
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
            }
        })
        self._db.job_group_info.insert_many([
            {
                '_id': 'A1234',
                'romeId': 'A1234',
                'requirements': {
                    'extras': [{'name': 'foo'}],
                    'diplomas': [{'name': 'bar'}],
                    'skills': [
                        {
                            'name': 'Chaîne du froid',
                            'skill': {
                                'kind': 'THEORETICAL_SKILL',
                                'skillId': '1234',
                            },
                        },
                        {
                            'name': "Réaliser l'oeuvre et les finitions",
                            'skill': {
                                'kind': 'PRACTICAL_SKILL',
                                'skillId': '1235',
                            },
                        },
                    ],
                },
            },
        ])
        self._logging = mock.patch(server.__name__ + '.logging', spec=True)
        self._logging.start()

    def tearDown(self):
        super(ServerTestCase, self).tearDown()
        self._logging.stop()

    def authenticate_new_user(
            self, email='foo@bar.fr', first_name='Henry', last_name='Dupont', password='psswd'):
        """Authenticates a new user.

        Args:
            The email of the new user.
        Returns:
            Returns their user_id.
        """
        response = self.app.post(
            '/api/user/authenticate',
            data='{"email": "%s", "firstName": "%s", "lastName": "%s", "hashedPassword": "%s"}' % (
                email, first_name, last_name, sha1(email, password)),
            content_type='application/json')
        auth_response = json.loads(response.get_data(as_text=True))
        return auth_response['authenticatedUser']['userId']

    def user_login(self, email='foo@bar.fr', password='psswd'):
        """User login."""
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "%s"}' % email,
            content_type='application/json')
        auth_response = self.json_from_response(response)
        salt = auth_response['hashSalt']

        response2 = self.app.post(
            '/api/user/authenticate',
            data='{"email": "%s", "hashSalt": "%s", "hashedPassword": "%s"}' % (
                email, salt, sha1(salt, sha1(email, password))),
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        return auth_response2['authenticatedUser']

    def create_user(self, modifiers=None, data=None, email=None, advisor=True):
        """Creates a new user.

        Args:
            data: The user's data that will be sent to the server. Will default
                to a basic user: the caller should not expect this user to have
                any specific values, only that it's a valid user.
        Returns:
            the user's ID.
        """
        if email is None:
            email = 'foo%d@bar.fr' % (self._db.user.count())
        if not data:
            data = {
                'profile': {
                    'city': {
                        'name': 'foobar',
                        'departementName': 'Vienne',
                    },
                    'latestJob': {
                        'jobGroup': {
                            'romeId': 'M1403',
                            'name': 'Études et prospectives socio-économiques',
                        },
                        'name': 'Data scientist',
                        'codeOgr': '38972',
                    },
                },
            }
        if modifiers:
            for modifier in modifiers:
                modifier(data)

        server.ADVISOR_DISABLED_FOR_TESTING = not advisor

        # Create password.
        user_id = self.authenticate_new_user(email=email)

        data['userId'] = user_id
        data['profile'] = data.get('profile', {})
        data['profile']['email'] = data['profile'].get('email', email)
        response = self.app.post(
            '/api/user', data=json.dumps(data), content_type='application/json')
        self.assertEqual(200, response.status_code, response.get_data())

        server.ADVISOR_DISABLED_FOR_TESTING = False

        return user_id

    def create_user_that(self, predicate, num_tries=50, *args, **kwargs):
        """Creates a user that passes a predicate.

        Args:
            predicate: the predicate on the JSON-like dict to pass.
            num_tries: the number of creation attempt that we should try.
            args, kwargs: the parameters to send to the create_user method on
                each attempt.
        Returns:
            a user ID.
        Raises:
            AssertionError: if we could not create a user that passes the
            predicate in the given number of tries.
        """
        for unused_ in range(num_tries):
            user_id = self.create_user(*args, **kwargs)
            user_data = self._db.user.find_one({'_id': mongomock.ObjectId(user_id)})
            try:
                if predicate(user_data):
                    return user_id
            except KeyError:
                pass
        self.fail('Could not create a user that matches the predicate')  # pragma: no cover

    def json_from_response(self, response):
        """Parses the json returned in a response."""
        data_text = response.get_data(as_text=True)
        self.assertEqual(200, response.status_code, msg=data_text)
        return json.loads(data_text)

    def get_user_info(self, user_id):
        """Retrieve the user's data from the server."""
        user_req = self.app.get('/api/user/' + user_id)
        return self.json_from_response(user_req)

    def _refresh_action_plan(self, user_id, get_user_info=False):
        user_info = self.json_from_response(self.app.post(
            '/api/user/refresh-action-plan',
            data='{"userId": "%s"}' % user_id,
            content_type='application/json'))
        if get_user_info:
            return user_info
        return user_info['projects'][0].get('actions', [])

    def user_info_from_db(self, user_id):
        """Get user's info directly from DB without calling any endpoint."""
        user_info = self._db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertIn('_server', user_info)
        return {k: v for k, v in user_info.items() if not k.startswith('_')}
