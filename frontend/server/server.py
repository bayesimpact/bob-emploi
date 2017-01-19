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
import json
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
from bob_emploi.frontend.api import discovery_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import export_pb2

app = flask.Flask(__name__)  # pylint: disable=invalid-name
# Get original host and scheme used before proxies (load balancer, nginx, etc).
app.wsgi_app = fixers.ProxyFix(app.wsgi_app)


_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'localhost')).get_database(
    os.getenv('MONGO_DATABASE', 'test'))

_SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_TEST_USER_REGEXP = re.compile(os.getenv('TEST_USER_REGEXP', r'@(bayes.org|example.com)$'))

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

# Template for the link to Pôle Emploi job offers.
_POLE_EMPLOI_OFFERS_LINK = (
    'https://candidat.pole-emploi.fr/candidat/rechercheoffres/resultats/'
    'A__DEPARTEMENT_%departementId___P__________INDIFFERENT_____________'
    '____%romeId______')
# Template for the link to La Bonne Boite company suggestion.
_LA_BONNE_BOITE_LINK = (
    'http://labonneboite.pole-emploi.fr/entreprises/commune/%cityId/rome/%romeId?'
    'utm_medium=web&utm_source=bob&utm_campaign=bob-recherche')

# Email regex from http://emailregex.com/
_EMAIL_REGEX = re.compile(r"(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)")


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


@app.route("/api/user/refresh-action-plan", methods=['POST'])
@proto.flask_api(in_type=user_pb2.User, out_type=user_pb2.User)
def user_refresh_action_plan(user_data):
    """Creates daily actions for the user if none for today."""
    user_proto = _get_user_data(user_data.user_id, update_requested_at=False)
    _maybe_generate_new_actions(user_proto)
    return user_proto


def _generic_image():
    return 'generic%d' % random.randint(1, 5)


def _save_user(user_data, is_new_user):
    if not user_data.registered_at.seconds:
        user_data.registered_at.FromDatetime(now.get())
        # No need to pollute our DB with super precise timestamps.
        user_data.registered_at.nanos = 0
        # Enable email notifications for new users.
        user_data.features_enabled.email_notifications = True
        user_data.profile.email_days.extend([
            user_pb2.MONDAY, user_pb2.TUESDAY, user_pb2.WEDNESDAY,
            user_pb2.THURSDAY, user_pb2.FRIDAY])

    # TODO: Don't do this on every save.
    if _is_in_unverified_data_zone(user_data.profile):
        user_data.app_not_available = True

    _populate_feature_flags(user_data)

    for project in user_data.projects:
        rome_id = project.target_job.job_group.rome_id
        if not project.project_id:
            # Add ID, timestamp and stats to new projects
            project.project_id = '%x-%x' % (round(time.time()), random.randrange(0x10000))
            project.source = project_pb2.PROJECT_MANUALLY_CREATED
            project.created_at.FromDatetime(now.get())
        if not project.HasField('local_stats'):
            _populate_job_stats_dict(
                {rome_id: project.local_stats}, project.mobility.city)
        if not project.cover_image_url:
            job_group_info = _job_groups_info().get(rome_id)
            if job_group_info and job_group_info.image_link:
                project.cover_image_url = job_group_info.image_link
            else:
                project.cover_image_url = _generic_image()

        advisor.maybe_advise(user_data, project, _DB)

        for current_action in project.actions:
            if current_action.status in _ACTION_STOPPED_STATUSES:
                action.stop(current_action, _DB)

        for past_action in project.past_actions:
            action.stop(past_action, _DB)

        for sticky_action in project.sticky_actions:
            if not sticky_action.HasField('stuck_at'):
                sticky_action.stuck_at.FromDatetime(now.get())

    if not is_new_user:
        previous_user_data = _get_user_data(user_data.user_id, update_requested_at=False)
        _assert_no_credentials_change(previous_user_data, user_data)
        _copy_unmodifiable_fields(previous_user_data, user_data)
        _populate_feature_flags(user_data)

    # Modifications on user_data after this point will not be saved.
    user_dict = json.loads(json_format.MessageToJson(user_data))
    user_dict.update(_SERVER_TAG)
    if is_new_user:
        user_dict['_id'] = _get_unguessable_object_id()
        result = _DB.user.insert_one(user_dict)
        user_data.user_id = str(result.inserted_id)
    else:
        _DB.user.replace_one({'_id': _safe_object_id(user_data.user_id)}, user_dict)
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


def _is_in_unverified_data_zone(user_profile):
    data_zone_key = '%s:%s' % (
        user_profile.city.postcodes, user_profile.latest_job.job_group.rome_id)
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


def _get_user_data(user_id, update_requested_at=True):
    """Load user data from DB.

    Make sure to use `update_requested_at=False` when you load user data
    without being requested by the user (e.g. in the mailer).
    """
    user_dict = _DB.user.find_one({'_id': _safe_object_id(user_id)})
    user_proto = user_pb2.User()
    if not proto.parse_from_mongo(user_dict, user_proto):
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, 'Utilisateur "%s" inconnu.' % user_id)

    start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
    # TODO: HACK to be cleaned up soon. We don't want a user_proto floating around
    # that should not be saved, nor returning a proto that is not the latest
    # value from dB. Consider creating a separate endpoint to mark the user as requested.
    if user_proto.requested_by_user_at_date.ToDatetime() < start_of_day and update_requested_at:
        user_proto_copy = user_pb2.User()
        user_proto_copy.CopyFrom(user_proto)
        user_proto_copy.requested_by_user_at_date.FromDatetime(now.get())
        # No need to pollute our DB with super precise timestamps.
        user_proto_copy.requested_by_user_at_date.nanos = 0
        _save_user(user_proto_copy, is_new_user=False)

    _populate_feature_flags(user_proto)

    return user_proto


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


@app.route('/api/chantiers', methods=['GET'])
@proto.flask_api(out_type=chantier_pb2.ChantierTitles)
def chantiers():
    """Get the title of all existing chantiers keyed by ID."""
    result = chantier_pb2.ChantierTitles()
    for name, chantier in _chantiers().items():
        result.titles[name] = chantier.title
    return result


# TODO(stephan): Split this into separate endpoints for registration and login.
@app.route('/api/user/authenticate', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest, out_type=user_pb2.AuthResponse)
def authenticate(auth_request):
    """Authenticate a user."""
    authenticator = auth.Authenticator(_DB, _save_user)
    response = authenticator.authenticate(auth_request)
    if response.authenticated_user.user_id:
        _maybe_generate_new_actions(response.authenticated_user)
    return response


@app.route('/api/user/reset-password', methods=['POST'])
@proto.flask_api(in_type=user_pb2.AuthRequest)
def reset_password(auth_request):
    """Sends an email to user with a reset token so that they can reset their password."""
    authenticator = auth.Authenticator(_DB, _save_user)
    authenticator.send_reset_password_token(auth_request.email)
    return '{}'


# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO = {}


def _job_groups_info():
    """Returns a dict of info of known job groups as protos."""
    return proto.cache_mongo_collection(_DB.job_group_info.find, _JOB_GROUPS_INFO, job_pb2.JobGroup)


def _maybe_generate_new_action_plan(user_proto, project):
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
    return project.best_advice_id and project.advice_status in (
        project_pb2.ADVICE_RECOMMENDED, project_pb2.ADVICE_ACCEPTED, project_pb2.ADVICE_ENGAGED)


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


@app.route('/api/project/<user_id>/<project_id>/potential-chantiers', methods=['GET'])
@proto.flask_api(out_type=chantier_pb2.PotentialChantiers)
def project_potential_chantiers(user_id, project_id):
    """Get all available chantiers for a project."""
    # TODO(pascal): Split this function it's starting to get big.

    user_proto = _get_user_data(user_id)
    try:
        project = next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, 'Projet "%s" inconnu.' % project_id)

    response = chantier_pb2.PotentialChantiers()

    # Score all existing chantiers.
    all_chantiers = _chantiers()
    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, _DB)
    scorer = scoring.score_chantiers(all_chantiers.values(), scoring_project)
    best_scored_chantiers = scorer.get_best_chantiers(len(all_chantiers))
    best_chantier_ids = set(t.chantier.chantier_id for t in best_scored_chantiers)

    # Set a target of # of chantiers per group that the user should select.
    # This defines how much each group is needed.
    targets = scorer.get_group_targets()
    for kind, target in targets.items():
        group = response.groups.add()
        group.kind = kind
        if target >= 6:
            group.need = chantier_pb2.REALLY_NEEDED
        elif target >= 3:
            group.need = chantier_pb2.SOMEHOW_NEEDED
        else:
            group.need = chantier_pb2.NOT_NEEDED
    response.groups.sort(key=lambda group: group.kind)

    # If this is the first time the user will see chantiers for this project we
    # preselect some of them. The # of chantiers selected in each group depend
    # on the target we have set.
    needs_preselection = not project.activated_chantiers

    # Add best chantiers.
    for scored_chantier in best_scored_chantiers:
        if needs_preselection:
            if targets.get(scored_chantier.chantier.kind, 0) <= 0:
                selected = False
            else:
                selected = True
                # TODO(pascal): Compute impact while scoring.
                impact = 1
                if scored_chantier.additional_job_offers:
                    impact = (
                        scored_chantier.additional_job_offers /
                        scoring.JOB_OFFERS_INCREASE_PER_TARGET)
                targets[scored_chantier.chantier.kind] -= impact
        else:
            selected = project.activated_chantiers.get(scored_chantier.chantier.chantier_id)
        response.chantiers.add(
            template=scored_chantier.chantier,
            user_has_started=selected,
            additional_job_offers_percent=scored_chantier.additional_job_offers)

    # Append chantiers that user has started and that are not already listed.
    for chantier_id, chantier in all_chantiers.items():
        if chantier_id in best_chantier_ids:
            continue
        if project.activated_chantiers.get(chantier_id):
            response.chantiers.add(template=chantier, user_has_started=True)

    return response


@app.route('/api/project/<user_id>/<project_id>/update-chantiers', methods=['POST'])
@proto.flask_api(in_type=chantier_pb2.ChantiersSet, out_type=user_pb2.User)
def project_update_chantiers(templates_set, user_id, project_id):
    """Update chantiers of a project."""
    user_proto = _get_user_data(user_id)
    try:
        project = next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, 'Projet "%s" inconnu.' % project_id)

    project.activated_chantiers.update(templates_set.chantier_ids)

    return _save_user(user_proto, is_new_user=False)


@app.route('/api/explore/<user_id>', methods=['GET'])
@proto.flask_api(out_type=discovery_pb2.JobsExploration)
def explore(user_id):
    """Get new jobs to explore for the user."""
    user_proto = _get_user_data(user_id)
    if not user_proto.profile.city.departement_id:
        flask.abort(422, 'Pas assez de contexte géographique pour explorer.')
    source_job = user_proto.profile.latest_job
    if not source_job.job_group.rome_id:
        for project in user_proto.projects:
            if project.target_job.job_group.rome_id:
                source_job = project.target_job
                break
        else:
            flask.abort(422, 'Pas assez de contexte professionel pour explorer.')
    return _explore(source_job, user_proto.profile.city)


def _explore(source_job, city):
    response = discovery_pb2.JobsExploration()
    response.city.CopyFrom(city)
    response.source_job.CopyFrom(source_job)

    # Find ROME IDs of similar job groups.
    job_group_mobility = discovery_pb2.JobsExploration()
    proto.parse_from_mongo(
        _DB.similar_jobs.find_one({'_id': source_job.job_group.rome_id}), job_group_mobility)
    job_mobility = discovery_pb2.JobsExploration()
    proto.parse_from_mongo(_DB.similar_jobs.find_one({'_id': source_job.code_ogr}), job_mobility)
    # We've checked in a notebook that those IDs would be unique here despite
    # joining the ones from job and from job group.
    # http://go/pe:notebooks/datasets/ROME%20mobility.ipynb
    job_group_ids = list((e.job_group.rome_id for e in itertools.chain(
        job_group_mobility.job_groups, job_mobility.job_groups)))
    job_group_ids.append(source_job.job_group.rome_id)

    # Populate the response with data from job group info.
    job_groups_info = _job_groups_info()
    # Keep access to each exploration job group data keyed by ROME ID so that
    # we can enrich it by ID without iterating over the whole proto several
    # times.
    exploration_job_groups = {}
    for job_group_id in job_group_ids:
        job_group_info = job_groups_info.get(job_group_id)
        if not job_group_info:
            continue
        exploration_job_group = response.job_groups.add(job_group=job_group_info)
        exploration_job_groups[job_group_id] = exploration_job_group

    _enrich_discovery_protos(exploration_job_groups, city)

    def _sort_key(job_group):
        # Keep the source job group first.
        if job_group.job_group.rome_id == source_job.job_group.rome_id:
            return -1
        return job_group.stats.unemployment_duration.days

    response.job_groups.sort(key=_sort_key)
    return response


@app.route('/api/explore/<user_id>/<job_group_rome_id>', methods=['GET'])
@proto.flask_api(out_type=discovery_pb2.JobGroupExploration)
def explore_job_group(user_id, job_group_rome_id):
    """Get more exploration info about a specific job group."""
    user_proto = _get_user_data(user_id)
    if not user_proto.profile.city.departement_id:
        flask.abort(422, 'Pas assez de contexte géographique pour explorer.')
    return _job_stats(job_group_rome_id, user_proto.profile.city)


def _job_stats(job_group_rome_id, city):
    response = discovery_pb2.JobGroupExploration()
    job_group_info = _job_groups_info().get(job_group_rome_id)
    if not job_group_info:
        flask.abort(404, 'Groupe de métier "%s" inconnu.' % job_group_rome_id)
    response.job_group.CopyFrom(job_group_info)
    _enrich_discovery_protos({job_group_rome_id: response}, city)
    return response


@app.route('/api/explore/job', methods=['GET'])
@proto.flask_api(
    in_type=discovery_pb2.JobExplorationRequest, out_type=discovery_pb2.JobsExploration)
def explore_job(request):
    """Explore jobs around a job for a given city."""
    return _explore(request.source_job, request.city)


@app.route('/api/explore/job/stats', methods=['GET'])
@proto.flask_api(
    in_type=discovery_pb2.JobExplorationRequest, out_type=discovery_pb2.JobGroupExploration)
def job_stats(request):
    """Get stats for a given job group in a given city."""
    return _job_stats(request.source_job.job_group.rome_id, request.city)


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


def _enrich_discovery_protos(exploration_job_groups, city):
    """Enrich a dict of JobExploration protos with local stats and images."""
    _populate_job_stats_dict({g: e.stats for g, e in exploration_job_groups.items()}, city)

    # Fill empty cover images.
    for exploration_job_group in exploration_job_groups.values():
        if not exploration_job_group.job_group.image_link:
            exploration_job_group.job_group.image_link = _generic_image()

    # Add external links.
    for exploration_job_group in exploration_job_groups.values():
        num_available_job_offers = exploration_job_group.stats.num_available_job_offers
        available_offers = (
            'les offres' if num_available_job_offers <= 1
            else 'les %d offres ou plus' % num_available_job_offers)
        job = job_pb2.Job(job_group=exploration_job_group.job_group)
        exploration_job_group.links.add(
            caption='Consulter %s sur pole-emploi.fr' % available_offers,
            url=action.populate_template(_POLE_EMPLOI_OFFERS_LINK, city, job))
        exploration_job_group.links.add(
            caption='Voir les entreprises qui recrutent',
            url=action.populate_template(_LA_BONNE_BOITE_LINK, city, job))


@app.route('/api/cache/clear', methods=['GET'])
def clear_cache():
    """Clear all server caches.

    This is an undocumented feature that allows us to clear a server's cache
    without rebooting it. Anybody can use it, but it doesn't cost much apart
    from 2 or 3 additional MongoDB requests on next queries.
    """
    _JOB_GROUPS_INFO.clear()
    _CHANTIERS.clear()
    action.clear_cache()
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
        dashboard_export.projects.add().CopyFrom(project)
        for chantier_id, active in project.activated_chantiers.items():
            if not active or chantier_id in dashboard_export.chantiers:
                continue
            chantier = all_chantiers.get(chantier_id)
            if chantier:
                dashboard_export.chantiers[chantier_id].CopyFrom(chantier)
    dashboard_export.created_at.FromDatetime(now.get())
    export_json = json.loads(json_format.MessageToJson(dashboard_export))
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

    user_proto.features_enabled.sticky_actions = user_pb2.ACTIVE

    user_proto.features_enabled.ClearField('hide_discovery_nav')

    lbb_integration = bool(farmhash.hash32(user_proto.user_id + 'lbb_integration') % 2)
    user_proto.features_enabled.lbb_integration = (
        user_pb2.ACTIVE if lbb_integration else user_pb2.CONTROL)

    if _TEST_USER_REGEXP.search(user_proto.profile.email):
        user_proto.features_enabled.advisor = user_pb2.ACTIVE


if __name__ == "__main__":
    app.run(  # pragma: no cover
        debug=bool(os.getenv('DEBUG')),
        host=os.getenv('BIND_HOST', 'localhost'),
        port=int(os.getenv('PORT', '80')))
