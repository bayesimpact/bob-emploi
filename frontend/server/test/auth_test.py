"""Tests for the authentication endpoints of the server module."""

import time
import unittest
from urllib import parse

import mailjet_rest
import mock
import requests_mock

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import server
from bob_emploi.frontend.server.test import base_test


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
        self.assertEqual(
            # This is sha1('bob-emploifoo@bar.fr').
            'bb96b62f3ded5182d555e2452cc4125a1ea4201d',
            auth_response2['authenticatedUser']['hashedEmail'])
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

    def test_weird_email(self):
        """Email authentication with non-ascii email."""

        response = self.app.post(
            '/api/user/authenticate',
            data=(
                '{{"email": "œil@body.fr", "firstName": "foo", "lastName": "bar", '
                '"hashedPassword": "{}"}}').format(base_test.sha1('œil@body.fr', 'psswd')),
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
            "L'utilisateur existe mais utilise un autre moyen de connexion: Google.",
            response.get_data(as_text=True))

    @mock.patch(auth.__name__ + '.time')
    def test_auth_user_id_token(self, mock_time):
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
            data='{{"userId": "{}", "authToken": "{}"}}'.format(user_id, timed_token),
            content_type='application/json')

        auth_response = self.json_from_response(response)
        self.assertEqual(
            'Pascal',
            auth_response.get('authenticatedUser', {}).get('profile', {}).get('name'))
        self.assertTrue(auth_response.get('lastAccessAt'))


def _sha1(*args):
    return base_test.sha1(*args)


@requests_mock.mock()
class AuthenticateEndpointPEConnectTestCase(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint using PE Connect."""

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_bad_code(self, mock_requests, mock_logging):
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

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_redirect_uri_mismatch(self, mock_requests, mock_logging):
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

    def test_bad_nonce(self, mock_requests):
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

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_pe_server_fails(self, mock_requests, mock_logging):
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

    @mock.patch(auth.geo.__name__ + '.get_city_proto')
    def test_new_user(self, mock_requests, mock_get_city_proto):
        """Auth request with PE Connect for a new user."""

        def _match_correct_code(request):
            return 'code=correct-code' in (request.text or '')

        mock_requests.post(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            json={
                'access_token': '123456',
                'nonce': 'correct-nonce',
                'scope':
                    'api_peconnect-individuv1 openid profile email api_peconnect-coordonneesv1 '
                    'coordonnees',
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
        mock_requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-coordonnees/v1/coordonnees',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'codeINSEE': '69386',
                'address1': '55 rue du lac',
            })
        mock_get_city_proto.return_value = geo_pb2.FrenchCity(name='Lyon', city_id='69386')

        response = self.app.post(
            '/api/user/authenticate',
            data='{"peConnectCode": "correct-code", "peConnectNonce": "correct-nonce"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        user = auth_response['authenticatedUser']
        self.assertEqual('pe-connect-user-id-1', user.get('peConnectId'))
        self.assertEqual('Pascal', user.get('profile', {}).get('name'))
        self.assertEqual('Corpet', user.get('profile', {}).get('lastName'))
        self.assertEqual('MASCULINE', user.get('profile', {}).get('gender'))
        self.assertEqual([True], [p.get('isIncomplete') for p in user.get('projects', [])])
        self.assertEqual(
            'Lyon', user['projects'][0].get('mobility', {}).get('city', {}).get('name'))
        user_id = user['userId']
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

        mock_get_city_proto.assert_called_once_with('69386')

    def test_new_user_with_existing_email(self, mock_requests):
        """Auth request with a facebook token for a new user using an existing email."""

        self.authenticate_new_user(email='pascal@pole-emploi.fr', password='psswd')

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
        self.assertEqual(403, response.status_code)

    def test_load_user(self, mock_requests):
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


@requests_mock.mock()
class AuthenticateEndpointLinkedInTest(base_test.ServerTestCase):
    """Unit tests for the authenticate endpoint using LinkedIn Auth."""

    @mock.patch(auth.logging.__name__ + '.warning')
    def test_bad_code(self, mock_requests, mock_logging):
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
    def test_redirect_uri_mismatch(self, mock_requests, mock_logging):
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
    def test_linked_in_server_fails(self, mock_requests, mock_logging):
        """Auth request with LinkedIn, but people request fails."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v1/people/~:(id,location,first-name,last-name,email-address)',
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

    def test_new_user(self, mock_requests):
        """Auth request with LinkedIn for a new user."""

        def _match_correct_code(request):
            return 'code=correct-code' in (request.text or '')

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            json={'access_token': '123456'}, additional_matcher=_match_correct_code)
        mock_requests.get(
            'https://api.linkedin.com/v1/people/~:(id,location,first-name,last-name,email-address)',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'emailAddress': 'pascal-linkedin@example.com',
                'lastName': 'Corpet',
                'firstName': 'Pascal',
                'id': 'linked-in-user-id-1',
            })

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}',
            content_type='application/json')
        auth_response = self.json_from_response(response)

        self.assertTrue(auth_response['isNewUser'])
        user = auth_response['authenticatedUser']
        user_id = user['userId']
        self.assertEqual('linked-in-user-id-1', user.get('linkedInId'))
        self.assertEqual('Pascal', user.get('profile', {}).get('name'))
        self.assertEqual('Corpet', user.get('profile', {}).get('lastName'))
        self.assertEqual([user_id], [str(u['_id']) for u in self._user_db.user.find()])

    def test_new_user_with_existing_email(self, mock_requests):
        """Auth request with a LinkedIn code for a new user using an existing email."""

        self.authenticate_new_user(email='pascal@linkedin.com', password='psswd')

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v1/people/~:(id,location,first-name,last-name,email-address)',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'emailAddress': 'pascal@linkedin.com',
                'lastName': 'Corpet',
                'firstName': 'Pascal',
                'id': 'linked-in-user-id-1',
            })

        response = self.app.post(
            '/api/user/authenticate',
            data='{"linkedInCode": "correct-code"}', content_type='application/json')
        self.assertEqual(403, response.status_code)
        self.assertIn(
            "L'utilisateur existe mais utilise un autre moyen de connexion: Email/Mot de passe.",
            response.get_data(as_text=True))

    def test_load_user(self, mock_requests):
        """Auth request retrieves user."""

        mock_requests.post(
            'https://www.linkedin.com/oauth/v2/accessToken', json={'access_token': '123456'})
        mock_requests.get(
            'https://api.linkedin.com/v1/people/~:(id,location,first-name,last-name,email-address)',
            headers={'Authorization': 'Bearer 123456'},
            json={
                'emailAddress': 'pascal-linkedin@example.com',
                'lastName': 'Corpet',
                'firstName': 'Pascal',
                'id': 'linked-in-user-id-1',
            })

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
