"""Simple frontend server for MyGamePlan.

More information about the architecture of the application in go/pe:design.

This file contains the JSON API that will provide the
MyGamePlan web application with data.
"""

import datetime
import logging
import os
import random
import re
import typing
from typing import Any, Dict, Optional, Tuple, Union
from urllib import parse
import uuid

import flask
from google.protobuf import json_format
from google.protobuf import message
import requests
import sentry_sdk
from sentry_sdk.integrations import flask as sentry_flask
from sentry_sdk.integrations import logging as sentry_logging
import werkzeug
from werkzeug.middleware import proxy_fix

from bob_emploi.common.python import now
from bob_emploi.frontend.server import action
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import apps
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import proto_flask
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import strategist
from bob_emploi.frontend.server import tick
from bob_emploi.frontend.server import user
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import focus
from bob_emploi.frontend.server.mail.templates import mailjet_templates
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import auth_pb2
from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import reflection_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.api import strategy_pb2
from bob_emploi.frontend.api import use_case_pb2
from bob_emploi.frontend.api import user_pb2

app = flask.Flask(__name__)
# Get original host and scheme used before proxies (load balancer, nginx, etc).
app.wsgi_app = proxy_fix.ProxyFix(app.wsgi_app)  # type: ignore

RANDOMIZER = random.Random()

_FlaskResponse = Union[str, werkzeug.Response, Tuple[str, int]]

# TODO(pascal): Split this module then remove next line.
# pylint: disable=too-many-lines


# How long a support ticket should be kept open.
_SUPPORT_TICKET_LIFE_DAYS = 7

# Time of the day (as a number of hours since midnight) at which focus emails are sent.
# Only used for simulation, the actual timing is handled by scheduled tasks.
_FOCUS_EMAIL_SENDING_TIME = 9

# Environment variables needed.
_SERVER_TAG: Dict[str, str] = {}
_SERVER_TAG['_server'] = os.getenv('SERVER_VERSION', 'dev')


@app.errorhandler(auth.ExpiredTokenException)
def expired_token(error: auth.ExpiredTokenException) -> Tuple[str, int]:
    """Handle the 498 error."""

    return error.description or i18n.flask_translate("Le jeton d'authentification est périmé"), 498


@app.route('/api/user', methods=['DELETE'])
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.UserId)
def delete_user(user_data: user_pb2.User) -> user_pb2.UserId:
    """Delete a user and their authentication information."""

    user_db = mongo.get_connections_from_env().user_db

    auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
    filter_user: Optional[Dict[str, Any]]
    if user_data.user_id:
        try:
            auth.check_token(user_data.user_id, auth_token, role='unsubscribe')
        except ValueError:
            try:
                auth.check_token(user_data.user_id, auth_token, role='auth')
            except ValueError:
                flask.abort(403, i18n.flask_translate("Mauvais jeton d'authentification"))
        filter_user = {'_id': user.safe_object_id(user_data.user_id)}
    elif user_data.profile.email:
        try:
            auth.check_token('', auth_token, role='admin')
        except ValueError:
            flask.abort(403, i18n.flask_translate(
                'Accès refusé, action seulement pour le super-administrateur.'))
        filter_user = user_db.user.find_one({
            'hashedEmail': auth.hash_user_email(user_data.profile.email)}, {'_id': 1})
    else:
        flask.abort(400, i18n.flask_translate(
            'Impossible de supprimer un utilisateur sans son ID.'))

    if not filter_user:
        return user_pb2.UserId()

    user_proto = user.get_user_data(str(filter_user['_id']))
    if not auth.delete_user(user_proto, user_db):
        flask.abort(500, i18n.flask_translate('Erreur serveur, impossible de supprimer le compte.'))

    return user_pb2.UserId(user_id=str(filter_user['_id']))


@app.route('/api/user/<user_id>/settings', methods=['POST'])
@proto_flask.api(in_type=user_pb2.UserProfile, out_type=user_pb2.UserId)
@auth.require_user(lambda unused_profile, user_id: typing.cast(str, user_id), role='settings')
def update_user_settings(profile: user_pb2.UserProfile, user_id: str) -> user_pb2.UserId:
    """Update user's settings."""

    updater = {'$set': {
        f'profile.{key}': value
        for key, value in json_format.MessageToDict(profile).items()
    }}
    if profile.coaching_email_frequency:
        # Invalidate the send_coaching_email_after field: it will be recomputed
        # by the focus email script.
        updater['$unset'] = {'sendCoachingEmailAfter': 1}

    user_db = mongo.get_connections_from_env().user_db
    user_db.user.update_one({'_id': user.safe_object_id(user_id)}, updater)

    return user_pb2.UserId(user_id=user_id)


@app.route('/api/user/<user_id>', methods=['GET'])
@proto_flask.api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def get_user(user_id: str) -> user_pb2.User:
    """Return the user identified by user_id.

    Returns: The data for a user identified by user_id.
    """

    user_proto = user.get_user_data(user_id)
    user_proto.user_id = user_id
    return user_proto


@app.route('/api/user', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.User)
@auth.require_user(lambda user_data: typing.cast(user_pb2.User, user_data).user_id)
def save_user(user_data: user_pb2.User) -> user_pb2.User:
    """Save the user data sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    Returns: The user data as it was saved.
    """

    if not user_data.user_id:
        flask.abort(400, i18n.flask_translate(
            'Impossible de sauver les données utilisateur sans ID.'))
    return user.save_user(user_data, is_new_user=False)


@app.route('/api/user/<user_id>/project/<project_id>', methods=['POST'])
@proto_flask.api(in_type=project_pb2.Project, out_type=project_pb2.Project)
@auth.require_user(lambda project, user_id, project_id: typing.cast(str, user_id))
def save_project(
        project_data: project_pb2.Project, user_id: str, project_id: str) -> project_pb2.Project:
    """Save the project data sent by client.

    Input:
        * Body: A dictionary with attributes of the user's project data.
    Returns: The project data as it was saved.
    """

    user_proto = user.get_user_data(user_id)
    if not project_data.project_id:
        project_data.project_id = project_id
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, i18n.flask_translate("Le projet n'existe pas."))
    project_info = user_proto.projects[project_index]
    _clear_replaceable_fields(project_info, project_data)
    # TODO(cyrille): Add a route for resetting.
    project_info.MergeFrom(project_data)
    return _get_project_data(user.save_user(user_proto, is_new_user=False), project_id)


@app.route('/api/user/<user_id>/project/<project_id>/advice/<advice_id>', methods=['POST'])
@proto_flask.api(in_type=project_pb2.Advice, out_type=project_pb2.Advice)
@auth.require_user(lambda project, user_id, project_id, advice_id: typing.cast(str, user_id))
def update_advice(advice_data: project_pb2.Advice, user_id: str, project_id: str, advice_id: str) \
        -> project_pb2.Advice:
    """Save the advice module data sent by client.

    Input:
        * Body: A dictionary with attributes of the user's advice data.
    Returns: The advice data as it was saved.
    """

    user_proto = user.get_user_data(user_id)
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, i18n.flask_translate("Le projet n'existe pas."))
    advice_index = next((
        index for index, a in enumerate(user_proto.projects[project_index].advices)
        if a.advice_id == advice_id), None)
    if advice_index is None:
        flask.abort(404, i18n.flask_translate("Le conseil n'existe pas pour ce projet."))

    user_proto.projects[project_index].advices[advice_index].MergeFrom(advice_data)
    updated_user = user.save_user(user_proto, is_new_user=False)
    updated_project = _get_project_data(updated_user, project_id)
    return _get_advice_data(updated_project, advice_id)


@app.route('/api/user/<user_id>/project/<project_id>/strategy/<strategy_id>', methods=['POST'])
@proto_flask.api(in_type=project_pb2.WorkingStrategy, out_type=project_pb2.WorkingStrategy)
@auth.require_user(lambda project, user_id, project_id, strategy_id: typing.cast(str, user_id))
def update_strategy(
        strategy_data: project_pb2.WorkingStrategy,
        user_id: str, project_id: str, strategy_id: str) -> project_pb2.WorkingStrategy:
    """Save the strategy information sent by the client."""

    user_proto = user.get_user_data(user_id)
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, i18n.flask_translate("Le projet n'existe pas."))
    strategy = next((
        a for a in user_proto.projects[project_index].opened_strategies
        if a.strategy_id == strategy_id), None)
    if not strategy:
        strategy = user_proto.projects[project_index].opened_strategies.add()
        strategy.started_at.FromDatetime(now.get())
        strategy.started_at.nanos = 0

    strategy_data.ClearField('started_at')
    strategy.MergeFrom(strategy_data)
    strategy.last_modified_at.GetCurrentTime()
    strategy.last_modified_at.nanos = 0
    updated_user = user.save_user(user_proto, is_new_user=False)
    updated_project = _get_project_data(updated_user, project_id)
    return _get_strategy_data(updated_project, strategy_id)


@app.route('/api/user/<user_id>/project/<project_id>/strategy/<strategy_id>', methods=['DELETE'])
@auth.require_user(lambda user_id, project_id, strategy_id: typing.cast(str, user_id))
def stop_strategy(user_id: str, project_id: str, strategy_id: str) -> str:
    """Stop a strategy."""

    user_proto = user.get_user_data(user_id)
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, i18n.flask_translate("Le projet n'existe pas."))
    strategy_index = next((
        i for i, a in enumerate(user_proto.projects[project_index].opened_strategies)
        if a.strategy_id == strategy_id), None)
    if strategy_index is None:
        flask.abort(404, i18n.flask_translate("La stratégie n'existe pas."))
    del user_proto.projects[project_index].opened_strategies[strategy_index]
    user.save_user(user_proto, is_new_user=False)
    return 'OK'


_Replaceable = typing.TypeVar('_Replaceable', bound=message.Message)


def _clear_replaceable_fields(user_proto: _Replaceable, request_proto: _Replaceable) -> None:
    """Clear replaceable fields of a message.

    Input:
        user_proto: a message with data from the server.
        request_proto: a message coming from the client with data that should be
        merged with the server message.
    Modifies:
        Both messages are modified, replaceable fields of user_proto will be
        cleared and replaceable fields that should be emptied (the server send them as a list
        with only one falsy element) will be cleaned from request_proto.
    """

    for field_descriptor, user_value in user_proto.ListFields():
        request_value = getattr(request_proto, field_descriptor.name)
        if not request_value:
            continue
        list_format_options = field_descriptor.GetOptions()
        list_format_field = list_format_options.Extensions[options_pb2.list_format]
        if options_pb2.REPLACEABLE == list_format_field:
            user_proto.ClearField(field_descriptor.name)
            if len(request_value) > 1:
                continue
            sole_value = request_value[0]
            # Replaceable list with only one falsy value means that the field should be emptied.
            deletion_command = not sole_value
            # Replaceable list with only one empty message value means the same.
            if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
                deletion_command = sole_value == type(sole_value)()
            if deletion_command:
                request_proto.ClearField(field_descriptor.name)
        if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
            if field_descriptor.label == field_descriptor.LABEL_REPEATED:
                continue
            _clear_replaceable_fields(user_value, request_value)


@app.route(
    '/api/user/<user_id>/update-and-quick-diagnostic', methods=['POST'],
    defaults={'project_id': None})
@app.route('/api/user/<user_id>/update-and-quick-diagnostic/<project_id>', methods=['POST'])
@proto_flask.api(in_type=user_pb2.QuickDiagnosticRequest, out_type=diagnostic_pb2.QuickDiagnostic)
@auth.require_user(lambda request, user_id, project_id: typing.cast(str, user_id))
def update_and_quick_diagnose(
        request: user_pb2.QuickDiagnosticRequest, user_id: str, project_id: str) \
        -> diagnostic_pb2.QuickDiagnostic:
    """Update a user project and quickly diagnose it."""

    user_proto = user.get_user_data(user_id)
    project_proto: Optional[project_pb2.Project]
    if project_id:
        project_proto = _get_project_data(user_proto, project_id)
    elif user_proto.projects:
        project_proto = user_proto.projects[0]
    else:
        project_proto = None

    if request.HasField('user'):
        merged_project: Optional[project_pb2.Project]
        if request.user.projects and project_proto:
            merged_project = request.user.projects[0]
            _clear_replaceable_fields(project_proto, request.user.projects[0])
            project_proto.MergeFrom(request.user.projects[0])
            del request.user.projects[:]
        else:
            merged_project = None
        _clear_replaceable_fields(user_proto, request.user)

        if request.HasField('field_mask'):
            request.field_mask.MergeMessage(request.user, user_proto)
        else:
            user_proto.MergeFrom(request.user)
        user_proto = user.save_user(user_proto, is_new_user=False)

        if merged_project:
            request.user.projects.extend([merged_project])
        elif user_proto.projects:
            project_proto = user_proto.projects[0]

    database = mongo.get_connections_from_env().stats_db
    return diagnostic.quick_diagnose(
        user_proto, project_proto or project_pb2.Project(), request.user, database)


@app.route('/api/user/<user_id>/migrate-to-advisor', methods=['POST'])
@proto_flask.api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def migrate_to_advisor(user_id: str) -> user_pb2.User:
    """Migrate a user of the Mashup to use the Advisor."""

    user_proto = user.get_user_data(user_id)
    has_multiple_projects = len(user_proto.projects) > 1
    was_using_mashup = \
        user_proto.features_enabled.advisor == user_pb2.CONTROL or has_multiple_projects

    user_proto.features_enabled.ClearField('advisor')
    user_proto.features_enabled.ClearField('advisor_email')
    user_proto.features_enabled.switched_from_mashup_to_advisor = was_using_mashup
    user_db = mongo.get_connections_from_env().user_db
    user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)}, {'$set': {
            'featuresEnabled': json_format.MessageToDict(user_proto.features_enabled)}},
        upsert=False)

    return user.save_user(user_proto, is_new_user=False)


@app.route('/api/project/diagnose', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=diagnostic_pb2.Diagnostic)
def diagnose_project(user_proto: user_pb2.User) -> diagnostic_pb2.Diagnostic:
    """Diagnose a user project."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    project = user_proto.projects[0]
    database = mongo.get_connections_from_env().stats_db
    return diagnostic.diagnose(user_proto, project, database)


@app.route('/api/project/strategize', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=strategy_pb2.Strategies)
def strategize_project(user_proto: user_pb2.User) -> strategy_pb2.Strategies:
    """Strategize a user project."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    project = user_proto.projects[0]
    database = mongo.get_connections_from_env().stats_db
    strategist.strategize(user_proto, project, database)
    response = strategy_pb2.Strategies()
    response.strategies.extend(project.strategies)
    return response


@app.route('/api/project/compute-advices', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=project_pb2.Advices)
def compute_advices_for_project(user_proto: user_pb2.User) -> project_pb2.Advices:
    """Advise on a user project."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    database = mongo.get_connections_from_env().stats_db
    return advisor.compute_advices_for_project(user_proto, user_proto.projects[0], database)


@app.route('/api/project/compute-all', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.User)
def diagnose_advise_and_strategize(user_proto: user_pb2.User) -> user_pb2.User:
    """Diagnose, advise and strategize all the user's projects, all in one go."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    database = mongo.get_connections_from_env().stats_db
    for project in user_proto.projects:
        user_diagnostic = diagnostic.diagnose(user_proto, project, database)
        project.diagnostic.CopyFrom(user_diagnostic)
        advices = advisor.compute_advices_for_project(user_proto, project, database)
        project.advices.extend(advices.advices)
        strategist.strategize(user_proto, project, database)
    return user_proto


@app.route('/api/app/use/<user_id>', methods=['POST'])
@proto_flask.api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def use_app(user_id: str) -> user_pb2.User:
    """Update the user's data to mark that they have just used the app."""

    user_proto = user.get_user_data(user_id)
    start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
    if user_proto.requested_by_user_at_date.ToDatetime() >= start_of_day:
        return user_proto
    user_proto.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_proto.requested_by_user_at_date.nanos = 0
    return user.save_user(user_proto, is_new_user=False)


def _validate_city(city: geo_pb2.FrenchCity) -> Optional[geo_pb2.FrenchCity]:
    if not city.postcodes:
        return None
    return city


def _get_project_data(user_proto: user_pb2.User, project_id: str) -> project_pb2.Project:
    try:
        return next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, i18n.flask_translate(
            'Projet "{project_id}" inconnu.').format(project_id=project_id))


def _get_advice_data(project: project_pb2.Project, advice_id: str) -> project_pb2.Advice:
    try:
        return next(
            advice for advice in project.advices
            if advice.advice_id == advice_id)
    except StopIteration:
        flask.abort(
            404, i18n.flask_translate('Conseil "{advice_id}" inconnu.').format(advice_id=advice_id))


def _get_strategy_data(project: project_pb2.Project, strategy_id: str) \
        -> project_pb2.WorkingStrategy:
    try:
        return next(
            strategy for strategy in project.opened_strategies
            if strategy.strategy_id == strategy_id)
    except StopIteration:
        flask.abort(404, i18n.flask_translate(
            'Stratégie "{strategy_id}" inconnue.').format(strategy_id=strategy_id))


_ACTION_STOPPED_STATUSES = frozenset([
    action_pb2.ACTION_SNOOZED,
    action_pb2.ACTION_DONE,
    action_pb2.ACTION_STICKY_DONE,
    action_pb2.ACTION_DECLINED])


# TODO: Split this into separate endpoints for registration and login.
# Having both in the same endpoint makes refactoring the frontend more difficult.
@app.route('/api/user/authenticate', methods=['POST'])
@proto_flask.api(in_type=auth_pb2.AuthRequest, out_type=auth_pb2.AuthResponse)
def authenticate(auth_request: auth_pb2.AuthRequest) -> auth_pb2.AuthResponse:
    """Authenticate a user."""

    authenticator = user.get_authenticator()
    return authenticator.authenticate(auth_request)


@app.route('/api/user/reset-password', methods=['POST'])
@proto_flask.api(in_type=auth_pb2.AuthRequest)
def reset_password(auth_request: auth_pb2.AuthRequest) -> str:
    """Sends an email to user with a reset token so that they can reset their password."""

    authenticator = user.get_authenticator()
    authenticator.send_reset_password_token(auth_request.email)
    return '{}'


@app.route('/api/proto', methods=['POST'])
@proto_flask.api(in_type=reflection_pb2.Reflection, out_type=reflection_pb2.Reflection)
def reflect_proto(value: reflection_pb2.Reflection) -> reflection_pb2.Reflection:
    """A simple reflection to let client converts this proto from/to different formats."""

    return value


@app.route('/api/user/<user_id>/generate-auth-tokens', methods=['GET'])
@auth.require_user(lambda user_id: typing.cast(str, user_id))
@proto_flask.api(out_type=auth_pb2.AuthTokens)
def generate_auth_tokens(user_id: str) -> auth_pb2.AuthTokens:
    r"""Generates auth token for a given user.

    Note that this is safe to do as long as the user had a proper and complete
    auth token which is ensured by the @auth.require_user above.

    The "easiest" way to use it:
     - open a the Chrome Console on Bob
     - run the following js commands: ```
        (async () => {
          const authToken = window.localStorage.getItem('authToken')
          const userId = window.localStorage.getItem('userId')
          const response = await fetch(`/api/user/${userId}/generate-auth-tokens`, {
            headers: {Authorization: `Bearer ${authToken}`},
          })
          console.log(await response.json())
        })()
     ```
    - warning: may not work in other browsers or in Private Navigation mode.
    """

    tokens = auth_pb2.AuthTokens(
        user=user_id,
        auth=auth.create_token(user_id, is_using_timestamp=True),
        employment_status=auth.create_token(user_id, 'employment-status'),
        nps=auth.create_token(user_id, 'nps'),
        settings=auth.create_token(user_id, 'settings'),
        unsubscribe=auth.create_token(user_id, 'unsubscribe'),
    )

    base_url = parse.urljoin(flask.request.base_url, '/')
    tokens.auth_url = f'{base_url}?userId={user_id}&authToken={tokens.auth}'
    tokens.employment_status_url = \
        f'{base_url}statut/mise-a-jour?token={tokens.employment_status}&user={user_id}'
    tokens.nps_url = f'{base_url}retours?token={tokens.nps}&user={user_id}'
    tokens.settings_url = f'{base_url}unsubscribe.html?user={user_id}&auth={tokens.settings}&' \
        'coachingEmailFrequency=EMAIL_MAXIMUM'
    tokens.unsubscribe_url = f'{base_url}unsubscribe.html?user={user_id}&auth={tokens.unsubscribe}'

    reset_token, email = user.get_authenticator().create_reset_token(user.safe_object_id(user_id))
    if reset_token:
        tokens.reset = reset_token
        tokens.reset_url = f'{base_url}?email={email}&resetToken={reset_token}'

    return tokens


@app.route('/api/job/requirements/<rome_id>', methods=['GET'])
@proto_flask.api(out_type=job_pb2.JobRequirements)
def job_requirements(rome_id: str) -> job_pb2.JobRequirements:
    """Get requirements for a job."""

    no_requirements = job_pb2.JobRequirements()

    database = mongo.get_connections_from_env().stats_db
    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
        return no_requirements

    return job_group_info.requirements


def _get_expanded_card_data(
        user_proto: user_pb2.User, project: project_pb2.Project, advice_id: str) -> message.Message:
    database = mongo.get_connections_from_env().stats_db
    module = advisor.get_advice_module(advice_id, database)
    if not module or not module.trigger_scoring_model:
        flask.abort(404, i18n.flask_translate(
            'Le module "{advice_id}" n\'existe pas').format(advice_id=advice_id))
    model = scoring.get_scoring_model(module.trigger_scoring_model)
    if not model or not hasattr(model, 'get_expanded_card_data'):
        flask.abort(
            404,
            i18n.flask_translate('Le module "{advice_id}" n\'a pas de données supplémentaires')
            .format(advice_id=advice_id))

    scoring_project = scoring.ScoringProject(project, user_proto, database, now=now.get())
    return model.get_expanded_card_data(scoring_project)


@app.route('/api/advice/<advice_id>/<user_id>/<project_id>', methods=['GET'])
@proto_flask.api(out_type=message.Message)
@auth.require_user(lambda user_id, project_id, advice_id: typing.cast(str, user_id))
def get_advice_expanded_card_data(user_id: str, project_id: str, advice_id: str) \
        -> message.Message:
    """Retrieve expanded card data for an advice module for a project."""

    user_proto = user.get_user_data(user_id)
    return _get_expanded_card_data(user_proto, _get_project_data(user_proto, project_id), advice_id)


@app.route('/api/advice/<advice_id>', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=message.Message)
def compute_expanded_card_data(user_proto: user_pb2.User, advice_id: str) -> message.Message:
    """Retrieve expanded card data for an advice module for a project."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    return _get_expanded_card_data(user_proto, user_proto.projects[0], advice_id)


@app.route('/api/advice/tips/<advice_id>/<user_id>/<project_id>', methods=['GET'])
@proto_flask.api(out_type=action_pb2.AdviceTips)
@auth.require_user(lambda user_id, project_id, advice_id: typing.cast(str, user_id))
def advice_tips(user_id: str, project_id: str, advice_id: str) -> action_pb2.AdviceTips:
    """Get all available tips for a piece of advice."""

    user_proto = user.get_user_data(user_id)
    project = _get_project_data(user_proto, project_id)
    piece_of_advice = _get_advice_data(project, advice_id)

    database = mongo.get_connections_from_env().stats_db
    all_tips = advisor.list_all_tips(user_proto, project, piece_of_advice, database)

    response = action_pb2.AdviceTips()
    for tip_template in all_tips:
        action.instantiate(response.tips.add(), user_proto, project, tip_template, database)
    return response


@app.route('/api/emails/simulate', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.EmailHistory)
def simulate_coaching_emails(user_proto: user_pb2.User) -> user_pb2.EmailHistory:
    """Compute the email coaching schedule."""

    instant = now.get()
    database, user_db, unused_ = mongo.get_connections_from_env()

    # Complete the user's proto with mandatory fields.
    if not user_proto.HasField('registered_at'):
        user_proto.registered_at.FromDatetime(instant)
    if not user_proto.profile.coaching_email_frequency:
        user_proto.profile.coaching_email_frequency = user_pb2.EMAIL_MAXIMUM
    if not user_proto.projects:
        user_proto.projects.add()

    for attempt in range(200):
        campaign_id = focus.send_focus_email_to_user(
            'ghost', user_proto, database=database, users_database=user_db, instant=instant)
        if attempt and not campaign_id:
            # No more email to send.
            # Note that the first call might not return a campaign ID as we do not send focus emails
            # right away.
            break
        instant = user_proto.send_coaching_email_after.ToDatetime()
        if instant.hour > _FOCUS_EMAIL_SENDING_TIME or \
                instant.hour == _FOCUS_EMAIL_SENDING_TIME and instant.minute:
            instant += datetime.timedelta(days=1)
        instant = instant.replace(hour=9, minute=0)

    output = user_pb2.EmailHistory()
    output.emails_sent.extend(user_proto.emails_sent)
    return output


def _send_email(
        user_proto: user_pb2.User, *, campaign_id: mailjet_templates.Id) -> user_pb2.EmailSent:
    """Sends a prepared campaign to a user."""

    if campaign_id not in campaign.list_all_campaigns():
        flask.abort(
            404,
            i18n.flask_translate('Campagne {campaign_id} inconnue.').
            format(campaign_id=campaign_id))
    if not user_proto.profile.email:
        flask.abort(422, i18n.flask_translate('Adresse email manquante.'))

    database, user_db, unused_ = mongo.get_connections_from_env()

    a_campaign = campaign.get_campaign(campaign_id)
    current_time = now.get()
    emails_sent = a_campaign.send_mail(
        user_proto, database=database, users_database=user_db, now=current_time, action='send')
    if not emails_sent:
        flask.abort(
            404,
            i18n.flask_translate('Campagne {campaign_id} non disponible pour cet utilisateur').
            format(campaign_id=campaign_id))
    return emails_sent


@app.route('/api/emails/send/<campaign_id>', methods=['POST'])
@auth.require_google_user(email_kwarg='requester_email')
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.EmailSent)
def _send_email_from_proto(
        user_proto: user_pb2.User, *, campaign_id: mailjet_templates.Id, requester_email: str) \
        -> user_pb2.EmailSent:

    if not user_proto.profile.email:
        user_proto.profile.email = requester_email
    elif requester_email != user_proto.profile.email:
        mongo.get_connections_from_env().eval_db.email_requests.insert_one({
            'email': user_proto.profile.email,
            'registeredAt': proto.datetime_to_json_string(now.get()),
            'requesterEmail': requester_email,
            'action': 'send',
        })
    return _send_email(user_proto, campaign_id=campaign_id)


@app.route('/api/user/<user_id>/emails/send/<campaign_id>', methods=['POST'])
@auth.require_user(lambda user_id, campaign_id: typing.cast(str, user_id))
@proto_flask.api(out_type=user_pb2.EmailSent)
def _send_email_for_user(
        *, user_id: str, campaign_id: mailjet_templates.Id) -> user_pb2.EmailSent:
    user_proto = user.get_user_data(user_id)
    return _send_email(user_proto, campaign_id=campaign_id)


# Pattern to match src link to http images, e.g. ' src="http://r.bob-emploi.fr/image.png"'.
_SRC_LINKS = re.compile(r'( src=")(http:[^"?]*)(")')


def _convert_to_proxy_link(match: typing.Match[str]) -> str:
    prefix, src, suffix = match.groups()
    url = flask.url_for('_proxy_http_image', _external=True)
    return f'{prefix}{url}?src={parse.quote(src)}{suffix}'


def _get_email_content(user_proto: user_pb2.User, *, campaign_id: mailjet_templates.Id) -> str:
    if campaign_id not in campaign.list_all_campaigns():
        flask.abort(
            404,
            i18n.flask_translate('Campagne {campaign_id} inconnue.').
            format(campaign_id=campaign_id))

    database, user_db, unused_ = mongo.get_connections_from_env()

    a_campaign = campaign.get_campaign(campaign_id)
    current_time = now.get()
    email_content = a_campaign.get_content(
        user_proto, database=database, users_database=user_db, now=current_time)
    if not email_content:
        flask.abort(
            404,
            i18n.flask_translate('Campagne {campaign_id} non disponible pour cet utilisateur').
            format(campaign_id=campaign_id))
    email_content = _SRC_LINKS.sub(_convert_to_proxy_link, email_content)
    return email_content


@app.route('/api/emails/content/<campaign_id>', methods=['GET'])
@proto_flask.api(in_type=user_pb2.User)
def _get_email_from_proto(user_proto: user_pb2.User, *, campaign_id: mailjet_templates.Id) -> str:
    return _get_email_content(user_proto, campaign_id=campaign_id)


@app.route('/api/user/<user_id>/emails/content/<campaign_id>', methods=['GET'])
# TODO(pascal): Authorize access with a smaller role (email) instead of auth.
@auth.require_user(lambda user_id, campaign_id: typing.cast(str, user_id))
def _get_email_for_user(*, user_id: str, campaign_id: mailjet_templates.Id) -> str:
    user_proto = user.get_user_data(user_id)
    return _get_email_content(user_proto, campaign_id=campaign_id)


@app.route('/api/cache/clear', methods=['GET'])
def clear_cache() -> str:
    """Clear all server caches.

    This is an undocumented feature that allows us to clear a server's cache
    without rebooting it. Anybody can use it, but it doesn't cost much apart
    from 2 or 3 additional MongoDB requests on next queries.
    """

    cache.clear()
    return i18n.flask_translate('Cache serveur vidé.')


@app.route('/api/jobs/<rome_id>', methods=['GET'])
@proto_flask.api(out_type=job_pb2.JobGroup)
def get_job_group_jobs(rome_id: str) -> job_pb2.JobGroup:
    """Retrieve information about jobs whithin a job group."""

    job_group = jobs.get_group_proto(mongo.get_connections_from_env().stats_db, rome_id)
    if not job_group:
        flask.abort(404, i18n.flask_translate(
            'Groupe de métiers "{rome_id}" inconnu.').format(rome_id=rome_id))

    result = job_pb2.JobGroup()
    result.jobs.extend(job_group.jobs)
    result.requirements.specific_jobs.extend(job_group.requirements.specific_jobs)
    return result


@app.route('/api/job/application-modes/<rome_id>', methods=['GET'])
@proto_flask.api(out_type=job_pb2.JobGroup)
def get_job_group_application_modes(rome_id: str) -> job_pb2.JobGroup:
    """Retrieve information about application modes whithin a job group."""

    job_group = jobs.get_group_proto(mongo.get_connections_from_env().stats_db, rome_id)
    if not job_group:
        flask.abort(404, i18n.flask_translate(
            'Groupe de métiers "{rome_id}" inconnu.').format(rome_id=rome_id))

    result = job_pb2.JobGroup()
    result.application_modes.MergeFrom(job_group.application_modes)
    return result


@app.route('/api/feedback', methods=['POST'])
@proto_flask.api(in_type=feedback_pb2.Feedback)
def give_feedback(feedback: feedback_pb2.Feedback) -> _FlaskResponse:
    # TODO(pascal): Change this doc.
    """Retrieve information about jobs whithin a job group."""

    if feedback.user_id:
        auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
        if not auth_token:
            flask.abort(401, i18n.flask_translate('Jeton manquant'))
        try:
            auth.check_token(feedback.user_id, auth_token, role='auth')
        except ValueError:
            flask.abort(403, i18n.flask_translate('Jeton non autorisé'))
    user.give_feedback(feedback, slack_text=feedback.feedback)
    return '', 204


# TODO(cyrille): Consider using the same ticket for several requests with the same ID.
@app.route('/api/support/<user_id>', methods=['POST'], defaults={'ticket_id': None})
@app.route('/api/support/<user_id>/<ticket_id>', methods=['POST'])
@auth.require_user(lambda user_id, ticket_id: typing.cast(str, user_id))
@proto_flask.api(out_type=user_pb2.SupportTicket)
def create_support_ticket(user_id: str, ticket_id: str) -> user_pb2.SupportTicket:
    """Create a support ticket for the user, to be able to link them to support tickets."""

    ticket = user_pb2.SupportTicket(ticket_id=ticket_id or f'support:{uuid.uuid4().hex}')
    ticket.delete_after.FromDatetime(now.get() + datetime.timedelta(days=_SUPPORT_TICKET_LIFE_DAYS))
    mongo.get_connections_from_env().user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)},
        {'$push': {'supportTickets': json_format.MessageToDict(ticket)}})
    return ticket


@app.route('/', methods=['GET'])
def health_check() -> str:
    """Health Check endpoint.

    Probes can call it to check that the server is up.
    """

    return i18n.flask_translate('Serveur opérationnel')


@app.route('/api/user/nps-survey-response', methods=['POST'])
@auth.require_admin
@proto_flask.api(in_type=user_pb2.NPSSurveyResponse)
def set_nps_survey_response(nps_survey_response: user_pb2.NPSSurveyResponse) -> _FlaskResponse:
    """Save user response to the Net Promoter Score survey."""

    user_db = mongo.get_connections_from_env().user_db
    # Note that this endpoint doesn't use authentication: only the email is necessary to
    # update the user record.
    user_dict = user_db.user.find_one({
        'hashedEmail': auth.hash_user_email(nps_survey_response.email)}, {'_id': 1})
    if not user_dict:
        flask.abort(
            404,
            i18n.flask_translate('Utilisateur "{nps_survey_response_email}" inconnu.')
            .format(nps_survey_response_email=nps_survey_response.email))
    user_id = user_dict['_id']
    user_proto = user.get_user_data(user_id)
    # We use MergeFrom, as 'curated_useful_advice_ids' will likely be set in a second call.
    user_proto.net_promoter_score_survey_response.MergeFrom(nps_survey_response)
    # No need to keep the email field in the survey response as it is the same as in profile.email.
    user_proto.net_promoter_score_survey_response.ClearField('email')
    user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)},
        {'$set': {'netPromoterScoreSurveyResponse': json_format.MessageToDict(
            user_proto.net_promoter_score_survey_response
        )}},
        upsert=False
    )
    return '', 204


@app.route('/api/nps', methods=['GET'])
@auth.require_user_in_args(role='nps')
def set_nps_response(user_id: str) -> _FlaskResponse:
    """Save user response to the Net Promoter Score's first question."""

    user_to_update = user_pb2.User()
    user_to_update.net_promoter_score_survey_response\
        .responded_at.FromDatetime(now.get())
    try:
        score = int(flask.request.args.get('score', ''))
        if score < 0 or score > 10:
            raise ValueError()
    except (TypeError, ValueError):
        flask.abort(422, i18n.flask_translate('Paramètre score invalide.'))
    user_to_update.net_promoter_score_survey_response.score = score

    mongo.get_connections_from_env().user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return _maybe_redirect()


@app.route('/api/nps/user/<user_id>', methods=['GET'])
@auth.require_user(lambda user_id: typing.cast(str, user_id), role='nps')
@proto_flask.api(out_type=user_pb2.User)
def get_user_for_nps(user_id: str) -> user_pb2.User:
    """Get user info for the Net Promoter Score's page."""

    user_proto = user.get_user_data(user_id)

    response = user_pb2.User()
    response.profile.gender = user_proto.profile.gender
    if user_proto.projects:
        response.projects.add(
            city=user_proto.projects[0].city,
            target_job=user_proto.projects[0].target_job,
        )
    return response


@app.route('/api/nps', methods=['POST'])
@proto_flask.api(in_type=user_pb2.SetNPSCommentRequest)
@auth.require_user(
    lambda set_nps_request: typing.cast(user_pb2.SetNPSCommentRequest, set_nps_request).user_id,
    role='nps')
def set_nps_response_comment(set_nps_request: user_pb2.SetNPSCommentRequest) -> _FlaskResponse:
    """Save user's freeform comment and self-diagnostic after the Net Promoter Score survey."""

    user_to_update = user_pb2.User()
    user_to_update.net_promoter_score_survey_response.general_feedback_comment = \
        set_nps_request.comment

    if set_nps_request.HasField('answers'):
        # Remove fields that the user cannot choose.
        set_nps_request.answers.ClearField('email')
        set_nps_request.answers.ClearField('responded_at')
        user_to_update.net_promoter_score_survey_response.MergeFrom(set_nps_request.answers)
    if set_nps_request.HasField('self_diagnostic'):
        user_to_update.net_promoter_score_survey_response.nps_self_diagnostic.CopyFrom(
            set_nps_request.self_diagnostic)
    if set_nps_request.has_actions_idea:
        user_to_update.net_promoter_score_survey_response.has_actions_idea = \
            set_nps_request.has_actions_idea

    user_id = user.safe_object_id(set_nps_request.user_id)
    user_db = mongo.get_connections_from_env().user_db

    if set_nps_request.comment:
        previous_user = user_db.user.find_one(
            {'_id': user_id}, {'netPromoterScoreSurveyResponse.score': 1})
        if previous_user and 'netPromoterScoreSurveyResponse' in previous_user:
            score = previous_user['netPromoterScoreSurveyResponse'].get('score', 0)
        else:
            score = 'unknown'
        user_url = parse.urljoin(
            flask.request.base_url, f'/eval?userId={set_nps_request.user_id}')
        comment = '\n> '.join(set_nps_request.comment.split('\n'))
        user.give_feedback(
            feedback_pb2.Feedback(
                user_id=set_nps_request.user_id,
                feedback=set_nps_request.comment,
                source=feedback_pb2.PRODUCT_FEEDBACK),
            slack_text=f'[NPS Score: {score}] <{user_url}|{set_nps_request.user_id}>\n> {comment}')
    if set_nps_request.next_actions:
        del user_to_update.net_promoter_score_survey_response.next_actions[:]
        user_to_update.net_promoter_score_survey_response.next_actions.extend(
            set_nps_request.next_actions)

    mongo_update = _flatten_mongo_fields(json_format.MessageToDict(user_to_update))
    if mongo_update:
        user_db.user.update_one({'_id': user_id}, {'$set': mongo_update}, upsert=False)

    return '', 204


def _flatten_mongo_fields(root: Dict[str, Any], prefix: str = '') -> Dict[str, str]:
    """Flatten a nested dict as individual fields with key separted by dots as Mongo does it."""

    all_fields: Dict[str, str] = {}
    for key, value in root.items():
        if isinstance(value, dict):
            all_fields.update(_flatten_mongo_fields(value, prefix + key + '.'))
        else:
            all_fields[prefix + key] = typing.cast(str, value)
    return all_fields


@app.route('/api/employment-status/<user_id>', methods=['POST'])
@proto_flask.api(in_type=user_pb2.EmploymentStatus)
@auth.require_user(
    lambda unused_new_status, user_id: typing.cast(str, user_id), role='employment-status')
def update_employment_status(new_status: user_pb2.EmploymentStatus, user_id: str) -> _FlaskResponse:
    """Update user's last employment status."""

    user_proto = user.get_user_data(user_id)
    # Create another empty User message to update only the employment_status field.
    user_to_update = user_pb2.User()
    user_to_update.employment_status.extend(user_proto.employment_status[:])

    current_time = now.get()
    if user_to_update.employment_status and \
            user_to_update.employment_status[-1].created_at.ToDatetime() > \
            current_time - datetime.timedelta(days=1):
        recent_status = user_to_update.employment_status[-1]
    else:
        recent_status = user_to_update.employment_status.add()
        recent_status.created_at.FromDatetime(current_time)

    new_status.ClearField('created_at')
    recent_status.MergeFrom(new_status)
    mongo.get_connections_from_env().user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return '', 204


@app.route('/api/employment-status', methods=['GET'])
@auth.require_user_in_args(role='employment-status')
def get_employment_status(user_id: str) -> _FlaskResponse:
    """Save user's first click and redirect them to the full survey."""

    user_proto = user.get_user_data(user_id)
    # Create another empty User message to update only employment_status field.
    user_to_update = user_pb2.User()
    user_to_update.employment_status.extend(user_proto.employment_status[:])
    survey_id = len(user_to_update.employment_status)
    employment_status = user_to_update.employment_status.add()
    employment_status.created_at.FromDatetime(now.get())
    try:
        json_format.ParseDict(flask.request.args, employment_status, ignore_unknown_fields=True)
    except json_format.ParseError:
        flask.abort(422, i18n.flask_translate('Paramètres invalides.'))
    mongo.get_connections_from_env().user_db.user.update_one(
        {'_id': user.safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return _maybe_redirect(
        id=survey_id,
        gender=user_pb2.Gender.Name(user_proto.profile.gender),
        hl=scoring.get_user_locale(user_proto.profile),
        employed=any([p.kind == project_pb2.FIND_ANOTHER_JOB for p in user_proto.projects]))


def _maybe_redirect(**kwargs: Any) -> _FlaskResponse:
    if 'redirect' not in flask.request.args:
        return ''
    redirect_url = flask.request.args.get('redirect', '')
    separator = '&' if '?' in redirect_url else '?'
    query_string = parse.urlencode(dict(
        {key: flask.request.args.get(key)
         for key in flask.request.args if key != 'redirect'},
        **kwargs))
    return flask.redirect(f'{redirect_url}{separator}{query_string}')


@app.route('/api/usage/stats', methods=['GET'])
@proto_flask.api(out_type=stats_pb2.UsersCount)
def get_usage_stats() -> stats_pb2.UsersCount:
    """Get stats of the app usage."""

    now_utc = now.get().astimezone(datetime.timezone.utc)
    start_of_second = now_utc.replace(microsecond=0, tzinfo=None)
    last_week = start_of_second - datetime.timedelta(days=7)
    user_db = mongo.get_connections_from_env().user_db

    # Compute weekly user count.
    weekly_new_user_count = user_db.user.count_documents({
        'registeredAt': {
            '$gt': proto.datetime_to_json_string(last_week),
            '$lte': proto.datetime_to_json_string(start_of_second),
        },
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    })

    users_by_categories = list(user_db.user.aggregate([
        {'$unwind': '$projects'},
        {'$match': {'featuresEnabled.excludeFromAnalytics': {'$ne': True}}},
        {'$group': {'_id': '$projects.diagnostic.categoryId', 'count': {'$sum': 1}}},
    ]))

    main_challenge_counts = {
        category.get('_id'): category.get('count') for category in
        users_by_categories if category.get('_id')}

    return stats_pb2.UsersCount(
        main_challenge_counts=main_challenge_counts,
        total_user_count=user_db.user.count_documents({
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        }),
        weekly_new_user_count=weekly_new_user_count,
    )


@app.route('/api/redirect/eterritoire/<city_id>', methods=['GET'])
def redirect_eterritoire(city_id: str) -> werkzeug.Response:
    """Redirect to the e-Territoire page for a city."""

    database = mongo.get_connections_from_env().stats_db
    link = proto.fetch_from_mongo(
        database, association_pb2.SimpleLink, 'eterritoire_links', city_id) or \
        association_pb2.SimpleLink()
    return flask.redirect(f'http://www.eterritoire.fr{link.path}')


@app.route('/api/compute-labor-stats', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=use_case_pb2.LaborStatsData)
def compute_labor_stats(user_proto: user_pb2.User) -> use_case_pb2.LaborStatsData:
    """Compute labor statistics relevant for the user's project."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à conseiller."))
    database = mongo.get_connections_from_env().stats_db
    project = user_proto.projects[0]
    rome_id = project.target_job.job_group.rome_id
    departement_id = project.city.departement_id
    local_stats = jobs.get_local_stats(database, departement_id, rome_id)
    job_group_info = jobs.get_group_proto(database, rome_id)
    # TODO(cyrille): Maybe only keep the relevant departement and job group.
    user_counts = diagnostic.get_users_counts(database)
    return use_case_pb2.LaborStatsData(
        job_group_info=job_group_info, local_stats=local_stats, user_counts=user_counts)


@app.route('/api/diagnostic/main-challenges', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=diagnostic_pb2.DiagnosticMainChallenges)
def list_user_main_challenges(user_proto: user_pb2.User) -> diagnostic_pb2.DiagnosticMainChallenges:
    """List the possible challenges that the diagnostic could return.

    The input is a user to translate and genderize names properly, as well to check the feature
    flags.
    """

    database = mongo.get_connections_from_env().stats_db
    project = scoring.ScoringProject(
        user_proto.projects[0] if user_proto.projects else project_pb2.Project(),
        user_proto, database, now=now.get())
    return diagnostic_pb2.DiagnosticMainChallenges(
        categories=[
            diagnostic.translate_main_challenge(main_challenge, project)
            for main_challenge in diagnostic.list_main_challenges(database)
            if user_proto.features_enabled.alpha or not main_challenge.are_strategies_for_alpha_only
        ],
        is_sorted=boolean_pb2.TRUE,
    )


@app.route('/api/image', methods=['GET'])
def _proxy_http_image() -> flask.Response:
    """Proxy request to HTTP images."""

    src = flask.request.args.get('src', '')
    if not src:
        flask.abort(404)
    url = parse.urlparse(src)
    if url.scheme != 'http' or url.query:
        flask.abort(401)
    response = requests.get(src)
    response.raise_for_status()
    return flask.Response(
        response=response.content,
        headers=dict(response.headers),
    )


@app.route('/api/monitoring', methods=['GET'])
@proto_flask.api(out_type=stats_pb2.Monitoring)
def monitoring() -> stats_pb2.Monitoring:
    """Retrieve data to be monitored."""

    return stats_pb2.Monitoring(
        server_version=_SERVER_TAG['_server'],
    )


apps.register_blueprints(app)

app.before_request(tick.before_request)
app.teardown_request(tick.teardown_request)

if os.getenv('SENTRY_DSN'):
    # Setup logging basic's config first so that we also get basic logging to STDERR.
    logging.basicConfig(level=logging.INFO)
    # TODO(pascal): Fix when https://github.com/getsentry/sentry-python/issues/1081 is solved.
    sentry_sdk.init(  # pylint: disable=abstract-class-instantiated
        dsn=os.getenv('SENTRY_DSN'), release=user.SERVER_TAG['_server'],
        integrations=[
            sentry_logging.LoggingIntegration(level=logging.INFO, event_level=logging.WARNING),
            sentry_flask.FlaskIntegration()])


if __name__ == '__main__':
    # This is only used for dev setup as otherwise we use uwsgi that loads the
    # module and handle the server without running the app.
    app.run(
        debug=bool(os.getenv('DEBUG')),
        host=os.getenv('BIND_HOST', 'localhost'),
        port=int(os.getenv('PORT', '443')),
        ssl_context='adhoc')
