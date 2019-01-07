"""Helper for the mail campaign modules."""

import datetime
import logging
import os
import typing
from urllib import parse

from bson import objectid
from google.protobuf import json_format
from google.protobuf import message
import mypy_extensions
import pymongo
import typing_extensions

from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mail


# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')


class _Profile(typing_extensions.Protocol):
    email: str

    @property
    def name(self) -> str:
        """First name."""

    @property
    def last_name(self) -> str:
        """Last name."""


class _DocumentProfile(object):
    """This is to set up a 'profile' from a BobAction document.

    It has an 'email', 'name' and 'last_name' getters and an 'email' setter, since those are used
    in the blasting process.
    """

    def __init__(self, document: review_pb2.DocumentToReview) -> None:
        self._document = document

    def _get_email(self) -> str:
        return self._document.owner_email

    def _set_email(self, value: str) -> None:
        self._document.owner_email = value

    email = property(_get_email, _set_email)

    name = property(lambda self: self._document.name)

    last_name = property(lambda self: '')


_UserProto = typing.TypeVar('_UserProto', bound=message.Message)


class _UserCollection(typing.Generic[_UserProto]):

    def __init__(
            self, proto: typing.Type[_UserProto], email_field: str,
            get_profile: typing.Callable[[_UserProto], _Profile],
            can_send_email: typing.Callable[[_UserProto], bool], mongo_collection: str,
            get_id: typing.Callable[[_UserProto], str],
            has_registered_at: bool = True):
        self._proto = proto
        self._email_field = email_field
        self._get_profile = get_profile
        self._can_send_email = can_send_email
        self._mongo_collection = mongo_collection
        self._has_registered_at = has_registered_at
        self._get_id = get_id

    proto = property(lambda self: self._proto)
    email_field = property(lambda self: self._email_field)
    get_profile = property(lambda self: self._get_profile)
    can_send_email = property(lambda self: self._can_send_email)
    mongo_collection = property(lambda self: self._mongo_collection)
    has_registered_at = property(lambda self: self._has_registered_at)
    get_id = property(lambda self: self._get_id)


# Don't forget to remove filter on registeredAt when blasting on documents.
BOB_ACTION_DOCUMENTS = _UserCollection(
    proto=review_pb2.DocumentToReview, email_field='ownerEmail',
    get_profile=typing.cast(
        typing.Callable[[review_pb2.DocumentToReview], _Profile], _DocumentProfile),
    can_send_email=lambda doc: True, mongo_collection='cvs_and_cover_letters',
    get_id=lambda doc: doc.user_id, has_registered_at=False)
BOB_ACTION_HELPERS = _UserCollection(
    proto=helper_pb2.Helper, email_field='email', get_profile=lambda helper: helper,
    can_send_email=lambda helper: True, mongo_collection='helper',
    get_id=lambda helper: helper.user_id, has_registered_at=True)
BOB_USERS = _UserCollection(
    proto=user_pb2.User, email_field='profile.email',
    get_profile=lambda user: user.profile,
    # Do not send emails to users who said they have stopped seeking.
    can_send_email=lambda user: not any(
        status.seeking == user_pb2.STOP_SEEKING for status in user.employment_status),
    mongo_collection='user', get_id=lambda user: user.user_id)


class Campaign(typing.Generic[_UserProto]):
    """A Named tuple to define a campaign for blasting mails.

        - mailjet_template: the mailjet ID for the template.
        - mongo_filters: A filter on the mongoDB table for users, to select
          those that may receive this campaign.
        - get_vars: a function to retrieve the template variables from a user
          and a database.  This should be of the form get_vars(user, db) and
          return a dict that can be converted to JSON object, that can be
          accepted by MailJet templating API:
          https://dev.mailjet.com/template-language/reference/
          If a given user should not be sent the campaign, return None.
        - sender_name: the human readable name for the sender of this campaign.
        - sender_email: an email address for the sender of this email.
          Should be <something>@bob-emploi.fr
        - on_email_sent: a function called when the email is actually sent (not on
          dry-run nor list) with the arguments email_sent, user (proto), vars, user_db, data_db.
        - users_collection: a _UserCollection object describing the users that are
          targetted by this campaign.
        - is_coaching: whether it's a coaching email and should be sent
          regularly as part of the coaching experience.
        - is_big_focus: whether it's a big focus on a topic.
    """

    def __init__(
            self, mailjet_template: str, mongo_filters: typing.Dict[str, typing.Any],
            get_vars: typing.Callable[
                [
                    _UserProto,
                    mypy_extensions.DefaultNamedArg(pymongo.database.Database, 'database'),
                    mypy_extensions.DefaultNamedArg(pymongo.database.Database, 'users_database'),
                ],
                typing.Optional[typing.Dict[str, str]],
            ],
            sender_name: str, sender_email: str,
            on_email_sent: typing.Optional[typing.Callable[
                [
                    _UserProto,
                    mypy_extensions.DefaultNamedArg(user_pb2.EmailSent, 'email_sent'),
                    mypy_extensions.DefaultNamedArg(typing.Dict[str, str], 'template_vars'),
                    mypy_extensions.DefaultNamedArg(pymongo.database.Database, 'database'),
                    mypy_extensions.DefaultNamedArg(pymongo.database.Database, 'user_database'),
                ], None]] = None,  # pylint: disable=bad-whitespace
            users_collection: _UserCollection[typing.Any] = BOB_USERS, is_coaching: bool = False,
            is_big_focus: bool = False) -> None:
        self._mailjet_template = mailjet_template
        self._mongo_filters = mongo_filters
        self._get_vars = get_vars
        self._sender_name = sender_name
        self._sender_email = sender_email
        self._on_email_sent = on_email_sent
        self._users_collection = users_collection
        self._is_coaching = is_coaching
        self._is_big_focus = is_big_focus

    is_coaching = property(lambda self: self._is_coaching)
    is_big_focus = property(lambda self: self._is_big_focus)
    mongo_filters = property(lambda self: self._mongo_filters)
    users_collection = property(lambda self: self._users_collection)

    def send_mail(
            self, campaign_id: str, user: _UserProto, database: pymongo.database.Database,
            users_database: pymongo.database.Database, action: str = 'dry-run',
            dry_run_email: str = 'pascal@bayes.org',
            mongo_user_update: typing.Optional[typing.Dict[str, typing.Any]] = None) -> bool:
        """Send an email for this campaign."""

        template_vars = self._get_vars(user, database=database, users_database=users_database)
        if not template_vars:
            return False

        collection = self._users_collection

        if action == 'list':
            user_id = collection.get_id(user)
            logging.info('%s: %s %s', campaign_id, user_id, collection.get_profile(user).email)
            return True

        if action not in ('dry-run', 'send'):
            raise ValueError('Unknown action "{}".'.format(action))

        if action == 'dry-run':
            collection.get_profile(user).email = dry_run_email

        res = mail.send_template(
            self._mailjet_template, collection.get_profile(user), template_vars,
            sender_email=self._sender_email, sender_name=self._sender_name,
            campaign_id=campaign_id)
        logging.info('Email sent to %s', collection.get_profile(user).email)

        res.raise_for_status()

        email_sent = mail.create_email_sent_proto(res)
        if not email_sent:
            logging.warning('Impossible to retrieve the sent email ID:\n%s', res.json())
            return False
        if action == 'dry-run':
            return True

        email_sent.mailjet_template = self._mailjet_template
        email_sent.campaign_id = campaign_id
        if mongo_user_update and '$push' in mongo_user_update:  # pragma: no-cover
            raise ValueError(
                '$push operations are not allowed in mongo_user_update:\n{}'
                .format(mongo_user_update))
        users_database.get_collection(collection.mongo_collection).update_one(
            {'_id': objectid.ObjectId(collection.get_id(user))},
            dict(mongo_user_update or {}, **{'$push': {
                'emailsSent': json_format.MessageToDict(email_sent),
            }}))

        if self._on_email_sent:
            self._on_email_sent(
                user, email_sent=email_sent, template_vars=template_vars,
                database=database, user_database=users_database)

        return True


_CAMPAIGNS: typing.Dict[str, Campaign[typing.Any]] = {}


def register_campaign(campaign_id: str, campaign: Campaign[_UserProto]) -> None:
    """Registers an email campaign."""

    if campaign_id in _CAMPAIGNS:
        raise ValueError('The campaign "{}" already exists.'.format(campaign_id))
    _CAMPAIGNS[campaign_id] = campaign


def get_campaign(campaign_id: str) -> Campaign[_UserProto]:
    """Fetch an email campaign."""

    return _CAMPAIGNS[campaign_id]


def list_all_campaigns() -> typing.KeysView[str]:
    """Fetch all available campaign IDs."""

    return _CAMPAIGNS.keys()


def get_coaching_campaigns() -> typing.Dict[str, Campaign[typing.Any]]:
    """Fetch all coaching campaigns as a dict."""

    return {k: v for k, v in _CAMPAIGNS.items() if v.is_coaching}


def as_template_boolean(truth: typing.Any) -> str:
    """puts truth value of input as 'True' or '' in template vars."""

    return 'True' if truth else ''


def get_status_update_link(user_id: str, profile: user_pb2.UserProfile) -> str:
    """Make link with token from user ID for RER status update."""

    survey_token = parse.quote(auth.create_token(user_id, role='employment-status'))
    return '{}/statut/mise-a-jour?user={}&token={}&gender={}{}'.format(
        BASE_URL,
        user_id,
        survey_token,
        user_pb2.Gender.Name(profile.gender),
        '&can_tutoie=true' if profile.can_tutoie else '')


# TODO(cyrille): Fix this to account for same mode in different FAPs.
def get_application_modes(rome_id: str, database: pymongo.database.Database) \
        -> typing.Optional[typing.List[job_pb2.ModePercentage]]:
    """Fetch all possible application modes for all FAP corresponding to the given ROME."""

    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
        return None
    application_modes = job_group_info.application_modes.values()
    fap_modes = [fap_modes.modes for fap_modes in application_modes if fap_modes.modes]
    if not fap_modes:
        return None
    return [mode for modes in fap_modes for mode in modes]


def get_french_months_ago(instant: datetime.datetime) -> typing.Optional[str]:
    """Duration in months from given instant to now, in a French phrase.
    If duration is negative, returns None.
    """

    duration_since_instant = datetime.datetime.now() - instant
    month_since_instant = round(duration_since_instant.days / 30.5)
    if month_since_instant < 1:
        return None
    if month_since_instant > 6:
        return 'plus de six'
    try:
        return french.try_stringify_number(month_since_instant)
    except NotImplementedError:
        return 'quelques'


def create_logged_url(user_id: str, path: str = '') -> str:
    """Returns a route with given path and necessary query parameters for authentication."""

    auth_token = parse.quote(auth.create_token(user_id, role='auth', is_using_timestamp=True))
    return '{}{}?user={}&authToken={}'.format(BASE_URL, path, user_id, auth_token)


def job_search_started_months_ago(project: project_pb2.Project) -> float:
    """Number of months since project started until now. If project has not started, return -1."""

    if project.WhichOneof('job_search_length') != 'job_search_started_at':
        # TODO(pascal): Clean this up when this field is fully redundant in the DB.
        if project.job_search_length_months and project.HasField('created_at'):
            delta = datetime.datetime.now() - project.created_at.ToDatetime()
            return project.job_search_length_months + (delta.days / 30.5)
        return -1
    delta = datetime.datetime.now() - project.job_search_started_at.ToDatetime()
    return delta.days / 30.5


def get_default_vars(user: user_pb2.User) -> typing.Dict[str, str]:
    """Compute default variables used in all emails: firstName, gender and unsubscribeLink."""

    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    return {
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'unsubscribeLink': '{}/unsubscribe.html?user={}&auth={}'.format(
            BASE_URL, parse.quote(user.user_id),
            unsubscribe_token),
    }


def get_default_coaching_email_vars(
        user: user_pb2.User, **unused_kwargs: typing.Any) -> typing.Dict[str, str]:
    """Compute default variables used in all coaching emails."""

    settings_token = parse.quote(auth.create_token(user.user_id, role='settings'))
    return dict(get_default_vars(user), **{
        'changeEmailSettingsUrl':
        '{}/unsubscribe.html?user={}&auth={}&coachingEmailFrequency={}'.format(
            BASE_URL, parse.quote(user.user_id),
            settings_token, user_pb2.EmailFrequency.Name(user.profile.coaching_email_frequency)),
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        # TODO(pascal): Harmonize use of URL suffix (instead of link).
        'statusUpdateUrl': get_status_update_link(user.user_id, user.profile),
    })
