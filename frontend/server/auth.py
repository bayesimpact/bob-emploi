"""Authentication module for MyGamePlan."""

import base64
import binascii
import datetime
import functools
import hashlib
import json
import logging
import os
import random
import re
import time
import typing
from typing import Any, Callable, Dict, List, NoReturn, Optional, Tuple, TypedDict
from urllib import parse

from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import timestamp_pb2
from oauth2client import client
from oauth2client import crypt
import pymongo
import requests
from werkzeug import exceptions
from werkzeug import http


from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import auth_pb2
from bob_emploi.frontend.api import user_pb2

if typing.TYPE_CHECKING:
    import mypy_extensions

    _UpdateReturningUserFuncType = Callable[
        [
            user_pb2.User,
            mypy_extensions.DefaultNamedArg(bool, 'force_update'),
            mypy_extensions.DefaultNamedArg(bool, 'has_set_email'),
        ],
        timestamp_pb2.Timestamp]

_LinkedInEmailResponse = TypedDict(
    '_LinkedInEmailResponse', {
        'handle~': Dict[str, str],
    }, total=False)

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
_LINKED_IN_CLIENT_SECRET = os.getenv('LINKED_IN_CLIENT_SECRET', 'Ydx7uSMVLQe6goTJ')

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

http.HTTP_STATUS_CODES[498] = 'Authentication token expired'


class ExpiredTokenException(exceptions.HTTPException):
    """Exception class for expired authentication tokens."""

    code = 498
    description = '<p>The authentication token has expired.</p>'


def require_admin(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator for a function that requires admin authorization."""

    def _decorated_fun(*args: Any, **kwargs: Any) -> Any:
        if _ADMIN_AUTH_TOKEN:
            request_token = flask.request.headers.get('Authorization')
            if not request_token:
                flask.abort(401)
            if request_token != _ADMIN_AUTH_TOKEN:
                flask.abort(403)
        return func(*args, **kwargs)
    return functools.wraps(func)(_decorated_fun)


# TODO(cyrille): Use typing_extension to ensure get_user_id has the same param
# as the function that is returned.

def require_user(get_user_id: Callable[..., str], role: str = 'auth') \
        -> Callable[[Callable[..., Any]], Any]:
    """Check if authenticated user has a valid token in Authorization header."""

    def _decorator(func: Callable[..., Any]) -> Any:
        def _decorated_fun(*args: Any, **kwargs: Any) -> Any:
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


def require_user_in_args(role: str = 'auth') -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Check if authenticated user has a valid token in request GET args."""

    def _decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        def _decorated_fun(*args: Any, **kwargs: Any) -> Any:
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


def require_google_user(
        emails_pattern: str = '@bayesimpact.org', email_kwarg: Optional[str] = None) \
        -> Callable[[Callable[..., Any]], Callable[..., Any]]:
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

    def _decorator(wrapped: Callable[..., Any]) -> Callable[..., Any]:

        @functools.wraps(wrapped)
        def _wrapper(*args: Any, **kwargs: Any) -> Any:
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
                flask.abort(401, f'Adresse email "{email}" non autorisée')
            if email_kwarg:
                kwargs = dict(kwargs, **{email_kwarg: email})
            return wrapped(*args, **kwargs)
        return _wrapper

    return _decorator


def _decode_google_id_token(token_id: str) -> Dict[str, str]:
    """Decode a token generated by Google sign-in client-side,
    check that ISS is valid, and return the token content.
    This function calls flask.abort if anything is wrong"""

    try:
        id_info = typing.cast(
            Dict[str, str], client.verify_id_token(token_id, _GOOGLE_SSO_CLIENT_ID))
    except crypt.AppIdentityError as error:
        flask.abort(401, f"Mauvais jeton d'authentification : {error}")
    if id_info.get('iss') not in _GOOGLE_SSO_ISSUERS:
        flask.abort(
            401,
            f"Fournisseur d'authentification invalide : {id_info.get('iss', '<none>')}.")
    return id_info


def hash_user_email(email: str) -> str:
    """Hash email for better obfuscation of personal data."""

    hashed_email = hashlib.sha1()
    hashed_email.update(b'bob-emploi')
    hashed_email.update(email.lower().encode('utf-8'))
    return hashed_email.hexdigest()


def delete_user(user_proto: user_pb2.User, user_database: pymongo.database.Database) -> bool:
    """Close a user's account.

    We assume the given user_proto is up-to-date, e.g. just being fetched from database.
    """

    try:
        user_id = objectid.ObjectId(user_proto.user_id)
    except objectid.InvalidId:
        logging.exception('Tried to delete a user with invalid ID "%s"', user_proto.user_id)
        return False
    filter_user = {'_id': user_id}

    # Remove authentication informations.
    user_database.user_auth.delete_one(filter_user)

    try:
        privacy.redact_proto(user_proto)
    except TypeError:
        logging.exception('Cannot delete account %s', str(user_id))
        return False
    user_proto.deleted_at.FromDatetime(now.get())
    user_proto.ClearField('user_id')
    user_database.user.replace_one(filter_user, json_format.MessageToDict(user_proto))
    return True


def _replace_arrondissement_insee_to_city(code_insee: str) -> str:
    """If needed replace arrondissement's insee code with the full city's one."""

    if code_insee.startswith('132'):
        return '13055'
    if code_insee.startswith('751'):
        return '75056'
    if code_insee.startswith('6938'):
        return '69123'
    return code_insee


def _parse_user_from_mongo(user_dict: Dict[str, Any], user: user_pb2.User) -> None:
    if not proto.parse_from_mongo(user_dict, user, 'user_id'):
        flask.abort(500, 'Les données utilisateur sont corrompues dans la base de données.')


class Authenticator(object):
    """An object to authenticate requests."""

    def __init__(
            self, user_db: pymongo.database.Database, db: Optional[pymongo.database.Database],
            save_new_user: Callable[[user_pb2.User], user_pb2.User],
            update_returning_user: '_UpdateReturningUserFuncType',
            user_collection: str = 'user') -> None:
        self._user_db = user_db
        self._db = db
        self._save_new_user = save_new_user
        self._update_returning_user = update_returning_user
        self._user_collection = self._user_db.get_collection(user_collection)

    def save_new_user(
            self, user: user_pb2.User, user_data: auth_pb2.AuthUserData) -> user_pb2.User:
        """Save a user with additional data."""

        user.profile.locale = user_data.locale
        user.features_enabled.alpha = user_data.is_alpha

        return self._save_new_user(user)

    def authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        """Authenticate a user."""

        if auth_request.google_token_id:
            return self._google_authenticate(auth_request)
        if auth_request.facebook_access_token:
            return self._facebook_authenticate(auth_request)
        if auth_request.pe_connect_code:
            return self._pe_connect_authenticate(auth_request)
        if auth_request.linked_in_code:
            return self._linked_in_authenticate(auth_request)
        if auth_request.email:
            return self._email_authenticate(auth_request)
        if auth_request.user_id:
            return self._token_authenticate(auth_request)

        # Create a guest user.
        if auth_request.first_name:
            return self._create_guest_user(auth_request)

        logging.warning('No mean of authentication found:\n%s', auth_request)
        flask.abort(422, "Aucun moyen d'authentification n'a été trouvé.")

    def _google_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        id_info = _decode_google_id_token(auth_request.google_token_id)
        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'googleId': id_info['sub']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            is_existing_user, had_email = self._load_user_from_token_or_email(
                auth_request, response.authenticated_user, id_info['email'])
            response.authenticated_user.profile.picture_url = id_info.get('picture', '')
            response.authenticated_user.google_id = id_info['sub']
            response.is_new_user = not response.authenticated_user.has_account
            response.authenticated_user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True, had_email=had_email)
            else:
                self.save_new_user(response.authenticated_user, auth_request.user_data)

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _facebook_authenticate(
            self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        user_info_response = requests.get('https://graph.facebook.com/v4.0/me', params=dict(
            fields='id,first_name,email',
            access_token=auth_request.facebook_access_token,
        ))
        if user_info_response.status_code < 200 or user_info_response.status_code >= 300:
            flask.abort(
                user_info_response.status_code,
                user_info_response.json().get('error', {}).get('message', ''))
        user_info = typing.cast(Dict[str, str], user_info_response.json())

        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'facebookId': user_info['id']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            is_existing_user, had_email = self._load_user_from_token_or_email(
                auth_request, response.authenticated_user, user_info.get('email'))
            response.authenticated_user.facebook_id = user_info['id']
            response.is_new_user = not response.authenticated_user.has_account
            response.authenticated_user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True, had_email=had_email)
            else:
                response.authenticated_user.profile.name = user_info.get('first_name', '')
                self.save_new_user(response.authenticated_user, auth_request.user_data)

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _pe_connect_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        token_data = _get_oauth2_access_token(
            'https://authentification-candidat.pole-emploi.fr/connexion/oauth2/access_token?'
            'realm=/individu',
            code=auth_request.pe_connect_code,
            client_id=_EMPLOI_STORE_CLIENT_ID or '',
            client_secret=_EMPLOI_STORE_CLIENT_SECRET or '',
            auth_name='PE Connect',
        )

        if token_data.get('nonce') != auth_request.pe_connect_nonce:
            flask.abort(403, 'Mauvais paramètre nonce')
        bearer = token_data.get('token_type', 'Bearer')
        access_token = token_data.get('access_token', '')
        authorization_header = f'{bearer} {access_token}'
        scopes = token_data.get('scope', '').split(' ')

        user_info_response = requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': authorization_header})
        if user_info_response.status_code < 200 or user_info_response.status_code >= 400:
            logging.warning(
                'PE Connect fails (%d): "%s"', user_info_response.status_code,
                user_info_response.text)
            flask.abort(403, user_info_response.text)

        user_info = typing.cast(Dict[str, str], user_info_response.json())

        city = None
        if 'coordonnees' in scopes:
            coordinates_response = requests.get(
                'https://api.emploi-store.fr/partenaire/peconnect-coordonnees/v1/coordonnees',
                headers={
                    'Authorization': authorization_header,
                    'pe-nom-application': 'Bob Emploi',
                })
            if coordinates_response.status_code >= 200 and coordinates_response.status_code < 400:
                coordinates = typing.cast(Dict[str, str], coordinates_response.json())
                code_insee = coordinates.get('codeINSEE')
                if code_insee:
                    clean_code_insee = _replace_arrondissement_insee_to_city(code_insee)
                    city = geo.get_city_proto(clean_code_insee)

        job = None
        if 'competences' in scopes:
            competences_response = requests.get(
                'https://api.emploi-store.fr/partenaire/peconnect-competences/v1/competences',
                headers={'Authorization': authorization_header},
            )
            if competences_response.status_code >= 200 and competences_response.status_code < 400:
                competences = typing.cast(List[Dict[str, str]], competences_response.json())
                job_id, rome_id = next(
                    ((c.get('codeAppellation'), c.get('codeRome')) for c in competences),
                    (None, None))
                if job_id and rome_id:
                    job = jobs.get_job_proto(self._db, job_id, rome_id)

        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'peConnectId': user_info['sub']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            user = response.authenticated_user
            is_existing_user, had_email = self._load_user_from_token_or_email(
                auth_request, user, user_info.get('email'))
            user.pe_connect_id = user_info['sub']
            response.is_new_user = force_update = not user.has_account
            user.has_account = True
            if city or job and not user.projects:
                force_update = True
                user.projects.add(is_incomplete=True, city=city or None, target_job=job)
            if is_existing_user:
                self._handle_returning_user(
                    response, force_update=force_update, had_email=had_email)
            else:
                # TODO(pascal): Handle the case where one of the name is missing.
                user.profile.name = french.cleanup_firstname(user_info.get('given_name', ''))
                user.profile.last_name = french.cleanup_firstname(user_info.get('family_name', ''))
                user.profile.gender = \
                    _PE_CONNECT_GENDER.get(user_info.get('gender', ''), user_pb2.UNKNOWN_GENDER)
                self.save_new_user(user, auth_request.user_data)

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _linked_in_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        token_data = _get_oauth2_access_token(
            'https://www.linkedin.com/oauth/v2/accessToken',
            code=auth_request.linked_in_code,
            client_id=_LINKED_IN_CLIENT_ID or '',
            client_secret=_LINKED_IN_CLIENT_SECRET or '',
            auth_name='LinkedIn Auth',
        )

        bearer = token_data.get('token_type', 'Bearer')
        access_token = token_data.get('access_token', '')
        authorization_header = f'{bearer} {access_token}'

        user_info_response = requests.get(
            'https://api.linkedin.com/v2/me',
            headers={'Authorization': authorization_header})
        if user_info_response.status_code < 200 or user_info_response.status_code >= 400:
            logging.warning(
                'LinkedIn Auth fails (%d): "%s"', user_info_response.status_code,
                user_info_response.text)
            flask.abort(403, user_info_response.text)
        user_info = typing.cast(Dict[str, str], user_info_response.json())

        response = auth_pb2.AuthResponse()
        # TODO(cyrille): Factorize with other 3rd party auth.
        user_dict = self._user_collection.find_one({'linkedInId': user_info['id']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            email_response = requests.get(
                'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
                headers={'Authorization': authorization_header})
            if email_response.status_code < 200 or email_response.status_code >= 400:
                logging.warning(
                    'LinkedIn Auth fails (%d): "%s"', email_response.status_code,
                    email_response.text)
                flask.abort(403, email_response.text)
            email_response_json = typing.cast(_LinkedInEmailResponse, email_response.json())
            email = email_response_json.get('handle~', {}).get('emailAddress')
            user = response.authenticated_user
            is_existing_user, had_email = self._load_user_from_token_or_email(
                auth_request, user, email)
            user.linked_in_id = user_info['id']
            response.is_new_user = not user.has_account
            user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True, had_email=had_email)
            else:
                # TODO(pascal): Handle the case where one of the name is missing.
                user.profile.name = user_info.get('localizedFirstName', '')
                user.profile.last_name = user_info.get('localizedLastName', '')
                self.save_new_user(user, auth_request.user_data)

        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _assert_user_not_existing(self, email: str) -> None:
        existing_user = next(
            self._user_collection.find(
                {'hashedEmail': hash_user_email(email)},
                {'_id': 1, 'googleId': 1, 'facebookId': 1, 'peConnectId': 1, 'linkedInId': 1})
            .limit(1),
            None)
        if not existing_user:
            return
        self._abort_using_other_auth(existing_user)

    def _abort_using_other_auth(self, user_dict: Dict[str, str]) -> NoReturn:
        for field_name, auth_name in _AUTH_FIELDS.items():
            if user_dict.get(field_name):
                user_auth_name = auth_name
                break
        else:
            user_auth_name = 'Email/Mot de passe'
        flask.abort(
            403,
            f"L'utilisateur existe mais utilise un autre moyen de connexion: {user_auth_name}.")

    def _email_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        instant = int(time.time())
        response = auth_pb2.AuthResponse()
        response.hash_salt = _timestamped_hash(instant, auth_request.email)

        user_dict = self._user_collection.find_one(
            {'hashedEmail': hash_user_email(auth_request.email)})

        if not user_dict:
            return self._email_register(auth_request, response)

        user_object_id = user_dict['_id']
        user_id = str(user_object_id)

        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_object_id})

        if not auth_request.hashed_password:
            # User exists but did not sent a password: probably just getting some fresh salt.
            return response

        if not user_auth_dict:
            if not auth_request.auth_token:
                # User is trying to connect with a password, but never created one.
                self.send_auth_token(user_dict)
                flask.abort(
                    403,
                    f'Nous avons envoyé un email à {auth_request.email} avec un lien pour se '
                    'connecter',
                )
            try:
                check_token(user_id, auth_request.auth_token, role='auth')
            except ValueError as error:
                flask.abort(403, f'Token invalide : {error}.')
            # User that already uses an SSO account is now trying to add a password.
            _parse_user_from_mongo(user_dict, response.authenticated_user)
            self._user_db.user_auth.insert_one({
                '_id': user_object_id,
                'hashedPassword': auth_request.hashed_password,
            })
            response.auth_token = create_token(user_id, 'auth')
            response.authenticated_user.has_account = True
            response.authenticated_user.has_password = True
            response.is_password_updated = True
            self._handle_returning_user(response, force_update=True)
            return response

        if auth_request.user_id:
            # User is a guest using a pre-existing email account:
            # maybe they're using the same password.
            if auth_request.hashed_password != user_auth_dict.get('hashedPassword', ''):
                return response
            _parse_user_from_mongo(user_dict, response.authenticated_user)
            return response

        if auth_request.auth_token:
            self._reset_password(auth_request, user_id, user_auth_dict)
            _parse_user_from_mongo(user_dict, response.authenticated_user)
            response.auth_token = create_token(user_id, 'auth')
            return response

        if not auth_request.hash_salt:
            # User exists but has not sent salt: probably just getting some fresh salt.
            return response

        # Check that salt is valid.
        salt = auth_request.hash_salt
        try:
            if not _assert_valid_salt(salt, auth_request.email, instant):
                return response
        except ValueError as error:
            flask.abort(
                403, f"Le sel n'a pas été généré par ce serveur : {error}.")

        stored_hashed_password = user_auth_dict.get('hashedPassword', '')

        hashed_password = hashlib.sha1()
        hashed_password.update(salt.encode('ascii'))
        hashed_password.update(stored_hashed_password.encode('ascii'))
        request_hashed_password = binascii.unhexlify(auth_request.hashed_password)
        if request_hashed_password != hashed_password.digest():
            flask.abort(403, 'Mot de passe erroné.')

        _parse_user_from_mongo(user_dict, response.authenticated_user)
        response.auth_token = create_token(user_id, 'auth')

        # Update the password.
        if auth_request.new_hashed_password:
            self._user_db.user_auth.replace_one(
                {'_id': user_object_id},
                {'hashedPassword': auth_request.new_hashed_password})
            response.is_password_updated = True

        self._handle_returning_user(response)

        return response

    def _email_register(
            self, auth_request: auth_pb2.AuthRequest, response: auth_pb2.AuthResponse) \
            -> auth_pb2.AuthResponse:
        """Registers a new user using an email address."""

        is_existing_user = self._load_user_with_token(
            auth_request, response.authenticated_user, is_timestamp_required=False)
        force_update = False
        had_email = bool(response.authenticated_user.profile.email)
        if not is_existing_user and auth_request.hashed_password:
            if not (auth_request.first_name and auth_request.last_name):
                flask.abort(422, 'Un champs requis est manquant (prénom ou nom)')

        should_create_account = not is_existing_user and auth_request.hashed_password
        if is_existing_user or should_create_account:
            force_update |= response.authenticated_user.profile.email != auth_request.email
            response.authenticated_user.profile.email = auth_request.email
            response.authenticated_user.hashed_email = hash_user_email(auth_request.email)
            response.is_new_user = not response.authenticated_user.has_account
            force_update |= response.is_new_user
            response.authenticated_user.has_account = True
            force_update |= \
                response.authenticated_user.has_password != bool(auth_request.hashed_password)
            response.authenticated_user.has_password = bool(auth_request.hashed_password)

        if is_existing_user:
            self._handle_returning_user(response, had_email=had_email, force_update=force_update)
        elif should_create_account:
            response.authenticated_user.profile.name = auth_request.first_name
            response.authenticated_user.profile.last_name = auth_request.last_name
            self.save_new_user(response.authenticated_user, auth_request.user_data)

        if auth_request.hashed_password:
            object_id = objectid.ObjectId(response.authenticated_user.user_id)
            self._user_db.user_auth.replace_one(
                {'_id': object_id},
                {'hashedPassword': auth_request.hashed_password},
                upsert=True)
            response.is_password_updated = True

        response.is_new_user = not is_existing_user
        # TODO(cyrille): Consider dropping if there's no user_id.
        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')
        return response

    def _reset_password(
            self, auth_request: auth_pb2.AuthRequest, user_id: str,
            user_auth_dict: Dict[str, str]) -> None:
        """Resets the user's password."""

        try:
            is_token_valid = _assert_valid_salt(
                auth_request.auth_token,
                auth_request.email + user_id + user_auth_dict.get('hashedPassword', ''),
                int(time.time()))
            if not is_token_valid:
                raise ExpiredTokenException("Le jeton d'authentification est périmé.")
        except ValueError as error:
            flask.abort(
                401,
                f"Le jeton d'authentification n'a pas été généré par ce serveur : {error}.")
        self._user_db.user_auth.replace_one(
            {'_id': objectid.ObjectId(user_id)},
            {'hashedPassword': auth_request.hashed_password})

    def _token_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        instant = int(time.time())
        response = auth_pb2.AuthResponse()
        response.hash_salt = _timestamped_hash(instant, auth_request.email)
        self._load_user_with_token(auth_request, response.authenticated_user)
        if response.authenticated_user.HasField('deleted_at'):
            flask.abort(404, 'Compte supprimé')
        response.auth_token = create_token(auth_request.user_id, 'auth')
        self._handle_returning_user(response)

        return response

    def _load_user_with_token(
            self, auth_request: auth_pb2.AuthRequest, out_user: user_pb2.User,
            is_timestamp_required: bool = True) -> bool:
        if not auth_request.user_id:
            return False
        try:
            user_id = objectid.ObjectId(auth_request.user_id)
        except objectid.InvalidId:
            flask.abort(
                400, f'L\'identifiant utilisateur "{auth_request.user_id}" n\'a pas le bon format.')
        try:
            if not _assert_valid_salt(
                    auth_request.auth_token, str(user_id), int(time.time()),
                    validity_seconds=datetime.timedelta(days=5).total_seconds()) \
                    and is_timestamp_required:
                raise ExpiredTokenException("Token d'authentification périmé")
        except ValueError as error:
            flask.abort(403, f"Le sel n'a pas été généré par ce serveur : {error}.")

        user_dict = self._user_collection.find_one({'_id': user_id})

        if not user_dict:
            flask.abort(404, 'Utilisateur inconnu.')

        _parse_user_from_mongo(user_dict, out_user)

        return True

    def _load_user_from_token_or_email(
            self, auth_request: auth_pb2.AuthRequest, user: user_pb2.User,
            email: Optional[str]) -> Tuple[bool, bool]:
        is_existing_user = email and proto.parse_from_mongo(
            self._user_collection.find_one({'hashedEmail': hash_user_email(email)}),
            user, 'user_id') or \
            self._load_user_with_token(auth_request, user, is_timestamp_required=False)
        had_email = bool(user.profile.email)
        if not had_email and email:
            user.profile.email = email
        return is_existing_user, had_email

    def _create_guest_user(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        response = auth_pb2.AuthResponse()
        response.authenticated_user.profile.name = auth_request.first_name
        self.save_new_user(response.authenticated_user, auth_request.user_data)
        response.auth_token = create_token(response.authenticated_user.user_id, 'auth')
        response.is_new_user = True
        return response

    def create_reset_token(self, user_id: objectid.ObjectId) -> Tuple[Optional[str], str]:
        """Create a token to reset the user's password."""

        user_dict = self._user_collection.find_one({'_id': user_id})
        return self._create_reset_token_from_user(user_dict)

    def _create_reset_token_from_user(self, user_dict: Dict[str, Any]) -> Tuple[Optional[str], str]:
        """Returns the token, and the linked email address."""

        email = user_dict.get('profile', {}).get('email', '')

        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_dict['_id']})
        if not user_auth_dict or not user_auth_dict.get('hashedPassword'):
            return None, email

        hashed_old_password = user_auth_dict.get('hashedPassword', '')
        auth_token = _timestamped_hash(
            int(time.time()), email + str(user_dict['_id']) + hashed_old_password)
        return auth_token, email

    def send_reset_password_token(self, email: str) -> None:
        """Sends an email to user with a reset token so that they can reset their password."""

        user_dict = self._user_collection.find_one({'hashedEmail': hash_user_email(email)})
        if not user_dict:
            flask.abort(403, f"Nous n'avons pas d'utilisateur avec cet email : {email}")

        auth_token, unused_email = self._create_reset_token_from_user(user_dict)
        if not auth_token:
            flask.abort(
                403, 'Utilisez Facebook ou Google pour vous connecter, comme la première fois.')

        user_profile = typing.cast(
            user_pb2.UserProfile,
            proto.create_from_mongo(user_dict.get('profile'), user_pb2.UserProfile))

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

    def send_auth_token(self, user_dict: Dict[str, Any]) -> None:
        """Sends an email to the user with an auth token so that they can log in."""

        user_profile = typing.cast(
            user_pb2.UserProfile,
            proto.create_from_mongo(user_dict.get('profile'), user_pb2.UserProfile))

        user_id = str(user_dict['_id'])
        auth_token = create_token(user_id, is_using_timestamp=True)
        # TODO(pascal): Factorize with campaign.create_logged_url.
        auth_link = parse.urljoin(flask.request.url, '/?' + parse.urlencode({
            'userId': user_id,
            'authToken': auth_token}))
        template_vars = {
            'authLink': auth_link,
            'firstName': user_profile.name,
        }
        result = mail.send_template('1140080', user_profile, template_vars)
        if result.status_code != 200:
            logging.error('Failed to send an email with MailJet:\n %s', result.text)
            flask.abort(result.status_code)

    def _handle_returning_user(
            self, response: auth_pb2.AuthResponse, force_update: bool = False,
            had_email: bool = True) -> None:
        response.last_access_at.CopyFrom(self._update_returning_user(
            response.authenticated_user,
            force_update=force_update or response.is_new_user,
            has_set_email=bool(not had_email and response.authenticated_user.profile.email)))


def _get_oauth2_access_token(
        endpoint: str, code: str, client_id: str, client_secret: str, auth_name: str = 'OAuth2') \
        -> Dict[str, str]:
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
            json_error = typing.cast(Dict[str, str], token_response.json())
        except json.decoder.JSONDecodeError:
            json_error = {}
        if json_error and json_error.keys() == {'error', 'error_description'}:
            error_description = json_error['error_description']
            if json_error['error'] in ('redirect_uri_mismatch', 'invalid_redirect_uri'):
                error_description += f' "{flask.request.url_root}"'
            logging.warning('%s fails (%s): %s', auth_name, json_error['error'], error_description)
        else:
            logging.warning(
                '%s fails (%d): "%s"',
                auth_name, token_response.status_code, token_response.text)
        flask.abort(403, token_response.text)

    return typing.cast(Dict[str, str], token_response.json())


def create_token(email: str, role: str = '', is_using_timestamp: bool = False) -> str:
    """Creates an auth token valid for a given email and a given role."""

    if is_using_timestamp:
        timestamp = int(time.time())
    else:
        timestamp = random.randint(0x10000, 0x1000000)

    return _timestamped_hash(timestamp, email + role)


def check_token(email: str, token: str, role: str = '') -> bool:
    """Ensures a token is valid for a given role or raises a ValueError."""

    if _ADMIN_AUTH_TOKEN and token == _ADMIN_AUTH_TOKEN:
        return True
    return _assert_valid_salt(token, email + role)


def _assert_valid_salt(
        salt: str, email: str, instant: Optional[int] = None,
        validity_seconds: float = _SALT_VALIDITY_SECONDS) \
        -> bool:
    """Asserts a salt is valid.

    Returns:
        True if the salt has been generated by this server less than
        _SALT_VALIDITY_SECONDS ago.
    Raises:
        ValueError if the salt has not been generated by this server.
    """

    [timestamp_str, salt_check] = salt.split('.')
    timestamp = int(timestamp_str)
    if instant:
        if timestamp > instant:
            raise ValueError("Salt's timestamp is in the future.")
        if timestamp < instant - validity_seconds:
            # Salt is too old, let's hope the client will try again with the
            # new salt.
            return False
    if salt_check != _unique_salt_check(timestamp, email):
        raise ValueError("Salt's signature is invalid")
    return True


def _timestamped_hash(timestamp: int, value: str) -> str:
    """Creates a cryptographic hash prefixed by a timestamp.

    This can be used either as a salt or as an auth token.
    """

    return f'{timestamp:d}.{_unique_salt_check(timestamp, value)}'


def _unique_salt_check(timestamp: int, email: str) -> str:
    """Hash a timestamp and email to make a salt unique to our server."""

    salter = hashlib.sha1()
    salter.update(str(timestamp).encode('ascii'))
    salter.update(str(email).encode('utf-8'))
    salter.update(SECRET_SALT)
    return binascii.hexlify(salter.digest()).decode('ascii')


def _base64_url_decode(encoded: str) -> bytes:
    encoded += '=' * (4 - (len(encoded) % 4))
    return base64.urlsafe_b64decode(encoded.encode('utf-8'))
