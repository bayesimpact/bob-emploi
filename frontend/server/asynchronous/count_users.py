"""A script to count users in each departement and rome group."""

import collections
import datetime
from typing import Dict

from google.protobuf import json_format

from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now

_DB, _USER_DB, _ = mongo.get_connections_from_env()


def _convert_date(date: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(date.upper().replace('Z', ''))


def main() -> None:
    """Aggregate users and populate user_count collection."""

    aggregation = _USER_DB.user.aggregate([
        {'$match': {
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        }},
        {'$unwind': '$projects'},
        {'$project': {
            '_id': 0,
            'dep_id': '$projects.city.departementId',
            'interview_counts': '$projects.totalInterviewCount',
            'rome_id': '$projects.targetJob.jobGroup.romeId',
            'weekly_applications': '$projects.weeklyApplicationsEstimate',
            'job_search_started_at': '$projects.jobSearchStartedAt',
            'created_at': '$projects.createdAt',
            'job_search_length_months': '$projects.jobSearchLengthMonths',
        }}
    ])

    job_group_counts: Dict[str, int] = collections.defaultdict(int)
    dep_counts: Dict[str, int] = collections.defaultdict(int)
    medium_search_interview_counts: Dict[str, int] = collections.defaultdict(int)
    long_search_interview_counts: Dict[str, int] = collections.defaultdict(int)
    weekly_application_counts: Dict[str, int] = collections.defaultdict(int)
    for user_info in aggregation:
        search_length_months = 0
        if not {'job_search_started_at', 'created_at'} - set(user_info):
            search_length = _convert_date(user_info.get('created_at')) -\
                _convert_date(user_info.get('job_search_started_at'))
            search_length_months = round(search_length.days / 30)
        elif 'job_search_length_months' in user_info:
            search_length_months = user_info.get('job_search_length_months')

        if 'dep_id' in user_info:
            dep_counts[user_info.get('dep_id', '')] += 1
        if 'rome_id' in user_info:
            job_group_counts[user_info.get('rome_id', '')] += 1
        if 'weekly_applications' in user_info:
            weekly_applications_name = user_info.get('weekly_applications')
            if weekly_applications_name:
                weekly_application_counts[weekly_applications_name] += 1
        if 'interview_counts' in user_info and search_length:
            if search_length_months > 5 and search_length_months < 9:
                medium_search_interview_counts[str(user_info.get('interview_counts', -1))] += 1
            if search_length_months > 12:
                long_search_interview_counts[str(user_info.get('interview_counts', -1))] += 1

    user_counts = stats_pb2.UsersCount(
        departement_counts=dep_counts, job_group_counts=job_group_counts,
        weekly_application_counts=weekly_application_counts,
        medium_search_interview_counts=medium_search_interview_counts,
        long_search_interview_counts=long_search_interview_counts)
    user_counts.aggregated_at.FromDatetime(now.get())
    user_counts.aggregated_at.nanos = 0

    # TODO(cyrille): Replace 'values' by '' once https://github.com/mongomock/mongomock/pull/483 is
    # released.
    _DB.user_count.replace_one(
        {'_id': 'values'}, json_format.MessageToDict(user_counts), upsert=True)


if __name__ == '__main__':
    main()
