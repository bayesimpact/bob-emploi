"""Tests for the authentication endpoint of the server module using PE Connect."""

import datetime
import os
import time
import typing
from typing import Dict, List, Optional
import unittest
from unittest import mock
from urllib import parse

from bson import objectid
import mailjet_rest

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock

_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


class AuthenticateEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint."""

    def test_no_token(self) -> None:
        """Auth request with no token."""

        response = self.app.post(
            '/api/user/authenticate', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_create_guest_user(self) -> None:
        """Auth request to create a guest user."""

        response = self.app.post(
            '/api/user/authenticate', data='{"firstName": "Bob"}', content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertTrue(auth_response['authToken'])
        self.assertEqual('Bob', auth_response['authenticatedUser']['profile']['name'])
        self.assertNotEqual('fr@tu', auth_response['authenticatedUser']['profile'].get('locale'))
        self.assertFalse(auth_response['authenticatedUser'].get('hasAccount'))
        self.assertFalse(auth_response['authenticatedUser'].get('featuresEnabled', {}).get('alpha'))
        self.assertFalse(
            auth_response['authenticatedUser'].get('featuresEnabled', {})
            .get('excludeFromAnalytics'))
        user_id = auth_response['authenticatedUser']['userId']
        self.assertTrue(user_id)

    def test_create_guest_user_can_tutoie(self) -> None:
        """Auth request to create a guest user that can be tutoyed."""

        response = self.app.post(
            '/api/user/authenticate', data='{"firstName": "Bob", "userData": {"locale": "fr@tu"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertEqual('fr@tu', auth_response['authenticatedUser']['profile'].get('locale'))

    def test_create_guest_user_alpha(self) -> None:
        """Auth request to create a guest user in alpha."""

        response = self.app.post(
            '/api/user/authenticate', data='{"firstName": "Bob", "userData": {"isAlpha": true}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['authenticatedUser'].get('featuresEnabled', {}).get('alpha'))
        self.assertTrue(
            auth_response['authenticatedUser'].get('featuresEnabled', {})
            .get('excludeFromAnalytics'))

    def test_register_guest_user_broken(self) -> None:
        """Sign-in a user after they created a guest account, but with a broken password."""

        user_id, auth_token = self.create_guest_user()

        # This should never happen, but maybe the DB got broken somehow.
        self._user_db.user_auth.insert_one({'_id': objectid.ObjectId(user_id)})

        response = self.app.post(
            '/api/user/authenticate',
            data=(f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}",'
                  f'"hashedPassword": "{base_test.sha1("foo@bar.fr", "psswd")}"}}'),
            content_type='application/json')
        self.json_from_response(response)

    def test_fields_missing(self) -> None:
        """Auth request with missing name."""

        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr", "hashedPassword": "foo"}',
            content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_new_user(self) -> None:
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
            data=('{"email": "foo@bar.fr", "firstName": "foo", "lastName": "bar", '
                  f'"hashedPassword": "{base_test.sha1("foo@bar.fr", "psswd")}"}}'),
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        self.assertTrue(auth_response2['isNewUser'])
        self.assertTrue(auth_response2['authToken'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasPassword'))
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        self.assertEqual(
            # This is sha1('bob-emploifoo@bar.fr').
            'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
            auth_response2['authenticatedUser']['hashedEmail'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasAccount'))
        user_id = auth_response2['authenticatedUser']['userId']
        self.assertTrue(user_id)
        saved_user = self.user_info_from_db(user_id)
        self.assertTrue(saved_user.get('hasPassword'))

        # Check again if user exists.
        response3 = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response3 = self.json_from_response(response3)
        self.assertFalse(auth_response3.get('isNewUser', False))
        self.assertNotIn('authenticatedUser', auth_response3)
        salt = auth_response3['hashSalt']
        self.assertTrue(salt)
        self.assertFalse(auth_response3.get('authToken'))

        # Log-in with salt.
        request4 = \
            f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "psswd"))}"}}'
        response4 = self.app.post('/api/user/authenticate', data=request4)
        auth_response4 = self.json_from_response(response4)
        self.assertFalse(auth_response4.get('isNewUser', False))
        self.assertEqual(user_id, auth_response4['authenticatedUser']['userId'])
        self.assertTrue(auth_response4['authToken'])

    def test_weird_email(self) -> None:
        """Email authentication with non-ascii email."""

        response = self.app.post(
            '/api/user/authenticate',
            data='{"email": "œil@body.fr", "firstName": "foo", "lastName": "bar", '
            f'"hashedPassword": "{base_test.sha1("œil@body.fr", "psswd")}"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertTrue(auth_response['authToken'])
        self.assertEqual(
            'œil@body.fr', auth_response['authenticatedUser']['profile']['email'])
        self.assertEqual(
            # This is sha1('bob-emploiœil@body.fr').
            '30f8f216d08e4aaaf45d9f081330432838e580b9',
            auth_response['authenticatedUser']['hashedEmail'])
        user_id = auth_response['authenticatedUser']['userId']
        self.assertTrue(user_id)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password(self, mock_mailjet_client: mock.MagicMock) -> None:
        """Full flow to reset a user's password."""

        # Create password.
        self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        # Try login with new password.
        salt = self._get_salt('foo@bar.fr')
        request1 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "new password"))}"}}'
        response1 = self.app.post('/api/user/authenticate', data=request1)
        self.assertEqual(403, response1.status_code)

        # Reset password.
        auth_token = self._get_reset_token(
            'foo@bar.fr', mock_mailjet_client,
            recipients=[{'Email': 'foo@bar.fr', 'Name': 'Pascal Corpet'}])
        request2 = f'{{"email": "foo@bar.fr", "authToken": "{auth_token}", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
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
        request3 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "psswd"))}"}}'
        response3 = self.app.post('/api/user/authenticate', data=request3)
        self.assertEqual(403, response3.status_code)

        # Try logging in with the new password.
        salt = self._get_salt('foo@bar.fr')
        request4 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "new password"))}"}}'
        response4 = self.app.post('/api/user/authenticate', data=request4)
        auth_response4 = self.json_from_response(response4)
        self.assertEqual(user_id, auth_response4['authenticatedUser']['userId'])
        self.assertTrue(auth_response4['authToken'])

        # Try changing the password with the same reset token.
        request5 = f'{{"email": "foo@bar.fr", "authToken": "{auth_token}", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "newer password")}"}}'
        response5 = self.app.post('/api/user/authenticate', data=request5)
        self.assertEqual(401, response5.status_code)

    def test_change_password(self) -> None:
        """Full flow to change a user's password."""

        # Create password.
        self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        # Try login with new password.
        salt = self._get_salt('foo@bar.fr')
        request1 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "new password"))}"}}'
        response1 = self.app.post('/api/user/authenticate', data=request1)
        self.assertEqual(403, response1.status_code)

        # Update the password.
        request2 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "psswd"))}", ' \
            f'"newHashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response2 = self.app.post('/api/user/authenticate', data=request2)
        auth_response2 = self.json_from_response(response2)
        self.assertFalse(auth_response2.get('isNewUser', False))
        self.assertTrue(auth_response2.get('isPasswordUpdated', False))
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        user_id = auth_response2['authenticatedUser']['userId']
        self.assertTrue(user_id)
        self.assertTrue(auth_response2['authToken'])

        # Try logging in with the old password.
        salt = self._get_salt('foo@bar.fr')
        request3 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "psswd"))}"}}'
        response3 = self.app.post('/api/user/authenticate', data=request3)
        self.assertEqual(403, response3.status_code)

        # Try logging in with the new password.
        salt = self._get_salt('foo@bar.fr')
        request4 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "new password"))}"}}'
        response4 = self.app.post('/api/user/authenticate', data=request4)
        auth_response4 = self.json_from_response(response4)
        self.assertEqual(user_id, auth_response4['authenticatedUser']['userId'])
        self.assertTrue(auth_response4['authToken'])

    def test_link_guest_to_password_account(self) -> None:
        """Guest user connects to a pre-existing email account with valid password."""

        previous_user_id = self.create_user(email='foo@bar.fr', password='aa')
        guest_user_id, auth_token = self.create_guest_user(first_name='Cyrille')

        request = f'''{{
            "authToken": "{auth_token}",
            "email": "foo@bar.fr",
            "hashedPassword": "{_sha1('foo@bar.fr', 'aa')}",
            "userId": "{guest_user_id}"
        }}'''
        response = self.app.post('/api/user/authenticate', data=request)
        auth_response = self.json_from_response(response)
        self.assertEqual(previous_user_id, auth_response['authenticatedUser']['userId'])

        # Try logging in with the password.
        salt = self._get_salt('foo@bar.fr')
        request2 = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "aa"))}"}}'
        response2 = self.app.post('/api/user/authenticate', data=request2)
        auth_response2 = self.json_from_response(response2)
        self.assertEqual(previous_user_id, auth_response2['authenticatedUser']['userId'])
        self.assertTrue(auth_response2['authToken'])

    def test_guest_with_wrong_password(self) -> None:
        """Guest user connects to a pre-existing email account with invalid password."""

        self.create_user(email='foo@bar.fr', password='right password')
        guest_user_id, auth_token = self.create_guest_user(first_name='Cyrille')

        request = f'''{{
            "authToken": "{auth_token}",
            "email": "foo@bar.fr",
            "hashedPassword": "{_sha1('foo@bar.fr', 'wrong password')}",
            "userId": "{guest_user_id}"
        }}'''
        response = self.app.post('/api/user/authenticate', data=request)
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('authenticatedUser'))

    @mock.patch(auth.proto.__name__ + '._IS_TEST_ENV', False)
    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch('logging.warning')
    def test_corrupted_mongo_while_reset(
            self, mock_warning: mock.MagicMock, mock_mailjet_client: mock.MagicMock) -> None:
        """Corrupted user dict in MongoDB."""

        self.create_user_with_token(
            email='foo@bar.fr', password='aa',
            data={'profile': {'name': 'Pascal', 'lastName': 'Corpet'}})
        # Screw the data in Mongo.
        self._user_db.user.update_one({}, {'$set': {'revision': {'hack': 1}}})

        auth_token = self._get_reset_token(
            'foo@bar.fr', mock_mailjet_client,
            recipients=[{'Email': 'foo@bar.fr', 'Name': 'Pascal Corpet'}])
        request = f'{{"email": "foo@bar.fr", "authToken": "{auth_token}", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(500, response.status_code)
        self.assertIn('Les données utilisateur sont corrompues', response.get_data(as_text=True))
        mock_warning.assert_called_once()
        self.assertIn(
            'Failed to parse revision',
            mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    def test_missing_salt(self) -> None:
        """Forgot to send the salt."""

        self.create_user_with_token(email='foo@bar.fr')

        response = self.json_from_response(self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr", "hashedPassword": "salt"}'))
        self.assertIn('hashSalt', response)

    def test_wrong_salt(self) -> None:
        """Forgot to send the salt."""

        self.create_user_with_token(email='foo@bar.fr')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"email": "foo@bar.fr", "hashSalt": "aaa.111", "hashedPassword": "salt"}')
        self.assertEqual(403, response.status_code)
        self.assertIn("Le sel n'a pas été généré par ce serveur", response.get_data(as_text=True))

    @mock.patch('time.time')
    def test_outdated_salt(self, mock_time: mock.MagicMock) -> None:
        """Use outdated salt returns fresh salt."""

        mock_time.return_value = 1544180477.9767606

        self.create_user_with_token(email='foo@bar.fr', password='uuu')
        salt = self._get_salt('foo@bar.fr')

        mock_time.return_value = 1544180477.9767606 + datetime.timedelta(days=3).total_seconds()

        request = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "uuu"))}"}}'
        response = self.json_from_response(self.app.post('/api/user/authenticate', data=request))
        self.assertNotIn('authenticatedUser', response)

        new_salt = response.get('hashSalt', '')
        request = f'{{"email": "foo@bar.fr", "hashSalt": "{new_salt}", ' \
            f'"hashedPassword": "{_sha1(new_salt, _sha1("foo@bar.fr", "uuu"))}"}}'
        response = self.json_from_response(self.app.post('/api/user/authenticate', data=request))
        self.assertTrue(response.get('authenticatedUser'))

    @mock.patch('time.time')
    def test_future_salt(self, mock_time: mock.MagicMock) -> None:
        """Using future is forbidden."""

        mock_time.return_value = 1544180477.9767606

        self.create_user_with_token(email='foo@bar.fr', password='uuu')
        salt = self._get_salt('foo@bar.fr')

        mock_time.return_value = 1544180477.9767606 - datetime.timedelta(hours=1).total_seconds()

        request = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "uuu"))}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(403, response.status_code)
        self.assertIn("Le sel n'a pas été généré par ce serveur", response.get_data(as_text=True))

    @mock.patch(auth.proto.__name__ + '._IS_TEST_ENV', False)
    @mock.patch('logging.warning')
    def test_corrupted_mongo(self, mock_warning: mock.MagicMock) -> None:
        """Corrupted user dict in MongoDB."""

        self.create_user_with_token(email='foo@bar.fr', password='aa')
        # Screw the data in Mongo.
        self._user_db.user.update_one({}, {'$set': {'revision': {'hack': 1}}})

        salt = self._get_salt('foo@bar.fr')
        request = f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "aa"))}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(500, response.status_code)
        self.assertIn('Les données utilisateur sont corrompues', response.get_data(as_text=True))
        mock_warning.assert_called_once()
        self.assertIn(
            'Failed to parse revision',
            mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    def test_reset_password_bad_format_auth_token(self) -> None:
        """Try reseting a password with a wrongly fomatted token."""

        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        request = '{"email": "foo@bar.fr", "authToken": "123", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(401, response.status_code)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password_bad_auth_token(self, mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password with a bad token."""

        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        auth_token = self._get_reset_token('foo@bar.fr', mock_mailjet_client)
        if auth_token[-1:] == '0':
            messed_up_auth_token = auth_token[:-1] + '1'
        else:
            messed_up_auth_token = auth_token[:-1] + '0'
        request = f'{{"email": "foo@bar.fr", "authToken": "{messed_up_auth_token}", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(401, response.status_code)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch(auth.__name__ + '.time')
    def test_reset_password_old_auth_token(
            self, mock_time: mock.MagicMock, mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password with an old token."""

        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        # 259200 = 3 days.
        mock_time.time.return_value = time.time() - 259200
        auth_token = self._get_reset_token('foo@bar.fr', mock_mailjet_client)

        mock_time.time.return_value = time.time()
        request = f'{{"email": "foo@bar.fr", "authToken": "{auth_token}", '\
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(498, response.status_code)
        self.assertIn(
            "Le jeton d'authentification est périmé.",
            response.get_data(as_text=True))

    def _get_salt(self, email: str) -> str:
        # Check again if user exists.
        response = self.app.post(
            '/api/user/authenticate', data=f'{{"email": "{email}"}}',
            content_type='application/json')
        return typing.cast(str, self.json_from_response(response)['hashSalt'])

    def _get_reset_token(
            self, email: str, mock_mailjet_client: mock.MagicMock,
            recipients: Optional[List[Dict[str, str]]] = None) -> str:
        self.assertFalse(mock_mailjet_client().send.create.called)
        mock_mailjet_client().send.create().status_code = 200
        response = self.app.post(
            '/api/user/reset-password', data=f'{{"email":"{email}"}}',
            content_type='application/json')
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        self.assertTrue(mock_mailjet_client().send.create.called)

        # Extract link from email.
        send_mail_kwargs = mock_mailjet_client().send.create.call_args[1]
        self.assertIn('data', send_mail_kwargs)
        self.assertIn('Messages', send_mail_kwargs['data'])
        self.assertTrue(send_mail_kwargs['data']['Messages'])
        message = send_mail_kwargs['data']['Messages'][0]
        self.assertEqual('Bob', message.get('From', {}).get('Name'))
        self.assertEqual('bob@bob-emploi.fr', message.get('From', {}).get('Email'))
        self.assertIn('To', message)
        if recipients:
            self.assertEqual(recipients, message['To'])
        self.assertIn('Variables', message)
        mail_vars = message['Variables']
        reset_link = mail_vars['resetLink']
        mock_mailjet_client.reset()

        # Extract token from link.
        url_args = parse.parse_qs(parse.urlparse(reset_link).query)
        self.assertIn('resetToken', url_args)
        self.assertEqual(1, len(url_args['resetToken']), msg=url_args)
        return url_args['resetToken'][0]

    @mock.patch(server.__name__ + '.auth.id_token.verify_oauth2_token')
    def test_user_after_google_signup(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Trying to connect with a password a user registered with Google."""

        # Register user with Google (note that verify_oauth2_token accepts any
        # token including "my-token" and returns a Google account).
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        auth_response = self.json_from_response(self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json'))
        auth_token = auth_response.get('authToken', '')
        user_id = auth_response.get('authenticatedUser', {}).get('userId', '')

        # Try creating a password with a token from another user.
        unused_guest_user_id, fake_auth_token = self.create_guest_user()
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{fake_auth_token}", '
            f'"hashedPassword": "{base_test.sha1("pascal@bayes.org", "new_password")}", '
            f'"email": "pascal@bayes.org"}}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)

        # Create a password.
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{auth_token}", '
            f'"hashedPassword": "{base_test.sha1("pascal@bayes.org", "new_password")}", '
            f'"email": "pascal@bayes.org"}}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response.get('isPasswordUpdated'))
        self.assertEqual(user_id, auth_response.get('authenticatedUser', {}).get('userId'))

        # Login again with user / password.
        salt = self._get_salt('pascal@bayes.org')
        request = f'{{"email": "pascal@bayes.org", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("pascal@bayes.org", "new_password"))}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(200, response.status_code)

    @mock.patch(auth.__name__ + '.time')
    def test_auth_user_id_token(self, mock_time: mock.MagicMock) -> None:
        """Authenticate using the user ID and a token."""

        now = time.time()
        mock_time.time.return_value = now

        # Create password.
        user_id = self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        # 2 days later…
        mock_time.time.return_value = now + 86400 * 2

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{timed_token}"}}',
            content_type='application/json')

        auth_response = self.json_from_response(response)
        self.assertEqual(
            'Pascal',
            auth_response.get('authenticatedUser', {}).get('profile', {}).get('name'))
        self.assertTrue(auth_response.get('lastAccessAt'))

    def test_auth_user_id_token_wrong_format_id(self) -> None:
        """Authenticate using a token but a wrongly formatted user ID."""

        # Create password.
        user_id = self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "aaa", "authToken": "{timed_token}"}}',
            content_type='application/json')
        self.assertEqual(400, response.status_code)
        self.assertIn(
            "L'identifiant utilisateur &quot;aaa&quot; n'a pas le bon format",
            response.get_data(as_text=True))

    def test_auth_user_id_token_unknown_user(self) -> None:
        """Authenticate using a token but the user ID does not correspond to anything."""

        user_id = str(objectid.ObjectId())
        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{timed_token}"}}',
            content_type='application/json')
        self.assertEqual(404, response.status_code)
        self.assertIn('Utilisateur inconnu', response.get_data(as_text=True))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_auth_user_id_token_unknown_user_i18n(self) -> None:
        """Authenticate using a token but the user ID does not correspond to anything."""

        user_id = str(objectid.ObjectId())
        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{timed_token}"}}',
            content_type='application/json',
            headers={'Accept-Language': 'en-US, en, *'})
        self.assertEqual(404, response.status_code)
        self.assertIn('Unknown user', response.get_data(as_text=True))

    def test_auth_user_id_token_malformed(self) -> None:
        """Authenticate using the user ID and a malformed token."""

        # Create password.
        user_id = self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "aaa.111"}}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn("Le sel n'a pas été généré par ce serveur", response.get_data(as_text=True))

    @mock.patch(auth.__name__ + '.time')
    def test_auth_user_id_token_outdated(self, mock_time: mock.MagicMock) -> None:
        """Authenticate using the user ID and a very old token."""

        now = time.time()
        mock_time.time.return_value = now

        # Create password.
        user_id = self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')

        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        # 10 days later…
        mock_time.time.return_value = now + 86400 * 10

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{timed_token}"}}',
            content_type='application/json')
        self.assertEqual(498, response.status_code)
        self.assertIn("Token d'authentification périmé", response.get_data(as_text=True))

    @mock.patch(auth.proto.__name__ + '._IS_TEST_ENV', False)
    @mock.patch('logging.warning')
    def test_auth_user_id_token_corrupted_data(self, mock_warning: mock.MagicMock) -> None:
        """Authenticate using the user ID and a token but data is corrupted."""

        # Create password.
        user_id = self.authenticate_new_user(
            email='foo@bar.fr', password='psswd', first_name='Pascal', last_name='Corpet')
        timed_token = auth.create_token(user_id, is_using_timestamp=True)

        # Screw the data in Mongo.
        self._user_db.user.update_one({}, {'$set': {'revision': {'hack': 1}}})

        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{timed_token}"}}',
            content_type='application/json')
        self.assertEqual(500, response.status_code)
        self.assertIn('Les données utilisateur sont corrompues', response.get_data(as_text=True))
        mock_warning.assert_called_once()
        self.assertIn(
            'Failed to parse revision',
            mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password_bad_email(self, mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password with a bad token."""

        response = self.app.post(
            '/api/user/reset-password', data='{"email":"foo@bar.fr"}',
            content_type='application/json')
        self.assertEqual(403, response.status_code)
        mock_mailjet_client.assert_not_called()

    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch(server.__name__ + '.auth.id_token.verify_oauth2_token')
    def test_reset_password_after_google_signup(
            self, mock_verify_oauth2_token: mock.MagicMock,
            mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password for a user that signed up with Google."""

        # Register user with Google (note that verify_oauth2_token accepts any
        # token including "my-token" and returns a Google account).
        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayes.org',
            'sub': '12345',
        }
        mock_mailjet_client().send.create().status_code = 200
        self.app.post(
            '/api/user/authenticate', data='{"googleTokenId": "my-token"}',
            content_type='application/json')

        response = self.app.post(
            '/api/user/reset-password', data='{"email":"pascal@bayes.org"}',
            content_type='application/json')
        self.assertEqual(200, response.status_code, msg=response.get_data(as_text=True))
        self.assertTrue(mock_mailjet_client().send.create.called)

        # Extract link from email.
        send_mail_kwargs = mock_mailjet_client().send.create.call_args[1]
        self.assertIn('data', send_mail_kwargs)
        self.assertIn('Messages', send_mail_kwargs['data'])
        self.assertTrue(send_mail_kwargs['data']['Messages'])
        message = send_mail_kwargs['data']['Messages'][0]
        self.assertEqual('Bob', message.get('From', {}).get('Name'))
        self.assertEqual('bob@bob-emploi.fr', message.get('From', {}).get('Email'))
        self.assertIn('To', message)
        self.assertIn('pascal@bayes.org', message['To'][0]['Email'])
        self.assertIn('Variables', message)
        mail_vars = message['Variables']
        auth_link = mail_vars['authLink']
        mock_mailjet_client.reset()

        # Extract token from link.
        url_args = parse.parse_qs(parse.urlparse(auth_link).query)
        self.assertIn('authToken', url_args)
        self.assertEqual(1, len(url_args['authToken']), msg=url_args)

    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch('logging.error')
    def test_reset_password_failed_email(
            self, mock_logging_error: mock.MagicMock, mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password with a bad token."""

        self.create_user_with_token(email='foo@bar.fr')
        mock_mailjet_client().send.create().status_code = 500

        response = self.app.post(
            '/api/user/reset-password', data='{"email":"foo@bar.fr"}',
            content_type='application/json')
        self.assertEqual(500, response.status_code, msg=response.get_data(as_text=True))
        self.assertEqual(True, mock_mailjet_client().send.create.called)
        mock_logging_error.assert_called_once()
        self.assertIn(
            'Failed to send an email with MailJet',
            mock_logging_error.call_args[0][0] % mock_logging_error.call_args[0][1:])

    def test_add_account_to_guest_user(self) -> None:
        """Create an account with email + password from a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')

        # First request: check if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertNotIn('authenticatedUser', auth_response)
        self.assertTrue(auth_response['authToken'])

        # Create password.
        response2 = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}", '
            f'"hashedPassword": "{base_test.sha1("foo@bar.fr", "psswd")}"}}',
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        self.assertFalse(auth_response2.get('isNewUser'))
        self.assertTrue(auth_response2['authToken'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasPassword'))
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        self.assertEqual(
            # This is sha1('bob-emploifoo@bar.fr').
            'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
            auth_response2['authenticatedUser']['hashedEmail'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasAccount'))
        self.assertEqual(user_id, auth_response2['authenticatedUser'].get('userId'))
        self.assertEqual('Lascap', auth_response2['authenticatedUser']['profile'].get('name'))
        saved_user = self.user_info_from_db(user_id)
        self.assertTrue(saved_user.get('hasAccount'))
        self.assertTrue(saved_user.get('hasPassword'))

    def test_add_account_to_recent_guest_visitor(self) -> None:
        """Create an account with email + password from a guest user with a recent visit."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')

        # User visits the site (maybe by reloading the page).
        response = self.app.post(
            f'/api/app/use/{user_id}',
            headers={'Authorization': f'Bearer {auth_token}'})
        user_dict = self.json_from_response(response)
        self.assertEqual(user_id, user_dict['userId'])

        # First request: check if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertNotIn('authenticatedUser', auth_response)
        self.assertTrue(auth_response['authToken'])

        # Create password.
        response2 = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}", '
            f'"hashedPassword": "{base_test.sha1("foo@bar.fr", "psswd")}"}}',
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        self.assertFalse(auth_response2.get('isNewUser'))
        self.assertTrue(auth_response2['authToken'])
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        self.assertEqual(
            # This is sha1('bob-emploifoo@bar.fr').
            'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
            auth_response2['authenticatedUser']['hashedEmail'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasAccount'))
        self.assertEqual(user_id, auth_response2['authenticatedUser'].get('userId'))
        self.assertEqual('Lascap', auth_response2['authenticatedUser']['profile'].get('name'))
        saved_user = self.user_info_from_db(user_id)
        self.assertTrue(saved_user.get('hasAccount'))

    def test_check_email(self) -> None:
        """Check that there is a user with a given email."""

        self.create_user_with_token(email='foo@bar.fr')

        # Check if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertFalse(auth_response.get('isNewUser'))
        self.assertNotIn('authenticatedUser', auth_response)
        self.assertFalse(auth_response.get('authToken'))

    @mock.patch(server.now.__name__ + '.get')
    @mailjetmock.patch()
    def test_activation_email_for_guest_user(self, mock_now: mock.MagicMock) -> None:
        """Create an account with email + password from a guest user that has a diagnostic."""

        mock_now.return_value = datetime.datetime(2018, 6, 10)

        self._db.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
        ])

        user_id, auth_token = self.create_guest_user(
            first_name='Pascal', modifiers=[base_test.add_project])

        self.assertFalse(mailjetmock.get_all_sent_messages())

        # Create password.
        self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}", '
            f'"hashedPassword": "{base_test.sha1("foo@bar.fr", "psswd")}"}}',
            content_type='application/json')

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        self.assertEqual('foo@bar.fr', mails_sent[0].recipient['Email'])
        data = mails_sent[0].properties['Variables']
        self.assertEqual('10 juin 2018', data['date'])
        self.assertEqual('Pascal', data['firstName'])

    def test_add_email_to_guest_user(self) -> None:
        """Create an account with email from a guest user."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')

        # First request: check if user exists.
        response = self.app.post(
            '/api/user/authenticate', data='{"email": "foo@bar.fr"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)
        self.assertTrue(auth_response['isNewUser'])
        self.assertNotIn('authenticatedUser', auth_response)
        self.assertTrue(auth_response['authToken'])

        # Create account with email.
        response2 = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        auth_response2 = self.json_from_response(response2)
        self.assertFalse(auth_response2.get('isNewUser'))
        self.assertTrue(auth_response2['authToken'])
        self.assertFalse(auth_response2['authenticatedUser'].get('hasPassword'))
        self.assertEqual(
            'foo@bar.fr', auth_response2['authenticatedUser']['profile']['email'])
        self.assertEqual(
            # This is sha1('bob-emploifoo@bar.fr').
            'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
            auth_response2['authenticatedUser']['hashedEmail'])
        self.assertTrue(auth_response2['authenticatedUser'].get('hasAccount'))
        self.assertEqual(user_id, auth_response2['authenticatedUser'].get('userId'))
        self.assertEqual('Lascap', auth_response2['authenticatedUser']['profile'].get('name'))
        saved_user = self.user_info_from_db(user_id)
        self.assertTrue(saved_user.get('hasAccount'))

    @mailjetmock.patch()
    def test_send_auth_email_to_guest_user(self) -> None:
        """Create an account with email from a guest user, then use this email to auth."""

        user_id, auth_token = self.create_guest_user(first_name='Lascap')
        # Add an email to the guest user.
        self.app.post(
            '/api/user/authenticate',
            data=f'{{"email": "foo@bar.fr", "userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')

        self.assertFalse(mailjetmock.get_all_sent_messages())

        # Try to connect with a password.
        salt = self._get_salt('foo@bar.fr')
        request = \
            f'{{"email": "foo@bar.fr", "hashSalt": "{salt}", ' \
            f'"hashedPassword": "{_sha1(salt, _sha1("foo@bar.fr", "psswd"))}"}}'
        response = self.app.post(
            '/api/user/authenticate', data=request, content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn('foo@bar.fr', response.get_data(as_text=True))

        # Open the auth email.
        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        self.assertEqual('foo@bar.fr', mails_sent[0].recipient['Email'])
        data = mails_sent[0].properties['Variables']
        self.assertEqual('Lascap', data['firstName'])
        url_args = parse.parse_qs(parse.urlparse(data['authLink']).query)
        self.assertLessEqual({'userId', 'authToken'}, url_args.keys())
        self.assertEqual([user_id], url_args['userId'])
        auth_token = url_args['authToken'][0]

        # Log in from email.
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"userId": "{user_id}", "authToken": "{auth_token}"}}',
            content_type='application/json')
        self.json_from_response(response)


def _sha1(*args: str) -> str:
    return base_test.sha1(*args)


class TokenTestCase(unittest.TestCase):
    """Unit tests for the token functions."""

    def test_create_token(self) -> None:
        """Basic usage of create_token."""

        token_1 = auth.create_token('pascal@example.fr', 'login')
        self.assertTrue(token_1)

        token_2 = auth.create_token('pascal@example.fr', 'unsubscribe')
        self.assertTrue(token_2)
        self.assertNotEqual(token_1, token_2)

        token_3 = auth.create_token('john@example.com', 'login')
        self.assertTrue(token_3)
        self.assertNotEqual(token_1, token_3)

    def test_check_token(self) -> None:
        """Basic usage of check_token (round trip with create_token)."""

        login_token = auth.create_token('pascal@example.fr', 'login')
        auth.check_token('pascal@example.fr', login_token, 'login')

    def test_check_token_empty(self) -> None:
        """Check that an empty token fails."""

        with self.assertRaises(ValueError):
            auth.check_token('pascal@example.fr', '', 'login')

    def test_check_token_wrong_role(self) -> None:
        """check_token fails if wrong role."""

        login_token = auth.create_token('pascal@example.fr', 'login')
        with self.assertRaises(ValueError):
            auth.check_token('pascal@example.fr', login_token, 'unsubscribe')


if __name__ == '__main__':
    unittest.main()
