"""Helper for the mail campaign modules."""

import contextlib
import datetime
import functools
import json
import locale
import logging
from os import path as os_path
import typing
from typing import Any, Callable, KeysView, Iterator, Literal, Mapping, Optional, Union
from urllib import parse

from bson import objectid
import pymongo
from google.protobuf import json_format

from bob_emploi.common.python import mustache
from bob_emploi.common.python import proto as common_proto
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import product
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail.templates import mailjet_templates


class _EmailSendHistory(typing.Protocol):
    def add(self) -> email_pb2.EmailSent:  # pylint: disable=invalid-name
        """Add a new email to the history."""


class _BaseUser(typing.Protocol):
    @property
    def emails_sent(self) -> _EmailSendHistory:
        """List of emails sent to the user."""


_UserProto = typing.TypeVar('_UserProto', bound=_BaseUser, contravariant=True)

if typing.TYPE_CHECKING:
    class _Profile(typing.Protocol):
        email: str

        @property
        def name(self) -> str:
            """First name."""

        @property
        def last_name(self) -> str:
            """Last name."""

    class _GetVarsFuncType(typing.Protocol[_UserProto]):

        def __call__(
            self, user: _UserProto, /, *,
            database: mongo.NoPiiMongoDatabase,
            now: datetime.datetime,
        ) -> dict[str, Any]:
            ...

    class _OnEmailSentFuncType(typing.Protocol[_UserProto]):

        def __call__(
            self, user: _UserProto, /, *,
            email_sent: email_pb2.EmailSent, template_vars: dict[str, Any],
            database: mongo.NoPiiMongoDatabase, users_database: mongo.UsersDatabase,
        ) -> None:
            ...

    Action = Literal['dry-run', 'ghost', 'list', 'send']
    NoGhostAction = Literal['dry-run', 'list', 'send']


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
    with open(headers_path, 'r', encoding='utf-8') as headers_file:
        headers = json.load(headers_file)
    return typing.cast(str, headers.get('Subject'))


@contextlib.contextmanager
def set_time_locale(new_locale: Optional[str]) -> Iterator[None]:
    """Context manager to set a locale for LC_TIME."""

    previous_locale = locale.getlocale(locale.LC_TIME)
    try:
        if new_locale:
            locale.setlocale(locale.LC_TIME, new_locale)
        yield
    finally:
        if new_locale:
            locale.setlocale(locale.LC_TIME, previous_locale)


_LOCALE_MAP = {
    'en': 'en_US.UTF-8',
    'en_UK': 'en_GB.UTF-8',
    'fr': 'fr_FR.UTF-8',
    'fr@tu': 'fr_FR.UTF-8',
}


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
            self, campaign_id: mailjet_templates.Id, *,
            get_vars: '_GetVarsFuncType[user_pb2.User]',
            sender_name: str, sender_email: str,
            mongo_filters: Optional[Mapping[str, Any]] = None,
            get_mongo_filters: Optional[Callable[[], Optional[Mapping[str, Any]]]] = None,
            is_coaching: bool = False,
            is_big_focus: bool = False) -> None:
        self._campaign_id = campaign_id
        self._mongo_filters = mongo_filters
        self._get_mongo_filters = get_mongo_filters
        self._get_vars = get_vars
        self._sender_name = sender_name
        self._sender_email = sender_email
        self._is_coaching = is_coaching
        self._is_big_focus = is_big_focus

    id = property(lambda self: self._campaign_id)
    is_coaching = property(lambda self: self._is_coaching)
    is_big_focus = property(lambda self: self._is_big_focus)

    @property
    def mongo_filters(self) -> Optional[Mapping[str, Any]]:
        """A filter on the MongoDB table for users, to select those that may receive this campaign.
        """

        static_filters = self._mongo_filters
        dynamic_filters = self._get_mongo_filters() if self._get_mongo_filters else None

        if not static_filters or not dynamic_filters:
            return static_filters or dynamic_filters
        return dict(static_filters) | dynamic_filters

    def get_vars(
            self, user: user_pb2.User, /, *, should_log_errors: bool = False,
            database: mongo.NoPiiMongoDatabase, now: datetime.datetime) -> Optional[dict[str, str]]:
        """Get template variables for the given user."""

        try:
            template_vars = self._get_vars(user, database=database, now=now)
        except (scoring.NotEnoughDataException, DoNotSend) as error:
            if should_log_errors:
                logging.error(error)
            return None
        try:
            i18n_sender_name = i18n.translate_string(self._sender_name, user.profile.locale)
        except i18n.TranslationMissingException:
            i18n_sender_name = self._sender_name

        if '{' in i18n_sender_name:
            i18n_sender_name = mustache.instantiate(i18n_sender_name, template_vars)
        return {'senderName': i18n_sender_name} | template_vars

    @typing.overload
    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: mongo.UsersDatabase,
            eval_database: mongo.NoPiiMongoDatabase,
            now: datetime.datetime,
            action: Literal['send'],
            dry_run_email: None = None,
            mongo_user_update: Optional[dict[str, Any]] = None,
            should_log_errors: bool = False) \
            -> Union[Literal[False], email_pb2.EmailSent]:
        ...

    @typing.overload
    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: None = None,
            eval_database: None = None,
            now: datetime.datetime,
            action: Literal['ghost', 'list'],
            dry_run_email: None = None,
            mongo_user_update: Optional[dict[str, Any]] = None,
            should_log_errors: bool = False) -> Union[bool, email_pb2.EmailSent]:
        ...

    @typing.overload
    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: Optional[mongo.UsersDatabase] = None,
            eval_database: Optional[mongo.NoPiiMongoDatabase] = None,
            now: datetime.datetime,
            action: 'Action' = 'dry-run',
            dry_run_email: Optional[str] = None,
            mongo_user_update: Optional[dict[str, Any]] = None,
            should_log_errors: bool = False) -> Union[bool, email_pb2.EmailSent]:
        ...

    def send_mail(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            users_database: Optional[mongo.UsersDatabase] = None,
            eval_database: Optional[mongo.NoPiiMongoDatabase] = None,
            now: datetime.datetime,
            action: 'Action' = 'dry-run',
            dry_run_email: Optional[str] = None,
            mongo_user_update: Optional[dict[str, Any]] = None,
            should_log_errors: bool = False) -> Union[bool, email_pb2.EmailSent]:
        """Send an email for this campaign."""

        with set_time_locale(_LOCALE_MAP.get(user.profile.locale or 'fr')):
            template_vars = self.get_vars(
                user, should_log_errors=should_log_errors, database=database, now=now)
        if not template_vars:
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

        if action == 'ghost':
            email_sent = user.emails_sent.add()
            common_proto.set_date_now(email_sent.sent_at, now)
        else:
            res = mail_send.send_template(
                self.id, user_profile, template_vars,
                sender_email=self._sender_email, sender_name=template_vars['senderName'])
            logging.info(
                'Email sent to %s',
                user_profile.email if action == 'dry-run'
                else user.user_id)

            res.raise_for_status()

            maybe_email_sent = mail_send.create_email_sent_proto(res)
            if not maybe_email_sent:
                logging.warning(
                    'Impossible to retrieve the sent email ID:\n'
                    'Response (%d):\n%s\nUser: %s\nCampaign: %s',
                    res.status_code, res.json(), user.user_id, self.id)
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
        if not user_id or action == 'ghost' or not users_database:
            return email_sent

        users_database.user.update_one(
            {'_id': objectid.ObjectId(user_id)},
            (mongo_user_update or {}) | {'$push': {
                'emailsSent': json_format.MessageToDict(email_sent),
            }})
        if eval_database:
            try:
                eval_database.sent_emails.update_one(
                    {'_id': self.id},
                    {'$set': {'lastSent': proto.datetime_to_json_string(now)}},
                    upsert=True)
            except pymongo.errors.OperationFailure:
                # We ignore this error silently: it's probably due to the base not being writeable
                # (which is the case in our demo servers). And the whole purpose of this update is
                # to update the monitoring info: if it fails, then the human being checking the
                # monitoring data will be warned that something is wrong as the data wasn't updated.
                pass
        return email_sent

    def get_content(
            self, user: user_pb2.User, *,
            database: mongo.NoPiiMongoDatabase,
            now: datetime.datetime) -> Optional[str]:
        """Get the HTML content of an email without sending it."""

        template_vars = self.get_vars(user, database=database, now=now)
        if template_vars is None:
            return None

        html_template = mail_send.get_html_template(self.id, user.profile.locale)
        if not html_template:
            return None
        return mustache.instantiate(html_template, template_vars)

    def get_as_fake_email(
        self, user: user_pb2.User, *,
        database: mongo.NoPiiMongoDatabase,
        now: datetime.datetime,
    ) -> Optional[email_pb2.EmailSent]:
        """Get the campaign as fake email without sending it."""

        template_vars = self.get_vars(user, database=database, now=now)
        if template_vars is None:
            return None

        campaign_subject = get_campaign_subject(self.id)
        try:
            i18n_campaign_subject = i18n.translate_string(campaign_subject, user.profile.locale)
        except i18n.TranslationMissingException:
            i18n_campaign_subject = campaign_subject

        return email_pb2.EmailSent(
            subject=mustache.instantiate(i18n_campaign_subject, template_vars),
            mailjet_template=str(mailjet_templates.MAP[self.id]['mailjetTemplate']),
            campaign_id=self.id,
            is_coaching=self.is_coaching,
        )

    def get_sent_campaign_url(self) -> Optional[str]:
        """Gets the URL of the corresponding sent campaign on Mailjet.

        Returns None if the campaign was never sent."""

        mailjet_campaign_id = mail_send.get_mailjet_sent_campaign_id(self.id)
        if not mailjet_campaign_id:
            return None
        return f'https://app.mailjet.com/stats/campaigns/{mailjet_campaign_id}/overview'


_CAMPAIGNS: dict[mailjet_templates.Id, Campaign] = {}


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


def get_coaching_campaigns() -> dict[mailjet_templates.Id, Campaign]:
    """Fetch all coaching campaigns as a dict."""

    return {k: v for k, v in _CAMPAIGNS.items() if v.is_coaching}


def as_template_boolean(truth: Any) -> str:
    """puts truth value of input as 'True' or '' in template vars."""

    return 'True' if truth else ''


def get_bob_link(path: str = '', params: Optional[Mapping[str, str]] = None) -> str:
    """Make a link to Bob, with the given path and params."""

    query = '' if not params else f'?{parse.urlencode(params)}'
    return f'{parse.urljoin(product.bob.base_url, path)}{query}'


def get_status_update_link(user: user_pb2.User) -> str:
    """Make link with token from user ID for RER status update."""

    user_id = user.user_id
    profile = user.profile
    was_employed = any([p.kind == project_pb2.FIND_ANOTHER_JOB for p in user.projects])
    return get_bob_link('statut/mise-a-jour', {
        'employed': str(was_employed),
        'gender': user_profile_pb2.Gender.Name(profile.gender),
        'hl': profile.locale or 'fr',
        'token': auth_token.create_token(user_id, role='employment-status'),
        'user': user_id,
    })


def create_logged_url(user_id: str, path: str = '') -> str:
    """Returns a route with given path and necessary query parameters for authentication."""

    return auth_token.create_logged_url(user_id, path=path)


def job_search_started_months_ago(
        project: project_pb2.Project, now: datetime.datetime) -> float:
    """Number of months since project started until now. If project has not started, return -1."""

    if project.WhichOneof('job_search_length') != 'job_search_started_at':
        return -1
    delta = now - project.job_search_started_at.ToDatetime()
    return delta.days / 30.5


def get_default_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    """Compute default variables used in all emails: firstName, gender and unsubscribeLink."""

    return {
        'areEmailsAnswerRead': product.bob.are_email_answers_read,
        'baseUrl': product.bob.base_url,
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_profile_pb2.Gender.Name(user.profile.gender),
        'highlightColor': product.bob.get_config('highlightColor', '#faf453'),
        'productLogoUrl': product.bob.get_config(
            'productLogoUrl', 'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1.png'),
        'productName': product.bob.name,
        'unsubscribeLink': get_bob_link('unsubscribe.html', {
            'auth': auth_token.create_token(user.profile.email, role='unsubscribe'),
            'hl': user.profile.locale,
            'user': user.user_id,
        }),
    }


def get_deep_link_advice(user_id: str, project: project_pb2.Project, advice_id: str) -> str:
    """Get a deep link to an advice."""

    if not any(a.advice_id == advice_id for a in project.advices):
        return ''

    return create_logged_url(user_id, f'/projet/{project.project_id}/methode/{advice_id}')


def get_default_coaching_email_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    """Compute default variables used in all coaching emails."""

    return get_default_vars(user) | {
        'changeEmailSettingsUrl': get_bob_link('unsubscribe.html', {
            'auth': auth_token.create_token(user.user_id, role='settings'),
            'coachingEmailFrequency':
            email_pb2.EmailFrequency.Name(user.profile.coaching_email_frequency),
            'hl': user.profile.locale,
            'user': user.user_id,
        }),
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_profile_pb2.Gender.Name(user.profile.gender),
        # TODO(pascal): Harmonize use of URL suffix (instead of link).
        'statusUpdateUrl': get_status_update_link(user),
    }
