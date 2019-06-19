"""Send a report of user-collected data by email or Slack.

Usage:
    docker-compose run --rm \
        -e MONGO_URL ... \
        frontend-flask python bob_emploi/frontend/server/asynchronous/feedback_report nps
"""

import argparse
import collections
import datetime
import re
import os
import sys
import typing

import requests

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import report as report_helper

# A Slack WebHook URL to send reports to.
_SLACK_FEEDBACK_URL = os.getenv('SLACK_FEEDBACK_URL')

_T = typing.TypeVar('_T')


def _report_comments(comments: typing.List[_T], display_func: typing.Callable[[_T], str]) -> str:
    if not comments:
        return 'There are no individual comments.'
    return 'And here {} the individual comment{}:\n{}'.format(
        'is' if len(comments) == 1 else 'are',
        '' if len(comments) == 1 else 's',
        '\n'.join(display_func(comment) for comment in comments),
    )


def _compute_nps_report(users: typing.Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    score_distribution: typing.Dict[int, int] = collections.defaultdict(int)
    nps_total = 0
    num_users = 0
    responses_with_comment = []
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

    # Total number of users that we asked for NPS during that time.
    total_num_users = _USER_DB.user.count_documents({
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

    comments = _report_comments(
        sorted(responses_with_comment, key=lambda r: -r[1].score),
        lambda id_and_response: '[Score: {}] ObjectId("{}")\n> {}'.format(
            id_and_response[1].score, id_and_response[0],
            '\n> '.join(id_and_response[1].general_feedback_comment.split('\n'))),
    )

    return (
        '{num_users} user{users_plural} answered the NPS survey '
        '(out of {total_num_users} - {answer_rate}% answer rate) '
        'for a global NPS of *{nps}%*\n'
        '{score_distribution}\n{comments}'.format(
            num_users=num_users,
            total_num_users=total_num_users,
            answer_rate=round(num_users * 100 / total_num_users) if total_num_users else 0,
            users_plural='' if num_users == 1 else 's',
            nps=round(nps_total * 1000 / num_users) / 10 if num_users else 0,
            score_distribution='\n'.join(
                '*{}*: {} user{}'.format(
                    score, score_distribution[score], '' if score_distribution[score] == 1 else 's')
                for score in sorted(score_distribution.keys(), reverse=True)),
            comments=comments,
        )
    )


def _compute_stars_report(
        users: typing.Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    score_distribution: typing.Dict[int, int] = collections.defaultdict(int)
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

    # Total number of finished projects during that time.
    total_num_projects = _USER_DB.user.count_documents({
        'projects.diagnostic': {'$exists': True},
        'projects.createdAt': {
            '$gt': from_date,
            '$lt': to_date,
        }
    })

    return (
        '{num_projects} project{projects_plural} {was_or_were} scored in the app '
        '(out of {total_num_projects} - {answer_rate}% answer rate) '
        'for a global average of *{average_stars} :star:*\n'
        '{score_distribution}\n{comments}'.format(
            num_projects=num_projects,
            projects_plural='' if num_projects == 1 else 's',
            was_or_were='was' if num_projects == 1 else 'were',
            average_stars=round(stars_total * 10 / num_projects) / 10 if num_projects else 0,
            total_num_projects=total_num_projects,
            answer_rate=round(num_projects * 100 / total_num_projects) if total_num_projects else 0,
            score_distribution='\n'.join(
                '{}: {} project{}'.format(
                    ':star:' * score, score_distribution[score],
                    '' if score_distribution[score] == 1 else 's')
                for score in sorted(score_distribution.keys(), reverse=True)),
            comments=_report_comments(
                sorted(responses_with_comment, key=lambda r: -r.score),
                lambda response: '[{}]\n> {}'.format(
                    ':star:' * response.score,
                    '\n> '.join(response.text.split('\n')),
                ),
            ),
        ))


def _compute_rer_report(users: typing.Iterable[user_pb2.User], from_date: str, to_date: str) -> str:
    seeking_distribution: typing.Dict['user_pb2.SeekingStatus', int] = collections.defaultdict(int)
    bob_has_helped: typing.Dict['user_pb2.SeekingStatus', int] = collections.defaultdict(int)
    answered_bob_helped: typing.Dict['user_pb2.SeekingStatus', int] = collections.defaultdict(int)
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

    return (
        '{num_users} user{users_plural} have answered the survey, '
        '*{percent_stop_seeking:.1f}%* have stopped seeking:\n'
        '{maybe_unknown_seeking}{seeking_distribution}'.format(
            num_users=num_users,
            users_plural='' if num_users == 1 else 's',
            percent_stop_seeking=(
                (seeking_distribution[user_pb2.STOP_SEEKING] / num_users * 100)
                if num_users else 0),
            maybe_unknown_seeking='{} with an unknown seeking status\n'.format(
                seeking_distribution[user_pb2.SEEKING_STATUS_UNDEFINED]
            ) if user_pb2.SEEKING_STATUS_UNDEFINED in seeking_distribution else '',
            seeking_distribution='\n'.join(
                '*{seeking}*: {num_users} user{plural_users} '
                '({percent_helped:.1f}% said Bob helped{helped_note})'.format(
                    seeking=user_pb2.SeekingStatus.Name(seeking),
                    num_users=seeking_distribution[seeking],
                    plural_users='' if seeking_distribution[seeking] == 1 else 's',
                    percent_helped=(
                        bob_has_helped[seeking] * 100 / (answered_bob_helped[seeking] or 1)),
                    helped_note='' if answered_bob_helped[seeking] == seeking_distribution[seeking]
                    else ' - excluding N/A')
                for seeking in sorted(seeking_distribution.keys())),
        ))


_ReportDefinition = collections.namedtuple('Report', (
    'color', 'compute_report', 'mongo_filters', 'required_fields', 'timestamp_field', 'title'))

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
}

_, _USER_DB, _ = mongo.get_connections_from_env()


def _create_user_proto_with_user_id(user_dict: typing.Dict[str, typing.Any]) -> user_pb2.User:
    user_proto = proto.create_from_mongo(user_dict, user_pb2.User, 'user_id')
    assert user_proto
    return user_proto


def _compute_and_send_report(
        report_id: str, from_date: str, to_date: str, out: typing.TextIO, dry_run: bool = True) \
        -> None:
    if not to_date:
        to_date = datetime.datetime.now().strftime('%Y-%m-%dT%H-%M')
    report = _REPORTS[report_id]

    selected_users = _USER_DB.user.find(dict(report.mongo_filters, **{
        'profile.email': {'$not': re.compile(r'@example.com$')},
        'registeredAt': {'$lt': to_date},
        report.timestamp_field: {
            '$gt': from_date,
            '$lt': to_date,
        }
    }), {field: 1 for field in report.required_fields})
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
            'title': '{} from {} to {}'.format(report.title, from_date, to_date),
            'text': report_text,
        }]})


def main(string_args: typing.Optional[typing.List[str]] = None, out: typing.TextIO = sys.stdout) \
        -> None:
    """Parse command line arguments, computes a report and send it."""

    parser = argparse.ArgumentParser(
        description='Compute a report of user feedbacks and send it through Slack or email')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false',
        help='No dry run really send reports.')
    parser.add_argument('report', choices=_REPORTS.keys(), help='Report type to send.')

    from_group = parser.add_mutually_exclusive_group(required=True)
    from_group.add_argument(
        '--from', dest='from_date', help='Only consider feedback sent after this date.')
    from_group.add_argument(
        '--from-days-ago', help='Only consider feedback sent in the last days.', type=int)

    parser.add_argument(
        '--to', dest='to_date', help='Only consider feedback sent before this date.')
    args = parser.parse_args(string_args)

    if not args.dry_run:
        report_helper.setup_sentry_logging(os.getenv('SENTRY_DSN'))

    if args.from_date:
        from_date = args.from_date
    else:
        from_date = (datetime.datetime.now() - datetime.timedelta(days=args.from_days_ago))\
            .strftime('%Y-%m-%d')

    _compute_and_send_report(args.report, from_date, args.to_date, out, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
