"""Tests for the authentication endpoint of the server module using LinkedIn."""

from unittest import mock

import requests_mock

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test


@requests_mock.mock()
class AuthenticateEndpointLinkedInTest(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint using LinkedIn Auth."""

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_bad_code(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with a OAuth2 code that is not correct."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            status_code=400, text='Could not authenticate properly')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "wrong-code"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Could not authenticate properly', response.get_data(as_text=True))

        mock_logging.assert_called_once()

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_redirect_uri_mismatch(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with a redirect_uri that is not registered."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            status_code=400,
            json={'error': 'redirect_uri_mismatch', 'error_description': 'MISMATCH'})

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "wrong-code"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('MISMATCH', response.get_data(as_text=True))

        mock_logging.assert_called_once()
        self.assertEqual(
            ('redirect_uri_mismatch', 'MISMATCH "http://localhost/"'),
            mock_logging.call_args[0][2:],
        )

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_linked_in_server_fails(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with LinkedIn, but me request fails."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            status_code=400,
            text='Token outdated')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Token outdated', response.get_data(as_text=True))

        mock_logging.assert_called_once()

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_linked_in_server_email_fails(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with LinkedIn, but email request fails."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            status_code=200,
            json={
                'id': 'linked-in-user-id-1',
                'localizedFirstName': 'Cyrille',
                'localizedLastName': 'Corpet',
            })
        mock_requests.get(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            headers={'Authorization': 'Bearer 123456'},
            status_code=400,
            text='Token outdated')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Token outdated', response.get_data(as_text=True))

        mock_logging.assert_called_once()

    def test_new_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with LinkedIn for a new user."""

        def _match_correct_code(request: 'requests_mock._RequestObjectProxy') -> bool:
            return 'code=correct-code' in (request.text or '')

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            json={'access_token': '123456'}, additional_matcher=_match_correct_code)
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'id': 'linked-in-user-id-1',
                'localizedFirstName': 'Pascal',
                'localizedLastName': 'Corpet',
            })
        mock_requests.get(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            headers={'Authorization': 'Bearer 123456'},
            json={'handle~': {'emailAddress': 'pascal-linkedin@example.com'}})

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        user = auth_response['authenticatedUser']
        user_id = user['userId']
        self.assertEqual('linked-in-user-id-1', user.get('linkedInId'))
        self.assertTrue(user.get('hasAccount'))
        self.assertEqual('Pascal', user.get('profile', {}).get('name'))
        self.assertEqual('Corpet', user.get('profile', {}).get('lastName'))
        self.assertEqual('pascal-linkedin@example.com', user.get('profile', {}).get('email'))
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_new_user_with_existing_email(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a LinkedIn code for a new user using an existing email."""

        self.authenticate_new_user(email='pascal@linkedin.com', password='psswd')

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'id': 'linked-in-user-id-1',
                'localizedFirstName': 'Pascal',
                'localizedLastName': 'Corpet',
            })
        mock_requests.get(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            headers={'Authorization': 'Bearer 123456'},
            json={'handle~': {'emailAddress': 'pascal@linkedin.com'}})

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}', content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn(
            "L'utilisateur existe mais utilise un autre moyen de connexion: Email/Mot de passe.",
            response.get_data(as_text=True))

    def test_load_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request retrieves user."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'id': 'linked-in-user-id-1',
                'localizedFirstName': 'Pascal',
                'localizedLastName': 'Corpet',
            })
        mock_requests.get(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            headers={'Authorization': 'Bearer 123456'},
            json={'handle~': {'emailAddress': 'pascal-linkedin@example.com'}})

        # Create a new user.
        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}', content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again.
        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}', content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('linked-in-user-id-1', returned_user.get('linkedInId'))
        self.assertEqual(user_id, returned_user.get('userId'))

    def test_linkedin_account_for_guest_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request, add LinkedIn account to a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'id': 'linked-in-user-id-1',
                'localizedFirstName': 'Pascal',
                'localizedLastName': 'Corpet',
            })
        mock_requests.get(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            headers={'Authorization': 'Bearer 123456'},
            json={'handle~': {'emailAddress': 'pascal-linkedin@example.com'}})

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"linkedInCode": "correc-code", "userId": "{user_id}", '
            f'"authToken": "{auth_token}"}}',
            content_type='application/json')

        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('Lascap', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertFalse(auth_response['authenticatedUser']['profile'].get('lastName'))
        self.assertEqual(
            'pascal-linkedin@example.com', auth_response['authenticatedUser']['profile']['email'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('linked-in-user-id-1', auth_response['authenticatedUser']['linkedInId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])
