"""Usefull functions to share among asynchronous script to send reports."""

import logging
import os
from typing import Optional

import requests
import sentry_sdk
from sentry_sdk.integrations import logging as sentry_logging


# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

# ID of the email template in MailJet to report the final count of the blast. See
# https://app.mailjet.com/tempate/74071/build
_MAILJET_REPORT_TEMPLATE_ID = '74071'


def notify_slack(message: str) -> None:
    """Send a message on slack channel #bob-bot as Bob the mailman."""

    if _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={'text': message})


def setup_sentry_logging(sentry_dsn: Optional[str]) -> None:
    """Set up logging with sentry."""

    logging.basicConfig()
    if not sentry_dsn:
        raise ValueError()
    logging_integration = sentry_logging.LoggingIntegration(
        level=logging.DEBUG,
        event_level=logging.WARNING)
    sentry_sdk.init(dsn=sentry_dsn, integrations=[logging_integration])
