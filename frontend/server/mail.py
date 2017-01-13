"""Module to send emails programmatically through MailJet."""
import collections
import logging
import os

import mailjet_rest

_MAILJET_APIKEY_PUBLIC = os.getenv('MAILJET_APIKEY_PUBLIC', 'f53ee2bc432e531d209aa686e3a725e1')
# See https://app.mailjet.com/account/api_keys
_MAILJET_SECRET = os.getenv('MAILJET_SECRET', 'dev-mailjet-private-key')
_MAIL_SENDER_EMAIL = 'bob@bob-emploi.fr'
_MAIL_SENDER_NAME = 'Bob Emploi'

# List of email addresses of admins to send service emails.
_ADMIN_EMAILS = os.getenv('ADMIN_EMAILS', 'Pascal Corpet <pascal@bayes.org>')

_FakeResponse = collections.namedtuple('FakeResponse', [
    'status_code', 'raise_for_status', 'text'])


def _mailjet_client():
    return mailjet_rest.Client(auth=(_MAILJET_APIKEY_PUBLIC, _MAILJET_SECRET))


def count_sent_to(email):
    """Count number of emails sent to a given user.

    Args:
        email: the user's email.
    Returns:
        a dict with counts: DeliveredCount, OpenedCount, ClickedCount.
        See full doc at https://dev.mailjet.com/email-api/v3/contactstatistics
    """
    mail_client = _mailjet_client()
    result = mail_client.contactstatistics.get(email)
    if result.status_code == 404:
        return collections.defaultdict(int)
    result.raise_for_status()
    return result.json()['Data'][0]


def send_template(template_id, recipient, template_vars, dry_run=False):
    """Send an email using a template.

    Args:
        template_id: the ID of the template in MailJet, see
            https://app.mailjet.com/templates/transactional.
        recipient: a UserProfile proto defining the email recipient.
        vars: a dict of keywords vars to use in the template.
        dry_run: if True, emails are sent to the admins, not to the recipient.
    """
    mail_client = _mailjet_client()
    data = {
        'MJ-TemplateID': template_id,
        'MJ-TemplateLanguage': True,
        'MJ-TemplateErrorReporting': _ADMIN_EMAILS,
        'FromEmail': _MAIL_SENDER_EMAIL,
        'FromName': _MAIL_SENDER_NAME,
        'Vars': template_vars,
        'Recipients': [{
            'Email': recipient.email,
            'Name': '%s %s' % (recipient.name, recipient.last_name),
        }],
    }
    if dry_run:
        logging.info(data)
        return _FakeResponse(status_code=200, raise_for_status=lambda: None, text='OK')
    return mail_client.send.create(data=data)


def send_template_to_admins(template_id, template_vars):
    """Send an email to admins using a template.

    Args:
        template_id: the ID of the template in MailJet, see
            https://app.mailjet.com/templates/transactional.
        recipient: a UserProfile proto defining the email recipient.
        vars: a dict of keywords vars to use in the template.
    """
    if not _ADMIN_EMAILS:
        return
    mail_client = _mailjet_client()
    return mail_client.send.create(data={
        'MJ-TemplateID': template_id,
        'MJ-TemplateLanguage': True,
        'MJ-TemplateErrorReporting': _ADMIN_EMAILS,
        'FromEmail': _MAIL_SENDER_EMAIL,
        'FromName': _MAIL_SENDER_NAME,
        'Vars': template_vars,
        'To': _ADMIN_EMAILS,
    })
