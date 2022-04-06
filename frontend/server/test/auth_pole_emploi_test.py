"""Tests for the authentication endpoints of the server module."""

import unittest
from unittest import mock

import requests_mock

from bob_emploi.frontend.server.test import base_test


@requests_mock.mock()
class AuthenticateEndpointPEConnectTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint using PE Connect."""

    @mock.patch('logging.warning')
    def test_bad_code(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with a PE Connect code that is not correct."""

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            status_code=400,
            text='Could not authenticate properly')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "wrong-code", "peConnectNonce": "12345"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Could not authenticate properly', response.get_data(as_text=True))

        mock_logging.assert_called_once()

    @mock.patch('logging.warning')
    def test_redirect_uri_mismatch(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with a redirect_uri that is not registered."""

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            status_code=400,
            json={'error': 'redirect_uri_mismatch', 'error_description': 'MISMATCH'})

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "wrong-code", "peConnectNonce": "12345"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('MISMATCH', response.get_data(as_text=True))

        mock_logging.assert_called_once()
        self.assertEqual(
            ('redirect_uri_mismatch', 'MISMATCH "http://localhost/"'),
            mock_logging.call_args[0][2:],
        )

    def test_bad_nonce(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a PE Connect nonce that does not match."""

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={'nonce': 'correct-nonce', 'token_type': 'Bearer', 'access_token': '123456'})

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "wrong-nonce"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Mauvais paramètre nonce', response.get_data(as_text=True))

    @mock.patch('logging.warning')
    def test_pe_server_fails(
            self, mock_requests: requests_mock.Mocker, mock_logging: mock.MagicMock) -> None:
        """Auth request with PE Connect, but userinfo fails."""

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={'nonce': 'correct-nonce', 'token_type': 'Bearer', 'access_token': '123456'})
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': 'Bearer 123456'},
            status_code=400,
            text='Token outdated')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Token outdated', response.get_data(as_text=True))

        mock_logging.assert_called_once()

    def test_new_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with PE Connect for a new user."""

        def _match_correct_code(request: 'requests_mock._RequestObjectProxy') -> bool:
            return 'code=correct-code' in (request.text or '')

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={
                'access_token': '123456',
                'nonce': 'correct-nonce',
                'scope': 'api_peconnect-individuv1 openid profile email',
                'token_type': 'Bearer',
            },
            additional_matcher=_match_correct_code)
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'email': 'polemploi-pascal@example.com',
                'family_name': 'CORPET',
                'gender': 'male',
                'given_name': 'PASCAL',
                'sub': 'pe-connect-user-id-1',
            })

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        user = auth_response['authenticatedUser']
        self.assertEqual('pe-connect-user-id-1', user.get('peConnectId'))
        self.assertTrue(user.get('hasAccount'))
        self.assertEqual('Pascal', user.get('profile', {}).get('name'))
        self.assertEqual('Corpet', user.get('profile', {}).get('lastName'))
        self.assertEqual('MASCULINE', user.get('profile', {}).get('gender'))
        user_id = user['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_new_user_with_existing_email(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request with a pole-emploi token for a new user using an existing email."""

        user_id = self.authenticate_new_user(email='pascal@pole-emploi.fr', password='psswd')

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={'nonce': 'correct-nonce', 'token_type': 'Bearer', 'access_token': '123456'})
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'email': 'pascal@pole-emploi.fr',
                'family_name': 'CORPET',
                'gender': 'male',
                'given_name': 'PASCAL',
                'sub': 'pe-connect-user-id-1',
            })

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])

    def test_load_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request retrieves user."""

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={'nonce': 'correct-nonce', 'token_type': 'Bearer', 'access_token': '123456'})
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'email': 'pascal@pole-emploi.fr',
                'family_name': 'CORPET',
                'gender': 'male',
                'given_name': 'PASCAL',
                'sub': 'pe-connect-user-id-1',
            })

        # Create a new user.
        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again.
        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('pe-connect-user-id-1', returned_user.get('peConnectId'))
        self.assertEqual(user_id, returned_user.get('userId'))

    def test_signin_guest(self, mock_requests: requests_mock.Mocker) -> None:
        """Auth request adds an account to guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={'nonce': 'correct-nonce', 'token_type': 'Bearer', 'access_token': '123456'})
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'email': 'pascal@pole-emploi.fr',
                'family_name': 'CORPET',
                'gender': 'male',
                'given_name': 'PASCAL',
                'sub': 'pe-connect-user-id-1',
            })

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce", '
            f'"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')

        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response.get('isNewUser'))
        self.assertEqual('Lascap', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertFalse(auth_response['authenticatedUser']['profile'].get('lastName'))
        self.assertEqual(
            'pascal@pole-emploi.fr', auth_response['authenticatedUser']['profile']['email'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('pe-connect-user-id-1', auth_response['authenticatedUser']['peConnectId'])
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])


if __name__ == '__main__':
    unittest.main()
