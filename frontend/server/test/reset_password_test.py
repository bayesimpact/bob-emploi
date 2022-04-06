"""Tests for the authentication endpoint of the server module for reseting the password."""

import functools
import json
import os
import time
import typing
from typing import Optional, Set
import unittest
from unittest import mock
from urllib import parse

import mailjet_rest

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.test import base_test


@functools.lru_cache()
def _get_reset_template_vars() -> Set[str]:
    template_path = campaign.get_campaign_folder('reset-password')
    assert template_path
    vars_filename = os.path.join(template_path, 'vars-example.json')
    with open(vars_filename, 'r', encoding='utf-8') as vars_file:
        return typing.cast(Set[str], json.load(vars_file).keys())


class AuthenticateEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for reseting the password using the authenticate endpoint."""

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
        self.assertEqual(403, response5.status_code)

    @mock.patch(proto.__name__ + '._IS_TEST_ENV', False)
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
        # Called once when resetting and again when sending the email.
        self.assertEqual(mock_warning.call_count, 2)
        self.assertIn(
            'Failed to parse revision',
            mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])
        self.assertIn(
            'Failed to parse revision',
            mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    def test_reset_password_bad_format_auth_token(self) -> None:
        """Try reseting a password with a wrongly fomatted token."""

        self.authenticate_new_user(email='foo@bar.fr', password='psswd')

        request = '{"email": "foo@bar.fr", "authToken": "123", ' \
            f'"hashedPassword": "{_sha1("foo@bar.fr", "new password")}"}}'
        response = self.app.post('/api/user/authenticate', data=request)
        self.assertEqual(403, response.status_code)

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
        self.assertEqual(403, response.status_code)

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
            "Les informations d'authentification ne sont pas valides.",
            response.get_data(as_text=True))

    def _get_salt(self, email: str) -> str:
        # Check again if user exists.
        response = self.app.post(
            '/api/user/authenticate', data=f'{{"email": "{email}"}}',
            content_type='application/json')
        return typing.cast(str, self.json_from_response(response)['hashSalt'])

    def _get_reset_token(
            self, email: str, mock_mailjet_client: mock.MagicMock,
            recipients: Optional[list[dict[str, str]]] = None) -> str:
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
        self.assertLessEqual(
            _get_reset_template_vars(), mail_vars.keys(),
            msg='missing variables for template')
        self.assertEqual('Bob', mail_vars['productName'])
        reset_link = mail_vars['resetLink']
        mock_mailjet_client.reset()

        # Extract token from link.
        url_args = parse.parse_qs(parse.urlparse(reset_link).query)
        self.assertIn('resetToken', url_args)
        self.assertEqual(1, len(url_args['resetToken']), msg=url_args)
        return url_args['resetToken'][0]

    @mock.patch(mailjet_rest.__name__ + '.Client')
    def test_reset_password_bad_email(self, mock_mailjet_client: mock.MagicMock) -> None:
        """Try reseting a password with an unknown email."""

        response = self.app.post(
            '/api/user/reset-password', data='{"email":"foo@bar.fr"}',
            content_type='application/json')
        # No error code so that an attacker cannot differentiate from an existing password.
        self.assertEqual(200, response.status_code)
        # However no email was sent.
        mock_mailjet_client.assert_not_called()

    @mock.patch(mailjet_rest.__name__ + '.Client')
    @mock.patch('google.oauth2.id_token.verify_oauth2_token')
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
        self.assertEqual('Bob', mail_vars['productName'])
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


def _sha1(*args: str) -> str:
    return base_test.sha1(*args)


if __name__ == '__main__':
    unittest.main()
