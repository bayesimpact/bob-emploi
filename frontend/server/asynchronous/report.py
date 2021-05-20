"""Usefull functions to share among asynchronous script to send reports."""

import argparse
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


def _setup_sentry_logging(sentry_dsn: Optional[str]) -> None:
    """Set up logging with sentry."""

    logging.basicConfig()
    if not sentry_dsn:
        raise ValueError()
    logging_integration = sentry_logging.LoggingIntegration(
        level=logging.DEBUG,
        event_level=logging.WARNING)
    # TODO(pascal): Fix when https://github.com/getsentry/sentry-python/issues/1081 is solved.
    sentry_sdk.init(dsn=sentry_dsn, integrations=[logging_integration])  # pylint: disable=abstract-class-instantiated


def add_report_arguments(parser: argparse.ArgumentParser, setup_dry_run: bool = True) -> None:
    """Add default command line arguments for reporting.

    The arguments are verbose, disabled sentry and dry run. The two first ones re used in the
    setup_sentry_logging function, and the last one (optional) should be used to avoid any DB
    modifications or real world changes.
    """

    parser.add_argument('--verbose', '-v', action='store_true', help='More detailed output.')
    if setup_dry_run:
        parser.add_argument(
            '--no-dry-run', dest='dry_run', action='store_false',
            help='No dry run actually modifies the database or the various states.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')


def setup_sentry_logging(args: argparse.Namespace, dry_run: Optional[bool] = None) -> bool:
    """Set up logging with Sentry.

    Args:
        args: arguments parsed from the commandline, if possible setup with the add_report_arguments
            function above. It checks for verbose, disabled sentry and dry run.
        dry_run: an optional boolean to override the commandline flag "dry_run".
    """

    logging.basicConfig(level='DEBUG' if args.verbose else 'INFO')
    is_dry_run = args.dry_run if dry_run is None else dry_run
    if not is_dry_run and not args.disable_sentry:
        try:
            _setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return False

    return True
