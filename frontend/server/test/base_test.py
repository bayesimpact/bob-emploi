"""Base classes for tests of the server module."""

import base64
import binascii
import hashlib
import json
import random
import typing
from typing import Any, Callable, Dict, List, Mapping, Optional, Tuple, Union
import unittest
from unittest import mock

import mongomock
import requests_mock
import werkzeug

from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import server


def sha1(*args: str) -> str:
    """Compute the sha1 of the given args and return an hex string of it."""

    hasher = hashlib.sha1()
    for arg in args:
        hasher.update(arg.encode('utf-8'))
    return binascii.hexlify(hasher.digest()).decode('ascii')


def add_project(user: Dict[str, Any]) -> None:
    """Modifier for a user proto that adds a new project.

    Callers should not rely on the actual values of the project, just that it's
    a valid project.
    """

    user['projects'] = user.get('projects', []) + [{
        'targetJob': {'jobGroup': {'romeId': random.choice(('A1234', 'B5678'))}},
        'city': {'cityId': random.choice(('31555', '69123',))},
    }]


def base64_encode(content: Union[str, bytes]) -> str:
    """Encode using base64."""

    if isinstance(content, bytes):
        content_as_bytes = content
    else:
        content_as_bytes = content.encode('utf-8')
    base64_encoded_as_bytes = base64.urlsafe_b64encode(content_as_bytes)
    base64_encoded = base64_encoded_as_bytes.decode('ascii', 'ignore')
    return base64_encoded.rstrip('=')


def _deep_merge_dict(source: Mapping[str, Any], destination: Dict[str, Any]) -> None:
    for key, value in source.items():
        if isinstance(value, dict):
            node = destination.setdefault(key, {})
            _deep_merge_dict(value, node)
        else:
            destination[key] = value


class ServerTestCase(unittest.TestCase):
    """Base test case for class testing the server module."""

    def setUp(self) -> None:
        """Set up mock environment."""

        super().setUp()
        # Simulate a clean load of the modules.

        self.app = server.app.test_client()
        self.app_context = typing.cast(
            Callable[[], typing.ContextManager[None]], server.app.app_context)
        cache.clear()
        patcher = mongomock.patch(on_new='create')
        patcher.start()
        self.addCleanup(patcher.stop)
        self._db, self._user_db, self._eval_db = server.mongo.get_connections_from_env()
        server.jobs._JOB_GROUPS_INFO.reset_cache()  # pylint: disable=protected-access
        self._db.action_templates.insert_many([
            {
                '_id': f'a{i:d}',
                'actionTemplateId': f'a{i:d}',
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
        logging_patch = mock.patch(server.__name__ + '.logging', spec=True)
        logging_patch.start()
        self.addCleanup(logging_patch.stop)

    def authenticate_new_user_token(
            self, email: str = 'foo@bar.fr', first_name: str = 'Henry',
            last_name: str = 'Dupont', password: str = 'psswd') -> Tuple[str, str]:
        """Authenticates a new user.

        Args:
            The email of the new user.
        Returns:
            Returns their user_id.
        """

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "{email}", "firstName": "{first_name}", "lastName": "{last_name}", '
            f'"hashedPassword": "{sha1(email, password)}"}}',
            content_type='application/json')
        auth_response = json.loads(response.get_data(as_text=True))
        return auth_response['authenticatedUser']['userId'], auth_response['authToken']

    def authenticate_new_user(self, *args: str, **kwargs: str) -> str:
        """Authenticates new user, calls authenticate_new_user_token."""

        return self.authenticate_new_user_token(*args, **kwargs)[0]

    def create_guest_user(
            self, first_name: str = 'Henry',
            modifiers: Optional[List[Callable[[Dict[str, Any]], None]]] = None,
            data: Optional[Dict[str, Any]] = None,
            auth_data: Optional[Dict[str, Any]] = None) -> Tuple[str, str]:
        """Creates a new guest user.

        Args:
            data: The user's data that will be sent to the server. Will default
                to a basic user: the caller should not expect this user to have
                any specific values, only that it's a valid user.
        Returns:
            the user's ID and an auth token.
        """

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
                    'name': first_name,
                },
            }
        if modifiers:
            for modifier in modifiers:
                modifier(data)

        # Create guest user with only auth data.
        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'firstName': first_name, 'userData': auth_data or {}}),
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']
        auth_token = auth_response['authToken']

        response = self.app.post(
            '/api/user', data=json.dumps(dict(data, **{'userId': user_id})),
            headers={'Authorization': 'Bearer ' + auth_token, 'Content-Type': 'application/json'})
        self.assertEqual(200, response.status_code, response.get_data())

        return user_id, auth_token

    def create_user_with_token(
            self,
            modifiers: Optional[List[Callable[[Dict[str, Any]], None]]] = None,
            data: Optional[Dict[str, Any]] = None,
            email: Optional[str] = None, advisor: bool = True,
            password: str = 'psswd') \
            -> Tuple[str, str]:
        """Creates a new user.

        Args:
            data: The user's data that will be sent to the server. Will default
                to a basic user: the caller should not expect this user to have
                any specific values, only that it's a valid user.
        Returns:
            the user's ID.
        """

        if email is None:
            email = f'foo{self._user_db.user.count_documents({}):d}@bar.fr'
        server.user.ADVISOR_DISABLED_FOR_TESTING = not advisor

        # Create password.
        user_id, auth_token = self.authenticate_new_user_token(email=email, password=password)
        registered_data = self.get_user_info(user_id, auth_token)
        if data:
            _deep_merge_dict(data, registered_data)
        if modifiers:
            for modifier in modifiers:
                modifier(registered_data)

        response = self.app.post(
            '/api/user', data=json.dumps(registered_data),
            headers={'Authorization': 'Bearer ' + auth_token, 'Content-Type': 'application/json'})
        self.assertEqual(200, response.status_code, response.get_data())

        server.user.ADVISOR_DISABLED_FOR_TESTING = False

        return user_id, auth_token

    def create_user(self, *args: Any, **kwargs: Any) -> str:
        """Creates a new user, calling create_user_with_token"""

        return self.create_user_with_token(*args, **kwargs)[0]

    def create_facebook_user_with_token(self, email: str) -> Tuple[str, str]:
        """Create a facebook user."""

        with requests_mock.mock() as mock_requests:
            mock_requests.get(
                'https://graph.facebook.com/v4.0/me?'
                'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
                json={
                    'id': '12345',
                    'email': email,
                })
            response = self.app.post(
                '/api/user/authenticate',
                data=json.dumps({'facebookAccessToken': 'my-custom-token'}),
                content_type='application/json')
        auth_response = self.json_from_response(response)
        return (
            auth_response.get('authenticatedUser', {}).get('userId', ''),
            auth_response.get('authToken', ''))

    def create_user_that(
            self, predicate: Callable[[Dict[str, Any]], bool],
            *args: Any, num_tries: int = 50, **kwargs: Any) \
            -> Tuple[str, str]:
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

    def json_from_response(self, response: werkzeug.Response) -> Dict[str, Any]:
        """Parses the json returned in a response."""

        data_text = response.get_data(as_text=True)
        self.assertEqual(200, response.status_code, msg=data_text)
        return typing.cast(Dict[str, Any], json.loads(data_text))

    def get_user_info(self, user_id: str, auth_token: Optional[str] = None) \
            -> Dict[str, Any]:
        """Retrieve the user's data from the server."""

        kwargs: Dict[str, Any] = {}
        if auth_token:
            kwargs['headers'] = {'Authorization': 'Bearer ' + auth_token}
        user_req = self.app.get('/api/user/' + user_id, **kwargs)
        return self.json_from_response(user_req)

    def user_info_from_db(self, user_id: str) -> Dict[str, Any]:
        """Get user's info directly from DB without calling any endpoint."""

        user_info = self._user_db.user.find_one({'_id': mongomock.ObjectId(user_id)})
        assert user_info
        self.assertIn('_server', user_info)
        return {k: v for k, v in user_info.items() if not k.startswith('_')}


def add_project_modifier(user: Dict[str, Any]) -> None:
    """Modifier to use in create_user_with_token to add a project."""

    user['projects'] = user.get('projects', []) + [{
        'targetJob': {'jobGroup': {'romeId': random.choice(('A1234', 'B5678'))}},
        'city': {'cityId': random.choice(('31555', '69123'))},
    }]
