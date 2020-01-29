"""Functions for manipulating users. Assume to be in a flask app."""

import collections
import datetime
import itertools
import os
import re
import time
import typing
from typing import Literal
from urllib import parse

from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import timestamp_pb2
import requests

from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import strategist
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_Tick = collections.namedtuple('Tick', ['name', 'time'])

_TEST_USER_REGEXP = re.compile(os.getenv('TEST_USER_REGEXP', r'@(bayes.org|example.com)$'))
_ALPHA_USER_REGEXP = re.compile(os.getenv('ALPHA_USER_REGEXP', r'@example.com$'))
_POLE_EMPLOI_USER_REGEXP = \
    re.compile(os.getenv('POLE_EMPLOI_USER_REGEXP', r'@pole-emploi.fr$'))
_EXCLUDE_FROM_ANALYTICS_REGEXP = re.compile(
    os.getenv('EXCLUDE_FROM_ANALYTICS_REGEXP', r'@(bayes.org|bayesimpact.org|example.com)$'))

# Email regex from http://emailregex.com/
_EMAIL_REGEX = re.compile(r'(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)')

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

# For testing on old users, we sometimes want to enable advisor for newly
# created users.
# TODO(pascal): Remove that when we stop testing about users that do not have
# the advisor feature.
ADVISOR_DISABLED_FOR_TESTING = False


def get_authenticator() -> auth.Authenticator:
    """Get the relevant Authenticator object for the task at hand."""

    authenticator = auth.Authenticator(
        flask.current_app.config['USER_DATABASE'], flask.current_app.config['DATABASE'],
        lambda u: save_user(u, is_new_user=True),
        _update_returning_user,
    )
    return authenticator


def safe_object_id(_id: str) -> objectid.ObjectId:
    """Wrap the given ID in a MongoDB ObjectID. Raises a flask error if format is invalid."""

    try:
        return objectid.ObjectId(_id)
    except objectid.InvalidId:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(
            400, f'L\'identifiant "{_id}" n\'est pas un identifiant MongoDB valide.')


def _save_low_level(user_data: user_pb2.User, is_new_user: bool = False) -> user_pb2.User:
    user_collection = flask.current_app.config['USER_DATABASE'].user
    user_dict = json_format.MessageToDict(user_data)
    user_dict.update(SERVER_TAG)
    user_dict.pop('userId', None)
    if is_new_user:
        result = user_collection.insert_one(user_dict)
        user_data.user_id = str(result.inserted_id)
    else:
        user_collection.replace_one(
            {'_id': safe_object_id(user_data.user_id)}, user_dict)
    return user_data


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


def get_user_data(user_id: str) -> user_pb2.User:
    """Load user data from DB."""

    user_dict = flask.current_app.config['USER_DATABASE'].user.find_one(
        {'_id': safe_object_id(user_id)})
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id', always_create=False)
    if not user_proto or user_proto.HasField('deleted_at'):
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, f'Utilisateur "{user_id}" inconnu.')

    _populate_feature_flags(user_proto)

    # TODO(cyrille): Remove this once we've generated observations for old users.
    for project in user_proto.projects:
        if not project.diagnostic.sub_diagnostics:
            continue
        scoring_project = scoring.ScoringProject(
            project, user_proto, flask.current_app.config['DATABASE'])
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


def _update_returning_user(
        user_data: user_pb2.User, force_update: bool = False, has_set_email: bool = False) \
        -> timestamp_pb2.Timestamp:
    if user_data.HasField('requested_by_user_at_date'):
        start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
        if user_data.requested_by_user_at_date.ToDatetime() >= start_of_day:
            if force_update:
                _save_low_level(user_data)
            return user_data.requested_by_user_at_date
        else:
            last_connection = timestamp_pb2.Timestamp()
            last_connection.CopyFrom(user_data.requested_by_user_at_date)
    else:
        last_connection = user_data.registered_at

    if user_data.profile.email:
        user_data.hashed_email = auth.hash_user_email(user_data.profile.email)

    if has_set_email:
        base_url = parse.urljoin(flask.request.base_url, '/')[:-1]
        advisor.maybe_send_late_activation_emails(
            user_data, flask.current_app.config['DATABASE'], base_url)

    user_data.requested_by_user_at_date.FromDatetime(now.get())
    # No need to pollute our DB with super precise timestamps.
    user_data.requested_by_user_at_date.nanos = 0
    _save_low_level(user_data)

    return last_connection


def _tick(tick_name: str) -> None:
    flask.g.ticks.append(_Tick(tick_name, time.time()))


def _is_test_user(user_proto: user_pb2.User) -> bool:
    return bool(_TEST_USER_REGEXP.search(user_proto.profile.email))


def _create_new_project_id(user_data: user_pb2.User) -> str:
    existing_ids = set(p.project_id for p in user_data.projects) |\
        set(p.project_id for p in user_data.deleted_projects)
    for id_candidate in itertools.count():
        id_string = f'{id_candidate:x}'
        if id_string not in existing_ids:
            return id_string
    raise ValueError('Should never happen as itertools.count() does not finish')  # pragma: no-cover


def give_feedback(feedback: feedback_pb2.Feedback, slack_text: str) -> None:
    """Save feedback in database, and publish it to slack."""

    if slack_text and _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={'text': f':mega: {slack_text}'})
    flask.current_app.config['USER_DATABASE'].feedbacks.insert_one(
        json_format.MessageToDict(feedback))


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

    database = flask.current_app.config['DATABASE']
    _tick('Populate local stats')
    if previous_project.city.departement_id != departement_id or \
            previous_project.target_job.job_group.rome_id != rome_id:
        project.ClearField('local_stats')
    if not project.HasField('local_stats'):
        project.local_stats.CopyFrom(jobs.get_local_stats(database, departement_id, rome_id))

    _tick('Diagnostic')
    diagnostic.maybe_diagnose(user_data, project, database)

    _tick('Advisor')
    advisor.maybe_advise(
        user_data, project, database, parse.urljoin(flask.request.base_url, '/')[:-1])

    _tick('Strategies')
    strategist.maybe_strategize(user_data, project, database)

    _tick('New feedback')
    if project.feedback.text and not previous_project.feedback.text:
        stars = ':star:' * project.feedback.score
        user_url = parse.urljoin(
            flask.request.base_url, f'/eval?userId={user_data.user_id}')
        feedback = '\n> '.join(project.feedback.text.split('\n'))
        slack_text = f'[{stars}] <{user_url}|{user_data.user_id}>\n> {feedback}'
        give_feedback(
            feedback_pb2.Feedback(
                user_id=str(user_data.user_id),
                project_id=str(project.project_id),
                feedback=project.feedback.text,
                source=feedback_pb2.PROJECT_FEEDBACK,
                score=project.feedback.score),
            slack_text=slack_text)

    _tick('Process project end')
    return project


def save_user(user_data: user_pb2.User, is_new_user: bool) \
        -> user_pb2.User:
    """Save a user, updating all the necessary computed fields while doing so."""

    _tick('Save user start')

    if is_new_user:
        previous_user_data = user_data
    else:
        _tick('Load old user data')
        previous_user_data = get_user_data(user_data.user_id)
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
    if user_data.profile.email:
        user_data.hashed_email = auth.hash_user_email(user_data.profile.email)

    if not is_new_user:
        _assert_no_credentials_change(previous_user_data, user_data)
        _copy_unmodifiable_fields(previous_user_data, user_data)
        _populate_feature_flags(user_data)

        if user_data.profile.email and not previous_user_data.profile.email:
            base_url = parse.urljoin(flask.request.base_url, '/')[:-1]
            advisor.maybe_send_late_activation_emails(
                user_data, flask.current_app.config['DATABASE'], base_url)

    user_data.revision += 1

    _tick('Save user')
    _save_low_level(user_data, is_new_user=is_new_user)
    _tick('Return user proto')

    return user_data


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
        email_taken = bool(flask.current_app.config['USER_DATABASE'].user.find(
            {'hashedEmail': auth.hash_user_email(new.profile.email)}, {'_id': 1}).limit(1).count())
        if email_taken:
            flask.abort(403, "L'utilisateur existe mais utilise un autre moyen de connexion.")
        return
    flask.abort(403, "Impossible de modifier l'adresse email.")


def _copy_unmodifiable_fields(previous_user_data: user_pb2.User, user_data: user_pb2.User) -> None:
    """Copy unmodifiable fields.

    Some fields cannot be changed by the API: we only copy over the fields
    from the previous state.
    """

    if _is_test_user(user_data):
        # Test users can do whatever they want.
        return
    for field in ('features_enabled', 'last_email_sent_at'):
        typed_field = typing.cast(Literal['features_enabled', 'last_email_sent_at'], field)
        if previous_user_data.HasField(typed_field):
            getattr(user_data, typed_field).CopyFrom(getattr(previous_user_data, typed_field))
        else:
            user_data.ClearField(typed_field)
