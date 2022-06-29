#!/usr/bin/env python3
# ARGCOMPLETE OK
"""Check the release notes and ask for manual approval.

Needs the following environment to work properly:
- GITHUB_TOKEN to make hub CLI tool work
- SLACK_INTEGRATION_URL to notify Slack
"""

import argparse
import json
import logging
import os
import re
import subprocess
from typing import Iterator, Optional

import requests

_GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
_SLACK_WEBHOOK_URL = os.getenv('SLACK_INTEGRATION_URL', '')
# See https://app.slack.com/client/T9S0ZJF2Q/user_groups/SACSUK4KY
_ENG = '<!subteam^SACSUK4KY>'
_BOB_DEV = 'C9UH026MD'
_NOT_DOMAIN_CHARS_REGEX = re.compile(r'[^a-z0-9-]+')


def _get_release_notes(tag: str, repo_fullname: str) -> str:
    try:
        return subprocess.check_output(('hub', 'release', 'show', tag), text=True).strip()
    except subprocess.CalledProcessError:
        logging.error(
            'No release notes found. Build again this workflow step when they are ready'
            '(go to https://app.circleci.com/pipelines/gh/%s and click'
            "'Rerun failed jobs' on the failed workflow)."
            "To create the notes, rerun 'frontend/release/release.sh $TAG' on your machine if"
            'the original release script is lost.', repo_fullname)
        raise


def _make_update_notes(tag: str) -> str:
    release_url = subprocess.check_output(
        ('hub', 'release', 'show', '-d', '-f', r'%U', tag), text=True).strip()
    return f'• {_ENG}, update the <{release_url}|release notes> to a more compact list, ' + \
        'then add a :notes: reaction to this post.\n'


def _get_alternate_urls(tag: str) -> Iterator[str]:
    dep_file_name = os.path.join(os.path.dirname(__file__), 'stack_deployments.json')
    with open(dep_file_name, encoding='utf-8') as dep_file:
        deployment_configs = json.load(dep_file)
    for dep_config in deployment_configs:
        raw_deployment = dep_config['deployment']
        if 'deprecatedFor' in dep_config or raw_deployment == 'fr':
            continue
        dep = _NOT_DOMAIN_CHARS_REGEX.sub('-', raw_deployment)
        requests.get(
            f'https://bob-demo.bayes.org/start/release-{dep}/tag-{tag}?'
            f'service=bob&ttl=7&env={raw_deployment}&host=release-{dep}.bob-demo.bayes.org')
        yield f'<https://go.bayes.org/bob:demo/release-{dep}|{dep}>'


# TODO(cyrille): Use https://circleci.com/docs/api/v2/#operation/approvePendingApprovalJobById
# to allow team members to validate directly from Slack.
# New line in Slack message (https://Github.com/cleentfaar/slack/issues/21).
def _make_slack_message(tag: str, repo_url: str, deploy_url: str, is_auto: bool) -> str:
    alternate_urls = ', '.join(_get_alternate_urls(tag))
    base_url = f'https://go.bayes.org/bob:demo/tag-{tag}'
    update_notes = _make_update_notes(tag) if is_auto else ''
    return (
        f'<!here> A demo for the release candidate {tag} is <{base_url}|ready for review>. '
        f'See <{repo_url}/compare/prod...{tag}|Git changes>. If you are happy with it, '
        f'<{deploy_url}|approve the release workflow>.\n'
        '\nBut first, do not forget to:\n'
        '• check that a new user can go through the workflow, see their assessment and select and '
        'read some advice, without being blocked. :rocket:\n'
        '• check the flow for desktop and mobile. :iphone: :computer:\n'
        f'• go to the <{base_url}/conseiller/integration-imilo|integration-imilo page> '
        'to check all the pieces of advice.\n'
        f'• go to <{base_url}/orientation|Jobflix> to check the product.\n'
        f'• test the other deployments: {alternate_urls}, they may differ substantially.\n'
        f'• {_ENG}, make sure no error has been logged to '
        '<https://sentry.io/bayes-impact/bob-emploi-demo/|bob-emploi-demo> on Sentry.\n'
        f'{update_notes}• of course have a look to the release notes to know where '
        'to be even more careful.\nBob will be forever grateful :heart:')


def _ping_slack(tag: str, repo_url: str, release_notes: str, deploy_url: str, dry_run: bool) \
        -> None:
    is_auto = 'auto' in release_notes.split('\n')[0]
    payload = {
        'attachments': [{'fields': [{
            'title': 'Release Notes',
            'value': release_notes,
        }]}],
        'text': _make_slack_message(tag, repo_url, deploy_url, is_auto)
    }
    if is_auto:
        payload['channel'] = _BOB_DEV
    if dry_run:
        print(json.dumps(payload, indent=2))
    else:
        requests.post(_SLACK_WEBHOOK_URL, json=payload)


def check_and_ask(tag: str, *, repo_fullname: str, deploy_url: str, dry_run: bool) -> None:
    """Check the release notes for the tag, and ask for review."""

    repo_url = f'https://Github.com/{repo_fullname}'
    release_notes = _get_release_notes(tag, repo_fullname)
    _ping_slack(tag, repo_url, release_notes, deploy_url, dry_run)


def main(string_args: Optional[list[str]] = None) -> None:
    """Parse CLI arguments and run the script."""

    parser = argparse.ArgumentParser('Check the release notes and ask for manual approval.')
    parser.add_argument('tag', help='The git tag to prepare for release.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false',
        help='Actually run the script instead of only going through the motions.')
    parser.add_argument(
        '--owner', default='bayesimpact', help='The Github owner of the current repo.')
    parser.add_argument(
        '--repo', default='bob-emploi-internal', help='The Github name of the current repo.')
    parser.add_argument(
        '--token', default=os.getenv('GITHUB_TOKEN'),
        help='A Github token with sufficient rights to read release notes.')
    parser.add_argument(
        '--deploy-url', required=True, help='A URL where we can manually approve the deployment.')
    args = parser.parse_args(string_args)
    if args.dry_run:
        logging.info('DRY RUN: will not actually modify anything.')
    if not args.token:
        raise ValueError(
            'No Github token found, unable to fetch the release notes. Please, set --token.')
    os.environ['GITHUB_TOKEN'] = args.token
    if not _SLACK_WEBHOOK_URL:
        raise ValueError(
            'No slack webhook found, unable to ask for manual approval. '
            'Please, set SLACK_INTEGRATION_URL.')
    if not args.owner or not args.repo:
        raise ValueError('No Github repo specified. Please set --owner and --repo.')
    repo_fullname = f'{args.owner}/{args.repo}'
    check_and_ask(
        args.tag, deploy_url=args.deploy_url, dry_run=args.dry_run, repo_fullname=repo_fullname)


if __name__ == '__main__':
    main()
