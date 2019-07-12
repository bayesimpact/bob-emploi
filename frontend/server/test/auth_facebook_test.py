"""Tests for the Facebook authentication."""

import base64
import hashlib
import hmac
import typing
import unittest

from bob_emploi.frontend.server.test import base_test


def _base64_encode(content: typing.Union[str, bytes]) -> str:
    if isinstance(content, bytes):
        content_as_bytes = content
    else:
        content_as_bytes = content.encode('utf-8')
    base64_encoded_as_bytes = base64.urlsafe_b64encode(content_as_bytes)
    base64_encoded = base64_encoded_as_bytes.decode('ascii', 'ignore')
    return base64_encoded.rstrip('=')


def _facebook_sign(content: str) -> str:
    payload = _base64_encode(content).encode('utf-8')
    return _base64_encode(hmac.new(
        b'aA12bB34cC56dD78eE90fF12aA34bB56', payload, hashlib.sha256).digest())


class AuthenticateEndpointFacebookTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    fake_signature = _facebook_sign('stupid content')

    def test_bad_token_missing_dot(self) -> None:
        """Auth request with a facebook token missing a dot."""

        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookSignedRequest": "wrong-token"}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn('not enough values to unpack', response.get_data(as_text=True))

    def test_bad_token_bad_json(self) -> None:
        """Auth request with a facebook token unreadable json."""

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{self.fake_signature}.{ _base64_encode("a4")}"}}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_no_algorithm(self) -> None:
        """Auth request with a facebook token missing the algorithm field."""

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{self.fake_signature}.{_base64_encode("{}")}"}}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn('Le champ &quot;algorithm&quot; est requis', response.get_data(as_text=True))

    def test_wrong_algorithm(self) -> None:
        """Auth request with a facebook token with a bad algorithm field."""

        token = _base64_encode('{"algorithm": "plain", "user_id": "1234"}')
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{self.fake_signature}.{token}"}}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn(
            "Algorithme d'encryption inconnu &quot;plain&quot;", response.get_data(as_text=True))

    def test_bad_signature(self) -> None:
        """Auth request with a facebook token but wrong signature."""

        token = _base64_encode('{"algorithm": "HMAC-SHA256", "user_id": "1234"}')
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{self.fake_signature}.{token}"}}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Mauvaise signature', response.get_data(as_text=True))

    def test_new_user(self) -> None:
        """Auth request with a facebook token for a new user."""

        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        user_id = auth_response['authenticatedUser']['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])
        auth_token = auth_response['authToken']

        # Try with an invalid email.
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "facebookId": "12345", '
            '"profile": {"email": "invalidemail"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

        # Try with an email that is already in use.
        self.authenticate_new_user(email='used@email.fr', password='psswd')
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "facebookId": "12345", '
            '"profile": {"email": "used@email.fr"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

        # Set email from client.
        response = self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "facebookId": "12345", '
            '"profile": {"email": "me@facebook.com"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertEqual({'email': 'me@facebook.com'}, user_info['profile'])

    def test_new_user_with_email(self) -> None:
        """Auth request with a facebook token for a new user using an existing email."""

        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}", '
            '"email": "pascal@facebook.com"}',
            content_type='application/json')
        auth_info = self.json_from_response(response)
        self.assertEqual(
            'pascal@facebook.com', auth_info['authenticatedUser'].get('profile', {}).get('email'))

    def test_new_user_with_existing_email(self) -> None:
        """Auth request with a facebook token for a new user using an existing email."""

        self.authenticate_new_user(email='pascal@facebook.com', password='psswd')

        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}", '
                 '"email": "pascal@facebook.com"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])

    def test_load_user(self) -> None:
        """Auth request retrieves user."""

        # Create a new user.
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "13579"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again.
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "13579"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('13579', returned_user.get('facebookId'))
        self.assertEqual(user_id, returned_user.get('userId'))

    def test_facebook_account_for_guest_user(self) -> None:
        """Auth request add a facebook account for a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Pascal')

        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"facebookSignedRequest": "{good_signature}.{_base64_encode(facebook_data)}",'
            f'"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser'))
        self.assertEqual('Pascal', auth_response['authenticatedUser']['profile'].get('name'))
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        self.assertTrue(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertEqual(user_id, auth_response['authenticatedUser']['userId'])


if __name__ == '__main__':
    unittest.main()
