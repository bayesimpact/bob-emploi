"""Tests for the Facebook authentication."""

import json
import unittest

import requests_mock

from bob_emploi.frontend.server.test import base_test


@requests_mock.mock()
class AuthenticateEndpointFacebookTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint using the Facebook auth."""

    def test_bad_token(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a bad facebook auth token."""

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?access_token=wrong-token',
            status_code=400,
            json={'error': {
                'message': 'The access token could not be decrypted',
                'type': 'OAuthException',
                'code': 190,
                'fbtrace_id': 'ACJZTGaX5oFtJBGTYW_WYcP',
            }})
        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookAccessToken": "wrong-token"}',
            content_type='application/json')
        self.assertEqual(400, response.status_code, msg=response.get_data(as_text=True))
        self.assertIn('The access token could not be decrypted', response.get_data(as_text=True))

    def test_old_token(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with an old facebook auth token."""

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?access_token=old-token',
            status_code=400,
            json={'error': {
                'message': 'Error validating access token: Session has expired.',
                'type': 'OAuthException',
                'code': 190,
                'error_subcode': 463,
                'fbtrace_id': 'ArfcR_p3qHlsGMyjOl7ITL1',
            }})
        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookAccessToken": "old-token"}',
            content_type='application/json')
        self.assertEqual(400, response.status_code)
        self.assertIn('Session has expired', response.get_data(as_text=True))

    def test_new_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a facebook token for a new user."""

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '12345',
                'first_name': 'Pascal',
                'email': 'pascal@example.com',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'facebookAccessToken': 'my-custom-token'}),
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertEqual(
            'Pascal',
            auth_response['authenticatedUser'].get('profile', {}).get('name'))
        self.assertEqual(
            'pascal@example.com',
            auth_response['authenticatedUser'].get('profile', {}).get('email'))
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        user_id = auth_response['authenticatedUser']['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_new_user_with_existing_email(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a facebook token for a new user using an existing email."""

        user_id = self.authenticate_new_user(email='pascal@facebook.com', password='psswd')
        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '12345',
                'first_name': 'Pascal',
                'email': 'pascal@facebook.com',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'facebookAccessToken': 'my-custom-token'}),
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])

    def test_load_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request retrieves user."""

        # Create a Facebook user.
        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '13579',
                'first_name': 'Pascal',
                'email': 'pascal@example.com',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'facebookAccessToken': 'my-custom-token'}),
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again with a different token.
        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-other-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '13579',
                'first_name': 'Pascal',
                'email': 'pascal@example.com',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'facebookAccessToken': 'my-other-token'}),
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('13579', returned_user.get('facebookId'))
        self.assertEqual(user_id, returned_user.get('userId'))

    def test_facebook_account_for_guest_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request add a facebook account for a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Pascal')

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '12345',
                'first_name': 'Pascal',
                'email': 'foo@bar.fr',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookAccessToken": "my-custom-token",'
            f'"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response.get('isNewUser'))
        self.assertEqual('Pascal', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertEqual('foo@bar.fr', auth_response['authenticatedUser']['profile'].get('email'))
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])

    def test_facebook_with_existing_email_for_guest_user(
            self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request to add a facebook account for a guest user with a pre-existing email."""

        self.authenticate_new_user(email='pascal@facebook.com', password='psswd')

        user_id, auth_token = self.create_guest_user(first_name='Pascal')

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={
                'id': '12345',
                'first_name': 'Pascal',
                'email': 'pascal@facebook.com',
            })
        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookAccessToken": "my-custom-token",'
            f'"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])

    def test_facebook_for_guest_user_no_email(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request add a facebook account without the email for a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Pascal')

        mock_requests.get(
            'https://graph.facebook.com/v4.0/me?'
            'access_token=my-custom-token&fields=id%2Cfirst_name%2Cemail',
            json={'id': '12345'})
        self.json_from_response(self.app.post(
            '/api/user/authenticate',
            data='{"facebookAccessToken": "my-custom-token",'
            f'"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json'))

        # OK the user was created without an email. Now add an email:
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('Pascal', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])


if __name__ == '__main__':
    unittest.main()
