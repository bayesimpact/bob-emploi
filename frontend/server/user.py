"""Functions for manipulating users. Assume to be in a flask app."""

import datetime
import itertools
import os
import re
import textwrap
import typing
from typing import Any, Callable, Literal, Optional
from urllib import parse

import bson
from bson import objectid
import flask
from google.protobuf import json_format
from google.protobuf import timestamp_pb2
from pymongo import collection as pymongo
import requests

from bob_emploi.common.python import now
from bob_emploi.common.python import proto as common_proto
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import features
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import strategist
from bob_emploi.frontend.server import tick
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

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
# TODO(cyrille): Remove the fallback once the feedback URL is set up.
_SLACK_FEEDBACK_WEBHOOK_URL = \
    os.getenv('SLACK_FEEDBACK_WEBHOOK_URL', os.getenv('SLACK_WEBHOOK_URL'))

_UPSKILLING_SLACK_WEBHOOK_URL = \
    os.getenv('UPSKILLING_SLACK_WEBHOOK_URL', _SLACK_FEEDBACK_WEBHOOK_URL)

# An email address where the processing done in server#direct_email_to_user will happen.
_ANONYMOUS_USER_EMAIL = os.getenv('ANONYMOUS_USER_EMAIL')

# For testing on old users, we sometimes want to enable advisor for newly
# created users.
# TODO(pascal): Remove that when we stop testing about users that do not have
# the advisor feature.
ADVISOR_DISABLED_FOR_TESTING = False


def _get_user_db() -> mongo.UsersDatabase:
    return mongo.get_connections_from_env().user_db


def get_authenticator() -> auth.Authenticator:
    """Get the relevant Authenticator object for the task at hand."""

    database, user_database, unused_ = mongo.get_connections_from_env()

    authenticator = auth.Authenticator(
        user_database, database,
        lambda u: save_user(u, is_new_user=True),
        _update_returning_user,
    )
    return authenticator


def safe_object_id(_id: str) -> objectid.ObjectId:
    """Wrap the given ID in a MongoDB ObjectID. Raises a flask error if format is invalid."""

    try:
        return objectid.ObjectId(_id)
    except bson.errors.InvalidId:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(
            400, f'L\'identifiant "{_id}" n\'est pas un identifiant MongoDB valide.')


def save_low_level(
        user_data: user_pb2.User, *,
        is_new_user: bool = False,
        collection: Optional[pymongo.Collection] = None) -> user_pb2.User:
    """Save the user almost 'as is' in database."""

    user_collection = collection or _get_user_db().user
    user_dict = json_format.MessageToDict(user_data) | SERVER_TAG
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


def get_user_data(user_id: str, *, collection: Optional[pymongo.Collection] = None) \
        -> user_pb2.User:
    """Load user data from DB."""

    user_dict = (collection or _get_user_db().user).find_one(
        {'_id': safe_object_id(user_id)})
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id', always_create=False)
    if not user_proto or user_proto.HasField('deleted_at'):
        # Switch to raising an error if you move this function in a lib.
        flask.abort(404, f'Utilisateur "{user_id}" inconnu.')

    _populate_feature_flags(user_proto)

    # TODO(pascal): Remove the fields completely after this has been live for a week.
    user_proto.profile.ClearField('city')
    user_proto.profile.ClearField('latest_job')
    user_proto.profile.ClearField('situation')

    return user_proto


def delete_user(
        user_data: user_pb2.User, token: str, *,
        user_db: Optional[mongo.UsersDatabase] = None) -> Optional[str]:
    """Delete a user."""

    if not user_db:
        user_db = _get_user_db()

    filter_user: Optional[dict[str, Any]]
    if user_data.user_id:
        try:
            auth_token.check_token(user_data.user_id, token, role='unsubscribe')
        except ValueError:
            try:
                auth_token.check_token(user_data.user_id, token, role='auth')
            except ValueError:
                flask.abort(403, i18n.flask_translate("Mauvais jeton d'authentification"))
        filter_user = {'_id': safe_object_id(user_data.user_id)}
    elif user_data.profile.email:
        try:
            auth_token.check_admin_token(token)
        except ValueError:
            flask.abort(403, i18n.flask_translate(
                'Accès refusé, action seulement pour le super-administrateur.'))
        filter_user = user_db.user.find_one({
            'hashedEmail': auth.hash_user_email(user_data.profile.email)}, {'_id': 1})
    else:
        flask.abort(400, i18n.flask_translate(
            'Impossible de supprimer un utilisateur sans son ID.'))

    if not filter_user:
        return None

    user_proto = get_user_data(str(filter_user['_id']), collection=user_db.user)
    if not auth.delete_user(user_proto, user_db):
        flask.abort(500, i18n.flask_translate('Erreur serveur, impossible de supprimer le compte.'))

    return str(filter_user['_id'])


def _update_returning_user(
        user_data: user_pb2.User, /, force_update: bool = False, has_set_email: bool = False) \
        -> timestamp_pb2.Timestamp:
    if user_data.HasField('requested_by_user_at_date'):
        start_of_day = now.get().replace(hour=0, minute=0, second=0, microsecond=0)
        if user_data.requested_by_user_at_date.ToDatetime() >= start_of_day:
            if force_update:
                save_low_level(user_data)
            return user_data.requested_by_user_at_date
        last_connection = timestamp_pb2.Timestamp()
        last_connection.CopyFrom(user_data.requested_by_user_at_date)
    else:
        last_connection = user_data.registered_at

    if user_data.profile.email:
        user_data.hashed_email = auth.hash_user_email(user_data.profile.email)

    if last_connection.ToDatetime() < datetime.datetime(2019, 10, 25) and \
            user_data.features_enabled.strat_two != features_pb2.ACTIVE:
        for project in user_data.projects:
            _save_project(project, project, user_data)

    if has_set_email:
        base_url = flask.request.url_root
        advisor.maybe_send_late_activation_emails(
            user_data, mongo.get_connections_from_env().stats_db, base_url)

    common_proto.set_date_now(user_data.requested_by_user_at_date)
    save_low_level(user_data)

    return last_connection


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


def give_feedback(
        feedback: feedback_pb2.Feedback, slack_text: str, *,
        users_database: Optional[mongo.UsersDatabase] = None) -> None:
    """Save feedback in database, and publish it to slack."""

    # TODO(cyrille): Move the upskilling part to the jobflix blueprint/app.
    if feedback.source == feedback_pb2.UPSKILLING_FEEDBACK:
        webhook_url = _UPSKILLING_SLACK_WEBHOOK_URL
    else:
        webhook_url = _SLACK_FEEDBACK_WEBHOOK_URL
    if slack_text and webhook_url:
        requests.post(webhook_url, json={'text': f':mega: {slack_text}'})
    (users_database or _get_user_db()).feedbacks.insert_one(json_format.MessageToDict(feedback))


def give_project_feedback(
        user_id: str, has_email: bool, project: project_pb2.Project, *,
        base_feedback: feedback_pb2.Feedback = feedback_pb2.Feedback(),
        header: str = '', prefix: str = '') -> None:
    """Give feedback on project."""

    if not project.feedback.text:
        return
    user_url = parse.urljoin(
        flask.request.url_root, f'eval?userId={user_id}')
    feedback = '\n> '.join(project.feedback.text.split('\n'))
    if project.feedback.score:
        stars = ':star:' * project.feedback.score
        header += f'[{stars}] <{user_url}|{user_id}>\n'
    elif project.feedback.challenge_agreement_score:
        self_diagnostic: str
        if project.original_self_diagnostic.status == diagnostic_pb2.UNDEFINED_SELF_DIAGNOSTIC:
            self_diagnostic = "don't know"
        elif project.original_self_diagnostic.status == diagnostic_pb2.OTHER_SELF_DIAGNOSTIC:
            self_diagnostic = project.original_self_diagnostic.category_details
        else:
            self_diagnostic = project.original_self_diagnostic.category_id
        stars = f'Agree with {project.diagnostic.category_id}: ' \
            f'{project.feedback.challenge_agreement_score - 1}/4'
        feedback = f'Self diagnosed to: {self_diagnostic}\n>{feedback}'
        header += f'[{stars}] <{user_url}|{user_id}>\n'
    if _ANONYMOUS_USER_EMAIL and has_email:
        mail_params = parse.urlencode({
            'body': textwrap.dedent('''\
                # Please, keep the user ID as the beginning of your subject.
                # It will be deleted by the email pre-processing.
                # Also, please remove these lines
                # (pre-processing should take care of it in a future version).'''),
            'subject': f'{prefix}:{user_id} # Your message here',
        })
        prefilled_email = f'mailto:{_ANONYMOUS_USER_EMAIL}?{mail_params}'
        header += f'<{prefilled_email}|Send an email>\n'
    slack_text = f'{header}> {feedback}'
    saved_feedback = feedback_pb2.Feedback(
        user_id=str(user_id),
        project_id=str(project.project_id),
        feedback=project.feedback.text,
        source=feedback_pb2.PROJECT_FEEDBACK,
        score=project.feedback.score)
    # Override input fields.
    saved_feedback.MergeFrom(base_feedback)
    give_feedback(
        saved_feedback, slack_text=slack_text, users_database=_get_user_db().with_prefix(prefix))


def _save_project(
        project: project_pb2.Project,
        previous_project: project_pb2.Project,
        user_data: user_pb2.User) -> project_pb2.Project:
    # TODO(cyrille): Check for completeness here, rather than in client.
    if project.is_incomplete:
        return project
    tick.tick('Process project start')
    rome_id = project.target_job.job_group.rome_id
    departement_id = project.city.departement_id
    if not project.project_id:
        # Add ID, timestamp and stats to new projects
        project.project_id = _create_new_project_id(user_data)
        common_proto.set_date_now(project.created_at)

    database = mongo.get_connections_from_env().stats_db
    tick.tick('Populate local stats')
    if previous_project.city.departement_id != departement_id or \
            previous_project.target_job.job_group.rome_id != rome_id:
        project.ClearField('local_stats')
    if not project.HasField('local_stats'):
        project.local_stats.CopyFrom(jobs.get_local_stats(database, departement_id, rome_id))

    tick.tick('Diagnostic')
    diagnostic.maybe_diagnose(user_data, project, database)

    tick.tick('Advisor')
    advisor.maybe_advise(
        user_data, project, database, flask.request.url_root)

    tick.tick('Strategies')
    strategist.maybe_strategize(user_data, project, database)

    tick.tick('New feedback')
    if project.feedback.text and not previous_project.feedback.text:
        give_project_feedback(user_data.user_id, '@' in user_data.profile.email, project)

    tick.tick('Process project end')
    return project


_SaveProject = Callable[
    [project_pb2.Project, project_pb2.Project, user_pb2.User], project_pb2.Project]


def save_user(
        user_data: user_pb2.User, is_new_user: bool,
        collection: Optional[pymongo.Collection] = None,
        save_project: _SaveProject = _save_project) -> user_pb2.User:
    """Save a user, updating all the necessary computed fields while doing so."""

    tick.tick('Save user start')

    if is_new_user:
        previous_user_data = user_data
        features.assign_features(user_data.features_enabled, is_new=True)
    else:
        tick.tick('Load old user data')
        previous_user_data = get_user_data(user_data.user_id, collection=collection)
        if user_data.revision and previous_user_data.revision > user_data.revision:
            # Do not overwrite newer data that was saved already: just return it.
            return previous_user_data
        features.assign_features(previous_user_data.features_enabled, is_new=False)

    if not previous_user_data.registered_at.seconds:
        common_proto.set_date_now(user_data.registered_at)
        # Disable Advisor for new users in tests.
        if ADVISOR_DISABLED_FOR_TESTING:
            user_data.features_enabled.advisor = features_pb2.CONTROL
            user_data.features_enabled.advisor_email = features_pb2.CONTROL
    elif not _is_test_user(previous_user_data):
        user_data.registered_at.CopyFrom(previous_user_data.registered_at)
        user_data.features_enabled.advisor = previous_user_data.features_enabled.advisor
        user_data.features_enabled.strat_two = previous_user_data.features_enabled.strat_two

    # TODO(pascal): Clean up those multiple populate_feature_flags floating around.
    _populate_feature_flags(user_data)

    for project in user_data.projects:
        previous_project = next(
            (p for p in previous_user_data.projects if p.project_id == project.project_id),
            project_pb2.Project())
        save_project(project, previous_project, user_data)

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
            advisor.maybe_send_late_activation_emails(
                user_data, mongo.get_connections_from_env().stats_db, flask.request.url_root)

    user_data.revision += 1

    tick.tick('Save user')
    save_low_level(user_data, is_new_user=is_new_user, collection=collection)
    tick.tick('Return user proto')

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
        email_taken = bool(_get_user_db().user.find_one(
            {'hashedEmail': auth.hash_user_email(new.profile.email)}, {'_id': 1}))
        if email_taken:
            flask.abort(403, "L'utilisateur existe mais utilise un autre moyen de connexion.")
        return
    flask.abort(403, "Impossible de modifier l'adresse email.")


def _copy_unmodifiable_fields(previous_user_data: user_pb2.User, user_data: user_pb2.User) -> None:
    """Copy unmodifiable fields.

    Some fields cannot be changed by the API: we only copy over the fields
    from the previous state.
    """

    if _is_test_user(user_data) or previous_user_data.features_enabled.alpha:
        # Test users can do whatever they want.
        return
    for field in ('features_enabled', 'last_email_sent_at', 'ma_voie'):
        typed_field = typing.cast(
            Literal['features_enabled', 'last_email_sent_at', 'ma_voie'], field)
        if previous_user_data.HasField(typed_field):
            getattr(user_data, typed_field).CopyFrom(getattr(previous_user_data, typed_field))
        else:
            user_data.ClearField(typed_field)


def get_project_data(user_proto: user_pb2.User, project_id: str) -> project_pb2.Project:
    """Get the data for a project or abort."""

    try:
        return next(
            project for project in user_proto.projects
            if project.project_id == project_id)
    except StopIteration:
        flask.abort(404, i18n.flask_translate(
            'Projet "{project_id}" inconnu.').format(project_id=project_id))


def get_scoring_project(user_id: str, project_id: str) -> scoring.ScoringProject:
    """Get the scoring project or abort."""

    user_proto = get_user_data(user_id)
    project = get_project_data(user_proto, project_id)
    return scoring.ScoringProject(
        project, user_proto, mongo.get_connections_from_env().stats_db, now=now.get())
