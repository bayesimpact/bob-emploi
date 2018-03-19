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
import re
import time
from urllib import parse

from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import message
from google.protobuf import timestamp_pb2
import pymongo
from raven.contrib import flask as raven_flask
from werkzeug.contrib import fixers

from bob_emploi.frontend.server import action
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import evaluation
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import export_pb2

# TODO(pascal): Split in submodules and remove the exception below.
# pylint: disable=too-many-lines

app = flask.Flask(__name__)  # pylint: disable=invalid-name
# Get original host and scheme used before proxies (load balancer, nginx, etc).
app.wsgi_app = fixers.ProxyFix(app.wsgi_app)


_DB, _USER_DB = mongo.get_connections_from_env()

_SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_TEST_USER_REGEXP = re.compile(os.getenv('TEST_USER_REGEXP', r'@(bayes.org|example.com)$'))
_ALPHA_USER_REGEXP = re.compile(os.getenv('ALPHA_USER_REGEXP', r'@example.com$'))
_SHOW_UNVERIFIED_DATA_USER_REGEXP = \
    re.compile(os.getenv('SHOW_UNVERIFIED_DATA_USER_REGEXP', r'@pole-emploi.fr$'))
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

_Tick = collections.namedtuple('Tick', ['name', 'time'])

# Log timing of requests that take too long to be treated.
_LONG_REQUEST_DURATION_SECONDS = 5


@app.route('/api/user', methods=['DELETE'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.UserId)
def delete_user(user_data):
    """Delete a user and their authentication information."""

    auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
    if user_data.user_id:
        try:
            auth.check_token(user_data.user_id, auth_token, role='auth')
        except ValueError:
            flask.abort(403, 'Wrong authentication token.')
        filter_user = {'_id': _safe_object_id(user_data.user_id)}
    elif user_data.profile.email:
        try:
            auth.check_token(user_data.profile.email, auth_token, role='unsubscribe')
        except ValueError:
            flask.abort(403, 'Accès refusé')
        filter_user = _USER_DB.user.find_one({'profile.email': user_data.profile.email}, {'_id': 1})
    else:
        flask.abort(400, 'Impossible de supprimer un utilisateur sans son ID.')

    if not filter_user:
        return user_pb2.UserId()

    # Remove authentication informations.
    _USER_DB.user_auth.delete_one(filter_user)

    user_proto = _get_user_data(filter_user['_id'])
    try:
        privacy.redact_proto(user_proto)
    except TypeError:
        logging.exception('Cannot delete account %s', str(filter_user['_id']))
        flask.abort(500, 'Erreur serveur, impossible de supprimer le compte.')
    user_proto.deleted_at.FromDatetime(now.get())
    user_proto.ClearField('user_id')
    _USER_DB.user.replace_one(filter_user, json_format.MessageToDict(user_proto))

    return user_pb2.UserId(user_id=str(filter_user['_id']))


@app.route('/api/user/<user_id>', methods=['GET'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: user_id)
def get_user(user_id):
    """Return the user identified by user_id.

    Returns: The data for a user identified by user_id.
    """

    user_proto = _get_user_data(user_id)
    user_proto.user_id = user_id
    return user_proto


@app.route('/api/user', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.User)
@auth.require_user(lambda user_data: user_data.user_id)
def user(user_data):
    """Save the user data sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    Returns: The user data as it was saved.
    """

    if not user_data.user_id:
        flask.abort(400, 'Impossible de sauver les données utilisateur sans ID.')
    return _save_user(user_data, is_new_user=False)


@app.route('/api/user/<user_id>/migrate-to-advisor', methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: user_id)
def migrate_to_advisor(user_id):
    """Migrate a user of the Mashup to use the Advisor."""

    user_proto = _get_user_data(user_id)
    has_multiple_projects = len(user_proto.projects) > 1
    was_using_mashup = \
        user_proto.features_enabled.advisor != user_pb2.ACTIVE or has_multiple_projects

    user_proto.features_enabled.advisor = user_pb2.ACTIVE
    user_proto.features_enabled.advisor_email = user_pb2.ACTIVE
    user_proto.features_enabled.switched_from_mashup_to_advisor = was_using_mashup
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(user_id)}, {'$set': {
            'featuresEnabled': json_format.MessageToDict(user_proto.features_enabled)}},
        upsert=False)

    return _save_user(user_proto, is_new_user=False)


@app.route('/api/project/diagnose', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=diagnostic_pb2.Diagnostic)
def diagnose_project(user_proto):
    """Diagnose a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    diagnostic, unused_missing = advisor.diagnose(user_proto, user_proto.projects[0], _DB)
    return diagnostic


@app.route('/api/project/compute-advices', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=project_pb2.Advices)
def compute_advices_for_project(user_proto):
    """Advise on a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    return advisor.compute_advices_for_project(user_proto, user_proto.projects[0], _DB)


@app.route('/api/project/compute-categories', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=project_pb2.AdviceCategories)
def compute_categories_for_project(user_proto):
    """Categorize advice on a user project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to perform advice categorization on.')
    if not user_proto.projects[0].advices:
        flask.abort(422, 'Input project has no advice to categorize.')
    return advisor.compute_advice_categories(user_proto.projects[0], _DB)


@app.route('/api/users/counts', methods=['GET'])
@proto.flask_api(out_type=stats_pb2.UsersCount)
def count_grouped_users():
    """Gives the count of users in a department"""

    all_counts = _get_users_counts(_DB)
    if not all_counts:
        logging.warning('Unable to serve user counts.')
        flask.abort(500, 'There is no user counts to serve.')
    return all_counts


# TODO(cyrille): Add a cache for the last value served.
def _get_users_counts(database):
    all_counts = next(
        database.user_count.find({}).sort('aggregatedAt', pymongo.DESCENDING).limit(1), None)
    return proto.create_from_mongo(all_counts, stats_pb2.UsersCount, always_create=False)


@app.route('/api/app/use/<user_id>', methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
@auth.require_user(lambda user_id: user_id)
def use_app(user_id):
    """Update the user's data to mark that they have just used the app."""

    user_proto = _get_user_data(user_id)
    start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
    if user_proto.requested_by_user_at_date.ToDatetime() >= start_of_day:
        return user_proto
    user_proto.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_proto.requested_by_user_at_date.nanos = 0
    return _save_user(user_proto, is_new_user=False)


def _save_user(user_data, is_new_user):
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
        # Enable Advisor for new users.
        if not ADVISOR_DISABLED_FOR_TESTING:
            user_data.features_enabled.advisor = user_pb2.ACTIVE
            user_data.features_enabled.advisor_email = user_pb2.ACTIVE
            user_data.profile.email_days.extend([
                user_pb2.MONDAY, user_pb2.WEDNESDAY, user_pb2.FRIDAY])
    elif not _is_test_user(previous_user_data):
        user_data.registered_at.CopyFrom(previous_user_data.registered_at)
        user_data.features_enabled.advisor = previous_user_data.features_enabled.advisor

    _tick('Unverified data zone check start')
    # TODO(guillaume): Check out how we could not recompute that every time gracefully.
    if _is_in_unverified_data_zone(user_data.profile, user_data.projects):
        user_data.app_not_available = True
    _tick('Unverified data zone check end')

    _populate_feature_flags(user_data)

    for project in user_data.projects:
        if project.is_incomplete:
            continue
        _tick('Process project start')
        rome_id = project.target_job.job_group.rome_id
        if not project.project_id:
            # Add ID, timestamp and stats to new projects
            project.project_id = _create_new_project_id(user_data)
            project.created_at.FromDatetime(now.get())

        previous_project = next(
            (p for p in previous_user_data.projects if p.project_id == project.project_id),
            project_pb2.Project())
        if project.job_search_length_months != previous_project.job_search_length_months:
            if project.job_search_length_months < 0:
                project.job_search_has_not_started = True
            else:
                job_search_length_days = 30.5 * project.job_search_length_months
                job_search_length_duration = datetime.timedelta(days=job_search_length_days)
                project.job_search_started_at.FromDatetime(
                    project.created_at.ToDatetime() - job_search_length_duration)
                project.job_search_started_at.nanos = 0

        _tick('Populate local stats')
        if not project.HasField('local_stats'):
            _populate_job_stats_dict(
                {rome_id: project.local_stats}, project.mobility.city)

        _tick('Diagnostic')
        advisor.maybe_diagnose(user_data, project, _DB)

        _tick('Advisor')
        advisor.maybe_advise(
            user_data, project, _DB, parse.urljoin(flask.request.base_url, '/')[:-1])

        _tick('Categorizer')
        advisor.maybe_categorize_advice(user_data, project, _DB)

        _tick('New feedback')
        if not is_new_user and (project.feedback.text or project.feedback.score):
            if project.feedback.text and not previous_project.feedback.text:
                _give_feedback(feedback_pb2.Feedback(
                    user_id=str(user_data.user_id),
                    project_id=str(project.project_id),
                    feedback=project.feedback.text,
                    source=feedback_pb2.PROJECT_FEEDBACK))

        _tick('Process project end')

    if not is_new_user:
        _assert_no_credentials_change(previous_user_data, user_data)
        _copy_unmodifiable_fields(previous_user_data, user_data)
        _populate_feature_flags(user_data)

    user_data.revision += 1

    _tick('Save user')
    _save_low_level(user_data, is_new_user=is_new_user)
    _tick('Return user proto')

    return user_data


def _save_low_level(user_data, is_new_user=False):
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


def _create_new_project_id(user_data):
    existing_ids = set(p.project_id for p in user_data.projects) |\
        set(p.project_id for p in user_data.deleted_projects)
    for id_candidate in itertools.count():
        id_string = '{:x}'.format(id_candidate)
        if id_string not in existing_ids:
            return id_string


def _get_unguessable_object_id():
    """Hash the ObjectID with our salt to avoid that new UserIds can easily be guessed.

    See http://go/bob:security for details.
    """

    guessable_object_id = objectid.ObjectId()
    salter = hashlib.sha1()
    salter.update(str(guessable_object_id).encode('ascii'))
    salter.update(auth.SECRET_SALT)
    return objectid.ObjectId(salter.hexdigest()[:24])


_SHOW_UNVERIFIED_DATA_USERS = set()


def _show_unverified_data_users():
    if not _SHOW_UNVERIFIED_DATA_USERS:
        for document in _DB.show_unverified_data_users.find():
            _SHOW_UNVERIFIED_DATA_USERS.add(document['_id'])
    return _SHOW_UNVERIFIED_DATA_USERS


def _is_in_unverified_data_zone(user_profile, user_projects):
    if _SHOW_UNVERIFIED_DATA_USER_REGEXP.search(user_profile.email):
        return False
    if user_profile.email in _show_unverified_data_users():
        return False

    has_valid_project_job = user_projects and user_projects[0].target_job.job_group.rome_id
    has_valid_latest_job = user_profile.latest_job.job_group.rome_id
    if has_valid_latest_job:
        job = user_profile.latest_job
    elif has_valid_project_job:
        job = user_projects[0].target_job
    else:
        return False

    has_valid_project_city = user_projects and user_projects[0].mobility.city.postcodes
    has_valid_profile_city = user_profile.city.postcodes
    if has_valid_profile_city:
        city = user_profile.city
    elif has_valid_project_city:
        city = user_projects[0].mobility.city
    else:
        return False

    data_zone_key = '{}:{}'.format(city.postcodes, job.job_group.rome_id)
    hashed_data_zone_key = hashlib.md5(data_zone_key.encode('utf-8')).hexdigest()
    return bool(_DB.unverified_data_zones.find(
        {'_id': hashed_data_zone_key}, {'_id': 1}).limit(1).count())


def _copy_unmodifiable_fields(previous_user_data, user_data):
    """Copy unmodifiable fields.

    Some fields cannot be changed by the API: we only copy over the fields
    from the previous state.
    """

    if _is_test_user(user_data):
        # Test users can do whatever they want.
        return
    for field in ('features_enabled', 'last_email_sent_at'):
        if previous_user_data.HasField(field):
            getattr(user_data, field).CopyFrom(getattr(previous_user_data, field))
        else:
            user_data.ClearField(field)


def _assert_no_credentials_change(previous, new):
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
            {'profile.email': new.profile.email}, {'_id': 1}).limit(1).count())
        if email_taken:
            flask.abort(403, "L'utilisateur existe mais utilise un autre moyen de connexion.")
        return
    flask.abort(403, "Impossible de modifier l'adresse email.")


def _safe_object_id(_id):
    try:
        return objectid.ObjectId(_id)
    except objectid.InvalidId:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(
            400, 'L\'identifiant "{}" n\'est pas un identifiant MongoDB valide.'.format(_id))


def _get_user_data(user_id):
    """Load user data from DB."""

    user_dict = _USER_DB.user.find_one({'_id': _safe_object_id(user_id)})
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, always_create=False)
    if not user_proto:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, 'Utilisateur "{}" inconnu.'.format(user_id))
    user_proto.user_id = str(user_id)

    _populate_feature_flags(user_proto)

    # TODO(pascal): Remove the fields completely after this has been live for a
    # week.
    user_proto.profile.ClearField('city')
    user_proto.profile.ClearField('latest_job')
    user_proto.profile.ClearField('situation')
    user_proto.ClearField('initial_utm_content')

    return user_proto


def _get_project_data(user_proto, project_id):
    try:
        return next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, 'Projet "{}" inconnu.'.format(project_id))


def _get_advice_data(project, advice_id):
    try:
        return next(
            advice for advice in project.advices
            if advice.advice_id == advice_id)
    except StopIteration:
        flask.abort(404, 'Conseil "{}" inconnu.'.format(advice_id))


_ACTION_STOPPED_STATUSES = frozenset([
    action_pb2.ACTION_SNOOZED,
    action_pb2.ACTION_DONE,
    action_pb2.ACTION_STICKY_DONE,
    action_pb2.ACTION_DECLINED])


# Cache (from MongoDB) of known chantiers.
_CHANTIERS = proto.MongoCachedCollection(chantier_pb2.Chantier, 'chantiers')


def _chantiers():
    """Returns a list of known chantiers as protos."""

    return _CHANTIERS.get_collection(_DB)


def _get_authenticator():
    authenticator = auth.Authenticator(
        _USER_DB, _DB, lambda u: _save_user(u, is_new_user=True),
        _update_returning_user,
    )
    return authenticator


def _update_returning_user(user_data):
    if user_data.HasField('requested_by_user_at_date'):
        start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
        if user_data.requested_by_user_at_date.ToDatetime() >= start_of_day:
            # Nothing to update.
            return user_data.requested_by_user_at_date
        last_connection = timestamp_pb2.Timestamp()
        last_connection.CopyFrom(user_data.requested_by_user_at_date)
    else:
        last_connection = user_data.registered_at

    user_data.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_data.requested_by_user_at_date.nanos = 0
    _save_low_level(user_data)

    return last_connection


# TODO: Split this into separate endpoints for registration and login.
# Having both in the same endpoint makes refactoring the frontend more difficult.
@app.route('/api/user/authenticate', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest, out_type=user_pb2.AuthResponse)
def authenticate(auth_request):
    """Authenticate a user."""

    authenticator = _get_authenticator()
    return authenticator.authenticate(auth_request)


@app.route('/api/user/reset-password', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest)
def reset_password(auth_request):
    """Sends an email to user with a reset token so that they can reset their password."""

    authenticator = _get_authenticator()
    authenticator.send_reset_password_token(auth_request.email)
    return '{}'


@app.route('/api/user/<user_id>/generate-auth-tokens', methods=['GET'])
@auth.require_user(lambda user_id: user_id)
def generate_auth_tokens(user_id):
    r"""Generates auth token for a given user.

    Note that this is safe to do as long as the user had a proper and complete
    auth token which is ensured by the @auth.require_user above.

    The "easiest" way to use it:
     - open a the Chrome Console on Bob
     - run the following js commands: ```
        (() => {const authToken = document.cookie.match(/(^|;\s*)authToken=(.*?)(\s*;|$)/)[2];
        const userId = document.cookie.match(/(^|;\s*)userId=(.*?)(\s*;|$)/)[2];
        fetch(`/api/user/${userId}/generate-auth-tokens`, {
            headers: {Authorization: `Bearer ${authToken}`},
         }).then(response => response.json()).then(console.log)})()
       ```
    """

    user_data = _USER_DB.user.find_one(
        {'_id': _safe_object_id(user_id)},
        {'profile.email': 1, '_id': 0})
    if not user_data:
        flask.abort(404, 'Utilisateur "{}" inconnu.'.format(user_id))
    email = user_data.get('profile', {}).get('email')
    # TODO(cyrille): Add user to simplify use in url.
    return json.dumps({
        'auth': auth.create_token(user_id, is_using_timestamp=True),
        'employment-status': auth.create_token(user_id, 'employment-status'),
        'nps': auth.create_token(user_id, 'nps'),
        'unsubscribe': auth.create_token(email, 'unsubscribe'),
        'user': user_id,
    })


# TODO(pascal): Remove this endpoint, one week after its deprecation on client.
@app.route('/api/project/requirements', methods=['POST'])
@proto.flask_api(in_type=project_pb2.Project, out_type=job_pb2.JobRequirements)
def project_requirements(project):
    """Get requirements for a project."""

    return _get_job_requirements(project.target_job.job_group.rome_id)


@app.route('/api/job/requirements/<rome_id>', methods=['GET'])
@proto.flask_api(out_type=job_pb2.JobRequirements)
def job_requirements(rome_id):
    """Get requirements for a job."""

    return _get_job_requirements(rome_id)


def _get_job_requirements(rome_id):
    no_requirements = job_pb2.JobRequirements()

    if not rome_id:
        return no_requirements

    job_group_info = jobs.get_group_proto(_DB, rome_id)
    if not job_group_info:
        return no_requirements

    return job_group_info.requirements


def _get_expanded_card_data(user_proto, project, advice_id):
    module = advisor.get_advice_module(advice_id, _DB)
    if not module or not module.trigger_scoring_model:
        flask.abort(404, 'Le module "{}" n\'existe pas'.format(advice_id))
    model = scoring.get_scoring_model(module.trigger_scoring_model)
    if not model or not hasattr(model, 'get_expanded_card_data'):
        flask.abort(404, 'Le module "{}" n\'a pas de données supplémentaires'.format(advice_id))

    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, _DB, now=now.get())
    return model.get_expanded_card_data(scoring_project)


@app.route('/api/advice/<advice_id>/<user_id>/<project_id>', methods=['GET'])
@proto.flask_api(out_type=message.Message)
@auth.require_user(lambda user_id, project_id, advice_id: user_id)
def get_advice_expanded_card_data(user_id, project_id, advice_id):
    """Retrieve expanded card data for an advice module for a project."""

    user_proto = _get_user_data(user_id)
    return _get_expanded_card_data(user_proto, _get_project_data(user_proto, project_id), advice_id)


@app.route('/api/advice/<advice_id>', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=message.Message)
def compute_expanded_card_data(user_proto, advice_id):
    """Retrieve expanded card data for an advice module for a project."""

    if not user_proto.projects:
        flask.abort(422, 'There is no input project to advise on.')
    return _get_expanded_card_data(user_proto, user_proto.projects[0], advice_id)


# TODO(pascal): Maybe move that to /api/advice/tips/<advice_id>/...
@app.route('/api/project/<user_id>/<project_id>/advice/<advice_id>/tips', methods=['GET'])
@proto.flask_api(out_type=action_pb2.AdviceTips)
@auth.require_user(lambda user_id, project_id, advice_id: user_id)
def advice_tips(user_id, project_id, advice_id):
    """Get all available tips for a piece of advice."""

    user_proto = _get_user_data(user_id)
    project = _get_project_data(user_proto, project_id)
    piece_of_advice = _get_advice_data(project, advice_id)

    all_tips = advisor.list_all_tips(user_proto, project, piece_of_advice, _DB)

    response = action_pb2.AdviceTips()
    for tip_template in all_tips:
        action.instantiate(response.tips.add(), user_proto, project, tip_template, _DB)
    return response


def _populate_job_stats_dict(local_job_stats, city):
    local_stats_ids = dict(
        ('{}:{}'.format(city.departement_id, job_group_id), job_group_id)
        for job_group_id in local_job_stats)

    # Import most stats from local_diagnosis.
    local_stats = _DB.local_diagnosis.find({'_id': {'$in': list(local_stats_ids)}})
    for job_group_local_stats in local_stats:
        job_group_id = local_stats_ids[job_group_local_stats['_id']]
        proto.parse_from_mongo(job_group_local_stats, local_job_stats[job_group_id])

    # Enrich with the # of job offers.
    job_group_offers_counts = _DB.recent_job_offers.find({'_id': {'$in': list(local_stats_ids)}})
    for job_group_offers_count in job_group_offers_counts:
        job_group_id = local_stats_ids[job_group_offers_count['_id']]
        proto.parse_from_mongo(job_group_offers_count, local_job_stats[job_group_id])


@app.route('/api/cache/clear', methods=['GET'])
def clear_cache():
    """Clear all server caches.

    This is an undocumented feature that allows us to clear a server's cache
    without rebooting it. Anybody can use it, but it doesn't cost much apart
    from 2 or 3 additional MongoDB requests on next queries.
    """

    _SHOW_UNVERIFIED_DATA_USERS.clear()
    proto.CachedCollection.update_cache_version()
    return 'Server cache cleared.'


@app.route('/api/dashboard-export/open/<user_id>', methods=['POST'])
@auth.require_user(lambda user_id: user_id)
def open_dashboard_export(user_id):
    """Create an export of the user's current dashboard.

    http://go/pe:data-export
    """

    dashboard_export = _create_dashboard_export(user_id)
    # Keep in sync with the same URL on the client.
    return flask.redirect(
        '/historique-des-actions/{}'.format(dashboard_export.dashboard_export_id))


def _create_dashboard_export(user_id):
    """Create an export of the user's current dashboard."""

    user_proto = _get_user_data(user_id)
    dashboard_export = export_pb2.DashboardExport()
    all_chantiers = _chantiers()
    for project in user_proto.projects:
        if not project.is_incomplete:
            dashboard_export.projects.add().CopyFrom(project)
            for chantier_id, active in project.activated_chantiers.items():
                if not active or chantier_id in dashboard_export.chantiers:
                    continue
                chantier = all_chantiers.get(chantier_id)
                if chantier:
                    dashboard_export.chantiers[chantier_id].CopyFrom(chantier)
    dashboard_export.created_at.FromDatetime(now.get())
    export_json = json_format.MessageToDict(dashboard_export)
    export_json['_id'] = _get_unguessable_object_id()
    result = _DB.dashboard_exports.insert_one(export_json)
    dashboard_export.dashboard_export_id = str(result.inserted_id)
    return dashboard_export


@app.route('/api/dashboard-export/<dashboard_export_id>', methods=['GET'])
@proto.flask_api(out_type=export_pb2.DashboardExport)
def get_dashboard_export(dashboard_export_id):
    """Retrieve an export of the user's current dashboard."""

    dashboard_export_json = _DB.dashboard_exports.find_one({
        '_id': _safe_object_id(dashboard_export_id)})
    dashboard_export = proto.create_from_mongo(
        dashboard_export_json, export_pb2.DashboardExport, always_create=False)
    if not dashboard_export:
        flask.abort(404, 'Export "{}" introuvable.'.format(dashboard_export_id))
    dashboard_export.dashboard_export_id = dashboard_export_id
    return dashboard_export


@app.route('/api/jobs/<rome_id>', methods=['GET'])
@proto.flask_api(out_type=job_pb2.JobGroup)
def get_job_group_jobs(rome_id):
    """Retrieve information about jobs whithin a job group."""

    job_group = jobs.get_group_proto(_DB, rome_id)
    if not job_group:
        flask.abort(404, 'Groupe de métiers "{}" inconnu.'.format(rome_id))

    result = job_pb2.JobGroup()
    result.jobs.extend(job_group.jobs)
    result.requirements.specific_jobs.extend(job_group.requirements.specific_jobs)
    return result


@app.route('/api/feedback', methods=['POST'])
@proto.flask_api(in_type=feedback_pb2.Feedback)
def give_feedback(feedback):
    """Retrieve information about jobs whithin a job group."""

    if feedback.user_id:
        auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '')
        if not auth_token:
            flask.abort(401, 'Token manquant')
        try:
            auth.check_token(feedback.user_id, auth_token, role='auth')
        except ValueError:
            flask.abort(403, 'Unauthorized token')
    _give_feedback(feedback)
    return ''


def _give_feedback(feedback):
    _DB.feedbacks.insert_one(json_format.MessageToDict(feedback))


@app.route('/', methods=['GET'])
def health_check():
    """Health Check endpoint.

    Probes can call it to check that the server is up.
    """

    return 'Up and running'


def _populate_feature_flags(user_proto):
    """Update the feature flags."""

    user_proto.features_enabled.ClearField('action_done_button_discreet')
    user_proto.features_enabled.ClearField('action_done_button_control')

    if _ALPHA_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.alpha = True
    if _POLE_EMPLOI_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.pole_emploi = True
    if _EXCLUDE_FROM_ANALYTICS_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.exclude_from_analytics = True


@app.route('/api/user/nps-survey-response', methods=['POST'])
@auth.require_admin
@proto.flask_api(in_type=user_pb2.NPSSurveyResponse)
def set_nps_survey_response(nps_survey_response):
    """Save user response to the Net Promoter Score survey."""

    # Note that this endpoint doesn't use authentication: only the email is necessary to
    # update the user record.
    user_dict = _USER_DB.user.find_one({'profile.email': nps_survey_response.email}, {'_id': 1})
    if not user_dict:
        flask.abort(404, 'Utilisateur "{}" inconnu.'.format(nps_survey_response.email))
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
def set_nps_response(user_id):
    """Save user response to the Net Promoter Score's first question."""

    user_to_update = user_pb2.User()
    user_to_update.net_promoter_score_survey_response.responded_at.FromDatetime(now.get())
    try:
        score = int(flask.request.args.get('score'))
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
@auth.require_user(lambda set_nps_request: set_nps_request.user_id, role='nps')
def set_nps_response_comment(set_nps_request):
    """Save user's freeform comment after the Net Promoter Score survey."""

    user_to_update = user_pb2.User()
    user_to_update.net_promoter_score_survey_response.general_feedback_comment = \
        set_nps_request.comment

    mongo_update = _flatten_mongo_fields(json_format.MessageToDict(user_to_update))
    _USER_DB.user.update_one(
        {'_id': _safe_object_id(set_nps_request.user_id)},
        {'$set': mongo_update},
        upsert=False)

    return ''


def _flatten_mongo_fields(root, prefix=''):
    """Flatten a nested dict as individual fields with key separted by dots as Mongo does it."""

    all_fields = {}
    for key, value in root.items():
        if isinstance(value, dict):
            all_fields.update(_flatten_mongo_fields(value, prefix + key + '.'))
        else:
            all_fields[prefix + key] = value
    return all_fields


@app.route('/api/employment-status/<user_id>', methods=['POST'])
@proto.flask_api(in_type=user_pb2.EmploymentStatus)
@auth.require_user(lambda unused_new_status, user_id: user_id, role='employment-status')
def update_employment_status(new_status, user_id):
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
def get_employment_status(user_id):
    """Save user's first click and redirect them to the full survey."""

    user_proto = _get_user_data(user_id)
    # Create another empty User message to update only employment_status field.
    user_to_update = user_pb2.User()
    user_to_update.employment_status.extend(user_proto.employment_status[:])
    if 'id' in flask.request.args:
        # TODO(pascal): Cleanup once all clients are using the POST endpoint
        # (in 2018).
        survey_id = int(flask.request.args.get('id'))
        if survey_id >= len(user_to_update.employment_status):
            flask.abort(422, 'Id invalide.')
        employment_status = user_to_update.employment_status[survey_id]
    else:
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


def _maybe_redirect(**kwargs):
    if 'redirect' not in flask.request.args:
        return ''
    redirect_url = flask.request.args.get('redirect')
    separator = '&' if '?' in redirect_url else '?'
    return flask.redirect('{redirect_url}{separator}{query_string}'.format(
        redirect_url=redirect_url,
        separator=separator,
        query_string=parse.urlencode(dict(
            {key: flask.request.args.get(key)
             for key in flask.request.args if key != 'redirect'},
            **kwargs))))


@app.route('/api/usage/stats', methods=['GET'])
@proto.flask_api(out_type=stats_pb2.UsersCount)
def get_usage_stats():
    """Get stats of the app usage."""

    now_utc = now.get().astimezone(datetime.timezone.utc)
    start_of_second = now_utc.replace(microsecond=0, tzinfo=None)
    last_week = start_of_second - datetime.timedelta(days=7)
    yesterday = start_of_second - datetime.timedelta(days=1)

    # Compute daily scores count.
    daily_scores_count = collections.defaultdict(int)
    last_day_users = _USER_DB.user.find(
        {
            'registeredAt': {
                '$gt': _datetime_to_json_string(yesterday),
                '$lte': _datetime_to_json_string(start_of_second),
            },
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        },
        {
            'projects': 1,
            'registeredAt': 1,
        },
    )
    for user_dict in last_day_users:
        user_proto = proto.create_from_mongo(user_dict, user_pb2.User)
        for project in user_proto.projects:
            if project.feedback.score:
                daily_scores_count[project.feedback.score] += 1

    # Compute weekly user count.
    weekly_new_user_count = _USER_DB.user.find({
        'registeredAt': {
            '$gt': _datetime_to_json_string(last_week),
            '$lte': _datetime_to_json_string(start_of_second),
        },
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    }).count()

    return stats_pb2.UsersCount(
        total_user_count=_USER_DB.user.count(),
        weekly_new_user_count=weekly_new_user_count,
        daily_scores_count=daily_scores_count,
    )


@app.route('/api/redirect/eterritoire/<city_id>', methods=['GET'])
def redirect_eterritoire(city_id):
    """Redirect to the e-Territoire page for a city."""

    link = proto.create_from_mongo(
        _DB.eterritoire_links.find_one({'_id': city_id}), association_pb2.SimpleLink)
    return flask.redirect('http://www.eterritoire.fr{}'.format(link.path))


app.register_blueprint(evaluation.app, url_prefix='/api/eval')


@app.before_request
def _before_request():
    flask.g.start = time.time()
    flask.g.ticks = []


def _tick(tick_name):
    flask.g.ticks.append(_Tick(tick_name, time.time()))


def _datetime_to_json_string(instant):
    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(instant)
    return json_format.MessageToDict(timestamp)


def _is_test_user(user_proto):
    return _TEST_USER_REGEXP.search(user_proto.profile.email)


@app.teardown_request
def _teardown_request(unused_exception=None):
    total_duration = time.time() - flask.g.start
    if total_duration <= _LONG_REQUEST_DURATION_SECONDS:
        return
    logging.warning('Long request: %d seconds', total_duration)
    last_tick_time = flask.g.start
    for tick in sorted(flask.g.ticks, key=lambda t: t.time):
        logging.warning(
            '%.4f: Tick %s (%.4f since last tick)',
            tick.time - flask.g.start, tick.name, tick.time - last_tick_time)
        last_tick_time = tick.time


app.config['DATABASE'] = _DB
app.config['USER_DATABASE'] = _USER_DB
if os.getenv('SENTRY_DSN'):
    # Setup logging basic's config first so that we also get basic logging to STDERR.
    logging.basicConfig()
    app.config['SENTRY_RELEASE'] = _SERVER_TAG['_server']
    raven_flask.Sentry(app, dsn=os.getenv('SENTRY_DSN'), logging=True, level=logging.WARNING)


if __name__ == '__main__':
    # This is only used for dev setup as otherwise we use uwsgi that loads the
    # module and handle the server without running the app.
    app.run(  # pragma: no cover
        debug=bool(os.getenv('DEBUG')),
        host=os.getenv('BIND_HOST', 'localhost'),
        port=int(os.getenv('PORT', '80')))
