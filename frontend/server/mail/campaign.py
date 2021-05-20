"""Helper for the mail campaign modules."""

import datetime
import functools
import json
import logging
import os
from os import path as os_path
import typing
from typing import Any, Dict, Callable, KeysView, List, Literal, Optional, Union
from urllib import parse

from bson import objectid
from google.protobuf import json_format

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail import mustache
from bob_emploi.frontend.server.mail.templates import mailjet_templates


class _EmailSendHistory(typing.Protocol):
    def add(self) -> user_pb2.EmailSent:  # pylint: disable=invalid-name
        """Add a new email to the history."""


class _BaseUser(typing.Protocol):
    @property
    def emails_sent(self) -> _EmailSendHistory:
        """List of emails sent to the user."""


_UserProto = typing.TypeVar('_UserProto', bound=_BaseUser)

if typing.TYPE_CHECKING:
    import mypy_extensions

    class _Profile(typing.Protocol):
        email: str

        @property
        def name(self) -> str:
            """First name."""

        @property
        def last_name(self) -> str:
            """Last name."""

    _GetVarsFuncType = Callable[
        [
            _UserProto,
            mypy_extensions.NamedArg(mongo.NoPiiMongoDatabase, 'database'),
            mypy_extensions.NamedArg(mongo.UsersDatabase, 'users_database'),
            mypy_extensions.NamedArg(datetime.datetime, 'now'),
        ],
        Dict[str, str],
    ]

    _OnEmailSentFuncType = Callable[
        [
            _UserProto,
            mypy_extensions.NamedArg(user_pb2.EmailSent, 'email_sent'),
            mypy_extensions.NamedArg(Dict[str, str], 'template_vars'),
            mypy_extensions.NamedArg(mongo.NoPiiMongoDatabase, 'database'),
            mypy_extensions.NamedArg(mongo.UsersDatabase, 'user_database'),
        ], None]

    Action = Literal['dry-run', 'ghost', 'list', 'send']


# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')


class DoNotSend(Exception):
    """Exception raised while preparing a campaign if the business logic decides not to send it."""


def get_campaign_folder(campaign_id: mailjet_templates.Id) -> str:
    """Get the folder containing the files for a MailJet template."""

    return os_path.join(mailjet_templates.PATH, campaign_id)


@functools.lru_cache()
def get_campaign_subject(campaign_id: mailjet_templates.Id) -> str:
    """Get the subject of a Mailjet template."""

    folder = get_campaign_folder(campaign_id)
    headers_path = os_path.join(folder, 'headers.json')
    with open(headers_path, 'r') as headers_file:
        headers = json.load(headers_file)
    return typing.cast(str, headers.get('Subject'))


class Campaign:
    """A Named tuple to define a campaign for blasting mails.

        - campaign_id: the ID for the Mailjet campaign.
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
        - is_coaching: whether it's a coaching email and should be sent
          regularly as part of the coaching experience.
        - is_big_focus: whether it's a big focus on a topic.
    """

    def __init__(
            self, campaign_id: mailjet_templates.Id, mongo_filters: Dict[str, Any],
            get_vars: '_GetVarsFuncType[user_pb2.User]',
            sender_name: str, sender_email: str,
            is_coaching: bool = False,
            is_big_focus: bool = False) -> None:
        self._campaign_id = campaign_id
        self._mongo_filters = mongo_filters
        self._get_vars = get_vars
        self._sender_name = sender_name
        self._sender_email = sender_email
        self._is_coaching = is_coaching
        self._is_big_focus = is_big_focus

    id = property(lambda self: self._campaign_id)
    is_coaching = property(lambda self: self._is_coaching)
    is_big_focus = property(lambda self: self._is_big_focus)
    mongo_filters = property(lambda self: self._mongo_filters)

    @typing.overload
    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: mongo.UsersDatabase, now: datetime.datetime,
            action: Literal['send'],
            dry_run_email: None = None,
            mongo_user_update: Optional[Dict[str, Any]] = None) \
            -> Union[Literal[False], user_pb2.EmailSent]:
        ...

    @typing.overload
    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: mongo.UsersDatabase, now: datetime.datetime,
            action: 'Action' = 'dry-run',
            dry_run_email: Optional[str] = None,
            mongo_user_update: Optional[Dict[str, Any]] = None) -> Union[bool, user_pb2.EmailSent]:
        ...

    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: mongo.UsersDatabase, now: datetime.datetime,
            action: 'Action' = 'dry-run',
            dry_run_email: Optional[str] = None,
            mongo_user_update: Optional[Dict[str, Any]] = None) -> Union[bool, user_pb2.EmailSent]:
        """Send an email for this campaign."""

        try:
            template_vars = self._get_vars(
                user, database=database, users_database=users_database, now=now)
        except (scoring.NotEnoughDataException, DoNotSend):
            return False

        user_profile = user.profile

        if action == 'list':
            user_id = user.user_id
            logging.info(
                '%s: %s %s', self.id, user_id, user_profile.email)
            return True

        if action == 'dry-run':
            user_profile.email = dry_run_email or 'pascal@bayes.org'
            logging.info('Template vars:\n%s', template_vars)

        try:
            i18n_sender_name = i18n.translate_string(self._sender_name, user_profile.locale)
        except i18n.TranslationMissingException:
            i18n_sender_name = self._sender_name

        if action == 'ghost':
            email_sent = user.emails_sent.add()
            email_sent.sent_at.FromDatetime(now)
            email_sent.sent_at.nanos = 0
        else:
            res = mail_send.send_template(
                self.id, user_profile, template_vars,
                sender_email=self._sender_email, sender_name=i18n_sender_name)
            logging.info(
                'Email sent to %s',
                user_profile.email if action == 'dry-run'
                else user.user_id)

            res.raise_for_status()

            maybe_email_sent = mail_send.create_email_sent_proto(res)
            if not maybe_email_sent:
                logging.warning('Impossible to retrieve the sent email ID:\n%s', res.json())
                return False
            if action == 'dry-run':
                return maybe_email_sent

            email_sent = maybe_email_sent

        campaign_subject = get_campaign_subject(self.id)
        try:
            i18n_campaign_subject = i18n.translate_string(campaign_subject, user_profile.locale)
        except i18n.TranslationMissingException:
            i18n_campaign_subject = campaign_subject
        email_sent.subject = mustache.instantiate(i18n_campaign_subject, template_vars)
        email_sent.mailjet_template = str(mailjet_templates.MAP[self.id]['mailjetTemplate'])
        email_sent.is_coaching = self.is_coaching
        email_sent.campaign_id = self.id
        if mongo_user_update and '$push' in mongo_user_update:  # pragma: no-cover
            raise ValueError(
                f'$push operations are not allowed in mongo_user_update:\n{mongo_user_update}')
        user_id = user.user_id
        if user_id and action != 'ghost':
            users_database.user.update_one(
                {'_id': objectid.ObjectId(user_id)},
                dict(mongo_user_update or {}, **{'$push': {
                    'emailsSent': json_format.MessageToDict(email_sent),
                }}))

        return email_sent

    def get_content(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: mongo.UsersDatabase, now: datetime.datetime) -> Optional[str]:
        """Get the HTML content of an email without sending it."""

        try:
            template_vars = self._get_vars(
                user, database=database, users_database=users_database, now=now)
        except (scoring.NotEnoughDataException, DoNotSend):
            return None

        html_template = mail_send.get_html_template(self.id, user.profile.locale)
        if not html_template:
            return None
        return mustache.instantiate(html_template, template_vars)


_CAMPAIGNS: Dict[mailjet_templates.Id, Campaign] = {}


def register_campaign(campaign: Campaign) -> None:
    """Registers an email campaign."""

    if campaign.id in _CAMPAIGNS:
        raise ValueError(f'The campaign "{campaign.id}" already exists.')
    _CAMPAIGNS[campaign.id] = campaign


def get_campaign(campaign_id: mailjet_templates.Id) -> Campaign:
    """Fetch an email campaign."""

    return _CAMPAIGNS[campaign_id]


def list_all_campaigns() -> KeysView[mailjet_templates.Id]:
    """Fetch all available campaign IDs."""

    return _CAMPAIGNS.keys()


def get_coaching_campaigns() -> Dict[mailjet_templates.Id, Campaign]:
    """Fetch all coaching campaigns as a dict."""

    return {k: v for k, v in _CAMPAIGNS.items() if v.is_coaching}


def as_template_boolean(truth: Any) -> str:
    """puts truth value of input as 'True' or '' in template vars."""

    return 'True' if truth else ''


def get_status_update_link(user: user_pb2.User) -> str:
    """Make link with token from user ID for RER status update."""

    user_id = user.user_id
    profile = user.profile
    was_employed = any([p.kind == project_pb2.FIND_ANOTHER_JOB for p in user.projects])
    survey_token = parse.quote(auth.create_token(user_id, role='employment-status'))
    return f'{BASE_URL}/statut/mise-a-jour?user={user_id}&token={survey_token}&' \
        f'gender={user_pb2.Gender.Name(profile.gender)}' + \
        f'&hl={parse.quote(scoring.get_user_locale(profile))}' + \
        f'&employed={str(was_employed)}'


# TODO(cyrille): Fix this to account for same mode in different FAPs.
def get_application_modes(rome_id: str, database: mongo.NoPiiMongoDatabase) \
        -> Optional[List[job_pb2.ModePercentage]]:
    """Fetch all possible application modes for all FAP corresponding to the given ROME."""

    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
        return None
    application_modes = job_group_info.application_modes.values()
    fap_modes = [fap_modes.modes for fap_modes in application_modes if fap_modes.modes]
    if not fap_modes:
        return None
    return [mode for modes in fap_modes for mode in modes]


def get_french_months_ago(
        instant: datetime.datetime, *, now: datetime.datetime) -> Optional[str]:
    """Duration in months from given instant to now, in a French phrase.
    If duration is negative, returns None.
    """

    duration_since_instant = now - instant
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
    return f'{BASE_URL}{path}?userId={user_id}&authToken={auth_token}'


def job_search_started_months_ago(
        project: project_pb2.Project, now: datetime.datetime) -> float:
    """Number of months since project started until now. If project has not started, return -1."""

    if project.WhichOneof('job_search_length') != 'job_search_started_at':
        return -1
    delta = now - project.job_search_started_at.ToDatetime()
    return delta.days / 30.5


def get_default_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    """Compute default variables used in all emails: firstName, gender and unsubscribeLink."""

    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    return {
        'baseUrl': BASE_URL,
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        # TODO(cyrille): Put this in an environment variable and/or start creating a server config.
        'productName': 'Bob',
        'unsubscribeLink':
        f'{BASE_URL}/unsubscribe.html?user={parse.quote(user.user_id)}&'
        f'auth={unsubscribe_token}&hl={parse.quote(user.profile.locale)}',
    }


def get_deep_link_advice(user_id: str, project: project_pb2.Project, advice_id: str) -> str:
    """Get a deep link to an advice."""

    if not any(a.advice_id == advice_id for a in project.advices):
        return ''

    return create_logged_url(user_id, f'/projet/{project.project_id}/methode/{advice_id}')


def get_default_coaching_email_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    """Compute default variables used in all coaching emails."""

    settings_token = parse.quote(auth.create_token(user.user_id, role='settings'))
    return dict(get_default_vars(user), **{
        'changeEmailSettingsUrl':
        f'{BASE_URL}/unsubscribe.html?user={parse.quote(user.user_id)}&auth={settings_token}&'
        'coachingEmailFrequency=' +
        user_pb2.EmailFrequency.Name(user.profile.coaching_email_frequency) +
        f'&hl={parse.quote(user.profile.locale)}',
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        # TODO(pascal): Harmonize use of URL suffix (instead of link).
        'statusUpdateUrl': get_status_update_link(user),
    })
