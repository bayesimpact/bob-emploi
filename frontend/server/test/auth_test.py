# -*- coding: utf-8
"""Tests for the authentication endpoints of the server module."""
import base64
import hashlib
import hmac
import time
import unittest
from urllib import parse

import mailjet_rest
import mock
from oauth2client import crypt

from bob_emploi.frontend import auth
from bob_emploi.frontend import server
from bob_emploi.frontend.test import base_test


class AuthenticateEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    def test_no_token(self):
        """Auth request with no token."""
        response = self.app.post(
            '/api/user/authenticate', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_fields_missing(self):
        """Auth request with missing name."""
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr", "hashedPassword": "foo"}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_new_user(self):
        """Full flow to create a user with email + password."""
        # First request: check if user exists.
        response = self.app.post(
            '/api/user/authenticate',
            data='{"email": "foo@bar.fr", "firstName": "foo", "lastName": "bar"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertNotIn('authenticatedUser', auth_response)
        self.assertTrue(auth_response['authToken'])

        # Create password.
        response2 = self.app.post(
            '/api/user/authenticate',
            data=('{{"email": "foo@bar.fr", "firstName": "foo", "lastName": "bar", '
                  '"hashedPassword": "{}"}}').format(base_test.sha1('foo@bar.fr', 'psswd')),
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        self.assertTrue(auth_response2['isNewUser'])
        self.assertTrue(auth_response2['authToken'])
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        user_id = auth_response2['authenticatedUser']['userId']
        self.assertTrue(user_id)

        # Check again if user exists.
        response3 = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response3 = self.json_from_response(response3)
        self.assertFalse(auth_response3.get('isNewUser', False))
        self.assertNotIn('authenticatedUser', auth_response3)
        salt = auth_response3['hashSalt']
        self.assertTrue(salt)
        self.assertTrue(auth_response3['authToken'])

        # Log-in with salt.
        request4 = (
            '{{"email": "foo@bar.fr", "hashSalt": "{}", '
            '"hashedPassword": "{}"}}').format(
                salt, _sha1(salt, _sha1('foo@bar.fr', 'psswd')))
        response4 = self.app.post('/api/user/authenticate', data=request4)
        auth_response4 = self.json_from_response(response4)
        self.assertFalse(auth_response4.get('isNewUser', False))
        self.assertEqual(user_id, auth_response4['authenticatedUser']['userId'])
        self.assertTrue(auth_response4['authToken'])

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password(self, mock_mailjet_client):
        """Full flow to reset a user's password."""
        # Create password.
        self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        # Try login with new password.
        salt = self._get_salt('foo@bar.fr')
        request1 = (
            '{{"email": "foo@bar.fr", "hashSalt": "{}", '
            '"hashedPassword": "{}"}}').format(
                salt, _sha1(salt, _sha1('foo@bar.fr', 'new password')))
        response1 = self.app.post('/api/user/authenticate', data=request1)
        self.assertEqual(403, response1.status_code)

        # Reset password.
        auth_token = self._get_reset_token(
            'foo@bar.fr', mock_mailjet_client,
            recipients=[{'Email': 'foo@bar.fr', 'Name': 'Pascal Corpet'}])
        request2 = (
            '{{"email": "foo@bar.fr", "authToken": "{}", "hashedPassword": "{}"}}'
            .format(auth_token, _sha1('foo@bar.fr', 'new password')))
        response2 = self.app.post('/api/user/authenticate', data=request2)
        auth_response2 = self.json_from_response(response2)
        self.assertFalse(auth_response2.get('isNewUser', False))
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        user_id = auth_response2['authenticatedUser']['userId']
        self.assertTrue(user_id)
        self.assertTrue(auth_response2['authToken'])

        # Try logging in with the old password.
        salt = self._get_salt('foo@bar.fr')
        request3 = (
            '{{"email": "foo@bar.fr", "hashSalt": "{}", '
            '"hashedPassword": "{}"}}').format(
                salt, _sha1(salt, _sha1('foo@bar.fr', 'psswd')))
        response3 = self.app.post('/api/user/authenticate', data=request3)
        self.assertEqual(403, response3.status_code)

        # Try logging in with the new password.
        salt = self._get_salt('foo@bar.fr')
        request4 = (
            '{{"email": "foo@bar.fr", "hashSalt": "{}", '
            '"hashedPassword": "{}"}}').format(
                salt, _sha1(salt, _sha1('foo@bar.fr', 'new password')))
        response4 = self.app.post('/api/user/authenticate', data=request4)
        auth_response4 = self.json_from_response(response4)
        self.assertEqual(user_id, auth_response4['authenticatedUser']['userId'])
        self.assertTrue(auth_response4['authToken'])

        # Try changing the password with the same reset token.
        request5 = (
            '{{"email": "foo@bar.fr", "authToken": "{}", "hashedPassword": "{}"}}'
            .format(auth_token, _sha1('foo@bar.fr', 'newer password')))
        response5 = self.app.post('/api/user/authenticate', data=request5)
        self.assertEqual(401, response5.status_code)

    def test_reset_password_bad_format_auth_token(self):
        """Try reseting a password with a wrongly fomatted token."""
        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        request = (
            '{{"email": "foo@bar.fr", "authToken": "123", "hashedPassword": "{}"}}'
            .format(_sha1('foo@bar.fr', 'new password')))
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(401, response.status_code)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password_bad_auth_token(self, mock_mailjet_client):
        """Try reseting a password with a bad token."""
        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        auth_token = self._get_reset_token('foo@bar.fr', mock_mailjet_client)
        if auth_token[-1:] == '0':
            messed_up_auth_token = auth_token[:-1] + '1'
        else:
            messed_up_auth_token = auth_token[:-1] + '0'
        request = (
            '{{"email": "foo@bar.fr", "authToken": "{}", "hashedPassword": "{}"}}'
            .format(messed_up_auth_token, _sha1('foo@bar.fr', 'new password')))
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(401, response.status_code)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch(auth.__name__ + '.time')
    def test_reset_password_old_auth_token(self, mock_time, mock_mailjet_client):
        """Try reseting a password with an old token."""
        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        mock_time.time.return_value = time.time() - 86400
        auth_token = self._get_reset_token('foo@bar.fr', mock_mailjet_client)

        mock_time.time.return_value = time.time()
        request = (
            '{{"email": "foo@bar.fr", "authToken": "{}", "hashedPassword": "{}"}}'
            .format(auth_token, _sha1('foo@bar.fr', 'new password')))
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(403, response.status_code)
        self.assertIn(
            "Le jeton d'authentification est périmé.",
            response.get_data(as_text=True))

    def _get_salt(self, email):
        # Check again if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{{"email": "{}"}}'.format(email),
            content_type='application/json')
        return self.json_from_response(response)['hashSalt']

    def _get_reset_token(self, email, mock_mailjet_client, recipients=None):
        self.assertFalse(mock_mailjet_client().send.create.called)
        mock_mailjet_client().send.create().status_code = 200
        response = self.app.post(
            '/api/user/reset-password', data='{{"email":"{}"}}'.format(email),
            content_type='application/json')
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        self.assertTrue(mock_mailjet_client().send.create.called)

        # Extract link from email.
        send_mail_kwargs = mock_mailjet_client().send.create.call_args[1]
        self.assertIn('data', send_mail_kwargs)
        self.assertEqual('Bob Emploi', send_mail_kwargs['data'].get('FromName'))
        self.assertEqual('bob@bob-emploi.fr', send_mail_kwargs['data'].get('FromEmail'))
        self.assertIn('Recipients', send_mail_kwargs['data'])
        if recipients:
            self.assertEqual(recipients, send_mail_kwargs['data']['Recipients'])
        self.assertIn('Vars', send_mail_kwargs['data'])
        mail_vars = send_mail_kwargs['data']['Vars']
        reset_link = mail_vars['resetLink']
        mock_mailjet_client.reset()

        # Extract token from link.
        url_args = parse.parse_qs(parse.urlparse(reset_link).query)
        self.assertIn('resetToken', url_args)
        self.assertEqual(1, len(url_args['resetToken']), msg=url_args)
        return url_args['resetToken'][0]

    @mock.patch(server.__name__ + '.auth.client.verify_id_token')
    def test_user_after_google_signup(self, mock_verify_id_token):
        """Trying to connect with a password a user registered with Google."""
        # Register user with Google (note that verify_id_token accepts any
        # token including "my-token" and returns a Google account).
        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')

        # Check if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "pascal@bayes.org"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn(
            "L'utilisateur existe mais utilise un autre moyen de connexion (Google).",
            response.get_data(as_text=True))


def _sha1(*args):
    return base_test.sha1(*args)


def _base64_encode(content):
    if isinstance(content, bytes):
        content_as_bytes = content
    else:
        content_as_bytes = content.encode('utf-8')
    base64_encoded_as_bytes = base64.urlsafe_b64encode(content_as_bytes)
    base64_encoded = base64_encoded_as_bytes.decode('ascii', 'ignore')
    return base64_encoded.rstrip('=')


def _facebook_sign(content):
    payload = _base64_encode(content).encode('utf-8')
    return _base64_encode(hmac.new(
        b'aA12bB34cC56dD78eE90fF12aA34bB56', payload, hashlib.sha256).digest())


class AuthenticateEndpointFacebookTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    fake_signature = _facebook_sign('stupid content')

    def test_bad_token_missing_dot(self):
        """Auth request with a facebook token missing a dot."""
        response = self.app.post(
            '/api/user/authenticate',
            data='{"facebookSignedRequest": "wrong-token"}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn('not enough values to unpack', response.get_data(as_text=True))

    def test_bad_token_bad_json(self):
        """Auth request with a facebook token unreadable json."""
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'
            .format(self.fake_signature, _base64_encode('a4')),
            content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_no_algorithm(self):
        """Auth request with a facebook token missing the algorithm field."""
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'
            .format(self.fake_signature, _base64_encode('{}')),
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn('Le champs &quot;algorithm&quot; est requis', response.get_data(as_text=True))

    def test_wrong_algorithm(self):
        """Auth request with a facebook token with a bad algorithm field."""
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'.format(
                self.fake_signature, _base64_encode('{"algorithm": "plain", "user_id": "1234"}')),
            content_type='application/json')
        self.assertEqual(422, response.status_code)
        self.assertIn(
            "Algorithme d'encryption inconnu &quot;plain&quot;", response.get_data(as_text=True))

    def test_bad_signature(self):
        """Auth request with a facebook token but wrong signature."""
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'.format(
                self.fake_signature, _base64_encode(
                    '{"algorithm": "HMAC-SHA256", "user_id": "1234"}')),
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('Mauvaise signature', response.get_data(as_text=True))

    def test_new_user(self):
        """Auth request with a facebook token for a new user."""
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'.format(
                good_signature, _base64_encode(facebook_data)),
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        self.assertEqual('12345', auth_response['authenticatedUser']['facebookId'])
        user_id = auth_response['authenticatedUser']['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._db.user.find()])
        auth_token = auth_response['authToken']

        # Try with an invalid email.
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "facebookId": "12345", '
            '"profile": {{"email": "invalidemail"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

        # Try with an email that is already in use.
        self.authenticate_new_user(email='used@email.fr', password='psswd')
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "facebookId": "12345", '
            '"profile": {{"email": "used@email.fr"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

        # Set email from client.
        response = self.app.post(
            '/api/user',
            data='{{"userId": "{}", "facebookId": "12345", '
            '"profile": {{"email": "me@facebook.com"}}}}'.format(user_id),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        self.assertEqual({'email': 'me@facebook.com'}, user_info['profile'])

    def test_new_user_with_email(self):
        """Auth request with a facebook token for a new user using an existing email."""
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}", "email": "pascal@facebook.com"}}'.format(
                good_signature, _base64_encode(facebook_data)),
            content_type='application/json')
        auth_info = self.json_from_response(response)
        self.assertEqual(
            'pascal@facebook.com', auth_info['authenticatedUser'].get('profile', {}).get('email'))

    def test_new_user_with_existing_email(self):
        """Auth request with a facebook token for a new user using an existing email."""
        self.authenticate_new_user(email='pascal@facebook.com', password='psswd')

        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "12345"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}", "email": "pascal@facebook.com"}}'.format(
                good_signature, _base64_encode(facebook_data)),
            content_type='application/json')
        self.assertEqual(403, response.status_code)

    def test_load_user(self):
        """Auth request retrieves user."""
        # Create a new user.
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "13579"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'.format(
                good_signature, _base64_encode(facebook_data)),
            content_type='application/json')
        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']

        # Now try to get the user again.
        facebook_data = '{"algorithm": "HMAC-SHA256", "user_id": "13579"}'
        good_signature = _facebook_sign(facebook_data)
        response = self.app.post(
            '/api/user/authenticate',
            data='{{"facebookSignedRequest": "{}.{}"}}'.format(
                good_signature, _base64_encode(facebook_data)),
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertFalse(auth_response.get('isNewUser', False))
        returned_user = auth_response['authenticatedUser']
        self.assertEqual('13579', returned_user.get('facebookId'))
        self.assertEqual(user_id, returned_user.get('userId'))


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
        self.assertEqual([user_id], [str(u['_id']) for u in self._db.user.find()])

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


class TokenTestCase(unittest.TestCase):
    """Unit tests for the token functions."""

    def test_create_token(self):
        """Basic usage of create_token."""
        token_1 = auth.create_token('pascal@example.fr', 'login')
        self.assertTrue(token_1)

        token_2 = auth.create_token('pascal@example.fr', 'unsubscribe')
        self.assertTrue(token_2)
        self.assertNotEqual(token_1, token_2)

        token_3 = auth.create_token('john@example.com', 'login')
        self.assertTrue(token_3)
        self.assertNotEqual(token_1, token_3)

    def test_check_token(self):
        """Basic usage of check_token (round trip with create_token)."""
        login_token = auth.create_token('pascal@example.fr', 'login')
        auth.check_token('pascal@example.fr', login_token, 'login')

    def test_check_token_empty(self):
        """Check that an empty token fails."""
        with self.assertRaises(ValueError):
            auth.check_token('pascal@example.fr', '', 'login')

    def test_check_token_wrong_role(self):
        """check_token fails if wrong role."""
        login_token = auth.create_token('pascal@example.fr', 'login')
        with self.assertRaises(ValueError):
            auth.check_token('pascal@example.fr', login_token, 'unsubscribe')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
