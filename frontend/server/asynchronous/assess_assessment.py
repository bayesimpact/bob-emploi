"""Script to assess how many users have the assessment.

docker-compose run --rm frontend-flask \
    python bob_emploi/frontend/server/asynchronous/assess_assessment.py
"""

import argparse
import collections
import datetime
import itertools
import logging
import os
import random
import sys
import typing

import requests

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import use_case_pb2
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_ASSESSER_URL = os.getenv('SLACK_ASSESSER_URL')

_DATA_DB, _, _DB = mongo.get_connections_from_env()

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

_SUBDIAGNOSTIC_PREFIX = 'subdiagnostic: '


def _list_missing_properties_for_assessed_use_case(user: user_pb2.User, title: str) \
        -> typing.Iterator[str]:
    user_diagnostic, missing_sentences = diagnostic.diagnose(user, user.projects[0], _DATA_DB)
    if missing_sentences is None:
        return
    logging.debug('Missing new diagnostic: %s', title)
    yield 'overall'
    for order in missing_sentences:
        logging.debug('Missing sentences %d in text:%s', order, title)
        yield 'text: sentence ' + str(order)
    if not user_diagnostic.overall_score:
        logging.debug("Diagnostic doesn't have overall score: %s", title)
        yield 'score'
    submetrics = {sub.topic for sub in user_diagnostic.sub_diagnostics if sub.text}
    for topic in diagnostic_pb2.DiagnosticTopic.values():
        if topic and (topic not in submetrics):
            yield _SUBDIAGNOSTIC_PREFIX + diagnostic_pb2.DiagnosticTopic.Name(topic)
    if len(submetrics) < 3:
        logging.debug(
            "Diagnostic doesn't have 3 complete subdiagnostics: %s", title)
        yield 'subdiagnostics'


def _get_use_case_url(use_case: use_case_pb2.UseCase) -> str:
    return '{}/eval/{}?poolName={}'.format(_BASE_URL, use_case.use_case_id, use_case.pool_name)


_T = typing.TypeVar('_T')


# Implementation of reservoir sampling https://en.wikipedia.org/wiki/Reservoir_sampling
def _reservoir_sample(
        reservoir: typing.List[_T], max_size: int, new_element: _T, new_index: int) -> None:
    if len(reservoir) < max_size:
        reservoir.append(new_element)
        return
    next_place = random.randrange(new_index)
    if next_place >= max_size:
        return
    reservoir[next_place] = new_element


def _compute_assessment_report(example_count: int, since: str, until: str) -> str:
    """Count the use cases that are assessed, and reports which and why are not."""

    cursor = _DB.use_case.find(
        {'poolName': {'$gte': str(since), '$lt': str(until), '$regex': r'\d{4}-\d{2}-\d{2}'}})

    unassessed_count = 0
    num_cases_missing_a_field: typing.Dict[str, int] = collections.defaultdict(int)
    project_count = 0
    examples: typing.List[typing.Tuple[str, typing.List[str]]] = []
    for use_case_json in cursor:
        use_case = proto.create_from_mongo(
            use_case_json, use_case_pb2.UseCase, 'use_case_id', always_create=False)
        if not use_case:
            logging.debug('Unable to parse use case from mongo\n%s', use_case_json)
            continue
        if not use_case.user_data.projects:
            logging.debug("Use case '%s' does not have any project", use_case.title)
            continue
        project_count += 1
        project_assessed = True
        missing = list(_list_missing_properties_for_assessed_use_case(
            use_case.user_data, use_case.title))
        for missing_field in missing:
            num_cases_missing_a_field[missing_field] += 1
            if project_assessed and not missing_field.startswith(_SUBDIAGNOSTIC_PREFIX):
                project_assessed = False
        if project_assessed:
            continue
        unassessed_count += 1
        example = (_get_use_case_url(use_case), missing)
        _reservoir_sample(examples, example_count, example, unassessed_count)
    report_text = '{} use case{} tested\n{} use case{} successfully assessed\n'.format(
        project_count, '' if project_count == 1 else 's',
        project_count - unassessed_count, '' if project_count - unassessed_count == 1 else 's')
    if project_count:
        rate = (project_count - unassessed_count) / project_count * 100
        report_text += 'Success rate: {:4.1f}%\n'.format(rate)
    total_failure_count = unassessed_count
    if total_failure_count:
        for field, count in num_cases_missing_a_field.items():
            report_text += '{} use case{} missed {} ({:3.1f}%)\n'.format(
                count, '' if count == 1 else 's', field, 100 * count / total_failure_count)

    example_count = min(len(examples), example_count)
    if not example_count:
        return report_text
    report_text += 'Example{maybe_s} of {count} failed use case{maybe_s}:\n'.format(
        maybe_s='' if example_count == 1 else 's', count=example_count)
    grouped_examples = itertools.groupby(
        sorted(examples, key=lambda s: s[1]), lambda s: s[1])
    for key, values in grouped_examples:
        report_text += 'Missing field{} "{}":\n\t{}\n'.format(
            '' if len(key) == 1 else 's',
            '", "'.join(key),
            '\n\t'.join(map(lambda e: e[0], list(values))))
    return report_text


def main(string_args: typing.Optional[typing.List[str]] = None, out: typing.TextIO = sys.stdout) \
        -> None:
    """Parse command line arguments and trigger _compute_assessment_report function.
    docker-compose run --rm -e MONGO_URL="$PROD_MONGO" frontend-flask \
        python /work/bob_emploi/frontend/server/asynchronous/assess_assessment.py -s 2017-11-01
    """

    parser = argparse.ArgumentParser(
        description='Statistics on users whith or whithout assessment.')
    since_group = parser.add_mutually_exclusive_group()
    since_group.add_argument(
        '-d', '--since-days-ago', type=int,
        help='Process use cases registered in the last given days.')
    since_group.add_argument(
        '-s', '--since', default='2018',
        help='Process use cases registered since the given date.')
    parser.add_argument(
        '-u', '--until',
        help='Process use cases registered before (but not including) the given date.')
    parser.add_argument(
        '-e', '--examples', default='1', type=int,
        help='Show the given number of examples of use cases whithout assessment.')
    parser.add_argument('--verbose', '-v', action='store_true', help='More detailed output.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false',
        help='No dry run really send reports.')
    args = parser.parse_args(string_args)

    if not args.dry_run:
        report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
    logging.basicConfig(level='DEBUG' if args.verbose else 'INFO')

    present = now.get()
    from_date = args.since
    if args.since_days_ago:
        from_date = present - datetime.timedelta(days=args.since_days_ago)
    to_date = present if args.since_days_ago or not args.until else args.until

    report_text = _compute_assessment_report(
        args.examples, from_date, to_date)
    if args.dry_run:
        out.write(report_text)
        return
    if _SLACK_ASSESSER_URL:
        requests.post(_SLACK_ASSESSER_URL, json={'attachments': [{
            'mrkdwn_in': ['text'],
            'title': 'Assessment coverage from {} to {}'.format(from_date, to_date),
            'text': report_text,
        }]})


if __name__ == '__main__':
    main()
