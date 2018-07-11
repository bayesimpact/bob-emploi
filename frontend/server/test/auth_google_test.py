"""Tests for the Google authentication."""

import unittest

import mock
from oauth2client import crypt

from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test


@mock.patch(server.__name__ + '.auth.client.verify_id_token')
class AuthenticateEndpointGoogleTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    def test_bad_token(self, mock_verify_id_token):
        """Auth request with a bad google token."""

        mock_verify_id_token.side_effect = crypt.AppIdentityError('foo bar')
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "wrong-token"}',
            content_type='application/json')
        self.assertEqual(401, response.status_code)
        self.assertIn(
            "Mauvais jeton d'authentification : foo bar",
            response.get_data(as_text=True))

    def test_wrong_token_issuer(self, mock_verify_id_token):
        """Auth request, Google token issued by Facebook."""

        mock_verify_id_token.return_value = {
            'iss': 'accounts.facebook.com',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        self.assertEqual(401, response.status_code)
        self.assertIn(
            "Fournisseur d'authentification invalide : accounts.facebook.com",
            response.get_data(as_text=True))

    def test_new_user(self, mock_verify_id_token):
        """Auth request, create a new user on the first time."""

        mock_verify_id_token.return_value = {
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
        self.assertEqual('12345', auth_response['authenticatedUser']['googleId'])
        user_id = auth_response['authenticatedUser']['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_when_user_already_exists(self, mock_verify_id_token):
        """The user had previously signed up via email registration."""

        self.authenticate_new_user(email='used@email.fr', password='psswd')
        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'used@email.fr',
            'sub': '12345',
        }
        response = self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)

    def test_email_address_change(self, mock_verify_id_token):
        """Change the email address of a Google SSO user."""

        mock_verify_id_token.return_value = {
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
            data='{{"userId": "{}", "googleId": "12345", '
            '"profile": {{"email": "valid@email.fr"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    def test_email_address_change_invalid(self, mock_verify_id_token):
        """Change the email address of a Google SSO user to invalid email."""

        mock_verify_id_token.return_value = {
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
            data='{{"userId": "{}", "googleId": "12345", '
            '"profile": {{"email": "invalidemail"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_email_address_change_to_used(self, mock_verify_id_token):
        """Change the email address of a Google SSO user to an address already used."""

        mock_verify_id_token.return_value = {
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
            data='{{"userId": "{}", "googleId": "12345", '
            '"profile": {{"email": "used@email.fr"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_update_no_email_change(self, mock_verify_id_token):
        """Update a Google signed-in user without changing the email."""

        mock_verify_id_token.return_value = {
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
            data='{{"userId": "{}", "googleId": "12345", '
            '"profile": {{"name": "Pascal", "email": "pascal@bayes.org"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

    def test_load_user(self, mock_verify_id_token):
        """Auth request retrieves user."""

        # First create a new user.
        mock_verify_id_token.return_value = {
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
        mock_verify_id_token.return_value = {
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


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
