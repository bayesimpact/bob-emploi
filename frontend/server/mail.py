"""Module to send emails programmatically through MailJet."""

import collections
import logging
import os
import re

import mailjet_rest

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import now

_MAILJET_APIKEY_PUBLIC = os.getenv('MAILJET_APIKEY_PUBLIC', 'f53ee2bc432e531d209aa686e3a725e1')
# See https://app.mailjet.com/account/api_keys
_MAILJET_SECRET = os.getenv('MAILJET_SECRET', 'dev-mailjet-private-key')
_MAIL_SENDER_EMAIL = 'bob@bob-emploi.fr'
_MAIL_SENDER_NAME = 'Bob'

_NAME_AND_MAIL_REGEXP = re.compile(r'(.*?)\s*<(.*)>')


# Email of admin to send service emails.
_ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'pascal@bayes.org')


_FakeResponse = collections.namedtuple('FakeResponse', [
    'status_code', 'raise_for_status', 'text'])


def _mailjet_client(version=None):
    return mailjet_rest.Client(auth=(_MAILJET_APIKEY_PUBLIC, _MAILJET_SECRET), version=version)


def _make_mailjet_recipient(recipient):
    return {
        'Email': recipient.email,
        'Name': '{} {}'.format(recipient.name, recipient.last_name),
    }


def send_template(
        template_id, recipient, template_vars, dry_run=False, other_recipients=None,
        sender_email=_MAIL_SENDER_EMAIL, sender_name=_MAIL_SENDER_NAME,
        campaign_id=None):
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
    recipients = [_make_mailjet_recipient(recipient)]
    if other_recipients:
        recipients.extend(_make_mailjet_recipient(r) for r in other_recipients)
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
    if dry_run:
        logging.info(data)
        return _FakeResponse(status_code=200, raise_for_status=lambda: None, text='OK')
    return mail_client.send.create(data=data)


def get_message(message_id):
    """Get the status of a sent message, using its Mailjet Message ID."""

    mail_client = _mailjet_client()
    mailjet_response = mail_client.message.get(message_id)
    mailjet_response.raise_for_status()
    return next(iter(mailjet_response.json().get('Data', [])), None)


def _get_message_ids(response):
    sent_response = response.json()
    for message in sent_response.get('Messages', []):
        for recipient in message.get('To', []):
            if 'MessageID' in recipient:
                yield recipient['MessageID']


def _create_email_sent_proto(message_id):
    email_sent = user_pb2.EmailSent()
    email_sent.sent_at.FromDatetime(now.get())
    email_sent.sent_at.nanos = 0
    email_sent.mailjet_message_id = message_id
    return email_sent


def create_email_sent_proto(response):
    """Create an EmailSent proto from a MailJet response for the first recipient."""

    message_id = next(_get_message_ids(response), 0)
    if not message_id:
        return None

    return _create_email_sent_proto(message_id)


# TODO(cyrille): Add tests.
def create_email_sent_protos(response):
    """Create an EmailSent proto for each recipient of an email from a MailJet response."""

    for message_id in _get_message_ids(response):
        yield _create_email_sent_proto(message_id)
