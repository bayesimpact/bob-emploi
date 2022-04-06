"""Module to send emails programmatically through MailJet."""

from collections import abc
import logging
import os
import re
import typing
from typing import Any, Iterable, Iterator, Literal, Mapping, Optional, TypedDict, Union

from google.protobuf import json_format
import mailjet_rest
from requests import exceptions
from requests import models

from bob_emploi.common.python import proto
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import mailjet_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server.mail.templates import mailjet_templates

if typing.TYPE_CHECKING:
    class _MailjetUser(TypedDict, total=False):
        Name: str
        Email: str

    class _MailjetSendAttachmentJson(TypedDict, total=False):
        ContentType: str
        Filename: str
        Base64Content: str

    _MailjetSendMessageJson = TypedDict(
        '_MailjetSendMessageJson', {
            # Email of sender.
            'To': list[_MailjetUser],
            'From': _MailjetUser,
            'HTMLPart': Optional[str],
            'Subject': str,
            'TemplateID': int,
            'TemplateLanguage': bool,
            'TemplateErrorReporting': _MailjetUser,
            'CustomCampaign': str,
            'TrackOpens': Literal['account_default', 'disabled', 'enabled'],
            'TrackClicks': Literal['account_default', 'disabled', 'enabled'],
            'TextPart': Optional[str],
            'Variables': Mapping[str, Any],
            'Attachments': list[_MailjetSendAttachmentJson],
        }, total=False)

    class _MailjetSendDataJson(TypedDict, total=False):
        Messages: list[_MailjetSendMessageJson]

    class _Recipient(typing.Protocol):
        @property
        def email(self) -> str:
            """Email address."""

        @property
        def last_name(self) -> str:
            """Last name."""

        @property
        def name(self) -> str:
            """First name."""

        @property
        def locale(self) -> str:
            """Locale."""

    class _Response(typing.Protocol):
        """This is a partial interface for the requests.models.Response class."""

        @property
        def status_code(self) -> int:
            """The HTTP return code for this response."""

            return 200

        @property
        def text(self) -> str:
            """The body of this HTTP response as a string."""

            return 'OK'

        def json(self) -> Any:  # pylint: disable=invalid-name
            """The body of this HTTP response encoded in JSON, decoded."""

            return {}

        def raise_for_status(self) -> None:
            """Raises an exception if status_code is that of an error."""


_MAILJET_APIKEY_PUBLIC = os.getenv('MAILJET_APIKEY_PUBLIC', 'f53ee2bc432e531d209aa686e3a725e1')
# See https://app.mailjet.com/account/api_keys
_MAILJET_SECRET = os.getenv('MAILJET_SECRET', 'dev-mailjet-private-key')
_MAIL_SENDER_EMAIL = 'bob@bob-emploi.fr'
_MAIL_SENDER_NAME = 'Bob'

_NAME_AND_MAIL_REGEXP = re.compile(r'(.*?)\s*<(.*)>')

# Capture filename from SMTP Content-Disposition header. Could be one of:
# filename=foobar.txt
# filename="foo bar.txt"
# filename="foo \"bar\".txt"
_FILENAME_DISPOSITION_REGEX = re.compile(r'filename=("(?:\\"|[^"])+"|[^ ]+)')

# Email of admin to send service emails.
# By default this is pinging Bayes Impact #bob-bugs channel.
# TODO(cyrille): Create and use a Google groups email address here.
_ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'bob-bugs-aaaaatnpsefcluioi5jfvhjvee@bayesimpact.slack.com')

# Mailjet statuses for which we consider that the mail has been read/opened.
READ_EMAIL_STATUSES = frozenset([
    email_pb2.EMAIL_SENT_OPENED, email_pb2.EMAIL_SENT_CLICKED])
READ_EMAIL_STATUS_STRINGS = frozenset(
    email_pb2.EmailSentStatus.Name(status)
    for status in READ_EMAIL_STATUSES
)


class _FakeResponse:

    def __init__(self, recipients: list[Any]) -> None:
        self.status_code = 200
        self.text = 'OK'
        self._recipients = recipients

    def json(self) -> dict[str, Any]:  # pylint: disable=invalid-name
        """Get JSON encoded data from the body."""

        return {'Messages': [{'To': [{'MessageID': 0} for r in self._recipients]}]}

    def raise_for_status(self) -> None:
        """Raises an exception if status_code is that of an error."""


def _mailjet_client(version: Optional[str] = None) -> mailjet_rest.Client:
    return mailjet_rest.Client(auth=(_MAILJET_APIKEY_PUBLIC, _MAILJET_SECRET), version=version)


def _make_mailjet_user(user: Union[str, '_Recipient']) -> '_MailjetUser':
    if isinstance(user, str):
        match = _NAME_AND_MAIL_REGEXP.match(user)
        if not match:
            raise ValueError(f'Unrecognized Email: "{user}"')
        return {
            'Email': match.group(2),
            'Name': match.group(1),
        }
    recipient: '_Recipient' = user
    name: str
    if recipient.name:
        if recipient.last_name:
            name = f'{recipient.name} {recipient.last_name}'
        else:
            name = recipient.name
    else:
        name = recipient.last_name
    return {
        'Email': recipient.email,
        'Name': name,
    }


def _get_mailjet_id(campaign_id: mailjet_templates.Id, locale: str = '') -> int:
    campaign_templates = mailjet_templates.MAP[campaign_id]
    if not locale or locale == 'fr' or campaign_templates.get('noI18n'):
        return campaign_templates['mailjetTemplate']

    for try_locale in i18n.iterate_on_fallback_locales(locale):
        try:
            return campaign_templates['i18n'][try_locale]
        except KeyError:
            pass

    logging.warning(
        'Missing a translation in "%s" for mailing campaign "%s".', locale, campaign_id)
    return campaign_templates['mailjetTemplate']


def _check_not_null_variable(
        json_variable: Union[None, Iterable[Any], Mapping[str, Any]]) -> None:
    if json_variable is None:
        raise ValueError('null is not an acceptable value.')
    if isinstance(json_variable, abc.Mapping):
        for element in json_variable.values():
            _check_not_null_variable(element)
    if isinstance(json_variable, abc.Iterable):
        for element in json_variable:
            if element != json_variable:
                _check_not_null_variable(element)


def send_template(
        campaign_id: mailjet_templates.Id, recipient: '_Recipient',
        template_vars: Mapping[str, Any],
        dry_run: bool = False, other_recipients: Optional[Iterable['_Recipient']] = None,
        sender_email: str = _MAIL_SENDER_EMAIL,
        sender_name: str = _MAIL_SENDER_NAME,
        template_id: Optional[int] = None,
        *, options: Optional['_MailjetSendMessageJson'] = None) -> '_Response':
    """Send an email using a template.

    Args:
        template_id: the ID of the template in MailJet, see
            https://app.mailjet.com/templates/transactional.
        recipient: a UserProfile proto defining the email recipient.
        vars: a dict of keywords vars to use in the template.
        dry_run: if True, emails are sent to the admins, not to the recipient.
        campaign_id: messages sent through send_template can be regrouped into
            campaigns to simulate the behavior of a regular marketing campaign.
            This could help you pulling advanced statistics of your transaction
            campaigns.

    Returns:
        See the format of the response at
        https://dev.mailjet.com/guides/?python#sending-a-basic-email
    """

    _check_not_null_variable(template_vars)
    if 'senderName' not in template_vars:
        template_vars = template_vars | {'senderName': sender_name}
    mail_client = _mailjet_client(version='v3.1')
    # TODO(cyrille): Batch messages when sending several.
    all_recipients = [recipient] + list(other_recipients or [])
    recipients = [
        _make_mailjet_user(r)
        for r in all_recipients
        if '@' in r.email and not r.email.endswith('@example.com')
    ]

    # TODO(cyrille): Update locale depending on other recipients.
    template_id = template_id or _get_mailjet_id(campaign_id, recipient.locale)
    data: _MailjetSendDataJson = {
        'Messages': [{
            'TemplateID': template_id,
            'TemplateLanguage': True,
            'TemplateErrorReporting': {'Email': _ADMIN_EMAIL},
            'From': {'Email': sender_email, 'Name': sender_name},
            'Variables': template_vars,
            'To': recipients,
        }],
    }
    if options:
        data['Messages'][0].update(options)
    if campaign_id:
        data['Messages'][0]['CustomCampaign'] = campaign_id
    if dry_run or not recipients:
        logging.info(data)
        return _FakeResponse(all_recipients)
    # TODO(cyrille): Drop the cast if mailjet_rest ever gets typed.
    return typing.cast(models.Response, mail_client.send.create(data=data))


def get_message(message_id: int) -> Optional[dict[str, Any]]:
    """Get the status of a sent message, using its Mailjet Message ID."""

    mail_client = _mailjet_client()
    mailjet_response = mail_client.message.get(message_id)
    if mailjet_response.status_code == 404:
        return None
    mailjet_response.raise_for_status()
    return next(iter(mailjet_response.json().get('Data', [])), None)


def _get_message_ids(response: '_Response') -> Iterator[int]:
    sent_response = response.json()
    for message in sent_response.get('Messages', []):
        for recipient in message.get('To', []):
            if 'MessageID' in recipient:
                yield typing.cast(int, recipient['MessageID'])


def _create_email_sent_proto(message_id: int) -> email_pb2.EmailSent:
    email_sent = email_pb2.EmailSent()
    proto.set_date_now(email_sent.sent_at)
    email_sent.mailjet_message_id = message_id
    return email_sent


def create_email_sent_proto(response: '_Response') -> Optional[email_pb2.EmailSent]:
    """Create an EmailSent proto from a MailJet response for the first recipient."""

    try:
        message_id = next(_get_message_ids(response))
    except StopIteration:
        return None

    return _create_email_sent_proto(message_id)


def create_email_sent_protos(response: '_Response') \
        -> Iterator[email_pb2.EmailSent]:
    """Create an EmailSent proto for each recipient of an email from a MailJet response."""

    for message_id in _get_message_ids(response):
        yield _create_email_sent_proto(message_id)


def send_direct_email(
        recipient: '_Recipient', email_data: mailjet_pb2.Parse,
        subject: Optional[str] = None) -> models.Response:
    """Send an email for which we already have the content to a specific recipient.

    Original sender is kept, so it must be a validated email address in MailJet.
    """

    mail_client = _mailjet_client(version='v3.1')
    attachments: list['_MailjetSendAttachmentJson'] = []
    for part in email_data.parts:
        ref = part.content_ref
        if not ref or not ref.startswith('Attachment'):
            continue
        headers = part.headers
        filename_match = next((
            _FILENAME_DISPOSITION_REGEX.search(dispo)
            for dispo in headers.content_disposition
            if dispo.startswith('attachment')), None)
        filename = filename_match.group(1) if filename_match else ''
        attachment_ref = '_'.join(ref.split('-')).lower()
        attachments.append({
            'Base64Content': getattr(email_data, attachment_ref),
            'ContentType': (headers.content_type or [''])[0].split(';', 1)[0],
            'Filename': filename,
        })
    # TODO(cyrille): Strip HTMLPart of #-starting lines too.
    text_part = '\n'.join(
        line for line in email_data.text_part.split('\n')
        if not line.strip().startswith('#')) or None
    data: _MailjetSendDataJson = {'Messages': [{
        'Attachments': attachments,
        'From': _make_mailjet_user(email_data.full_sender),
        'HTMLPart': email_data.html_part or None,
        'Subject': subject or email_data.subject,
        'TextPart': text_part,
        'To': [_make_mailjet_user(recipient)],
    }]}
    return typing.cast(models.Response, mail_client.send.create(data=data))


def mailer_daemon(
        error_message: str, email_data: mailjet_pb2.Parse,
        user_id: Optional[str] = None) -> models.Response:
    """Send an email back to the original sender of a Mailjet Parse API email,
    saying there has been an error."""

    data: _MailjetSendDataJson = {'Messages': [{
        'From': {'Name': 'Mail Delivery Subsystem', 'Email': 'mailer-daemon@bob-emploi.fr'},
        'To': [_make_mailjet_user(email_data.full_sender)],
        'TemplateID': 896724,
        'TemplateLanguage': True,
        'Variables': {
            'additionalContent': error_message,
            'originalHtml': email_data.html_part,
            'originalSubject': email_data.subject,
            'quotedOriginalText': '> ' + '\n> '.join(email_data.text_part.split('\n')),
            'userId': user_id or '',
        },
    }]}
    response = typing.cast(models.Response, _mailjet_client(version='v3.1').send.create(data=data))
    try:
        response.raise_for_status()
    except exceptions.HTTPError:
        logging.error('Mailjet response %s with message:\n%s', response.status_code, response.text)
    return response


def get_html_template(campaign_id: mailjet_templates.Id, locale: str) -> Optional[str]:
    """Retrieves the HTML template of an email.

    Note that this HTML body might contain mustache-like logic."""

    template_id = _get_mailjet_id(campaign_id, locale)
    client = _mailjet_client()
    response = typing.cast(models.Response, client.template_detailcontent.get(id=template_id))

    if response.status_code == 404:
        return None
    response.raise_for_status()
    detail_contents = mailjet_pb2.TemplateDetailContents()
    json_format.ParseDict(response.json(), detail_contents, ignore_unknown_fields=True)
    return detail_contents.data[0].html_part


def get_mailjet_sent_campaign_id(campaign_id: mailjet_templates.Id) -> Optional[int]:
    """Retrieves the Sent Campaign ID of one of our campaign.

    This can be used to find the Mailjet page with stats, e.g.
    https://app.mailjet.com/stats/campaigns/7693941302/overview
    """

    client = _mailjet_client()
    response = typing.cast(models.Response, client.campaign.get(
        filters={'CustomCampaign': campaign_id}))

    if response.status_code == 404:
        return None
    response.raise_for_status()
    sent_campaigns = mailjet_pb2.SentCampaigns()
    json_format.ParseDict(response.json(), sent_campaigns, ignore_unknown_fields=True)
    if not sent_campaigns.data or len(sent_campaigns.data) > 1:
        return None
    return sent_campaigns.data[0].campaign_id
