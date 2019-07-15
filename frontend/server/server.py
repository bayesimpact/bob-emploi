"""Simple frontend server for MyGamePlan.

More information about the architecture of the application in go/pe:design.

This file contains the JSON API that will provide the
MyGamePlan web application with data.
"""

import collections
import datetime
import hashlib
import itertools
import json
import logging
import os
import random
import re
import time
import typing
from urllib import parse

from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import message
from google.protobuf import timestamp_pb2
import requests
import sentry_sdk
from sentry_sdk.integrations import flask as sentry_flask
from sentry_sdk.integrations import logging as sentry_logging
import werkzeug
from werkzeug.middleware import proxy_fix

from bob_emploi.frontend.server import action
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import evaluation
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import strategist
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.api import strategy_pb2
from bob_emploi.frontend.api import use_case_pb2
from bob_emploi.frontend.api import user_pb2

if typing.TYPE_CHECKING:
    from typing_extensions import Literal

# TODO(pascal): Split in submodules and remove the exception below.
# pylint: disable=too-many-lines

app = flask.Flask(__name__)  # pylint: disable=invalid-name
# Get original host and scheme used before proxies (load balancer, nginx, etc).
app.wsgi_app = proxy_fix.ProxyFix(app.wsgi_app)  # type: ignore

RANDOMIZER = random.Random()

_FlaskResponse = typing.Union[str, werkzeug.Response]


# TODO(marielaure): Clean up the unverified_data_zones table in _DB.
_DB, _USER_DB, _EVAL_DB = mongo.get_connections_from_env()

_SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_TEST_USER_REGEXP = re.compile(os.getenv('TEST_USER_REGEXP', r'@(bayes.org|example.com)$'))
_ALPHA_USER_REGEXP = re.compile(os.getenv('ALPHA_USER_REGEXP', r'@example.com$'))
_POLE_EMPLOI_USER_REGEXP = \
    re.compile(os.getenv('POLE_EMPLOI_USER_REGEXP', r'@pole-emploi.fr$'))
_EXCLUDE_FROM_ANALYTICS_REGEXP = re.compile(
    os.getenv('EXCLUDE_FROM_ANALYTICS_REGEXP', r'@(bayes.org|bayesimpact.org|example.com)$'))

# Email regex from http://emailregex.com/
_EMAIL_REGEX = re.compile(r'(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)')

# For testing on old users, we sometimes want to enable advisor for newly
# created users.
# TODO(pascal): Remove that when we stop testing about users that do not have
# the advisor feature.
ADVISOR_DISABLED_FOR_TESTING = False

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

_Tick = collections.namedtuple('Tick', ['name', 'time'])

# Log timing of requests that take too long to be treated.
_LONG_REQUEST_DURATION_SECONDS = 5


@app.route('/api/user', methods=['DELETE'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.UserId)
def delete_user(user_data: user_pb2.User) -> user_pb2.UserId:
    """Delete a user and their authentication information."""

    auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
    filter_user: typing.Optional[typing.Dict[str, typing.Any]]
    if user_data.user_id:
        try:
            auth.check_token(user_data.user_id, auth_token, role='unsubscribe')
        except ValueError:
            try:
                auth.check_token(user_data.user_id, auth_token, role='auth')
            except ValueError:
                flask.abort(403, 'Wrong authentication token.')
        filter_user = {'_id': _safe_object_id(user_data.user_id)}
    elif user_data.profile.email:
        # TODO(pascal): Drop this after 2018-09-01, until then we need to keep
        # it as the link is used in old emails.
        try:
            auth.check_token(user_data.profile.email, auth_token, role='unsubscribe')
        except ValueError:
            flask.abort(403, 'Accès refusé')
        filter_user = _USER_DB.user.find_one({
            'hashedEmail': auth.hash_user_email(user_data.profile.email)}, {'_id': 1})
    else:
        flask.abort(400, 'Impossible de supprimer un utilisateur sans son ID.')

    if not filter_user:
        return user_pb2.UserId()

    user_proto = _get_user_data(str(filter_user['_id']))
    if not auth.delete_user(user_proto, _USER_DB):
        flask.abort(500, 'Erreur serveur, impossible de supprimer le compte.')

    return user_pb2.UserId(user_id=str(filter_user['_id']))


@app.route('/api/user/<user_id>/settings', methods=['POST'])
@proto.flask_api(in_type=user_pb2.UserProfile, out_type=user_pb2.UserId)
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

    _USER_DB.user.update_one({'_id': _safe_object_id(user_id)}, updater)

    return user_pb2.UserId(user_id=user_id)


@app.route('/api/user/<user_id>', methods=['GET'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def get_user(user_id: str) -> user_pb2.User:
    """Return the user identified by user_id.

    Returns: The data for a user identified by user_id.
    """

    user_proto = _get_user_data(user_id)
    user_proto.user_id = user_id
    return user_proto


@app.route('/api/user', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.User)
@auth.require_user(lambda user_data: typing.cast(user_pb2.User, user_data).user_id)
def user(user_data: user_pb2.User) -> user_pb2.User:
    """Save the user data sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    Returns: The user data as it was saved.
    """

    if not user_data.user_id:
        flask.abort(400, 'Impossible de sauver les données utilisateur sans ID.')
    return _save_user(user_data, is_new_user=False)


@app.route('/api/user/<user_id>/project/<project_id>', methods=['POST'])
@proto.flask_api(in_type=project_pb2.Project, out_type=project_pb2.Project)
@auth.require_user(lambda project, user_id, project_id: typing.cast(str, user_id))
def save_project(
        project_data: project_pb2.Project, user_id: str, project_id: str) -> project_pb2.Project:
    """Save the project data sent by client.

    Input:
        * Body: A dictionary with attributes of the user's project data.
    Returns: The project data as it was saved.
    """

    user_proto = _get_user_data(user_id)
    if not project_data.project_id:
        project_data.project_id = project_id
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, "Le projet n'existe pas.")
    # TODO(cyrille): Add a route for resetting
    user_proto.projects[project_index].MergeFrom(project_data)
    return _get_project_data(_save_user(user_proto, is_new_user=False), project_id)


@app.route('/api/user/<user_id>/project/<project_id>/advice/<advice_id>', methods=['POST'])
@proto.flask_api(in_type=project_pb2.Advice, out_type=project_pb2.Advice)
@auth.require_user(lambda project, user_id, project_id, advice_id: typing.cast(str, user_id))
def update_advice(advice_data: project_pb2.Advice, user_id: str, project_id: str, advice_id: str) \
        -> project_pb2.Advice:
    """Save the advice module data sent by client.

    Input:
        * Body: A dictionary with attributes of the user's advice data.
    Returns: The advice data as it was saved.
    """

    user_proto = _get_user_data(user_id)
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, "Le projet n'existe pas.")
    advice_index = next((
        index for index, a in enumerate(user_proto.projects[project_index].advices)
        if a.advice_id == advice_id), None)
    if advice_index is None:
        flask.abort(404, "Le conseil n'existe pas pour ce projet.")

    user_proto.projects[project_index].advices[advice_index].MergeFrom(advice_data)
    updated_user = _save_user(user_proto, is_new_user=False)
    updated_project = _get_project_data(updated_user, project_id)
    return _get_advice_data(updated_project, advice_id)


@app.route('/api/user/<user_id>/project/<project_id>/strategy/<strategy_id>', methods=['POST'])
@proto.flask_api(in_type=project_pb2.WorkingStrategy, out_type=project_pb2.WorkingStrategy)
@auth.require_user(lambda project, user_id, project_id, strategy_id: typing.cast(str, user_id))
def update_strategy(
        strategy_data: project_pb2.WorkingStrategy,
        user_id: str, project_id: str, strategy_id: str) -> project_pb2.WorkingStrategy:
    """Save the strategy information sent by the client."""

    user_proto = _get_user_data(user_id)
    project_index = next((
        index for index, p in enumerate(user_proto.projects)
        if p.project_id == project_id), None)
    if project_index is None:
        flask.abort(404, "Le projet n'existe pas.")
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
    updated_user = _save_user(user_proto, is_new_user=False)
    updated_project = _get_project_data(updated_user, project_id)
    return _get_strategy_data(updated_project, strategy_id)


def _clear_replaceable_fields(
        user_proto: message.Message, request_proto: message.Message) -> None:
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
            # Replaceable list with only one falsy value means that the field should be emptied.
            if len(request_value) == 1 and not request_value[0]:
                request_proto.ClearField(field_descriptor.name)
        if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
            if field_descriptor.label == field_descriptor.LABEL_REPEATED:
                continue
            _clear_replaceable_fields(user_value, request_value)


@app.route(
    '/api/user/<user_id>/update-and-quick-diagnostic', methods=['POST'],
    defaults={'project_id': None})
@app.route('/api/user/<user_id>/update-and-quick-diagnostic/<project_id>', methods=['POST'])
@proto.flask_api(in_type=user_pb2.QuickDiagnosticRequest, out_type=diagnostic_pb2.QuickDiagnostic)
@auth.require_user(lambda request, user_id, project_id: typing.cast(str, user_id))
def update_and_quick_diagnose(
        request: user_pb2.QuickDiagnosticRequest, user_id: str, project_id: str) \
        -> diagnostic_pb2.QuickDiagnostic:
    """Update a user project and quickly diagnose it."""

    user_proto = _get_user_data(user_id)
    project_proto: typing.Optional[project_pb2.Project]
    if project_id:
        project_proto = _get_project_data(user_proto, project_id)
    elif user_proto.projects:
        project_proto = user_proto.projects[0]
    else:
        project_proto = None

    if request.HasField('user'):
        merged_project: typing.Optional[project_pb2.Project]
        if request.user.projects and project_proto:
            merged_project = request.user.projects[0]
            _clear_replaceable_fields(project_proto, request.user.projects[0])
            project_proto.MergeFrom(request.user.projects[0])
            del request.user.projects[:]
        else:
            merged_project = None
        _clear_replaceable_fields(user_proto, request.user)

        user_proto.MergeFrom(request.user)
        user_proto = _save_user(user_proto, is_new_user=False)

        if merged_project:
            request.user.projects.extend([merged_project])
        elif user_proto.projects:
            project_proto = user_proto.projects[0]

    return diagnostic.quick_diagnose(
        user_proto, project_proto or project_pb2.Project(), request.user, _DB)


@app.route('/api/user/<user_id>/migrate-to-advisor', methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def migrate_to_advisor(user_id: str) -> user_pb2.User:
    """Migrate a user of the Mashup to use the Advisor."""

    user_proto = _get_user_data(user_id)
    has_multiple_projects = len(user_proto.projects) > 1
    was_using_mashup = \
        user_proto.features_enabled.advisor == user_pb2.CONTROL or has_multiple_projects

    user_proto.features_enabled.ClearField('advisor')
    user_proto.features_enabled.ClearField('advisor_email')
    user_proto.features_enabled.switched_from_mashup_to_advisor = was_using_mashup
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)}, {'$set': {
            'featuresEnabled': json_format.MessageToDict(user_proto.features_enabled)}},
        upsert=False)

    return _save_user(user_proto, is_new_user=False)


@app.route('/api/project/diagnose', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=diagnostic_pb2.Diagnostic)
def diagnose_project(user_proto: user_pb2.User) -> diagnostic_pb2.Diagnostic:
    """Diagnose a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    project = user_proto.projects[0]
    user_diagnostic, unused_missing = diagnostic.diagnose(user_proto, project, _DB)
    return user_diagnostic


@app.route('/api/project/strategize', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=strategy_pb2.Strategies)
def strategize_project(user_proto: user_pb2.User) -> strategy_pb2.Strategies:
    """Strategize a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    project = user_proto.projects[0]
    strategist.strategize(user_proto, project, _DB)
    response = strategy_pb2.Strategies()
    response.strategies.extend(project.strategies)
    return response


@app.route('/api/project/compute-advices', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=project_pb2.Advices)
def compute_advices_for_project(user_proto: user_pb2.User) -> project_pb2.Advices:
    """Advise on a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    return advisor.compute_advices_for_project(user_proto, user_proto.projects[0], _DB)


@app.route('/api/app/use/<user_id>', methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def use_app(user_id: str) -> user_pb2.User:
    """Update the user's data to mark that they have just used the app."""

    user_proto = _get_user_data(user_id)
    start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
    if user_proto.requested_by_user_at_date.ToDatetime() >= start_of_day:
        return user_proto
    user_proto.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_proto.requested_by_user_at_date.nanos = 0
    return _save_user(user_proto, is_new_user=False)


def _save_project(
        project: project_pb2.Project,
        previous_project: project_pb2.Project,
        user_data: user_pb2.User) -> project_pb2.Project:
    # TODO(cyrille): Check for completeness here, rather than in client.
    if project.is_incomplete:
        return project
    _tick('Process project start')
    rome_id = project.target_job.job_group.rome_id
    departement_id = project.city.departement_id
    if not project.project_id:
        # Add ID, timestamp and stats to new projects
        project.project_id = _create_new_project_id(user_data)
        project.created_at.FromDatetime(now.get())
        project.created_at.nanos = 0

    if not project.WhichOneof('job_search_length') and project.job_search_length_months:
        if project.job_search_length_months < 0:
            project.job_search_has_not_started = True
        else:
            job_search_length_days = 30.5 * project.job_search_length_months
            job_search_length_duration = datetime.timedelta(days=job_search_length_days)
            project.job_search_started_at.FromDatetime(
                project.created_at.ToDatetime() - job_search_length_duration)
            project.job_search_started_at.nanos = 0

    _tick('Populate local stats')
    if previous_project.city.departement_id != departement_id or \
            previous_project.target_job.job_group.rome_id != rome_id:
        project.ClearField('local_stats')
    if not project.HasField('local_stats'):
        project.local_stats.CopyFrom(jobs.get_local_stats(_DB, departement_id, rome_id))

    _tick('Diagnostic')
    diagnostic.maybe_diagnose(user_data, project, _DB)

    _tick('Advisor')
    advisor.maybe_advise(
        user_data, project, _DB, parse.urljoin(flask.request.base_url, '/')[:-1])

    _tick('Strategies')
    strategist.maybe_strategize(user_data, project, _DB)

    _tick('New feedback')
    if project.feedback.text and not previous_project.feedback.text:
        stars = ':star:' * project.feedback.score
        user_url = parse.urljoin(
            flask.request.base_url, f'/eval?userId={user_data.user_id}')
        feedback = '\n> '.join(project.feedback.text.split('\n'))
        slack_text = f'[{stars}] <{user_url}|{user_data.user_id}>\n> {feedback}'
        _give_feedback(
            feedback_pb2.Feedback(
                user_id=str(user_data.user_id),
                project_id=str(project.project_id),
                feedback=project.feedback.text,
                source=feedback_pb2.PROJECT_FEEDBACK,
                score=project.feedback.score),
            slack_text=slack_text)

    _tick('Process project end')
    return project


def _save_user(user_data: user_pb2.User, is_new_user: bool) -> user_pb2.User:
    _tick('Save user start')

    if is_new_user:
        previous_user_data = user_data
    else:
        _tick('Load old user data')
        previous_user_data = _get_user_data(user_data.user_id)
        if user_data.revision and previous_user_data.revision > user_data.revision:
            # Do not overwrite newer data that was saved already: just return it.
            return previous_user_data

    if not previous_user_data.registered_at.seconds:
        user_data.registered_at.FromDatetime(now.get())
        # No need to pollute our DB with super precise timestamps.
        user_data.registered_at.nanos = 0
        # Disable Advisor for new users in tests.
        if ADVISOR_DISABLED_FOR_TESTING:
            user_data.features_enabled.advisor = user_pb2.CONTROL
            user_data.features_enabled.advisor_email = user_pb2.CONTROL
    elif not _is_test_user(previous_user_data):
        user_data.registered_at.CopyFrom(previous_user_data.registered_at)
        user_data.features_enabled.advisor = previous_user_data.features_enabled.advisor
        user_data.features_enabled.strat_two = previous_user_data.features_enabled.strat_two

    _populate_feature_flags(user_data)

    for project in user_data.projects:
        previous_project = next(
            (p for p in previous_user_data.projects if p.project_id == project.project_id),
            project_pb2.Project())
        _save_project(project, previous_project, user_data)

    if user_data.profile.coaching_email_frequency != \
            previous_user_data.profile.coaching_email_frequency:
        # Invalidate the send_coaching_email_after field: it will be recomputed
        # by the focus email script.
        user_data.ClearField('send_coaching_email_after')

    # Update hashed_email field if necessary, to make sure it's consistent with profile.email. This
    # must be done for all users, since (say) a Google authenticated user may try to connect with
    # password, so its email hash must be indexed.
    # TODO(cyrille): Find a way to handle multi-authentication account more gracefully. Ideally in
    # the end we might want to have:
    #  - only one account with multiple way of authenticating
    #  - the email is only a property and multiple accounts may have the same email
    if user_data.profile.email:
        user_data.hashed_email = auth.hash_user_email(user_data.profile.email)

    if not is_new_user:
        _assert_no_credentials_change(previous_user_data, user_data)
        _copy_unmodifiable_fields(previous_user_data, user_data)
        _populate_feature_flags(user_data)

    user_data.revision += 1

    _tick('Save user')
    _save_low_level(user_data, is_new_user=is_new_user)
    _tick('Return user proto')

    return user_data


def _save_low_level(user_data: user_pb2.User, is_new_user: bool = False) -> user_pb2.User:
    user_dict = json_format.MessageToDict(user_data)
    user_dict.update(_SERVER_TAG)
    user_dict.pop('userId', None)
    if is_new_user:
        user_dict['_id'] = _get_unguessable_object_id()
        result = _USER_DB.user.insert_one(user_dict)
        user_data.user_id = str(result.inserted_id)
    else:
        _USER_DB.user.replace_one({'_id': _safe_object_id(user_data.user_id)}, user_dict)
    return user_data


def _create_new_project_id(user_data: user_pb2.User) -> str:
    existing_ids = set(p.project_id for p in user_data.projects) |\
        set(p.project_id for p in user_data.deleted_projects)
    for id_candidate in itertools.count():
        id_string = f'{id_candidate:x}'
        if id_string not in existing_ids:
            return id_string
    raise ValueError('Should never happen as itertools.count() does not finish')  # pragma: no-cover


def _get_unguessable_object_id() -> objectid.ObjectId:
    """Hash the ObjectID with our salt to avoid that new UserIds can easily be guessed.

    See http://go/bob:security for details.
    """

    guessable_object_id = objectid.ObjectId()
    salter = hashlib.sha1()
    salter.update(str(guessable_object_id).encode('ascii'))
    salter.update(auth.SECRET_SALT)
    return objectid.ObjectId(salter.hexdigest()[:24])


_SHOW_UNVERIFIED_DATA_USERS: typing.Set[str] = set()


def _show_unverified_data_users() -> typing.Set[str]:
    if not _SHOW_UNVERIFIED_DATA_USERS:
        for document in _USER_DB.show_unverified_data_users.find():
            _SHOW_UNVERIFIED_DATA_USERS.add(document['_id'])
    return _SHOW_UNVERIFIED_DATA_USERS


def _validate_city(city: geo_pb2.FrenchCity) -> typing.Optional[geo_pb2.FrenchCity]:
    if not city.postcodes:
        return None
    return city


def _copy_unmodifiable_fields(previous_user_data: user_pb2.User, user_data: user_pb2.User) -> None:
    """Copy unmodifiable fields.

    Some fields cannot be changed by the API: we only copy over the fields
    from the previous state.
    """

    if _is_test_user(user_data):
        # Test users can do whatever they want.
        return
    for field in ('features_enabled', 'last_email_sent_at'):
        typed_field = typing.cast('Literal["features_enabled", "last_email_sent_at"]', field)
        if previous_user_data.HasField(typed_field):
            getattr(user_data, typed_field).CopyFrom(getattr(previous_user_data, typed_field))
        else:
            user_data.ClearField(typed_field)


def _assert_no_credentials_change(previous: user_pb2.User, new: user_pb2.User) -> None:
    if previous.facebook_id != new.facebook_id:
        flask.abort(403, "Impossible de modifier l'identifiant Facebook.")
    if previous.google_id != new.google_id:
        flask.abort(403, "Impossible de modifier l'identifiant Google.")
    if previous.profile.email == new.profile.email:
        return
    if (new.facebook_id and not previous.profile.email) or new.google_id:
        # Email address can be changed for Google SSO users and can be set when empty for FB users.
        if not _EMAIL_REGEX.match(new.profile.email):
            flask.abort(403, 'Adresse email invalide.')
        email_taken = bool(_USER_DB.user.find(
            {'hashedEmail': auth.hash_user_email(new.profile.email)}, {'_id': 1}).limit(1).count())
        if email_taken:
            flask.abort(403, "L'utilisateur existe mais utilise un autre moyen de connexion.")
        return
    flask.abort(403, "Impossible de modifier l'adresse email.")


def _safe_object_id(_id: str) -> objectid.ObjectId:
    try:
        return objectid.ObjectId(_id)
    except objectid.InvalidId:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(
            400, f'L\'identifiant "{_id}" n\'est pas un identifiant MongoDB valide.')


def _get_user_data(user_id: str) -> user_pb2.User:
    """Load user data from DB."""

    user_dict = _USER_DB.user.find_one({'_id': _safe_object_id(user_id)})
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id', always_create=False)
    if not user_proto:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, f'Utilisateur "{user_id}" inconnu.')

    _populate_feature_flags(user_proto)

    # TODO(cyrille): Remove this once we've generated observations for old users.
    for project in user_proto.projects:
        if not project.diagnostic.sub_diagnostics:
            continue
        scoring_project = scoring.ScoringProject(
            project, user_proto.profile, user_proto.features_enabled, _DB)
        for sub_diagnostic in project.diagnostic.sub_diagnostics:
            if not sub_diagnostic.observations:
                sub_diagnostic.observations.extend(
                    diagnostic.compute_sub_diagnostic_observations(
                        scoring_project, sub_diagnostic.topic))

    # TODO(pascal): Remove the fields completely after this has been live for a
    # week.
    user_proto.profile.ClearField('city')
    user_proto.profile.ClearField('latest_job')
    user_proto.profile.ClearField('situation')

    return user_proto


def _get_project_data(user_proto: user_pb2.User, project_id: str) -> project_pb2.Project:
    try:
        return next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, f'Projet "{project_id}" inconnu.')


def _get_advice_data(project: project_pb2.Project, advice_id: str) -> project_pb2.Advice:
    try:
        return next(
            advice for advice in project.advices
            if advice.advice_id == advice_id)
    except StopIteration:
        flask.abort(404, f'Conseil "{advice_id}" inconnu.')


def _get_strategy_data(project: project_pb2.Project, strategy_id: str) \
        -> project_pb2.WorkingStrategy:
    try:
        return next(
            strategy for strategy in project.opened_strategies
            if strategy.strategy_id == strategy_id)
    except StopIteration:
        flask.abort(404, f'Stratégie "{strategy_id}" inconnue.')


_ACTION_STOPPED_STATUSES = frozenset([
    action_pb2.ACTION_SNOOZED,
    action_pb2.ACTION_DONE,
    action_pb2.ACTION_STICKY_DONE,
    action_pb2.ACTION_DECLINED])


def _get_authenticator() -> auth.Authenticator:
    authenticator = auth.Authenticator(
        _USER_DB, _DB, lambda u: _save_user(u, is_new_user=True),
        _update_returning_user,
    )
    return authenticator


def _update_returning_user(user_data: user_pb2.User) -> timestamp_pb2.Timestamp:
    if user_data.HasField('requested_by_user_at_date'):
        start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
        if user_data.requested_by_user_at_date.ToDatetime() >= start_of_day:
            # Nothing to update.
            return user_data.requested_by_user_at_date
        last_connection = timestamp_pb2.Timestamp()
        last_connection.CopyFrom(user_data.requested_by_user_at_date)
    else:
        last_connection = user_data.registered_at

    if user_data.profile.email:
        user_data.hashed_email = auth.hash_user_email(user_data.profile.email)

    user_data.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_data.requested_by_user_at_date.nanos = 0
    _save_low_level(user_data)

    return last_connection


# TODO: Split this into separate endpoints for registration and login.
# Having both in the same endpoint makes refactoring the frontend more difficult.
@app.route('/api/user/authenticate', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest, out_type=user_pb2.AuthResponse)
def authenticate(auth_request: user_pb2.AuthRequest) -> user_pb2.AuthResponse:
    """Authenticate a user."""

    authenticator = _get_authenticator()
    return authenticator.authenticate(auth_request)


@app.route('/api/user/reset-password', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest)
def reset_password(auth_request: user_pb2.AuthRequest) -> str:
    """Sends an email to user with a reset token so that they can reset their password."""

    authenticator = _get_authenticator()
    authenticator.send_reset_password_token(auth_request.email)
    return '{}'


@app.route('/api/user/proto', methods=['POST'])
@proto.flask_api(
    in_type=user_pb2.UserWithAdviceSelection, out_type=user_pb2.UserWithAdviceSelection)
def convert_user_proto(user_with_advice: user_pb2.UserWithAdviceSelection) \
        -> user_pb2.UserWithAdviceSelection:
    """A simple reflection to let client converts this proto from/to different formats."""

    return user_with_advice


@app.route('/api/user/<user_id>/generate-auth-tokens', methods=['GET'])
@auth.require_user(lambda user_id: typing.cast(str, user_id))
def generate_auth_tokens(user_id: str) -> str:
    r"""Generates auth token for a given user.

    Note that this is safe to do as long as the user had a proper and complete
    auth token which is ensured by the @auth.require_user above.

    The "easiest" way to use it:
     - open a the Chrome Console on Bob
     - run the following js commands: ```
        (() => {const authToken = window.localStorage.getItem('authToken');
        const userId = window.localStorage.getItem('userId');
        fetch(`/api/user/${userId}/generate-auth-tokens`, {
            headers: {Authorization: `Bearer ${authToken}`},
         }).then(response => response.json()).then(console.log)})()
       ```
    - warning: may not work in other browsers or in Private Navigation mode.
    """

    return json.dumps({
        'auth': auth.create_token(user_id, is_using_timestamp=True),
        'employment-status': auth.create_token(user_id, 'employment-status'),
        'nps': auth.create_token(user_id, 'nps'),
        'reset': _get_authenticator().create_reset_token(user_id),
        'settings': auth.create_token(user_id, 'settings'),
        'unsubscribe': auth.create_token(user_id, 'unsubscribe'),
        'user': user_id,
    })


@app.route('/api/job/requirements/<rome_id>', methods=['GET'])
@proto.flask_api(out_type=job_pb2.JobRequirements)
def job_requirements(rome_id: str) -> job_pb2.JobRequirements:
    """Get requirements for a job."""

    no_requirements = job_pb2.JobRequirements()

    job_group_info = jobs.get_group_proto(_DB, rome_id)
    if not job_group_info:
        return no_requirements

    return job_group_info.requirements


def _get_expanded_card_data(
        user_proto: user_pb2.User, project: project_pb2.Project, advice_id: str) -> message.Message:
    module = advisor.get_advice_module(advice_id, _DB)
    if not module or not module.trigger_scoring_model:
        flask.abort(404, f'Le module "{advice_id}" n\'existe pas')
    model = scoring.get_scoring_model(module.trigger_scoring_model)
    if not model or not hasattr(model, 'get_expanded_card_data'):
        flask.abort(404, f'Le module "{advice_id}" n\'a pas de données supplémentaires')

    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, _DB, now=now.get())
    return model.get_expanded_card_data(scoring_project)


@app.route('/api/advice/<advice_id>/<user_id>/<project_id>', methods=['GET'])
@proto.flask_api(out_type=message.Message)
@auth.require_user(lambda user_id, project_id, advice_id: typing.cast(str, user_id))
def get_advice_expanded_card_data(user_id: str, project_id: str, advice_id: str) \
        -> message.Message:
    """Retrieve expanded card data for an advice module for a project."""

    user_proto = _get_user_data(user_id)
    return _get_expanded_card_data(user_proto, _get_project_data(user_proto, project_id), advice_id)


@app.route('/api/advice/<advice_id>', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=message.Message)
def compute_expanded_card_data(user_proto: user_pb2.User, advice_id: str) -> message.Message:
    """Retrieve expanded card data for an advice module for a project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    return _get_expanded_card_data(user_proto, user_proto.projects[0], advice_id)


@app.route('/api/advice/tips/<advice_id>/<user_id>/<project_id>', methods=['GET'])
@proto.flask_api(out_type=action_pb2.AdviceTips)
@auth.require_user(lambda user_id, project_id, advice_id: typing.cast(str, user_id))
def advice_tips(user_id: str, project_id: str, advice_id: str) -> action_pb2.AdviceTips:
    """Get all available tips for a piece of advice."""

    user_proto = _get_user_data(user_id)
    project = _get_project_data(user_proto, project_id)
    piece_of_advice = _get_advice_data(project, advice_id)

    all_tips = advisor.list_all_tips(user_proto, project, piece_of_advice, _DB)

    response = action_pb2.AdviceTips()
    for tip_template in all_tips:
        action.instantiate(response.tips.add(), user_proto, project, tip_template, _DB)
    return response


@app.route('/api/cache/clear', methods=['GET'])
def clear_cache() -> str:
    """Clear all server caches.

    This is an undocumented feature that allows us to clear a server's cache
    without rebooting it. Anybody can use it, but it doesn't cost much apart
    from 2 or 3 additional MongoDB requests on next queries.
    """

    _SHOW_UNVERIFIED_DATA_USERS.clear()
    proto.CachedCollection.update_cache_version()
    proto.clear_mongo_fetcher_cache()
    strategist.clear_cache()
    return 'Server cache cleared.'


@app.route('/api/jobs/<rome_id>', methods=['GET'])
@proto.flask_api(out_type=job_pb2.JobGroup)
def get_job_group_jobs(rome_id: str) -> job_pb2.JobGroup:
    """Retrieve information about jobs whithin a job group."""

    job_group = jobs.get_group_proto(_DB, rome_id)
    if not job_group:
        flask.abort(404, f'Groupe de métiers "{rome_id}" inconnu.')

    result = job_pb2.JobGroup()
    result.jobs.extend(job_group.jobs)
    result.requirements.specific_jobs.extend(job_group.requirements.specific_jobs)
    return result


@app.route('/api/job/application-modes/<rome_id>', methods=['GET'])
@proto.flask_api(out_type=job_pb2.JobGroup)
def get_job_group_application_modes(rome_id: str) -> job_pb2.JobGroup:
    """Retrieve information about application modes whithin a job group."""

    job_group = jobs.get_group_proto(_DB, rome_id)
    if not job_group:
        flask.abort(404, f'Groupe de métiers "{rome_id}" inconnu.')

    result = job_pb2.JobGroup()
    # TODO(cyrille): Add MergeFrom as method on map fields in mypy-protobuf and remove the
    # type ignore.
    result.application_modes.MergeFrom(job_group.application_modes)  # type: ignore
    return result


@app.route('/api/feedback', methods=['POST'])
@proto.flask_api(in_type=feedback_pb2.Feedback)
def give_feedback(feedback: feedback_pb2.Feedback) -> str:
    # TODO(pascal): Change this doc.
    """Retrieve information about jobs whithin a job group."""

    if feedback.user_id:
        auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
        if not auth_token:
            flask.abort(401, 'Token manquant')
        try:
            auth.check_token(feedback.user_id, auth_token, role='auth')
        except ValueError:
            flask.abort(403, 'Unauthorized token')
    _give_feedback(feedback, slack_text=feedback.feedback)
    return ''


def _give_feedback(feedback: feedback_pb2.Feedback, slack_text: str) -> None:
    if slack_text and _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={'text': f':mega: {slack_text}'})
    _USER_DB.feedbacks.insert_one(json_format.MessageToDict(feedback))


@app.route('/', methods=['GET'])
def health_check() -> str:
    """Health Check endpoint.

    Probes can call it to check that the server is up.
    """

    return 'Up and running'


def _populate_feature_flags(user_proto: user_pb2.User) -> None:
    """Update the feature flags."""

    user_proto.features_enabled.ClearField('action_done_button_discreet')
    user_proto.features_enabled.ClearField('action_done_button_control')

    if _ALPHA_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.alpha = True
    if _POLE_EMPLOI_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.pole_emploi = True
    if _EXCLUDE_FROM_ANALYTICS_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.exclude_from_analytics = True
    if user_proto.features_enabled.strat_two == user_pb2.CONTROL:
        # Keep control users from strat_two.
        return
    if any(p.strategies for p in user_proto.projects):
        user_proto.features_enabled.strat_two = user_pb2.ACTIVE
    else:
        user_proto.features_enabled.ClearField('strat_two')


@app.route('/api/user/nps-survey-response', methods=['POST'])
@auth.require_admin
@proto.flask_api(in_type=user_pb2.NPSSurveyResponse)
def set_nps_survey_response(nps_survey_response: user_pb2.NPSSurveyResponse) -> str:
    """Save user response to the Net Promoter Score survey."""

    # Note that this endpoint doesn't use authentication: only the email is necessary to
    # update the user record.
    user_dict = _USER_DB.user.find_one({
        'hashedEmail': auth.hash_user_email(nps_survey_response.email)}, {'_id': 1})
    if not user_dict:
        flask.abort(404, f'Utilisateur "{nps_survey_response.email}" inconnu.')
    user_id = user_dict['_id']
    user_proto = _get_user_data(user_id)
    # We use MergeFrom, as 'curated_useful_advice_ids' will likely be set in a second call.
    user_proto.net_promoter_score_survey_response.MergeFrom(nps_survey_response)
    # No need to keep the email field in the survey response as it is the same as in profile.email.
    user_proto.net_promoter_score_survey_response.ClearField('email')
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': {'netPromoterScoreSurveyResponse': json_format.MessageToDict(
            user_proto.net_promoter_score_survey_response
        )}},
        upsert=False
    )
    return ''


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
        flask.abort(422, 'Paramètre score invalide.')
    user_to_update.net_promoter_score_survey_response.score = score

    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return _maybe_redirect()


@app.route('/api/nps', methods=['POST'])
@proto.flask_api(in_type=user_pb2.SetNPSCommentRequest)
@auth.require_user(
    lambda set_nps_request: typing.cast(user_pb2.SetNPSCommentRequest, set_nps_request).user_id,
    role='nps')
def set_nps_response_comment(set_nps_request: user_pb2.SetNPSCommentRequest) -> str:
    """Save user's freeform comment after the Net Promoter Score survey."""

    user_to_update = user_pb2.User()
    user_to_update.net_promoter_score_survey_response.general_feedback_comment = \
        set_nps_request.comment

    user_id = _safe_object_id(set_nps_request.user_id)

    if set_nps_request.comment:
        previous_user = _USER_DB.user.find_one(
            {'_id': user_id}, {'netPromoterScoreSurveyResponse.score': 1})
        if previous_user and 'netPromoterScoreSurveyResponse' in previous_user:
            score = previous_user['netPromoterScoreSurveyResponse'].get('score', 0)
        else:
            score = 'unknown'
        user_url = parse.urljoin(
            flask.request.base_url, f'/eval?userId={set_nps_request.user_id}')
        comment = '\n> '.join(set_nps_request.comment.split('\n'))
        _give_feedback(
            feedback_pb2.Feedback(
                user_id=set_nps_request.user_id,
                feedback=set_nps_request.comment,
                source=feedback_pb2.PRODUCT_FEEDBACK),
            slack_text=f'[NPS Score: {score}] <{user_url}|{set_nps_request.user_id}>\n> {comment}')

    mongo_update = _flatten_mongo_fields(json_format.MessageToDict(user_to_update))
    _USER_DB.user.update_one({'_id': user_id}, {'$set': mongo_update}, upsert=False)

    return ''


def _flatten_mongo_fields(
        root: typing.Dict[str, typing.Any], prefix: str = '') -> typing.Dict[str, str]:
    """Flatten a nested dict as individual fields with key separted by dots as Mongo does it."""

    all_fields: typing.Dict[str, str] = {}
    for key, value in root.items():
        if isinstance(value, dict):
            all_fields.update(_flatten_mongo_fields(value, prefix + key + '.'))
        else:
            all_fields[prefix + key] = typing.cast(str, value)
    return all_fields


@app.route('/api/employment-status/<user_id>', methods=['POST'])
@proto.flask_api(in_type=user_pb2.EmploymentStatus)
@auth.require_user(
    lambda unused_new_status, user_id: typing.cast(str, user_id), role='employment-status')
def update_employment_status(new_status: user_pb2.EmploymentStatus, user_id: str) -> str:
    """Update user's last employment status."""

    user_proto = _get_user_data(user_id)
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
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return ''


@app.route('/api/employment-status', methods=['GET'])
@auth.require_user_in_args(role='employment-status')
def get_employment_status(user_id: str) -> _FlaskResponse:
    """Save user's first click and redirect them to the full survey."""

    user_proto = _get_user_data(user_id)
    # Create another empty User message to update only employment_status field.
    user_to_update = user_pb2.User()
    user_to_update.employment_status.extend(user_proto.employment_status[:])
    survey_id = len(user_to_update.employment_status)
    employment_status = user_to_update.employment_status.add()
    employment_status.created_at.FromDatetime(now.get())
    try:
        json_format.ParseDict(flask.request.args, employment_status, ignore_unknown_fields=True)
    except json_format.ParseError:
        flask.abort(422, 'Paramètres invalides.')
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': json_format.MessageToDict(user_to_update)},
        upsert=False)

    return _maybe_redirect(
        id=survey_id,
        gender=user_pb2.Gender.Name(user_proto.profile.gender),
        can_tutoie=user_proto.profile.can_tutoie)


def _maybe_redirect(**kwargs: typing.Any) -> _FlaskResponse:
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
@proto.flask_api(out_type=stats_pb2.UsersCount)
def get_usage_stats() -> stats_pb2.UsersCount:
    """Get stats of the app usage."""

    now_utc = now.get().astimezone(datetime.timezone.utc)
    start_of_second = now_utc.replace(microsecond=0, tzinfo=None)
    last_week = start_of_second - datetime.timedelta(days=7)

    # Compute weekly user count.
    weekly_new_user_count = _USER_DB.user.find({
        'registeredAt': {
            '$gt': proto.datetime_to_json_string(last_week),
            '$lte': proto.datetime_to_json_string(start_of_second),
        },
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    }).count()

    return stats_pb2.UsersCount(
        total_user_count=_USER_DB.user.count(),
        weekly_new_user_count=weekly_new_user_count,
    )


@app.route('/api/redirect/eterritoire/<city_id>', methods=['GET'])
def redirect_eterritoire(city_id: str) -> werkzeug.Response:
    """Redirect to the e-Territoire page for a city."""

    link = proto.fetch_from_mongo(
        _DB, association_pb2.SimpleLink, 'eterritoire_links', city_id) or \
        association_pb2.SimpleLink()
    return flask.redirect(f'http://www.eterritoire.fr{link.path}')


@app.route('/api/compute-labor-stats', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=use_case_pb2.LaborStatsData)
def compute_labor_stats(user_proto: user_pb2.User) -> use_case_pb2.LaborStatsData:
    """Compute labor statistics relevant for the user's project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to compute stats on.')
    project = user_proto.projects[0]
    rome_id = project.target_job.job_group.rome_id
    departement_id = project.city.departement_id
    local_stats = jobs.get_local_stats(
        flask.current_app.config['DATABASE'], departement_id, rome_id)
    job_group_info = jobs.get_group_proto(
        flask.current_app.config['DATABASE'], rome_id)
    return use_case_pb2.LaborStatsData(
        job_group_info=job_group_info, local_stats=local_stats)


app.register_blueprint(evaluation.app, url_prefix='/api/eval')


@typing.cast(
    typing.Callable[[typing.Callable[[], None]], typing.Callable[[], None]],
    app.before_request)
def _before_request() -> None:
    flask.g.start = time.time()
    flask.g.ticks = []


def _tick(tick_name: str) -> None:
    flask.g.ticks.append(_Tick(tick_name, time.time()))


def _is_test_user(user_proto: user_pb2.User) -> bool:
    return bool(_TEST_USER_REGEXP.search(user_proto.profile.email))


@typing.cast(
    typing.Callable[
        [typing.Callable[[typing.Optional[Exception]], None]],
        typing.Callable[[], None]],
    app.teardown_request)
def _teardown_request(unused_exception: typing.Optional[Exception] = None) -> None:
    total_duration = time.time() - flask.g.start
    if total_duration <= _LONG_REQUEST_DURATION_SECONDS:
        return
    last_tick_time = flask.g.start
    for tick in sorted(flask.g.ticks, key=lambda t: t.time):
        logging.info(
            '%.4f: Tick %s (%.4f since last tick)',
            tick.time - flask.g.start, tick.name, tick.time - last_tick_time)
        last_tick_time = tick.time
    logging.warning('Long request: %d seconds', total_duration)


app.config['DATABASE'] = _DB
app.config['USER_DATABASE'] = _USER_DB
app.config['EVAL_DATABASE'] = _EVAL_DB
if os.getenv('SENTRY_DSN'):
    # Setup logging basic's config first so that we also get basic logging to STDERR.
    logging.basicConfig(level=logging.INFO)
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'), release=_SERVER_TAG['_server'],
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
