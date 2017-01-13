"""Authentication module for MyGamePlan."""
import base64
import binascii
import datetime
import hashlib
import hmac
import json
import logging
import os
import time
from urllib import parse

from bson import objectid
import flask
from oauth2client import client
from oauth2client import crypt

from bob_emploi.frontend import mail
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import user_pb2

_GOOGLE_SSO_ISSUERS = frozenset({
    'accounts.google.com', 'https://accounts.google.com'})
# https://console.cloud.google.com/apis/credentials/oauthclient/1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com?project=bayesimpact-my-game-plan
GOOGLE_SSO_CLIENT_ID = os.getenv(
    'GOOGLE_SSO_CLIENT_ID',
    '1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com')
# https://developers.facebook.com/apps/1048782155234293/settings/
_FACEBOOK_SECRET = os.getenv(
    'FACEBOOK_APP_SECRET', 'aA12bB34cC56dD78eE90fF12aA34bB56').encode('ascii', 'ignore')
FACEBOOK_SSO_APP_ID = os.getenv('FACEBOOK_SSO_APP_ID', '1048782155234293')

SECRET_SALT = os.getenv('SECRET_SALT', 'a2z3S5AKAEavfdr234aze075').encode('ascii', 'ignore')
# Validity of generated salt tokens.
_SALT_VALIDITY_SECONDS = datetime.timedelta(hours=2).total_seconds()


class Authenticator(object):
    """An object to authenticate requests."""

    def __init__(self, db, save_user):
        self._db = db
        self._save_user = save_user

    def authenticate(self, auth_request):
        """Authenticate a user."""
        if auth_request.google_token_id:
            return self._google_authenticate(auth_request.google_token_id)
        if auth_request.facebook_signed_request:
            return self._facebook_authenticate(auth_request.facebook_signed_request)
        if auth_request.email:
            return self._password_authenticate(auth_request)
        flask.abort(422, "Aucun moyen d'authentification n'a été trouvé.")

    def _google_authenticate(self, token_id):
        try:
            id_info = client.verify_id_token(token_id, GOOGLE_SSO_CLIENT_ID)
        except crypt.AppIdentityError as error:
            flask.abort(401, "Mauvais jeton d'authentification : %s" % error)
        if id_info.get('iss') not in _GOOGLE_SSO_ISSUERS:
            flask.abort(
                401, "Fournisseur d'authentification invalide : %s." % id_info.get('iss', '<none>'))

        response = user_pb2.AuthResponse()
        user_dict = self._db.user.find_one({'googleId': id_info['sub']})
        user_id = str(user_dict['_id']) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
        else:
            self._assert_user_not_existing(id_info['email'])
            response.authenticated_user.profile.email = id_info['email']
            response.authenticated_user.profile.picture_url = id_info.get('picture', '')
            response.authenticated_user.google_id = id_info['sub']
            self._save_user(response.authenticated_user, is_new_user=True)
            response.is_new_user = True

        return response

    # TODO: Handle the case where a user creates its account through Facebook but refuses to share
    # their email (empty email at creation time). Use `_assert_user_not_existing` in case they share
    # their email.
    def _facebook_authenticate(self, signed_request):
        try:
            [encoded_signature, payload] = signed_request.split('.')
            data = json.loads(_base64_url_decode(payload).decode('utf-8'))
            actual_signature = _base64_url_decode(encoded_signature)
        except ValueError as error:
            flask.abort(422, error)
        for required_field in ('algorithm', 'user_id'):
            if not data.get(required_field):
                flask.abort(422, 'Le champs %s est requis : %s' % (required_field, data))
        if data['algorithm'].lower() != 'hmac-sha256':
            flask.abort(422, 'Algorithme d\'encryption inconnu "%s"' % data['algorithm'])

        expected_signature = hmac.new(
            _FACEBOOK_SECRET, payload.encode('utf-8'), hashlib.sha256).digest()
        if expected_signature != actual_signature:
            flask.abort(403, 'Mauvaise signature')

        response = user_pb2.AuthResponse()
        user_dict = self._db.user.find_one({'facebookId': data['user_id']})
        user_id = str(user_dict['_id']) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
        else:
            response.authenticated_user.facebook_id = data['user_id']
            self._save_user(response.authenticated_user, is_new_user=True)
            response.is_new_user = True

        return response

    def _assert_user_not_existing(self, email):
        is_existing_user = self._db.user.find({'profile.email': email}, {'_id': 1}).limit(1).count()
        if is_existing_user:
            flask.abort(403, "L'utilisateur existe mais utilise un autre moyen de connexion.")

    def _password_authenticate(self, auth_request):
        now = int(time.time())
        response = user_pb2.AuthResponse()
        response.hash_salt = _timestamped_hash(now, auth_request.email)

        user_dict = self._db.user.find_one({'profile.email': auth_request.email})

        if not user_dict:
            return self._password_register(auth_request, response)

        user_id = str(user_dict['_id'])
        user_auth_dict = self._db.user_auth.find_one({'_id': user_dict['_id']})

        if not user_auth_dict:
            if user_dict.get('googleId'):
                auth_method = ' (Google)'
            elif user_dict.get('facebookId'):
                auth_method = ' (Facebook)'
            else:
                auth_method = ''
            flask.abort(
                403,
                "L'utilisateur existe mais utilise un autre moyen de connexion%s." % auth_method)

        if not auth_request.hashed_password:
            # User exists but did not sent a passwordt: probably just getting some fresh salt.
            return response

        if auth_request.auth_token:
            self._reset_password(auth_request, user_id, user_auth_dict)
            user_dict['userId'] = user_id
            if not proto.parse_from_mongo(user_dict, response.authenticated_user):
                flask.abort(
                    500, 'Les données utilisateur sont corrompues dans la base de données.')
            return response

        if not auth_request.hash_salt:
            # User exists but has not sent salt: probably just
            # getting some fresh salt.
            return response

        # Check that salt is valid.
        salt = auth_request.hash_salt
        try:
            if not _assert_valid_salt(salt, auth_request.email, now):
                return response
        except ValueError as error:
            flask.abort(
                403, "Le sel n'a pas été généré par ce serveur : %s." % error)

        stored_hashed_password = user_auth_dict.get('hashedPassword')

        hashed_password = hashlib.sha1()
        hashed_password.update(salt.encode('ascii'))
        hashed_password.update(stored_hashed_password.encode('ascii'))
        request_hashed_password = binascii.unhexlify(auth_request.hashed_password)
        if request_hashed_password != hashed_password.digest():
            flask.abort(403, 'Mot de passe erroné.')

        if not proto.parse_from_mongo(user_dict, response.authenticated_user):
            flask.abort(
                500, 'Les données utilisateur sont corrompues dans la base de données.')

        response.authenticated_user.user_id = user_id
        return response

    def _password_register(self, auth_request, response):
        """Registers a new user using a password."""
        if auth_request.hashed_password:
            if not (auth_request.email and auth_request.first_name and auth_request.last_name):
                flask.abort(422, 'Un champs requis est manquant (email, prénom ou nom)')
            response.authenticated_user.profile.email = auth_request.email
            response.authenticated_user.profile.name = auth_request.first_name
            response.authenticated_user.profile.last_name = auth_request.last_name
            user_data = self._save_user(response.authenticated_user, is_new_user=True)

            object_id = objectid.ObjectId(user_data.user_id)
            self._db.user_auth.insert_one({
                '_id': object_id,
                'hashedPassword': auth_request.hashed_password})
        response.is_new_user = True
        return response

    def _reset_password(self, auth_request, user_id, user_auth_dict):
        """Resets the user's password."""
        try:
            is_token_valid = _assert_valid_salt(
                auth_request.auth_token,
                auth_request.email + user_id + user_auth_dict.get('hashedPassword'),
                int(time.time()))
            if not is_token_valid:
                flask.abort(403, "Le jeton d'authentification est périmé.")
        except ValueError as error:
            flask.abort(
                401,
                "Le jeton d'authentification n'a pas été généré par ce serveur : %s." % error)
        self._db.user_auth.replace_one(
            {'_id': objectid.ObjectId(user_id)},
            {'hashedPassword': auth_request.hashed_password})

    def send_reset_password_token(self, email):
        """Sends an email to user with a reset token so that they can reset their password."""
        user_dict = self._db.user.find_one({'profile.email': email})
        if not user_dict:
            flask.abort(403, "Nous n'avons pas d'utilisateur avec cet email : %s" % email)
        user_auth_dict = self._db.user_auth.find_one({'_id': user_dict['_id']})
        if not user_auth_dict or not user_auth_dict.get('hashedPassword'):
            flask.abort(
                403, 'Utilisez Facebook ou Google pour vous connecter, comme la première fois.')

        hashed_old_password = user_auth_dict.get('hashedPassword')
        auth_token = _timestamped_hash(
            int(time.time()), email + str(user_dict['_id']) + hashed_old_password)

        user_profile = user_pb2.UserProfile()
        proto.parse_from_mongo(user_dict.get('profile'), user_profile)

        reset_link = parse.urljoin(flask.request.url, '/?' + parse.urlencode({
            'email': email,
            'resetToken': auth_token}))
        template_vars = {
            'resetLink': reset_link,
            'firstName': user_profile.name,
        }
        result = mail.send_template('71254', user_profile, template_vars)
        if result.status_code != 200:
            logging.error('Failed to send an email with MailJet:\n %s', result.text)
            flask.abort(result.status_code)


def _assert_valid_salt(salt, email, now):
    """Asserts a salt is valid.

    Returns:
        True if the salt has been generated by this server less than
        _SALT_VALIDITY_SECONDS ago.
    Raises:
        ValueError if the salt has not been generated by this server.
    """
    [timestamp, salt_check] = salt.split('.')
    timestamp = int(timestamp)
    if timestamp > now:
        raise ValueError("Salt's timestamp is in the future.")
    if timestamp < now - _SALT_VALIDITY_SECONDS:
        # Salt is too old, let's hope the client will try again with the
        # new salt.
        return False
    if salt_check != _unique_salt_check(timestamp, email):
        raise ValueError("Salt's signature is invalid")
    return True


def _timestamped_hash(timestamp, value):
    """Creates a cryptographic hash prefixed by a timestamp.

    This can be used either as a salt or as an auth token.
    """
    return '%d.%s' % (timestamp, _unique_salt_check(timestamp, value))


def _unique_salt_check(timestamp, email):
    """Hash a timestamp and email to make a salt unique to our server."""
    salter = hashlib.sha1()
    salter.update(str(timestamp).encode('ascii'))
    salter.update(str(email).encode('utf-8'))
    salter.update(SECRET_SALT)
    return binascii.hexlify(salter.digest()).decode('ascii')


def _base64_url_decode(encoded):
    encoded += '=' * (4 - (len(encoded) % 4))
    return base64.urlsafe_b64decode(encoded.encode('utf-8'))
