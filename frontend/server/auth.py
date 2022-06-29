"""Authentication module for MyGamePlan."""

import binascii
import datetime
import functools
import hashlib
import logging
import os
import re
import time
import typing
from typing import Any, Callable, NoReturn, Optional, Tuple, TypedDict, Union
from urllib import parse

import bson
from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import timestamp_pb2
import requests
from requests import exceptions as request_exceptions
import werkzeug
from werkzeug import exceptions
from werkzeug import http


from bob_emploi.common.python import now
from bob_emploi.frontend.server import auth_token as token
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import product
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.api import auth_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2

if typing.TYPE_CHECKING:

    class _UpdateReturningUserFuncType(typing.Protocol):

        def __call__(
            self, user: user_pb2.User, /, force_update: bool = ...,
        ) -> timestamp_pb2.Timestamp:
            ...

_LinkedInEmailResponse = TypedDict(
    '_LinkedInEmailResponse', {
        'handle~': dict[str, str],
    }, total=False)


_EMPLOI_STORE_CLIENT_ID = os.getenv('EMPLOI_STORE_CLIENT_ID')
_EMPLOI_STORE_CLIENT_SECRET = os.getenv('EMPLOI_STORE_CLIENT_SECRET')

# https://www.linkedin.com/developer/apps/4800174/auth
_LINKED_IN_CLIENT_ID = os.getenv('LINKED_IN_CLIENT_ID', '86r4xh5py0mw9k')
_LINKED_IN_CLIENT_SECRET = os.getenv('LINKED_IN_CLIENT_SECRET', 'fake-key-fake-key')

_PE_CONNECT_GENDER = {
    'female': user_profile_pb2.FEMININE,
    'male': user_profile_pb2.MASCULINE,
}

_AUTH_FIELDS = {
    'googleId': 'Google',
    'facebookId': 'Facebook',
    'peConnectId': 'Pôle emploi',
    'linkedInId': 'LinkedIn',
}

_AUTH_TOKEN_COOKIE_NAME = 'auth_token'

_AUTH_TOKEN_PERSISTENCE_DURATION = datetime.timedelta(days=30)

http.HTTP_STATUS_CODES[498] = 'Authentication token expired'

_MA_VOIE_API_URL = os.getenv('MA_VOIE_API_URL')
_MA_VOIE_AUTH = tuple(os.getenv('MA_VOIE_AUTH', ':').split(':', 1))

# TODO(cyrille): Add the env variable to the cloudformation template.
_ENABLE_ACTION_PLAN = bool(os.getenv('ENABLE_ACTION_PLAN', os.getenv('BOB_DEPLOYMENT') == 'fr'))


def _register_to_ma_voie(ma_voie: user_pb2.MaVoieInfo) -> None:
    if not _MA_VOIE_API_URL or not _MA_VOIE_AUTH[0] or not _MA_VOIE_AUTH[1]:
        logging.warning(
            'Ma Voie registration is not well configured:\nURL "%s"\nusername "%s"\npassword %s',
            _MA_VOIE_API_URL, _MA_VOIE_AUTH[0], '"****"' if _MA_VOIE_AUTH[1] else 'not set')
        return
    response = requests.post(
        f'{_MA_VOIE_API_URL}/user/{ma_voie.ma_voie_id}/register',
        auth=_MA_VOIE_AUTH, json={'stepId': ma_voie.step_id})
    try:
        response.raise_for_status()
    except request_exceptions.HTTPError:
        logging.error("Couln't register user to Ma Voie.")


class ExpiredTokenException(exceptions.HTTPException):
    """Exception class for expired authentication tokens."""

    code = 498
    description = '<p>The authentication token has expired.</p>'


def require_admin(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator for a function that requires admin authorization."""

    def _decorated_fun(*args: Any, **kwargs: Any) -> Any:
        request_token = flask.request.headers.get('Authorization', '')
        try:
            is_valid_token = token.check_admin_token(request_token)
        except ValueError:
            is_valid_token = False
        if not is_valid_token:
            # TODO(cyrille): Raise on empty ADMIN_AUTH_TOKEN and check this before.
            if not request_token:
                flask.abort(401)
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
                auth_token = flask.request.args.get('token', '')
                if not auth_token:
                    auth_token = flask.request.cookies.get(_AUTH_TOKEN_COOKIE_NAME, '')
                    if not auth_token:
                        flask.abort(401, i18n.flask_translate('Token manquant'))
            user_id = get_user_id(*args, **kwargs)
            try:
                token.check_token(user_id, auth_token, role=role)
            except ValueError:
                flask.abort(403, i18n.flask_translate('Unauthorized token'))
            return func(*args, **kwargs)
        return functools.wraps(func)(_decorated_fun)
    return _decorator


def _set_auth_cookie(
        response: flask.Response, *, value: str, expires_delta: Optional[float]) -> None:
    response.set_cookie(
        _AUTH_TOKEN_COOKIE_NAME, value=value, path='/api/', secure=True, httponly=True,
        expires=(int(time.time() - expires_delta)) if expires_delta else None)


_FlaskResponse = Union[str, werkzeug.Response, tuple[str, int]]


def clear_user_cookies(func: Callable[..., _FlaskResponse]) -> Callable[..., flask.Response]:
    """Decorator to clear a user auth cookies when returning."""

    def _decorated_fun(*args: Any, **kwargs: Any) -> flask.Response:
        response = func(*args, **kwargs)
        flask_response = flask.make_response(response)
        _set_auth_cookie(flask_response, value='', expires_delta=-3600)
        return flask_response

    return functools.wraps(func)(_decorated_fun)


def set_auth_cookie(
        response: flask.Response, auth_token: str, is_persistent: bool = False) -> None:
    """Sets the auth cookie for future re-authentication."""

    _set_auth_cookie(
        response, value=auth_token,
        expires_delta=_AUTH_TOKEN_PERSISTENCE_DURATION.total_seconds() if is_persistent else None)


def require_user_in_args(role: str = 'auth') -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Check if authenticated user has a valid token in request GET args."""

    def _decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        def _decorated_fun(*args: Any, **kwargs: Any) -> Any:
            auth_token = flask.request.args.get('token')
            user_id = flask.request.args.get('user')
            if not user_id or not auth_token:
                flask.abort(422, i18n.flask_translate('Paramètres manquants.'))
            try:
                token.check_token(user_id, auth_token, role=role)
            except ValueError:
                flask.abort(403, i18n.flask_translate('Accès non autorisé.'))
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

    def _get_google_email(authorization: str) -> str:

        try:
            token.check_admin_token(authorization)
            return 'admin@bayesimpact.org'
        except ValueError:
            pass
        if authorization.startswith('Bearer '):
            authorization = authorization.removeprefix('Bearer ')
        else:
            authorization = flask.request.args.get('token', '')
            if not authorization:
                flask.abort(401, i18n.flask_translate('Token manquant'))
        try:
            return token.check_google_token(authorization, emails_regexp)
        except i18n.TranslatableException as error:
            flask.abort(401, error.flask_translate())

    def _decorator(wrapped: Callable[..., Any]) -> Callable[..., Any]:

        @functools.wraps(wrapped)
        def _wrapper(*args: Any, **kwargs: Any) -> Any:
            email = _get_google_email(flask.request.headers.get('Authorization', ''))
            if email_kwarg:
                kwargs = kwargs | {email_kwarg: email}
            return wrapped(*args, **kwargs)
        return _wrapper

    return _decorator


def hash_user_email(email: str) -> str:
    """Hash email for better obfuscation of personal data."""

    hashed_email = hashlib.sha1()
    hashed_email.update(b'bob-emploi')
    hashed_email.update(email.lower().encode('utf-8'))
    return hashed_email.hexdigest()


def delete_user(user_proto: user_pb2.User, user_database: mongo.UsersDatabase) -> bool:
    """Close a user's account.

    We assume the given user_proto is up-to-date, e.g. just being fetched from database.
    """

    try:
        user_id = objectid.ObjectId(user_proto.user_id)
    except bson.errors.InvalidId:
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


def _parse_user_from_mongo(user_dict: dict[str, Any], user: user_pb2.User) -> None:
    if not proto.parse_from_mongo(user_dict, user, 'user_id'):
        flask.abort(
            500,
            i18n.flask_translate(
                'Les données utilisateur sont corrompues dans la base de données.'))


def _abort_failed_login() -> None:
    flask.abort(
        403,
        i18n.flask_translate(
            "L'email et le mot de passe ne correspondent pas. " +
            "Si vous avez déjà créé un compte mais que vous n'avez pas créé votre mot de passe, " +
            'nous venons de vous envoyer un email pour vous connecter.'))


def _check_password(stored_hashed_password: str, salt: str, request_hashed_password: str) -> None:
    hashed_password = hashlib.sha1()
    hashed_password.update(salt.encode('ascii'))
    hashed_password.update(stored_hashed_password.encode('ascii'))
    request_hashed_password_bin = binascii.unhexlify(request_hashed_password)
    if request_hashed_password_bin != hashed_password.digest():
        _abort_failed_login()


def _get_auth_error_message() -> str:
    return i18n.flask_translate("Les informations d'authentification ne sont pas valides.")


def _abort_on_bad_auth() -> NoReturn:
    flask.abort(403, _get_auth_error_message())


class Authenticator:
    """An object to authenticate requests."""

    def __init__(
            self, user_db: mongo.UsersDatabase,
            save_new_user: Callable[[user_pb2.User], user_pb2.User],
            update_returning_user: '_UpdateReturningUserFuncType') -> None:
        self._user_db = user_db
        self._save_new_user = save_new_user
        self._update_returning_user = update_returning_user
        self._user_collection = self._user_db.user

    def save_new_user(
            self, user: user_pb2.User, user_data: auth_pb2.AuthUserData) -> user_pb2.User:
        """Save a user with additional data."""

        user.profile.locale = user_data.locale
        user.features_enabled.alpha = user_data.is_alpha
        user.features_enabled.exclude_from_analytics = user_data.is_alpha
        if _ENABLE_ACTION_PLAN or user_data.is_action_plan_enabled:
            user.features_enabled.action_plan = features_pb2.ACTIVE
        if user_data.HasField('ma_voie'):
            user.ma_voie.CopyFrom(user_data.ma_voie)
            _register_to_ma_voie(user_data.ma_voie)
        if user_data.HasField('original_self_diagnostic'):
            original_self_diagnostic = diagnostic_pb2.SelfDiagnostic()
            original_self_diagnostic.CopyFrom(user_data.original_self_diagnostic)
            user.projects.add(is_incomplete=True, original_self_diagnostic=original_self_diagnostic)

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
        flask.abort(422, i18n.flask_translate("Aucun moyen d'authentification n'a été trouvé."))

    def change_email(self, user_proto: user_pb2.User, auth_request: auth_pb2.AuthRequest) \
            -> user_pb2.User:
        """Change user's email address."""

        new_hashed_email = hash_user_email(auth_request.email)
        if user_proto.hashed_email == new_hashed_email:
            # Trying to set the same email.
            return user_proto

        user_auth_dict = self._user_db.user_auth.find_one(
            {'_id': objectid.ObjectId(user_proto.user_id)})
        if user_auth_dict or auth_request.hashed_password:
            if not user_auth_dict:
                flask.abort(
                    422, i18n.flask_translate("L'utilisateur n'a pas encore de mot de passe"))
            stored_hashed_password = user_auth_dict.get('hashedPassword', '')
            _check_password(
                stored_hashed_password, auth_request.hash_salt, auth_request.hashed_password)

        existing = self._user_collection.find_one({'hashedEmail': new_hashed_email}, {'_id': 1})
        if existing:
            flask.abort(
                403,
                i18n.flask_translate('L\'email "{email}" est déjà utilisé par un autre compte')
                .format(email=auth_request.email))

        user_proto.profile.email = auth_request.email
        user_proto.hashed_email = new_hashed_email
        if user_auth_dict:
            self._user_db.user_auth.replace_one(
                {'_id': objectid.ObjectId(user_proto.user_id)},
                {'hashedPassword': auth_request.new_hashed_password})
        self._update_returning_user(user_proto, force_update=True)
        return user_proto

    def _google_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        try:
            id_info = token.decode_google_id_token(auth_request.google_token_id)
        except i18n.TranslatableException as error:
            flask.abort(401, error.flask_translate())
        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'googleId': id_info['sub']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            is_existing_user = self._load_user_from_token_or_email(
                auth_request, response.authenticated_user, id_info['email'])
            response.authenticated_user.profile.picture_url = id_info.get('picture', '')
            response.authenticated_user.google_id = id_info['sub']
            response.is_new_user = not response.authenticated_user.has_account
            response.authenticated_user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True)
            else:
                self.save_new_user(response.authenticated_user, auth_request.user_data)

        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')

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
        user_info = typing.cast(dict[str, str], user_info_response.json())

        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'facebookId': user_info['id']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            is_existing_user = self._load_user_from_token_or_email(
                auth_request, response.authenticated_user, user_info.get('email'))
            response.authenticated_user.facebook_id = user_info['id']
            response.is_new_user = not response.authenticated_user.has_account
            response.authenticated_user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True)
            else:
                response.authenticated_user.profile.name = user_info.get('first_name', '')
                self.save_new_user(response.authenticated_user, auth_request.user_data)

        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')

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
            flask.abort(403, i18n.flask_translate('Mauvais paramètre nonce'))
        bearer = token_data.get('token_type', 'Bearer')
        access_token = token_data.get('access_token', '')
        authorization_header = f'{bearer} {access_token}'

        user_info_response = requests.get(
            'https://api.emploi-store.fr/partenaire/peconnect-individu/v1/userinfo',
            headers={'Authorization': authorization_header})
        if user_info_response.status_code < 200 or user_info_response.status_code >= 400:
            logging.warning(
                'PE Connect fails (%d): "%s"', user_info_response.status_code,
                user_info_response.text)
            flask.abort(403, user_info_response.text)

        user_info = typing.cast(dict[str, str], user_info_response.json())

        response = auth_pb2.AuthResponse()
        user_dict = self._user_collection.find_one({'peConnectId': user_info['sub']})
        if proto.parse_from_mongo(user_dict, response.authenticated_user, 'user_id'):
            self._handle_returning_user(response)
        else:
            user = response.authenticated_user
            is_existing_user = self._load_user_from_token_or_email(
                auth_request, user, user_info.get('email'))
            user.pe_connect_id = user_info['sub']
            response.is_new_user = force_update = not user.has_account
            user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=force_update)
            else:
                # TODO(pascal): Handle the case where one of the name is missing.
                user.profile.name = french.cleanup_firstname(user_info.get('given_name', ''))
                user.profile.last_name = french.cleanup_firstname(user_info.get('family_name', ''))
                user.profile.gender = _PE_CONNECT_GENDER.get(
                    user_info.get('gender', ''), user_profile_pb2.UNKNOWN_GENDER)
                self.save_new_user(user, auth_request.user_data)

        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')

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
        user_info = typing.cast(dict[str, str], user_info_response.json())

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
            is_existing_user = self._load_user_from_token_or_email(auth_request, user, email)
            user.linked_in_id = user_info['id']
            response.is_new_user = not user.has_account
            user.has_account = True
            if is_existing_user:
                self._handle_returning_user(response, force_update=True)
            else:
                # TODO(pascal): Handle the case where one of the name is missing.
                user.profile.name = user_info.get('localizedFirstName', '')
                user.profile.last_name = user_info.get('localizedLastName', '')
                self.save_new_user(user, auth_request.user_data)

        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')

        return response

    def _get_reset_password_link(self, user_dict: dict[str, Any]) -> str:
        auth_token, email = self._create_reset_token_from_user(user_dict)

        return parse.urljoin(flask.request.url_root, '?' + parse.urlencode({
            'email': email,
            'resetToken': auth_token}))

    def send_update_confirmation(self, user_dict: dict[str, Any]) -> None:
        """Sends an email to the user that confirms password change."""

        user_id = str(user_dict['_id'])
        if not user_id:
            return
        auth_link = token.create_logged_url(user_id)
        reset_link = self._get_reset_password_link(user_dict)
        if not reset_link or not auth_link:
            return
        user = proto.create_from_mongo(user_dict.copy(), user_pb2.User)
        template_vars = dict(
            campaign.get_default_coaching_email_vars(user),
            authLink=auth_link, resetPwdLink=reset_link)
        # TODO(cyrille): Create a static Campaign object and use it.
        result = mail_send.send_template(
            'send-pwd-update-confirmation', user.profile, template_vars)
        if result.status_code != 200:
            logging.error('Failed to send an email with MailJet:\n %s', result.text)
            flask.abort(result.status_code)

    def _email_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        instant = int(time.time())
        response = auth_pb2.AuthResponse()
        response.hash_salt = token.timestamped_hash(instant, auth_request.email)

        user_dict = self._user_collection.find_one(
            {'hashedEmail': hash_user_email(auth_request.email)})

        if not user_dict:
            return self._email_register(auth_request, response)

        user_object_id = user_dict['_id']
        user_id = str(user_object_id)

        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_object_id})

        if not auth_request.hashed_password:
            # User exists but did not send a password: probably just getting some fresh salt.
            return response
        if not user_auth_dict:
            if not auth_request.auth_token:
                # User is trying to connect with a password, but never created one.
                self.send_auth_token(user_dict)
                _abort_failed_login()
            try:
                token.check_token(user_id, auth_request.auth_token, role='auth')
            except ValueError as error:
                logging.info('Invalid token:\n %s', error)
                _abort_on_bad_auth()
            # User that already uses an SSO account is now trying to add a password.
            _parse_user_from_mongo(user_dict, response.authenticated_user)
            self._user_db.user_auth.insert_one({
                '_id': user_object_id,
                'hashedPassword': auth_request.hashed_password,
            })
            response.auth_token = token.create_token(user_id, 'auth')
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
            self._reset_password(auth_request, user_id, user_auth_dict, user_dict)
            _parse_user_from_mongo(user_dict, response.authenticated_user)
            response.auth_token = token.create_token(user_id, 'auth')
            return response

        if not auth_request.hash_salt:
            # User exists but has not sent salt: probably just getting some fresh salt.
            return response

        # Check that salt is valid.
        salt = auth_request.hash_salt
        try:
            if not token.assert_valid_salt(salt, auth_request.email, instant):
                return response
        except ValueError as error:
            logging.info('Salt has not been generated by this server:\n %s', error)
            _abort_on_bad_auth()

        stored_hashed_password = user_auth_dict.get('hashedPassword', '')

        _check_password(stored_hashed_password, salt, auth_request.hashed_password)

        _parse_user_from_mongo(user_dict, response.authenticated_user)
        response.auth_token = token.create_token(user_id, 'auth')

        # Update the password.
        if auth_request.new_hashed_password:
            self._user_db.user_auth.replace_one(
                {'_id': user_object_id},
                {'hashedPassword': auth_request.new_hashed_password})
            response.is_password_updated = True
            user_dict['_id'] = user_id
            self.send_update_confirmation(user_dict)

        self._handle_returning_user(response)

        return response

    def _email_register(
            self, auth_request: auth_pb2.AuthRequest, response: auth_pb2.AuthResponse) \
            -> auth_pb2.AuthResponse:
        """Registers a new user using an email address."""

        is_existing_user = self._load_user_with_token(
            auth_request, response.authenticated_user, is_timestamp_required=False)
        force_update = False
        if not is_existing_user and auth_request.hashed_password:
            if not auth_request.first_name:
                flask.abort(422, i18n.flask_translate('Le champ first_name est nécessaire'))

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
            self._handle_returning_user(response, force_update=force_update)
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
        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')
        return response

    def _reset_password(
            self, auth_request: auth_pb2.AuthRequest, user_id: str,
            user_auth_dict: dict[str, str], user_dict: dict[str, Any]) -> None:
        """Resets the user's password.

        The auth_request.auth_token here is the reset_token provided by create_reset_token.
        """

        try:
            is_token_valid = token.assert_valid_salt(
                auth_request.auth_token,
                auth_request.email + user_id + user_auth_dict.get('hashedPassword', ''),
                int(time.time()))
            if not is_token_valid:
                logging.info('Token in outdated.')
                raise ExpiredTokenException(_get_auth_error_message())
        except ValueError as error:
            logging.info('Token has not been generated by this server:\n %s', error)
            _abort_on_bad_auth()
        self._user_db.user_auth.replace_one(
            {'_id': objectid.ObjectId(user_id)},
            {'hashedPassword': auth_request.hashed_password})
        self.send_update_confirmation(user_dict)

    def _token_authenticate(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        instant = int(time.time())
        response = auth_pb2.AuthResponse()
        response.hash_salt = token.timestamped_hash(instant, auth_request.email)
        self._load_user_with_token(auth_request, response.authenticated_user)
        if response.authenticated_user.HasField('deleted_at'):
            flask.abort(404, i18n.flask_translate('Compte supprimé'))
        response.auth_token = token.create_token(auth_request.user_id, 'auth')
        self._handle_returning_user(response)

        return response

    def _load_user_with_token(
            self, auth_request: auth_pb2.AuthRequest, out_user: user_pb2.User,
            is_timestamp_required: bool = True) -> bool:
        if not auth_request.user_id:
            return False
        try:
            user_id = objectid.ObjectId(auth_request.user_id)
        except bson.errors.InvalidId:
            flask.abort(
                400,
                i18n.flask_translate(
                    'L\'identifiant utilisateur "{user_id}" n\'a pas le bon format.',
                ).format(user_id=auth_request.user_id))
        try:
            if not token.assert_valid_salt(
                    auth_request.auth_token, str(user_id), int(time.time()),
                    validity_seconds=datetime.timedelta(days=5).total_seconds(),
                    role='auth') \
                    and is_timestamp_required:
                raise ExpiredTokenException(i18n.flask_translate("Token d'authentification périmé"))
        except ValueError as error:
            flask.abort(
                403,
                i18n.flask_translate("Le sel n'a pas été généré par ce serveur\xa0: {error}.")
                .format(error=error))

        user_dict = self._user_collection.find_one({'_id': user_id})

        if not user_dict:
            flask.abort(404, i18n.flask_translate('Utilisateur inconnu.'))

        _parse_user_from_mongo(user_dict, out_user)

        return True

    def _load_user_from_token_or_email(
            self, auth_request: auth_pb2.AuthRequest, user: user_pb2.User,
            email: Optional[str]) -> bool:
        is_existing_user = email and proto.parse_from_mongo(
            self._user_collection.find_one({'hashedEmail': hash_user_email(email)}),
            user, 'user_id') or \
            self._load_user_with_token(auth_request, user, is_timestamp_required=False)
        had_email = bool(user.profile.email)
        if not had_email and email:
            user.profile.email = email
        return is_existing_user

    def _create_guest_user(self, auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
        response = auth_pb2.AuthResponse()
        response.authenticated_user.profile.name = auth_request.first_name
        self.save_new_user(response.authenticated_user, auth_request.user_data)
        response.auth_token = token.create_token(response.authenticated_user.user_id, 'auth')
        response.is_new_user = True
        return response

    def create_reset_token(self, user_id: objectid.ObjectId) -> Tuple[Optional[str], str]:
        """Create a token to reset the user's password."""

        user_dict = self._user_collection.find_one({'_id': user_id})
        if not user_dict:
            return None, ''
        return self._create_reset_token_from_user(user_dict)

    def _create_reset_token_from_user(self, user_dict: dict[str, Any]) -> Tuple[Optional[str], str]:
        """Returns the reset token, and the linked email address."""

        email = user_dict.get('profile', {}).get('email', '')

        user_auth_dict = self._user_db.user_auth.find_one({'_id': user_dict['_id']})
        if not user_auth_dict or not user_auth_dict.get('hashedPassword'):
            return None, email

        hashed_old_password = user_auth_dict.get('hashedPassword', '')
        reset_token = token.timestamped_hash(
            int(time.time()), email + str(user_dict['_id']) + hashed_old_password)
        return reset_token, email

    def send_reset_password_token(self, email: str) -> None:
        """Sends an email to user with a reset token so that they can reset their password."""

        user_dict = self._user_collection.find_one({'hashedEmail': hash_user_email(email)})
        if not user_dict:
            # No user with this email address, however we don't want to tell that to a potential
            # attacker.
            return

        reset_token, unused_email = self._create_reset_token_from_user(user_dict)
        # User is a guest and/or doesn't have a password so we send them a email to login.
        if not reset_token:
            self.send_auth_token(user_dict)
            return

        user_profile = proto.create_from_mongo(
            user_dict.get('profile'), user_profile_pb2.UserProfile)

        reset_link = self._get_reset_password_link(user_dict)
        if not reset_link:
            return
        template_vars = {
            'firstname': user_profile.name,
            'productName': product.bob.name,
            'productLogoUrl': product.bob.get_config('productLogoUrl', ''),
            'resetLink': reset_link,
        }
        # TODO(cyrille): Create a static Campaign object and use it.
        result = mail_send.send_template('reset-password', user_profile, template_vars)
        if result.status_code != 200:
            logging.error('Failed to send an email with MailJet:\n %s', result.text)
            flask.abort(result.status_code)

    def send_auth_token(self, user_dict: dict[str, Any]) -> None:
        """Sends an email to the user with an auth token so that they can log in."""

        user_profile = proto.create_from_mongo(
            user_dict.get('profile'), user_profile_pb2.UserProfile)

        user_id = str(user_dict['_id'])
        auth_link = token.create_logged_url(user_id)
        template_vars = {
            'authLink': auth_link,
            'firstname': user_profile.name,
            'productName': product.bob.name,
            'productLogoUrl': product.bob.get_config('productLogoUrl', ''),
        }
        # TODO(cyrille): Create a static Campaign object and use it.
        result = mail_send.send_template('send-auth-token', user_profile, template_vars)
        if result.status_code != 200:
            logging.error('Failed to send an email with MailJet:\n %s', result.text)
            flask.abort(result.status_code)

    def _handle_returning_user(
            self, response: auth_pb2.AuthResponse, force_update: bool = False) -> None:
        response.last_access_at.CopyFrom(self._update_returning_user(
            response.authenticated_user,
            force_update=force_update or response.is_new_user))


def _get_oauth2_access_token(
        endpoint: str, code: str, client_id: str, client_secret: str, auth_name: str = 'OAuth2') \
        -> dict[str, str]:
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
            json_error = typing.cast(dict[str, str], token_response.json())
        except request_exceptions.JSONDecodeError:
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

    return typing.cast(dict[str, str], token_response.json())
