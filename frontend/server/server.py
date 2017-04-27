# encoding: utf-8
"""Simple frontend server for MyGamePlan.

More information about the architecture of the application in go/pe:design.

This file contains the JSON API that will provide the
MyGamePlan web application with data.
"""
import collections
import datetime
import hashlib
import itertools
import logging
import os
import random
import re
import time

from bson import objectid
import farmhash
import flask
from google.protobuf import json_format
import pymongo
from werkzeug.contrib import fixers

from bob_emploi.frontend import action
from bob_emploi.frontend import advisor
from bob_emploi.frontend import auth
from bob_emploi.frontend import now
from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import config_pb2
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import export_pb2

app = flask.Flask(__name__)  # pylint: disable=invalid-name
# Get original host and scheme used before proxies (load balancer, nginx, etc).
app.wsgi_app = fixers.ProxyFix(app.wsgi_app)


_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()

_SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_TEST_USER_REGEXP = re.compile(os.getenv('TEST_USER_REGEXP', r'@(bayes.org|example.com)$'))
_ALPHA_USER_REGEXP = re.compile(os.getenv('ALPHA_USER_REGEXP', r'@example.com$'))
_SHOW_UNVERIFIED_DATA_USER_REGEXP = \
    re.compile(os.getenv('SHOW_UNVERIFIED_DATA_USER_REGEXP', r'@pole-emploi.fr$'))

_ProjectIntensityDefinition = collections.namedtuple(
    'ProjetIntensityDefinition', [
        'min_applications_per_day',
        'max_applications_per_day',
        'min_actions_per_day',
        'max_actions_per_day',
    ])

_PROJECT_INTENSITIES = {
    project_pb2.PROJECT_FIGURING_INTENSITY: _ProjectIntensityDefinition(0, 0, 1, 3),
    project_pb2.PROJECT_NORMALLY_INTENSE: _ProjectIntensityDefinition(1, 1, 1, 3),
    project_pb2.PROJECT_PRETTY_INTENSE: _ProjectIntensityDefinition(1, 1, 2, 3),
    project_pb2.PROJECT_EXTREMELY_INTENSE: _ProjectIntensityDefinition(2, 2, 2, 4),
}

# Email regex from http://emailregex.com/
_EMAIL_REGEX = re.compile(r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)")

# For testing on old users, we sometimes want to enable advisor for newly
# created users.
# TODO(pascal): Remove that when we stop testing about users that do not have
# the advisor feature.
ADVISOR_DISABLED_FOR_TESTING = False

_Tick = collections.namedtuple('Tick', ['name', 'time'])

# Log timing of requests that take too long to be treated.
_LONG_REQUEST_DURATION_SECONDS = 1.5


@app.route('/api/user', methods=['DELETE'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.UserId)
def delete_user(user_data):
    """Delete a user and their authentication information."""
    if not user_data.user_id:
        flask.abort(400, 'Impossible de supprimer un utilisateur sans son ID.')
    user_from_db = _get_user_data(user_data.user_id)
    facebook_creds_mismatch = (
        user_data.facebook_id and user_data.facebook_id != user_from_db.facebook_id)
    google_creds_mismatch = (
        user_data.google_id and user_data.google_id != user_from_db.google_id)
    email_mismatch = (
        user_data.profile.email and user_data.profile.email != user_from_db.profile.email)
    if facebook_creds_mismatch or google_creds_mismatch or email_mismatch:
        flask.abort(403, 'Wrong credentials.')
    filter_user = {'_id': _safe_object_id(user_data.user_id)}
    _DB.user_auth.delete_one(filter_user)
    _DB.user.delete_one(filter_user)
    return user_pb2.UserId(user_id=user_data.user_id)


@app.route('/api/user/<user_id>', methods=['GET'])
@proto.flask_api(out_type=user_pb2.User)
def get_user(user_id):
    """Return the user identified by user_id.

    Returns: The data for a user identified by user_id.
    """
    user_proto = _get_user_data(user_id)
    user_proto.user_id = user_id
    return user_proto


def _maybe_generate_new_actions(user_proto):
    updated = False
    for project in user_proto.projects:
        updated |= _maybe_generate_new_action_plan(user_proto, project)
    if updated:
        _save_user(user_proto, is_new_user=False)


@app.route("/api/user", methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.User)
def user(user_data):
    """Save the user data sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    Returns: The user data as it was saved.
    """
    if not user_data.user_id:
        flask.abort(400, 'Impossible de sauver les données utilisateur sans ID.')
    return _save_user(user_data, is_new_user=False)


@app.route("/api/user/likes", methods=['POST'])
@proto.flask_api(in_type=user_pb2.User)
def user_likes(user_data):
    """Save the user likes sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    """
    if not user_data.user_id:
        flask.abort(400, 'Impossible de sauver les données utilisateur sans ID.')
    for key in user_data.likes.keys():
        if '.' in key or '$' in key:
            flask.abort(422, "Liked feature IDs cannot contain . or $, got \"%s\"" % key)
    result = _DB.user.update_one(
        {'_id': _safe_object_id(user_data.user_id)}, {'$set': {
            'likes.%s' % key: value for key, value in user_data.likes.items()}},
        upsert=False)
    if not result.matched_count:
        flask.abort(404, 'Utilisateur "%s" inconnu.' % user_data.user_id)
    return ''


@app.route("/api/user/refresh-action-plan", methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.User)
def user_refresh_action_plan(user_data):
    """Creates daily actions for the user if none for today."""
    user_proto = _get_user_data(user_data.user_id)
    _maybe_generate_new_actions(user_proto)
    return user_proto


@app.route("/api/user/<user_id>/migrate-to-advisor", methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
def migrate_to_advisor(user_id):
    """Migrate a user of the Mashup to use the Advisor."""
    user_proto = _get_user_data(user_id)
    has_multiple_projects = len(user_proto.projects) > 1
    was_using_mashup = \
        user_proto.features_enabled.advisor != user_pb2.ACTIVE or has_multiple_projects

    user_proto.features_enabled.advisor = user_pb2.ACTIVE
    user_proto.features_enabled.advisor_email = user_pb2.ACTIVE
    user_proto.features_enabled.switched_from_mashup_to_advisor = was_using_mashup
    _DB.user.update_one(
        {'_id': _safe_object_id(user_id)}, {'$set': {
            'featuresEnabled': json_format.MessageToDict(user_proto.features_enabled)}},
        upsert=False)

    return _save_user(user_proto, is_new_user=False)


@app.route('/api/app/use/<user_id>', methods=['POST'])
@proto.flask_api(out_type=user_pb2.User)
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


def _generic_image():
    return 'generic%d' % random.randint(1, 5)


def _save_user(user_data, is_new_user):
    _tick('Save user start')

    if is_new_user:
        previous_user_data = user_data
    else:
        _tick('Load old user data')
        previous_user_data = _get_user_data(user_data.user_id)

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
        # Send an NPS email the next day.
        user_data.features_enabled.net_promoter_score_email = user_pb2.NPS_EMAIL_PENDING
    else:
        user_data.registered_at.CopyFrom(previous_user_data.registered_at)
        if not _TEST_USER_REGEXP.search(previous_user_data.profile.email):
            user_data.features_enabled.advisor = previous_user_data.features_enabled.advisor
            user_data.features_enabled.net_promoter_score_email = \
                previous_user_data.features_enabled.net_promoter_score_email

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
            project.project_id = '%x-%x' % (round(time.time()), random.randrange(0x10000))
            project.source = project_pb2.PROJECT_MANUALLY_CREATED
            project.created_at.FromDatetime(now.get())

        _tick('Populate local stats')
        if not project.HasField('local_stats'):
            _populate_job_stats_dict(
                {rome_id: project.local_stats}, project.mobility.city)

        _tick('Advisor')
        advisor.maybe_advise(user_data, project, _DB)

        _tick('Stop actions')
        for current_action in project.actions:
            if current_action.status in _ACTION_STOPPED_STATUSES:
                action.stop(current_action, _DB)
        for past_action in project.past_actions:
            action.stop(past_action, _DB)

        for sticky_action in project.sticky_actions:
            if not sticky_action.HasField('stuck_at'):
                sticky_action.stuck_at.FromDatetime(now.get())
        _tick('Process project end')

    if not is_new_user:
        _assert_no_credentials_change(previous_user_data, user_data)
        _copy_unmodifiable_fields(previous_user_data, user_data)
        _populate_feature_flags(user_data)

    # Modifications on user_data after this point will not be saved.
    _tick('Save user')
    user_dict = json_format.MessageToDict(user_data)
    user_dict.update(_SERVER_TAG)
    if is_new_user:
        user_dict['_id'] = _get_unguessable_object_id()
        result = _DB.user.insert_one(user_dict)
        user_data.user_id = str(result.inserted_id)
    else:
        _DB.user.replace_one({'_id': _safe_object_id(user_data.user_id)}, user_dict)
    _tick('Return user proto')
    return user_data


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

    data_zone_key = '%s:%s' % (city.postcodes, job.job_group.rome_id)
    hashed_data_zone_key = hashlib.md5(data_zone_key.encode('utf-8')).hexdigest()
    return bool(_DB.unverified_data_zones.find(
        {'_id': hashed_data_zone_key}, {'_id': 1}).limit(1).count())


def _copy_unmodifiable_fields(previous_user_data, user_data):
    """Copy unmodifiable fields.

    Some fields cannot be changed by the API: we only copy over the fields
    from the previous state.
    """
    if _TEST_USER_REGEXP.search(user_data.profile.email):
        # Test users can do whatever they want.
        return
    for field in ('features_enabled', 'last_email_sent_at'):
        if previous_user_data.HasField(field):
            getattr(user_data, field).CopyFrom(getattr(previous_user_data, field))
        else:
            user_data.ClearField(field)


def _assert_no_credentials_change(previous, new):
    if previous.facebook_id != new.facebook_id or previous.google_id != new.google_id:
        flask.abort(403, 'Impossible de modifier jour les identifiants.')
    if previous.profile.email == new.profile.email:
        return
    if (new.facebook_id and not previous.profile.email) or new.google_id:
        # Email address can be changed for Google SSO users and can be set when empty for FB users.
        if not _EMAIL_REGEX.match(new.profile.email):
            flask.abort(403, 'Adresse email invalide.')
        email_taken = bool(_DB.user.find(
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
        flask.abort(400, 'L\'identifiant "%s" n\'est pas un identifiant MongoDB valide.')


# Mapping of old diploma estimates to new training estimates.
TRAINING_ESTIMATION = {
    project_pb2.FULFILLED: project_pb2.ENOUGH_DIPLOMAS,
    project_pb2.NOT_FULFILLED: project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
    project_pb2.FULFILLMENT_NOT_SURE: project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
    project_pb2.NOTHING_REQUIRED: project_pb2.NO_TRAINING_REQUIRED,
}


def _get_user_data(user_id):
    """Load user data from DB."""
    user_dict = _DB.user.find_one({'_id': _safe_object_id(user_id)})
    user_proto = user_pb2.User()
    if not proto.parse_from_mongo(user_dict, user_proto):
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, 'Utilisateur "%s" inconnu.' % user_id)

    _populate_feature_flags(user_proto)

    for project in user_proto.projects:
        # TODO(pascal): Update existing users and get rid of diploma_fulfillment_estimate.
        if not project.training_fulfillment_estimate and project.diploma_fulfillment_estimate:
            project.training_fulfillment_estimate = TRAINING_ESTIMATION.get(
                project.diploma_fulfillment_estimate, project_pb2.UNKNOWN_TRAINING_FULFILLMENT)
        # TODO(pascal): Update existing users and get rid of FIND_JOB.
        if project.kind == project_pb2.FIND_JOB:
            if user_proto.profile.situation == user_pb2.LOST_QUIT:
                project.kind = project_pb2.FIND_A_NEW_JOB
            elif user_proto.profile.situation == user_pb2.FIRST_TIME:
                project.kind = project_pb2.FIND_A_FIRST_JOB
            else:
                project.kind = project_pb2.FIND_ANOTHER_JOB

    return user_proto


def _get_project_data(user_proto, project_id):
    try:
        return next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, 'Projet "%s" inconnu.' % project_id)


def _get_advice_data(project, advice_id):
    try:
        return next(
            advice for advice in project.advices
            if advice.advice_id == advice_id)
    except StopIteration:
        flask.abort(404, 'Conseil "%s" inconnu.' % advice_id)


_ACTION_STOPPED_STATUSES = frozenset([
    action_pb2.ACTION_SNOOZED,
    action_pb2.ACTION_DONE,
    action_pb2.ACTION_STICKY_DONE,
    action_pb2.ACTION_DECLINED])


# Cache (from MongoDB) of known chantiers.
_CHANTIERS = {}


def _chantiers():
    """Returns a list of known chantiers as protos."""
    was_empty = not _CHANTIERS
    all_chantiers = proto.cache_mongo_collection(
        _DB.chantiers.find, _CHANTIERS, chantier_pb2.Chantier)
    if was_empty:
        # Validate chantiers.
        required_models = set(c.scoring_model for c in all_chantiers.values()) | set(
            scoring.GROUP_SCORING_MODELS.values())
        existing_models = set(scoring.SCORING_MODELS) | set(
            name for name in required_models if scoring.get_scoring_model(name))
        if required_models - existing_models:
            logging.warning(
                'Some scoring models will be random: %s', required_models - existing_models)
        if existing_models - required_models:
            logging.warning('Some scoring models are unused: %s', existing_models - required_models)
    return all_chantiers


def _white_chantier_ids():
    """Returns the set of IDs of white chantiers."""
    return set(
        chantier_id for chantier_id, chantier in _chantiers().items()
        if chantier.kind == chantier_pb2.CORE_JOB_SEARCH)


# TODO: Split this into separate endpoints for registration and login.
# Having both in the same endpoint makes refactoring the frontend more difficult.
@app.route('/api/user/authenticate', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest, out_type=user_pb2.AuthResponse)
def authenticate(auth_request):
    """Authenticate a user."""
    authenticator = auth.Authenticator(_DB, lambda u: _save_user(u, is_new_user=True))
    response = authenticator.authenticate(auth_request)
    if response.authenticated_user.user_id:
        _maybe_generate_new_actions(response.authenticated_user)
    return response


@app.route('/api/user/reset-password', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest)
def reset_password(auth_request):
    """Sends an email to user with a reset token so that they can reset their password."""
    authenticator = auth.Authenticator(_DB, lambda u: _save_user(u, is_new_user=True))
    authenticator.send_reset_password_token(auth_request.email)
    return '{}'


# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO = {}


def _job_groups_info():
    """Returns a dict of info of known job groups as protos."""
    return proto.cache_mongo_collection(_DB.job_group_info.find, _JOB_GROUPS_INFO, job_pb2.JobGroup)


def _maybe_generate_new_action_plan(user_proto, project):
    if project.is_incomplete:
        return False

    if _project_in_advisor(project):
        # Do not generate actions for projects handled by the Advisor.
        return False
    now_instant = now.get()
    this_morning = now_instant.replace(hour=3, minute=0, second=0, microsecond=0)
    if this_morning > now_instant:
        this_morning -= datetime.timedelta(hours=24)
    if project.actions_generated_at.ToDatetime() > this_morning:
        return False

    if not any(project.activated_chantiers.values()):
        logging.warning('No activated chantiers yet')
        return False

    intensity_def = _PROJECT_INTENSITIES.get(project.intensity)
    if not intensity_def:
        logging.warning('Intensity is not defined properly %s', project.intensity)
        return False

    # Renew all actions.
    for old_action in project.actions:
        action.stop(old_action, _DB)
    new_past_actions = [a for a in project.actions]
    new_past_actions.sort(key=lambda action: action.stopped_at.ToDatetime())
    project.past_actions.extend(new_past_actions)
    del project.actions[:]

    # Number of white actions to generate.
    target_white_actions = random.randint(
        intensity_def.min_applications_per_day, intensity_def.max_applications_per_day)
    # Number of other actions to generate.
    target_other_actions = random.randint(
        intensity_def.min_actions_per_day, intensity_def.max_actions_per_day)

    project.actions_generated_at.FromDatetime(now_instant)

    _add_actions_to_project(
        user_proto, project, target_white_actions, use_white_chantiers=True)
    _add_actions_to_project(user_proto, project, target_other_actions)

    return True


def _project_in_advisor(project):
    """Check whether a project is handled by the Advisor."""
    return bool(project.advices)


def _add_actions_to_project(user_proto, project, num_adds, use_white_chantiers=False):
    if num_adds < 0:
        return False

    all_chantiers = _chantiers()
    if use_white_chantiers:
        activated_chantiers = _white_chantier_ids()
    else:
        activated_chantiers = set(
            chantier_id for chantier_id, activated in project.activated_chantiers.items()
            if activated and chantier_id in all_chantiers)
    if not activated_chantiers:
        logging.warning('No activated chantiers')
        return False

    # List all action template IDs for which we already had an action in the
    # near past.
    now_instant = now.get()
    still_hot_action_template_ids = set()
    for hot_action in itertools.chain(
            project.actions, project.past_actions, project.sticky_actions):
        if (hot_action.HasField('end_of_cool_down') and
                hot_action.end_of_cool_down.ToDatetime() < now_instant):
            continue
        still_hot_action_template_ids.add(hot_action.action_template_id)

    # List all action templates that are at least in one of the activated
    # chantiers.
    actions_pool = [
        a for action_template_id, a in action.templates(_DB).items()
        # Do not add an action that was already taken.
        if action_template_id not in still_hot_action_template_ids and
        # Only add actions that are meant for these chantiers.
        activated_chantiers & set(a.chantiers)]

    # Filter action templates using the filters field.
    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, _DB)
    filtered_actions_pool = scoring.filter_using_score(
        actions_pool, lambda a: a.filters, scoring_project)

    # Split action templates by priority.
    pools = collections.defaultdict(list)
    for filtered_action in filtered_actions_pool:
        pools[filtered_action.priority_level].append(filtered_action)

    if not pools:
        logging.warning(
            'No action template would match:\n'
            ' - %d activated chantiers\n'
            ' - %d total action templates\n'
            ' - %d action templates still hot\n'
            ' - %d before filtering',
            len(activated_chantiers),
            len(action.templates(_DB)),
            len(still_hot_action_template_ids),
            len(actions_pool))
        return False

    added = False

    for priority in sorted(pools.keys(), reverse=True):
        pool = pools[priority]
        # Pick the number of actions to add if enough.
        if num_adds == 0:
            return added
        if len(pool) > num_adds:
            pool = random.sample(pool, num_adds)
            num_adds = 0
        else:
            num_adds -= len(pool)
        random.shuffle(pool)

        for template in pool:
            added = True
            action.instantiate(
                project.actions.add(), user_proto, project, template,
                activated_chantiers, _DB, _chantiers())

    return added


# TODO(pascal): Switch the project/requirements endpoint to be a GET as it does
# not modify any state.


@app.route('/api/project/requirements', methods=['POST'])
@proto.flask_api(in_type=project_pb2.Project, out_type=job_pb2.JobRequirements)
def project_requirements(project):
    """Get requirements for a project."""
    return _get_project_requirements(project)


def _get_project_requirements(project):
    no_requirements = job_pb2.JobRequirements()
    rome_id = project.target_job.job_group.rome_id
    if not rome_id:
        return no_requirements

    job_group_info = _job_groups_info().get(rome_id)
    if not job_group_info:
        return no_requirements

    return job_group_info.requirements


@app.route('/api/project/<user_id>/<project_id>/jobboards', methods=['GET'])
@proto.flask_api(out_type=jobboard_pb2.JobBoards)
def project_jobboards(user_id, project_id):
    """Retrieve a list of job boards for a project."""
    user_proto = _get_user_data(user_id)
    project = _get_project_data(user_proto, project_id)
    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, _DB)
    jobboards = scoring_project.list_jobboards()
    sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
    return jobboard_pb2.JobBoards(job_boards=sorted_jobboards)


@app.route('/api/project/<user_id>/<project_id>/advice/<advice_id>/tips', methods=['GET'])
@proto.flask_api(out_type=action_pb2.AdviceTips)
def advice_tips(user_id, project_id, advice_id):
    """Get all available tips for a piece of advice."""
    user_proto = _get_user_data(user_id)
    project = _get_project_data(user_proto, project_id)
    piece_of_advice = _get_advice_data(project, advice_id)

    all_tips = advisor.list_all_tips(user_proto, project, piece_of_advice, _DB)

    response = action_pb2.AdviceTips()
    for tip_template in all_tips:
        action.instantiate(response.tips.add(), user_proto, project, tip_template, set(), _DB, {})
    return response


def _populate_job_stats_dict(local_job_stats, city):
    local_stats_ids = dict(
        ('%s:%s' % (city.departement_id, job_group_id), job_group_id)
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
    _JOB_GROUPS_INFO.clear()
    _CHANTIERS.clear()
    _SHOW_UNVERIFIED_DATA_USERS.clear()
    action.clear_cache()
    advisor.clear_cache()
    return 'Server cache cleared.'


@app.route('/api/dashboard-export/create', methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=export_pb2.DashboardExport)
def create_dashboard_export(user_data):
    """Create an export of the user's current dashboard.

    http://go/pe:data-export
    """
    return _create_dashboard_export(user_data.user_id)


@app.route('/api/dashboard-export/open/<user_id>', methods=['POST'])
def open_dashboard_export(user_id):
    """Create an export of the user's current dashboard.

    http://go/pe:data-export
    """
    dashboard_export = _create_dashboard_export(user_id)
    # Keep in sync with the same URL on the client.
    return flask.redirect('/historique-des-actions/%s' % dashboard_export.dashboard_export_id)


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
    dashboard_export = export_pb2.DashboardExport()
    if not proto.parse_from_mongo(dashboard_export_json, dashboard_export):
        flask.abort(404, 'Export "%s" introuvable.' % dashboard_export_id)
    dashboard_export.dashboard_export_id = dashboard_export_id
    return dashboard_export


@app.route('/', methods=['GET'])
def health_check():
    """Health Check endpoint.

    Probes can call it to check that the server is up.
    """
    return 'Up and running'


@app.route('/api/config', methods=['GET'])
@proto.flask_api(out_type=config_pb2.ClientConfig)
def client_config():
    """Retrieve the client config from the server."""
    config = config_pb2.ClientConfig()
    config.google_SSO_client_id = auth.GOOGLE_SSO_CLIENT_ID
    config.facebook_SSO_app_id = auth.FACEBOOK_SSO_APP_ID
    return config


def _populate_feature_flags(user_proto):
    """Update the feature flags."""
    user_proto.features_enabled.action_button_chevron = False
    user_proto.features_enabled.action_button_round = False
    user_proto.features_enabled.action_button_none = False

    user_proto.features_enabled.chantier_icons = False
    user_proto.features_enabled.chantier_icons_control = False

    user_proto.features_enabled.ClearField('action_feedback_modal')

    user_proto.features_enabled.ClearField('sticky_actions')

    user_proto.features_enabled.ClearField('hide_discovery_nav')

    user_proto.features_enabled.ClearField('show_diagnostic')

    lbb_integration = bool(farmhash.hash32(user_proto.user_id + 'lbb_integration') % 2)
    user_proto.features_enabled.lbb_integration = (
        user_pb2.ACTIVE if lbb_integration else user_pb2.CONTROL)

    if _ALPHA_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.alpha = True


@app.before_request
def _before_request():
    flask.g.start = time.time()
    flask.g.ticks = []


def _tick(tick_name):
    flask.g.ticks.append(_Tick(tick_name, time.time()))


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


if __name__ == "__main__":
    app.run(  # pragma: no cover
        debug=bool(os.getenv('DEBUG')),
        host=os.getenv('BIND_HOST', 'localhost'),
        port=int(os.getenv('PORT', '80')))
