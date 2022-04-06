"""Send a report of user-collected data by email or Slack.

Usage:
    docker-compose run --rm \
        -e MONGO_URL ... \
        frontend-flask python bob_emploi/frontend/server/asynchronous/feedback_report nps
"""

import argparse
import collections
import datetime
import os
import sys
import typing
from typing import Any, Callable, Iterable, Mapping, Optional, Set, TextIO, Tuple

import requests

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report as report_helper

# A Slack WebHook URL to send reports to.
_SLACK_FEEDBACK_URL = os.getenv('SLACK_FEEDBACK_URL')

_T = typing.TypeVar('_T')


def _plural_s(num: int) -> str:
    if num == 1:
        return ''
    return 's'


def _report_comments(comments: list[_T], display_func: Callable[[_T], str]) -> str:
    if not comments:
        return 'There are no individual comments.'
    return f'And here {"is" if len(comments) == 1 else "are"} the individual ' \
        f'comment{_plural_s(len(comments))}:\n' + \
        '\n'.join(display_func(comment) for comment in comments)


def _compute_nps_report(users: Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    score_distribution: dict[int, int] = collections.defaultdict(int)
    nps_total = 0
    num_users = 0
    responses_with_comment: list[Tuple[str, user_pb2.NPSSurveyResponse]] = []
    for user in users:
        num_users += 1
        response = user.net_promoter_score_survey_response
        score_distribution[response.score] += 1
        # TODO(pascal): Move that to a common library so that it's always
        # compute the same way.
        if response.score <= 5:
            nps_total -= 1
        elif response.score > 7:
            nps_total += 1
        if response.general_feedback_comment:
            responses_with_comment.append((user.user_id, response))

    user_db = mongo.get_connections_from_env().user_db

    # Total number of users that we asked for NPS during that time.
    total_num_users = user_db.user.count_documents({
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        'emailsSent': {'$elemMatch': {
            'campaignId': 'nps',
            # Note that this is not taking the same base, as we are counting
            # users for which we sent an NPS during a given period, and then
            # those who answered during the same period.
            'sentAt': {
                '$gt': from_date,
                '$lt': to_date,
            },
        }},
    })

    def _display_func(id_and_response: Tuple[str, user_pb2.NPSSurveyResponse]) -> str:
        return f'[Score: {id_and_response[1].score}] ObjectId("{id_and_response[0]}")\n> ' + \
            ('\n> '.join(id_and_response[1].general_feedback_comment.split('\n')))

    comments = _report_comments(
        sorted(responses_with_comment, key=lambda r: -r[1].score), _display_func)
    answer_rate = round(num_users * 100 / total_num_users) if total_num_users else 0
    nps = round(nps_total * 1000 / num_users) / 10 if num_users else 0
    score_distributions = '\n'.join(
        f'*{score}*: {score_distribution[score]} user{_plural_s(score_distribution[score])}'
        for score in sorted(score_distribution.keys(), reverse=True))

    # TODO(emilie): Use "(out of n, xx% answer rate)" instead of "(out of n - xx% answer rate)"
    return f'{num_users} user{_plural_s(num_users)} answered the NPS survey ' \
        f'(out of {total_num_users} - {answer_rate}% answer rate) ' \
        f'for a global NPS of *{nps}%*\n' \
        f'{score_distributions}\n{comments}'


def _compute_stars_report(users: Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    score_distribution: dict[int, int] = collections.defaultdict(int)
    stars_total = 0
    num_projects = 0
    responses_with_comment = []
    for user in users:
        for project in user.projects:
            feedback = project.feedback
            if not feedback.score:
                continue
            num_projects += 1
            stars_total += feedback.score
            score_distribution[feedback.score] += 1
            if feedback.text:
                responses_with_comment.append(feedback)

    user_db = mongo.get_connections_from_env().user_db

    # Total number of finished projects during that time.
    total_num_projects = user_db.user.count_documents({
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        'projects.diagnostic': {'$exists': True},
        'projects.createdAt': {
            '$gt': from_date,
            '$lt': to_date,
        }
    })

    answer_rate = round(num_projects * 100 / total_num_projects) if total_num_projects else 0
    average_stars = round(stars_total * 10 / num_projects) / 10 if num_projects else 0
    score_distributions = '\n'.join(
        f'{":star:" * score}: {score_distribution[score]} '
        f'project{_plural_s(score_distribution[score])}'
        for score in sorted(score_distribution.keys(), reverse=True))
    comments = _report_comments(
        sorted(responses_with_comment, key=lambda r: -r.score),
        lambda response: f'[{":star:" * response.score}]\n> ' +
        '\n> '.join(response.text.split('\n')),
    )

    return f'{num_projects} project{_plural_s(num_projects)} ' \
        f'{"was" if num_projects == 1 else "were"} scored in the app ' \
        f'(out of {total_num_projects} - {answer_rate}% answer rate) ' \
        f'for a global average of *{average_stars} :star:*\n' \
        f'{score_distributions}\n{comments}'


def _compute_agreement_report(users: Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    score_distribution: dict[int, int] = collections.defaultdict(int)
    agreement_total = 0
    num_projects = 0
    for user in users:
        for project in user.projects:
            feedback = project.feedback
            if not feedback.challenge_agreement_score:
                continue
            num_projects += 1
            agreement_total += feedback.challenge_agreement_score - 1
            score_distribution[feedback.challenge_agreement_score - 1] += 1

    user_db = mongo.get_connections_from_env().user_db

    # Total number of finished projects during that time.
    total_num_projects = user_db.user.count_documents({
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        'projects.diagnostic': {'$exists': True},
        'projects.createdAt': {
            '$gt': from_date,
            '$lt': to_date,
        }
    })

    answer_rate = round(num_projects * 100 / total_num_projects) if total_num_projects else 0
    average_agreement = round(agreement_total * 10 / num_projects) / 10 if num_projects else 0
    score_distributions = '\n'.join(
        f'{score}/4: {score_distribution[score]} '
        f'project{_plural_s(score_distribution[score])}'
        for score in sorted(score_distribution.keys(), reverse=True))

    return f'{num_projects} project challenge{_plural_s(num_projects)} ' \
        f'{"was" if num_projects == 1 else "were"} evaluated in the app ' \
        f'(out of {total_num_projects} - {answer_rate}% answer rate) ' \
        f'for a global average agreement of *{average_agreement}/4*\n' \
        f'{score_distributions}'


def _compute_rer_report(users: Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    seeking_distribution: dict['user_pb2.SeekingStatus.V', int] = collections.defaultdict(int)
    bob_has_helped: dict['user_pb2.SeekingStatus.V', int] = collections.defaultdict(int)
    answered_bob_helped: dict['user_pb2.SeekingStatus.V', int] = collections.defaultdict(int)
    num_users = 0
    for user in users:
        # Find the first status that is in the date range.
        user_status = None
        for status in user.employment_status:
            created_at = status.created_at.ToJsonString()
            if created_at < from_date or created_at >= to_date:
                continue
            user_status = status
            break

        if not user_status:
            continue

        num_users += 1
        seeking_distribution[user_status.seeking] += 1
        if user_status.bob_has_helped:
            answered_bob_helped[user_status.seeking] += 1
            if 'YES' in user_status.bob_has_helped:
                bob_has_helped[user_status.seeking] += 1

    if num_users:
        percent_stop_seeking = \
            (seeking_distribution[user_pb2.STOP_SEEKING] / num_users * 100)
    else:
        percent_stop_seeking = 0
    if user_pb2.SEEKING_STATUS_UNDEFINED in seeking_distribution:
        maybe_unknown_seeking = \
            f'{seeking_distribution[user_pb2.SEEKING_STATUS_UNDEFINED]} with an unknown ' \
            'seeking status\n'
    else:
        maybe_unknown_seeking = ''
    seeking_distributions = '\n'.join(
        f'*{user_pb2.SeekingStatus.Name(seeking)}*: {seeking_distribution[seeking]} '
        f'user{_plural_s(seeking_distribution[seeking])} '
        f'({bob_has_helped[seeking] * 100 / (answered_bob_helped[seeking] or 1):.1f}% said Bob '
        f'helped{"" if answered_bob_helped[seeking] == seeking_distribution[seeking] else " - excluding N/A"})'  # pylint: disable=line-too-long,useless-suppression
        for seeking in sorted(seeking_distribution.keys())
    )

    return f'{num_users} user{_plural_s(num_users)} have answered the survey, ' \
        f'*{percent_stop_seeking:.1f}%* have stopped seeking:\n' \
        f'{maybe_unknown_seeking}{seeking_distributions}'


class _ReportComputFunc(typing.Protocol):

    def __call__(self, users: Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
        ...


class _ReportDefinition(typing.NamedTuple):
    color: str
    compute_report: _ReportComputFunc
    mongo_filters: Mapping[str, Any]
    required_fields: Set[str]
    timestamp_field: str
    title: str


_REPORTS = {
    'nps': _ReportDefinition(
        color='#4286f4',
        compute_report=_compute_nps_report,
        mongo_filters={
            'netPromoterScoreSurveyResponse': {'$exists': True},
        },
        required_fields={'netPromoterScoreSurveyResponse'},
        timestamp_field='netPromoterScoreSurveyResponse.respondedAt',
        title=':bar_chart: NPS Report',
    ),
    'rer': _ReportDefinition(
        color='#439107',
        compute_report=_compute_rer_report,
        mongo_filters={
            'employmentStatus': {'$exists': True},
        },
        required_fields={'employmentStatus'},
        timestamp_field='employmentStatus.createdAt',
        title=':clipboard: RER Survey Report',
    ),
    'stars': _ReportDefinition(
        color='#ffba30',
        compute_report=_compute_stars_report,
        mongo_filters={
            'projects.feedback.score': {'$gt': 0},
        },
        required_fields={'projects'},
        timestamp_field='projects.createdAt',
        title=':star: Stars Report',
    ),
    'agreement': _ReportDefinition(
        color='#ffba30',
        compute_report=_compute_agreement_report,
        mongo_filters={
            'projects.feedback.challengeAgreementScore': {'$gt': 0},
        },
        required_fields={'projects'},
        timestamp_field='projects.createdAt',
        title=':ok_hand: Agreement Report',
    ),
}


def _create_user_proto_with_user_id(user_dict: dict[str, Any]) -> user_pb2.User:
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id')
    assert user_proto
    return user_proto


def _compute_and_send_report(
        report_id: str, from_date: str, to_date: str, out: TextIO, dry_run: bool = True) -> None:
    if not to_date:
        to_date = datetime.datetime.now().strftime('%Y-%m-%dT%H-%M')
    report = _REPORTS[report_id]

    user_db = mongo.get_connections_from_env().user_db

    selected_users = user_db.user.find(report.mongo_filters | {
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        'registeredAt': {'$lt': to_date},
        report.timestamp_field: {
            '$gt': from_date,
            '$lt': to_date,
        }
    }, {field: 1 for field in report.required_fields})
    report_text = report.compute_report(
        (_create_user_proto_with_user_id(user) for user in selected_users),
        from_date=from_date, to_date=to_date)
    if dry_run:
        out.write(report_text)
        return
    if _SLACK_FEEDBACK_URL:
        requests.post(_SLACK_FEEDBACK_URL, json={'attachments': [{
            'color': report.color,
            'mrkdwn_in': ['text'],
            'title': f'{report.title} from {from_date} to {to_date}',
            'text': report_text,
        }]})


def main(string_args: Optional[list[str]] = None, out: TextIO = sys.stdout) -> None:
    """Parse command line arguments, computes a report and send it."""

    parser = argparse.ArgumentParser(
        description='Compute a report of user feedbacks and send it through Slack or email')
    parser.add_argument('report', choices=_REPORTS.keys(), help='Report type to send.')

    from_group = parser.add_mutually_exclusive_group(required=True)
    from_group.add_argument(
        '--from', dest='from_date', help='Only consider feedback sent after this date.')
    from_group.add_argument(
        '--from-days-ago', help='Only consider feedback sent in the last days.', type=int)

    parser.add_argument(
        '--to', dest='to_date', help='Only consider feedback sent before this date.')
    report_helper.add_report_arguments(parser)
    args = parser.parse_args(string_args)

    if not report_helper.setup_sentry_logging(args):
        return

    if args.from_date:
        from_date = args.from_date
    else:
        from_date = (datetime.datetime.now() - datetime.timedelta(days=args.from_days_ago))\
            .strftime('%Y-%m-%d')

    _compute_and_send_report(args.report, from_date, args.to_date, out, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
