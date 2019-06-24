"""Base classes for tests of the server module."""

import binascii
import hashlib
import json
import random
import typing
import unittest
from unittest import mock

import flask
import mongomock

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import server


def sha1(*args: str) -> str:
    """Compute the sha1 of the given args and return an hex string of it."""

    hasher = hashlib.sha1()
    for arg in args:
        hasher.update(arg.encode('utf-8'))
    return binascii.hexlify(hasher.digest()).decode('ascii')


def add_project(user: typing.Dict[str, typing.Any]) -> None:
    """Modifier for a user proto that adds a new project.

    Callers should not rely on the actual values of the project, just that it's
    a valid project.
    """

    user['projects'] = user.get('projects', []) + [{
        'targetJob': {'jobGroup': {'romeId': random.choice(('A1234', 'B5678'))}},
        'city': {'cityId': random.choice(('31555', '69123',))},
    }]


class ServerTestCase(unittest.TestCase):
    """Base test case for class testing the server module."""

    def setUp(self) -> None:
        """Set up mock environment."""

        super().setUp()
        # Simulate a clean load of the modules.

        self.app = server.app.test_client()
        proto.clear_mongo_fetcher_cache()
        self._db = mongomock.MongoClient().get_database('test')
        server.app.config['DATABASE'] = self._db
        server._DB = self._db  # pylint: disable=protected-access
        self._user_db = mongomock.MongoClient().get_database('user_test')
        server.app.config['USER_DATABASE'] = self._user_db
        server._USER_DB = self._user_db  # pylint: disable=protected-access
        self._eval_db = mongomock.MongoClient().get_database('eval_test')
        server._EVAL_DB = self._eval_db  # pylint: disable=protected-access
        server.app.config['EVAL_DATABASE'] = self._eval_db
        server.jobs._JOB_GROUPS_INFO.reset_cache()  # pylint: disable=protected-access
        self._db.action_templates.insert_many([
            {
                '_id': 'a{:d}'.format(i),
                'actionTemplateId': 'a{:d}'.format(i),
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
        self._logging = mock.patch(server.__name__ + '.logging', spec=True)
        self._logging.start()

    def tearDown(self) -> None:
        super().tearDown()
        self._logging.stop()

    def authenticate_new_user_token(
            self, email: str = 'foo@bar.fr', first_name: str = 'Henry',
            last_name: str = 'Dupont', password: str = 'psswd') \
            -> typing.Tuple[str, str]:
        """Authenticates a new user.

        Args:
            The email of the new user.
        Returns:
            Returns their user_id.
        """

        response = self.app.post(
            '/api/user/authenticate',
            data='{{"email": "{}", "firstName": "{}", "lastName": "{}", "hashedPassword": "{}"}}'
            .format(email, first_name, last_name, sha1(email, password)),
            content_type='application/json')
        auth_response = json.loads(response.get_data(as_text=True))
        return auth_response['authenticatedUser']['userId'], auth_response['authToken']

    def authenticate_new_user(self, *args: str, **kwargs: str) -> str:
        """Authenticates new user, calls authenticate_new_user_token."""

        return self.authenticate_new_user_token(*args, **kwargs)[0]

    def create_user_with_token(
            self,
            modifiers: typing.Optional[typing.List[
                typing.Callable[[typing.Dict[str, typing.Any]], None]]] = None,
            data: typing.Optional[typing.Dict[str, typing.Any]] = None,
            email: typing.Optional[str] = None, advisor: bool = True,
            password: str = 'psswd') \
            -> typing.Tuple[str, str]:
        """Creates a new user.

        Args:
            data: The user's data that will be sent to the server. Will default
                to a basic user: the caller should not expect this user to have
                any specific values, only that it's a valid user.
        Returns:
            the user's ID.
        """

        if email is None:
            email = 'foo{:d}@bar.fr'.format(self._user_db.user.count())
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
        user_id, auth_token = self.authenticate_new_user_token(email=email, password=password)

        response = self.app.post(
            '/api/user', data=json.dumps(dict(data, **{
                'profile': dict(data.get('profile', {}), email=email),
                'userId': user_id,
            })),
            headers={'Authorization': 'Bearer ' + auth_token, 'Content-Type': 'application/json'})
        self.assertEqual(200, response.status_code, response.get_data())

        server.ADVISOR_DISABLED_FOR_TESTING = False

        return user_id, auth_token

    def create_user(self, *args: typing.Any, **kwargs: typing.Any) -> str:
        """Creates a new user, calling create_user_with_token"""

        return self.create_user_with_token(*args, **kwargs)[0]

    def create_user_that(
            self, predicate: typing.Callable[[typing.Dict[str, typing.Any]], bool],
            *args: typing.Any, num_tries: int = 50, **kwargs: typing.Any) \
            -> typing.Tuple[str, str]:
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
            user_id, auth_token = self.create_user_with_token(*args, **kwargs)
            user_data = self.get_user_info(user_id, auth_token)
            try:
                if predicate(user_data):
                    return user_id, auth_token
            except KeyError:
                pass
        self.fail('Could not create a user that matches the predicate')

    def json_from_response(self, response: flask.Response) -> typing.Dict[str, typing.Any]:
        """Parses the json returned in a response."""

        data_text = response.get_data(as_text=True)
        self.assertEqual(200, response.status_code, msg=data_text)
        return typing.cast(typing.Dict[str, typing.Any], json.loads(data_text))

    def get_user_info(self, user_id: str, auth_token: typing.Optional[str] = None) \
            -> typing.Dict[str, typing.Any]:
        """Retrieve the user's data from the server."""

        kwargs: typing.Dict[str, typing.Any] = {}
        if auth_token:
            kwargs['headers'] = {'Authorization': 'Bearer ' + auth_token}
        user_req = self.app.get('/api/user/' + user_id, **kwargs)
        return self.json_from_response(user_req)

    def user_info_from_db(self, user_id: str) -> typing.Dict[str, typing.Any]:
        """Get user's info directly from DB without calling any endpoint."""

        user_info = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        self.assertIn('_server', user_info)
        return {k: v for k, v in user_info.items() if not k.startswith('_')}


def add_project_modifier(user: typing.Dict[str, typing.Any]) -> None:
    """Modifier to use in create_user_with_token to add a project."""

    user['projects'] = user.get('projects', []) + [{
        'targetJob': {'jobGroup': {'romeId': random.choice(('A1234', 'B5678'))}},
        'city': {'cityId': random.choice(('31555', '69123'))},
    }]
