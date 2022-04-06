"""Tests for the Google authentication."""

import unittest
from unittest import mock


from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test


@mock.patch(server.__name__ + '.auth.id_token.verify_oauth2_token')
class AuthenticateEndpointGoogleTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    def test_bad_token(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Auth request with a bad google token."""

        mock_verify_oauth2_token.side_effect = ValueError('foo bar')
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "wrong-token"}',
            content_type='application/json')
        self.assertEqual(401, response.status_code)
        self.assertIn(
            'Mauvais jeton d&#x27;authentification\xa0: foo bar',
            response.get_data(as_text=True))

    def test_new_user(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Auth request, create a new user on the first time."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')

        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        self.assertEqual('pascal@bayes.org', auth_response['authenticatedUser']['profile']['email'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('12345', auth_response['authenticatedUser']['googleId'])
        self.assertFalse(auth_response['authenticatedUser'].get('hasPassword'))
        user_id = auth_response['authenticatedUser']['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_when_user_already_exists(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """The user had previously signed up via email registration."""

        # Sign up via email registration.
        user_id = self.authenticate_new_user(email='used@email.fr', password='psswd')

        # Log in with Google SSO with the same email.
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'used@email.fr',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])
        self.assertEqual('12345', auth_response['authenticatedUser']['googleId'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasPassword'))
        user_info = self.user_info_from_db(user_id)
        self.assertEqual('12345', user_info['googleId'])

    def test_when_user_already_exists_with_facebook(
            self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """The user had previously signed up via Facebook registration."""

        # Sign up via email registration.
        user_id, unused_ = self.create_facebook_user_with_token(email='used@email.fr')

        # Log in with Google SSO with the same email.
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'used@email.fr',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])
        self.assertEqual('12345', auth_response['authenticatedUser']['googleId'])
        self.assertTrue(auth_response['authenticatedUser']['facebookId'])
        user_info = self.user_info_from_db(user_id)
        self.assertEqual('12345', user_info['googleId'])
        self.assertTrue(user_info['facebookId'])

    def test_email_address_change(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Change the email address of a Google SSO user."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']
        auth_token = auth_response['authToken']

        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "googleId": "12345", '
            '"profile": {"email": "valid@email.fr"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    def test_email_address_change_invalid(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Change the email address of a Google SSO user to invalid email."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']
        auth_token = auth_response['authToken']

        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "googleId": "12345", '
            '"profile": {"email": "invalidemail"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_email_address_change_to_used(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Change the email address of a Google SSO user to an address already used."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']
        auth_token = auth_response['authToken']

        self.authenticate_new_user(email='used@email.fr', password='psswd')
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "googleId": "12345", '
            '"profile": {"email": "used@email.fr"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_update_no_email_change(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Update a Google signed-in user without changing the email."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']
        auth_token = auth_response['authToken']

        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "googleId": "12345", '
            '"profile": {"name": "Pascal", "email": "pascal@bayes.org"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    def test_load_user(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Auth request retrieves user."""

        # First create a new user.
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '13579',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again.
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '13579',
        }

        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('13579', returned_user.get('googleId'))
        self.assertEqual('pascal@bayes.org', returned_user.get('profile', {}).get('email'))
        self.assertEqual(user_id, returned_user.get('userId'))

    def test_google_account_for_guest_user(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Auth request, add google account to a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Pascal')

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"googleTokenId": "my-token", "userId": "{user_id}", '
            f'"authToken": "{auth_token}"}}',
            content_type='application/json')

        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response.get('isNewUser'))
        self.assertEqual('Pascal', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertEqual('pascal@bayes.org', auth_response['authenticatedUser']['profile']['email'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('12345', auth_response['authenticatedUser']['googleId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])


if __name__ == '__main__':
    unittest.main()
