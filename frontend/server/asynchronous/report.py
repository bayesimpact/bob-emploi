"""Usefull functions to share among asynchronous script to send reports."""

import logging
import os

import raven
from raven import conf as raven_conf
from raven.handlers import logging as raven_logging
import requests

from bob_emploi.frontend.server import mail

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

# ID of the email template in MailJet to report the final count of the blast. See
# https://app.mailjet.com/tempate/74071/build
_MAILJET_REPORT_TEMPLATE_ID = '74071'


def notify_slack(message):
    """Send a message on slack channel #bob-bot as Bob the mailman."""

    if _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={'text': message})


def send_to_admins(blast_name, count, errors):
    """Send a blast campaign report by mail to admins. Admins are defined in ADMIN_EMAILS
    environment variable."""

    result = mail.send_template_to_admins(
        _MAILJET_REPORT_TEMPLATE_ID,
        {'count': count, 'errors': errors or ['No errors'], 'weekday': blast_name},
    )
    if result.status_code != 200:
        logging.error('Error while sending the report: %d', result.status_code)


def setup_sentry_logging(sentry_dsn):
    """Set up logging with sentry."""

    logging.basicConfig()
    if not sentry_dsn:
        raise ValueError()
    client = raven.Client(sentry_dsn)
    handler = raven_logging.SentryHandler(client)
    handler.setLevel(logging.WARNING)
    raven_conf.setup_logging(handler)
