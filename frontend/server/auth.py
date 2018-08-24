"""Authentication module for MyGamePlan."""

import base64
import binascii
import datetime
import functools
import hashlib
import hmac
import json
import logging
import os
import random
import re
import time
from urllib import parse

from bson import objectid
import flask
from oauth2client import client
from oauth2client import crypt
import requests

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import user_pb2

_GOOGLE_SSO_ISSUERS = frozenset({
    'accounts.google.com', 'https://accounts.google.com'})

# https://console.cloud.google.com/apis/credentials/oauthclient/1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com?project=bayesimpact-my-game-plan
_GOOGLE_SSO_CLIENT_ID = os.getenv(
    'GOOGLE_SSO_CLIENT_ID',
    '1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com')
# https://developers.facebook.com/apps/1048782155234293/settings/
_FACEBOOK_SECRET = os.getenv(
    'FACEBOOK_APP_SECRET',
    # This is a fake ID, not used anywhere in staging nor prod. This default
    # value is used for tests and dev environment.
    'aA12bB34cC56dD78eE90fF12aA34bB56').encode('ascii', 'ignore')

_EMPLOI_STORE_CLIENT_ID = os.getenv('EMPLOI_STORE_CLIENT_ID')
_EMPLOI_STORE_CLIENT_SECRET = os.getenv('EMPLOI_STORE_CLIENT_SECRET')

# https://www.linkedin.com/developer/apps/4800174/auth
_LINKED_IN_CLIENT_ID = os.getenv('LINKED_IN_CLIENT_ID', '86r4xh5py0mw9k')
_LINKED_IN_CLIENT_SECRET = os.getenv('LINKED_IN_CLIENT_SECRET')

# This is a fake salt, not used anywhere in staging nor prod. This default
# value is used for tests and dev environment.
FAKE_SECRET_SALT = b'a2z3S5AKAEavfdr234aze075'
SECRET_SALT = os.getenv(
    'SECRET_SALT',
    FAKE_SECRET_SALT.decode('ascii')).encode('ascii', 'ignore')
# Validity of generated salt tokens.
_SALT_VALIDITY_SECONDS = datetime.timedelta(hours=2).total_seconds()

_ADMIN_AUTH_TOKEN = os.getenv('ADMIN_AUTH_TOKEN')

_PE_CONNECT_GENDER = {
    'female': user_pb2.FEMININE,
    'male': user_pb2.MASCULINE,
}

_AUTH_FIELDS = {
    'googleId': 'Google',
    'facebookId': 'Facebook',
    'peConnectId': 'Pôle emploi',
    'linkedInId': 'LinkedIn',
}


def require_admin(func):
    """Decorator for a function that requires admin authorization."""

    def _decorated_fun(*args, **kwargs):
        if _ADMIN_AUTH_TOKEN:
            request_token = flask.request.headers.get('Authorization')
            if not request_token:
                flask.abort(401)
            if request_token != _ADMIN_AUTH_TOKEN:
                flask.abort(403)
        return func(*args, **kwargs)
    return functools.wraps(func)(_decorated_fun)


def require_user(get_user_id, role='auth'):
    """Check if authenticated user has a valid token in Authorization header."""

    def _decorator(func):
        def _decorated_fun(*args, **kwargs):
            auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
            if not auth_token:
                flask.abort(401, 'Token manquant')
            user_id = get_user_id(*args, **kwargs)
            try:
                check_token(user_id, auth_token, role=role)
            except ValueError:
                flask.abort(403, 'Unauthorized token')
            return func(*args, **kwargs)
        return functools.wraps(func)(_decorated_fun)
    return _decorator


def require_user_in_args(role='auth'):
    """Check if authenticated user has a valid token in request GET args."""

    def _decorator(func):
        def _decorated_fun(*args, **kwargs):
            auth_token = flask.request.args.get('token')
            user_id = flask.request.args.get('user')
            if not user_id or not auth_token:
                flask.abort(422, 'Paramètres manquants.')
            try:
                check_token(user_id, auth_token, role=role)
            except ValueError:
                flask.abort(403, 'Accès non autorisé.')
            return func(*args, **dict(kwargs, user_id=user_id))
        return functools.wraps(func)(_decorated_fun)
    return _decorator


def require_google_user(emails_pattern='@bayesimpact.org', email_kwarg=None):
    """Check if authenticated user has a valid google id token
    in Authorization header, and associated google account is from
    bayesimpact.org domain.


    Args:
        emails_pattern: the regex pattern that email should validate to be authorized.
        email_kwarg: if set, the decorated function will get an extra keyword arg with
            the actual email address. If an admin token is used, the forwarded email address is
            'admin@bayesimpact.org'.
    """

    emails_regexp = re.compile(emails_pattern)

    def _decorator(wrapped):

        @functools.wraps(wrapped)
        def _wrapper(*args, **kwargs):
            authorization = flask.request.headers.get('Authorization', '')
            if authorization and _ADMIN_AUTH_TOKEN == authorization:
                if email_kwarg:
                    kwargs = dict(kwargs, **{email_kwarg: 'admin@bayesimpact.org'})
                return wrapped(*args, **kwargs)
            if not authorization.startswith('Bearer '):
                flask.abort(401, 'Token manquant')
            id_info = _decode_google_id_token(authorization.replace('Bearer ', ''))
            email = id_info['email']
            if not emails_regexp.search(email):
                flask.abort(401, 'Adresse email "{}" non autorisée'.format(email))
            if email_kwarg:
                kwargs = dict(kwargs, **{email_kwarg: email})
            return wrapped(*args, **kwargs)
        return _wrapper

    return _decorator


def _decode_google_id_token(token_id):
    """Decode a token generated by Google sign-in client-side,
    check that ISS is valid, and return the token content.
    This function calls flask.abort if anything is wrong"""

    try:
        id_info = client.verify_id_token(token_id, _GOOGLE_SSO_CLIENT_ID)
    except crypt.AppIdentityError as error:
        flask.abort(401, "Mauvais jeton d'authentification : {}".format(error))
    if id_info.get('iss') not in _GOOGLE_SSO_ISSUERS:
        flask.abort(
            401,
            "Fournisseur d'authentification invalide : {}.".format(id_info.get('iss', '<none>')))
    return id_info


def hash_user_email(email):
    """Hash email for better obfuscation of personal data."""

    hashed_email = hashlib.sha1()
    hashed_email.update(b'bob-emploi')
    hashed_email.update(email.lower().encode('utf-8'))
    return hashed_email.hexdigest()


class Authenticator(object):
    """An object to authenticate requests."""

    def __init__(self, user_db, db, save_new_user, update_returning_user):
        self._user_db = user_db
        self._db = db
        self._save_new_user = save_new_user
        self._update_returning_user = update_returning_user

    def authenticate(self, auth_request):
        """Authenticate a user."""

        if auth_request.google_token_id:
            return self._google_authenticate(auth_request.google_token_id)
        if auth_request.facebook_signed_request:
            return self._facebook_authenticate(
                auth_request.facebook_signed_request, auth_request.email)
        if auth_request.pe_connect_code:
            return self._pe_connect_authenticate(
                auth_request.pe_connect_code, auth_request.pe_connect_nonce)
        if auth_request.linked_in_code:
            return self._linked_in_authenticate(auth_request.linked_in_code)
        if auth_request.email:
            return self._password_authenticate(auth_request)
        if auth_request.user_id:
            return self._token_authenticate(auth_request)
        logging.warning('No mean of authentication found:\n%s', auth_request)
        flask.abort(422, "Aucun moyen d'authentification n'a été trouvé.")

    def _google_authenticate(self, token_id):
        id_info = _decode_google_id_token(token_id)
        response = user_pb2.AuthResponse()
        user_dict = self._user_db.user.find_one({'googleId': id_info['sub']})
        user_id = str(user_dict['_id']) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
            self._handle_returning_user(response)
        else:
            self._assert_user_not_existing(id_info['email'])
            response.authenticated_user.profile.email = id_info['email']
            response.authenticated_user.profile.picture_url = id_info.get('picture', '')
            response.authenticated_user.google_id = id_info['sub']
            self._save_new_user(response.authenticated_user)
            response.is_new_user = True

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    # TODO: Handle the case where a user creates its account through Facebook but refuses to share
    # their email (empty email at creation time).
    def _facebook_authenticate(self, signed_request, email):
        try:
            [encoded_signature, payload] = signed_request.split('.')
            data = json.loads(_base64_url_decode(payload).decode('utf-8'))
            actual_signature = _base64_url_decode(encoded_signature)
        except ValueError as error:
            flask.abort(422, error)
        for required_field in ('algorithm', 'user_id'):
            if not data.get(required_field):
                flask.abort(422, 'Le champs "{}" est requis : {}'.format(required_field, data))
        if data['algorithm'].lower() != 'hmac-sha256':
            flask.abort(422, 'Algorithme d\'encryption inconnu "{}"'.format(data['algorithm']))

        expected_signature = hmac.new(
            _FACEBOOK_SECRET, payload.encode('utf-8'), hashlib.sha256).digest()
        if expected_signature != actual_signature:
            flask.abort(403, 'Mauvaise signature')

        response = user_pb2.AuthResponse()
        user_dict = self._user_db.user.find_one({'facebookId': data['user_id']})
        user_id = str(user_dict['_id']) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
            self._handle_returning_user(response)
        else:
            if email:
                self._assert_user_not_existing(email)
                response.authenticated_user.profile.email = email
            response.authenticated_user.facebook_id = data['user_id']
            self._save_new_user(response.authenticated_user)
            response.is_new_user = True

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _pe_connect_authenticate(self, code, nonce):
        token_data = _get_oauth2_access_token(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            code=code,
            client_id=_EMPLOI_STORE_CLIENT_ID,
            client_secret=_EMPLOI_STORE_CLIENT_SECRET,
            auth_name='PE Connect',
        )

        if token_data.get('nonce') != nonce:
            flask.abort(403, 'Mauvais paramètre nonce')
        authorization_header = '{} {}'.format(
            token_data.get('token_type', 'Bearer'),
            token_data.get('access_token', ''))
        scopes = token_data.get('scope', '').split(' ')

        user_info_response = requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': authorization_header})
        if user_info_response.status_code < 200 or user_info_response.status_code >= 400:
            logging.warning(
                'PE Connect fails (%d): "%s"', user_info_response.status_code,
                user_info_response.text)
            flask.abort(403, user_info_response.text)

        user_info = user_info_response.json()

        city = None
        if 'coordonnees' in scopes:
            coordinates_response = requests.get(
                'https://api.emploi-store.fr/partenaire/peconnect-coordonnees/v1/coordonnees',
                headers={
                    'Authorization': authorization_header,
                    'pe-nom-application': 'Bob Emploi',
                })
            if coordinates_response.status_code >= 200 and coordinates_response.status_code < 400:
                coordinates = coordinates_response.json()
                city = geo.get_city_proto(coordinates.get('codeINSEE'))

        job = None
        if 'competences' in scopes:
            competences_response = requests.get(
                'https://api.emploi-store.fr/partenaire/peconnect-competences/v1/competences',
                headers={'Authorization': authorization_header},
            )
            if competences_response.status_code >= 200 and competences_response.status_code < 400:
                competences = competences_response.json()
                job_id, rome_id = next(
                    ((c.get('codeAppellation'), c.get('codeRome')) for c in competences),
                    (None, None))
                job = jobs.get_job_proto(self._db, job_id, rome_id)

        response = user_pb2.AuthResponse()
        user_dict = self._user_db.user.find_one({'peConnectId': user_info['sub']})
        user_id = str(user_dict.pop('_id')) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
            self._handle_returning_user(response)
        else:
            email = user_info.get('email')
            if email:
                self._assert_user_not_existing(email)
                response.authenticated_user.profile.email = email
            user = response.authenticated_user
            user.pe_connect_id = user_info['sub']
            # TODO(pascal): Handle the case where one of the name is missing.
            user.profile.name = french.cleanup_firstname(user_info.get('given_name', ''))
            user.profile.last_name = french.cleanup_firstname(user_info.get('family_name', ''))
            user.profile.gender = \
                _PE_CONNECT_GENDER.get(user_info.get('gender', ''), user_pb2.UNKNOWN_GENDER)
            if city or job:
                user.projects.add(
                    is_incomplete=True,
                    city=city or None,
                    mobility=geo_pb2.Location(city=city) if city else None,
                    target_job=job)
            self._save_new_user(user)
            response.is_new_user = True

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _linked_in_authenticate(self, code):
        token_data = _get_oauth2_access_token(
            'https://www.linkedin.com/oauth/v2/accessToken',
            code=code,
            client_id=_LINKED_IN_CLIENT_ID,
            client_secret=_LINKED_IN_CLIENT_SECRET,
            auth_name='LinkedIn Auth',
        )

        authorization_header = '{} {}'.format(
            token_data.get('token_type', 'Bearer'),
            token_data.get('access_token', ''))

        user_info_response = requests.get(
            'https://api.linkedin.com/v1/people/~:'
            '(id,location,first-name,last-name,email-address)?format=json',
            headers={'Authorization': authorization_header})
        if user_info_response.status_code < 200 or user_info_response.status_code >= 400:
            logging.warning(
                'LinkedIn Auth fails (%d): "%s"', user_info_response.status_code,
                user_info_response.text)
            flask.abort(403, user_info_response.text)
        user_info = user_info_response.json()

        response = user_pb2.AuthResponse()
        # TODO(cyrille): Factorize with other 3rd party auth.
        user_dict = self._user_db.user.find_one({'linkedInId': user_info['id']})
        user_id = str(user_dict.pop('_id')) if user_dict else ''
        if proto.parse_from_mongo(user_dict, response.authenticated_user):
            response.authenticated_user.user_id = user_id
            self._handle_returning_user(response)
        else:
            email = user_info.get('emailAddress')
            if email:
                self._assert_user_not_existing(email)
                response.authenticated_user.profile.email = email
            user = response.authenticated_user
            user.linked_in_id = user_info['id']
            # TODO(pascal): Handle the case where one of the name is missing.
            user.profile.name = user_info.get('firstName', '')
            user.profile.last_name = user_info.get('lastName', '')
            self._save_new_user(user)
            response.is_new_user = True

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _assert_user_not_existing(self, email):
        existing_user = next(
            self._user_db.user.find(
                {'hashedEmail': hash_user_email(email)},
                {'_id': 1, 'googleId': 1, 'facebookId': 1, 'peConnectId': 1, 'linkedInId': 1})
            .limit(1),
            None)
        if not existing_user:
            return
        self._abort_using_other_auth(existing_user)

    def _abort_using_other_auth(self, user_dict):
        for field_name, auth_name in _AUTH_FIELDS.items():
            if user_dict.get(field_name):
                user_auth_name = auth_name
                break
        else:
            user_auth_name = 'Email/Mot de passe'
        flask.abort(
            403,
            "L'utilisateur existe mais utilise un autre moyen de connexion: {}."
            .format(user_auth_name))

    def _password_authenticate(self, auth_request):
        now = int(time.time())
        response = user_pb2.AuthResponse()
        response.hash_salt = _timestamped_hash(now, auth_request.email)

        user_dict = self._user_db.user.find_one(
            {'hashedEmail': hash_user_email(auth_request.email)})

        if not user_dict:
            return self._password_register(auth_request, response)

        user_id = str(user_dict['_id'])
        response.auth_token = create_token(user_id, 'auth')

        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_dict['_id']})

        if not user_auth_dict:
            self._abort_using_other_auth(user_dict)

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
                403, "Le sel n'a pas été généré par ce serveur : {}.".format(error))

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
        self._handle_returning_user(response)

        return response

    def _password_register(self, auth_request, response):
        """Registers a new user using a password."""

        if auth_request.hashed_password:
            if not (auth_request.email and auth_request.first_name and auth_request.last_name):
                flask.abort(422, 'Un champs requis est manquant (email, prénom ou nom)')
            response.authenticated_user.profile.email = auth_request.email
            response.authenticated_user.profile.name = auth_request.first_name
            response.authenticated_user.profile.last_name = auth_request.last_name
            user_data = self._save_new_user(response.authenticated_user)

            object_id = objectid.ObjectId(user_data.user_id)
            self._user_db.user_auth.insert_one({
                '_id': object_id,
                'hashedPassword': auth_request.hashed_password})
        response.is_new_user = True
        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')
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
                "Le jeton d'authentification n'a pas été généré par ce serveur : {}.".format(error))
        self._user_db.user_auth.replace_one(
            {'_id': objectid.ObjectId(user_id)},
            {'hashedPassword': auth_request.hashed_password})

    def _token_authenticate(self, auth_request):
        now = int(time.time())
        response = user_pb2.AuthResponse()
        response.hash_salt = _timestamped_hash(now, auth_request.email)

        try:
            user_id = objectid.ObjectId(auth_request.user_id)
        except objectid.InvalidId:
            flask.abort(
                400,
                'L\'identifiant utilisateur "{}" n\'a pas le bon format.'
                .format(auth_request.user_id))
        user_dict = self._user_db.user.find_one({'_id': user_id})

        if not user_dict:
            flask.abort(404, 'Utilisateur inconnu.')

        try:
            if not _assert_valid_salt(
                    auth_request.auth_token, str(user_id), now,
                    validity_seconds=datetime.timedelta(days=5).total_seconds()):
                flask.abort(403, "Token d'authentification périmé")
        except ValueError as error:
            flask.abort(403, "Le sel n'a pas été généré par ce serveur : {}.".format(error))

        if not proto.parse_from_mongo(user_dict, response.authenticated_user):
            flask.abort(500, 'Les données utilisateur sont corrompues dans la base de données.')

        response.auth_token = create_token(str(user_id), 'auth')
        response.authenticated_user.user_id = str(user_id)
        self._handle_returning_user(response)

        return response

    def send_reset_password_token(self, email):
        """Sends an email to user with a reset token so that they can reset their password."""

        user_dict = self._user_db.user.find_one({'hashedEmail': hash_user_email(email)})
        if not user_dict:
            flask.abort(403, "Nous n'avons pas d'utilisateur avec cet email : {}".format(email))
        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_dict['_id']})
        if not user_auth_dict or not user_auth_dict.get('hashedPassword'):
            flask.abort(
                403, 'Utilisez Facebook ou Google pour vous connecter, comme la première fois.')

        hashed_old_password = user_auth_dict.get('hashedPassword')
        auth_token = _timestamped_hash(
            int(time.time()), email + str(user_dict['_id']) + hashed_old_password)

        user_profile = proto.create_from_mongo(user_dict.get('profile'), user_pb2.UserProfile)

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

    def _handle_returning_user(self, response):
        response.last_access_at.CopyFrom(
            self._update_returning_user(response.authenticated_user))


def _get_oauth2_access_token(endpoint, code, client_id, client_secret, auth_name='OAuth2'):
    token_response = requests.post(
        endpoint,
        data=dict(
            grant_type='authorization_code',
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=flask.request.url_root,
        ))
    if token_response.status_code < 200 or token_response.status_code >= 400:
        try:
            json_error = token_response.json()
        except json.decoder.JSONDecodeError:
            json_error = None
        if json_error and json_error.keys() == {'error', 'error_description'}:
            error_description = json_error['error_description']
            if json_error['error'] in ('redirect_uri_mismatch', 'invalid_redirect_uri'):
                error_description += ' "{}"'.format(flask.request.url_root)
            logging.warning('%s fails (%s): %s', auth_name, json_error['error'], error_description)
        else:
            logging.warning(
                '%s fails (%d): "%s"',
                auth_name, token_response.status_code, token_response.text)
        flask.abort(403, token_response.text)

    return token_response.json()


def create_token(email, role='', is_using_timestamp=False):
    """Creates an auth token valid for a given email and a given role."""

    if is_using_timestamp:
        timestamp = int(time.time())
    else:
        timestamp = random.randint(0x10000, 0x1000000)

    return _timestamped_hash(timestamp, email + role)


def check_token(email, token, role=None):
    """Ensures a token is valid for a given role or raises a ValueError."""

    if _ADMIN_AUTH_TOKEN and token == _ADMIN_AUTH_TOKEN:
        return
    return _assert_valid_salt(token, email + role)


def _assert_valid_salt(salt, email, now=None, validity_seconds=_SALT_VALIDITY_SECONDS):
    """Asserts a salt is valid.

    Returns:
        True if the salt has been generated by this server less than
        _SALT_VALIDITY_SECONDS ago.
    Raises:
        ValueError if the salt has not been generated by this server.
    """

    [timestamp, salt_check] = salt.split('.')
    timestamp = int(timestamp)
    if now:
        if timestamp > now:
            raise ValueError("Salt's timestamp is in the future.")
        if timestamp < now - validity_seconds:
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

    return '{:d}.{}'.format(timestamp, _unique_salt_check(timestamp, value))


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
