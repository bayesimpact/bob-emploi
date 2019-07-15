"""Module to send emails programmatically through MailJet."""

import logging
import os
import re
import typing

import mailjet_rest
from requests import exceptions
from requests import models
import typing_extensions

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import now

if typing.TYPE_CHECKING:
    import mypy_extensions

    class _MailjetUser(mypy_extensions.TypedDict, total=False):
        Name: str
        Email: str

    _MailjetParsePartHeaderJson = mypy_extensions.TypedDict(  # pylint: disable=invalid-name
        '_MailjetParsePartHeaderJson', {
            'Content-Type': typing.List[str],
            'Content-Transfer-Encoding': typing.List[str],
            'Content-Disposition': typing.List[str],
        }, total=False)

    class _MailjetParsePartJson(mypy_extensions.TypedDict, total=False):
        # Add more attachments if needed.
        ContentRef: typing_extensions.Literal[
            'Html-part', 'Text-part', 'Attachment1', 'Attachment2', 'Attachment3',
        ]
        Headers: _MailjetParsePartHeaderJson

    _MailjetParseJson = mypy_extensions.TypedDict(  # pylint: disable=invalid-name
        '_MailjetParseJson', {
            # Email of sender.
            'Sender': str,
            'Recipient': str,
            'Date': str,
            # Sender in format "Name <Email>".
            'From': str,
            'Subject': str,
            'Headers': typing.Dict[str, typing.Any],
            'Parts': typing.List[_MailjetParsePartJson],
            'Text-part': str,
            'Html-part': str,
            'SpamAssassinScore': str,
            'Attachment1': str,
            'Attachment2': str,
            'Attachment3': str,
            # Add more attachments if needed.
        }, total=False)

    class _MailjetSendAttachementJson(mypy_extensions.TypedDict, total=False):
        ContentType: str
        Filename: str
        Base64Content: str

    _MailjetSendMessageJson = mypy_extensions.TypedDict(  # pylint: disable=invalid-name
        '_MailjetSendMessageJson', {
            # Email of sender.
            'To': typing.List[_MailjetUser],
            'From': _MailjetUser,
            'HTMLPart': typing.Optional[str],
            'Subject': str,
            'TemplateID': int,
            'TemplateLanguage': bool,
            'TextPart': typing.Optional[str],
            'Variables': typing.Dict[str, typing.Any],
            'Attachments': typing.List[_MailjetSendAttachementJson],
        }, total=False)

    class _MailjetSendDataJson(mypy_extensions.TypedDict, total=False):
        Messages: typing.List[_MailjetSendMessageJson]

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
_ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'pascal@bayes.org')


class _Recipient(typing_extensions.Protocol):
    @property
    def email(self) -> str:
        """Email address."""

    @property
    def last_name(self) -> str:
        """Last name."""

    @property
    def name(self) -> str:
        """First name."""


class _Response(typing_extensions.Protocol):
    """This is a partial interface for the requests.models.Response class."""

    @property
    def status_code(self) -> int:
        """The HTTP return code for this response."""

        return 200

    @property
    def text(self) -> str:
        """The body of this HTTP response as a string."""

        return 'OK'

    def json(self) -> typing.Any:  # pylint: disable=invalid-name
        """The body of this HTTP response encoded in JSON, decoded."""

        return {}

    def raise_for_status(self) -> None:
        """Raises an exception if status_code is that of an error."""


class _FakeResponse(typing.NamedTuple):
    status_code: int = 200
    text: str = 'OK'

    def json(self) -> typing.Dict[str, typing.Any]:  # pylint: disable=invalid-name
        """Get JSON encoded data from the body."""

        return {}

    def raise_for_status(self) -> None:
        """Raises an exception if status_code is that of an error."""


def _mailjet_client(version: typing.Optional[str] = None) -> mailjet_rest.Client:
    return mailjet_rest.Client(auth=(_MAILJET_APIKEY_PUBLIC, _MAILJET_SECRET), version=version)


def _make_mailjet_user(user: typing.Union[str, _Recipient]) -> '_MailjetUser':
    if isinstance(user, str):
        match = _NAME_AND_MAIL_REGEXP.match(user)
        if not match:
            raise ValueError(f'Unrecognized Email: "{user}"')
        return {
            'Email': match.group(2),
            'Name': match.group(1),
        }
    recipient: _Recipient = user
    return {
        'Email': recipient.email,
        'Name': f'{recipient.name} {recipient.last_name}',
    }


def send_template(
        template_id: str, recipient: _Recipient, template_vars: typing.Dict[str, typing.Any],
        dry_run: bool = False, other_recipients: typing.Optional[typing.List[_Recipient]] = None,
        sender_email: str = _MAIL_SENDER_EMAIL, sender_name: str = _MAIL_SENDER_NAME,
        campaign_id: typing.Optional[str] = None) -> _Response:
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

    mail_client = _mailjet_client(version='v3.1')
    # TODO(cyrille): Batch messages when sending several.
    all_recipients = [recipient] + (other_recipients or [])
    recipients = [
        _make_mailjet_user(r)
        for r in all_recipients
        if '@' in r.email and not r.email.endswith('@example.com')
    ]
    data = {
        'Messages': [{
            # TODO(cyrille): use integer template_ids and remove cast.
            'TemplateID': int(template_id),
            'TemplateLanguage': True,
            'TemplateErrorReporting': {'Email': _ADMIN_EMAIL},
            'From': {'Email': sender_email, 'Name': sender_name},
            'Variables': template_vars,
            'To': recipients,
        }]
    }
    if campaign_id:
        data['Messages'][0]['CustomCampaign'] = campaign_id
    if dry_run or not recipients:
        logging.info(data)
        return _FakeResponse()
    # TODO(cyrille): Drop the cast if mailjet_rest ever gets typed.
    return typing.cast(models.Response, mail_client.send.create(data=data))


def get_message(message_id: int) -> typing.Optional[typing.Dict[str, typing.Any]]:
    """Get the status of a sent message, using its Mailjet Message ID."""

    mail_client = _mailjet_client()
    mailjet_response = mail_client.message.get(message_id)
    if mailjet_response.status_code == 404:
        return None
    mailjet_response.raise_for_status()
    return next(iter(mailjet_response.json().get('Data', [])), None)


def _get_message_ids(response: _Response) -> typing.Iterator[int]:
    sent_response = response.json()
    for message in sent_response.get('Messages', []):
        for recipient in message.get('To', []):
            if 'MessageID' in recipient:
                yield typing.cast(int, recipient['MessageID'])


def _create_email_sent_proto(message_id: int) -> user_pb2.EmailSent:
    email_sent = user_pb2.EmailSent()
    email_sent.sent_at.FromDatetime(now.get())
    email_sent.sent_at.nanos = 0
    email_sent.mailjet_message_id = message_id
    return email_sent


def create_email_sent_proto(response: _Response) -> typing.Optional[user_pb2.EmailSent]:
    """Create an EmailSent proto from a MailJet response for the first recipient."""

    message_id = next(_get_message_ids(response), 0)
    if not message_id:
        return None

    return _create_email_sent_proto(message_id)


def create_email_sent_protos(response: _Response) \
        -> typing.Iterator[user_pb2.EmailSent]:
    """Create an EmailSent proto for each recipient of an email from a MailJet response."""

    for message_id in _get_message_ids(response):
        yield _create_email_sent_proto(message_id)


def send_direct_email(
        recipient: _Recipient, email_data: '_MailjetParseJson',
        subject: typing.Optional[str] = None) -> models.Response:
    """Send an email for which we already have the content to a specific recipient.

    Original sender is kept, so it must be a validated email address in MailJet.
    """

    mail_client = _mailjet_client(version='v3.1')
    attachments: typing.List['_MailjetSendAttachementJson'] = []
    for part in email_data.get('Parts', []):
        ref = part.get('ContentRef')
        if not ref or not ref.startswith('Attachment'):
            continue
        headers = part.get('Headers', {})
        filename_match = next((
            _FILENAME_DISPOSITION_REGEX.search(dispo)
            for dispo in iter(headers.get('Content-Disposition', []))
            if dispo.startswith('attachment')), None)
        filename = filename_match.group(1) if filename_match else ''
        attachments.append({
            'Base64Content': email_data.get(ref, ''),
            'ContentType': headers.get('Content-Type', [''])[0].split(';', 1)[0],
            'Filename': filename,
        })
    data: _MailjetSendDataJson = {'Messages': [{
        'Attachments': attachments,
        'From': _make_mailjet_user(email_data.get('From', '')),
        'HTMLPart': email_data.get('Html-part'),
        'Subject': subject or email_data.get('Subject', ''),
        'TextPart': email_data.get('Text-part'),
        'To': [_make_mailjet_user(recipient)],
    }]}
    return typing.cast(models.Response, mail_client.send.create(data=data))


def mailer_daemon(
        error_message: str, email_data: '_MailjetParseJson',
        user_id: typing.Optional[str] = None) -> models.Response:
    """Send an email back to the original sender of a Mailjet Parse API email,
    saying there has been an error."""

    data: _MailjetSendDataJson = {'Messages': [{
        'From': {'Name': 'Mail Delivery Subsystem', 'Email': 'mailer-daemon@bob-emploi.fr'},
        'To': [_make_mailjet_user(email_data.get('From', ''))],
        'TemplateID': 896724,
        'TemplateLanguage': True,
        'Variables': {
            'additionalContent': error_message,
            'originalHtml': email_data.get('Html-part', ''),
            'originalSubject': email_data.get('Subject', ''),
            'quotedOriginalText': '> ' + '\n> '.join(email_data.get('Text-part', '').split('\n')),
            'userId': user_id or '',
        },
    }]}
    response = typing.cast(models.Response, _mailjet_client(version='v3.1').send.create(data=data))
    try:
        response.raise_for_status()
    except exceptions.HTTPError:
        logging.error('Mailjet response %s with message:\n%s', response.status_code, response.text)
    return response
