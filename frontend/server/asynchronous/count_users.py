"""A script to count users in each departement and rome group."""

import collections
import datetime
from typing import Dict, Mapping

from google.protobuf import json_format

from bob_emploi.common.python import now
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import mongo

_DB, _USER_DB, _ = mongo.get_connections_from_env()


def _convert_date(date: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(date.upper().replace('Z', ''))


def _create_passion_category_counts(
        counts: Dict[str, int],
        category: 'stats_pb2.SearchLengthCategory.V') -> stats_pb2.PassionLevelCategory:
    return stats_pb2.PassionLevelCategory(
        level_counts=([
            stats_pb2.PassionLevelCount(
                passionate_level=project_pb2.PassionateLevel.Value(level), count=count)
            for (level, count) in counts.items()]),
        search_length=category)


class _FirstnameCounter:

    def __init__(self) -> None:
        self._counts: Dict[str, int] = collections.defaultdict(int)

    def increment(self, firstname: str) -> None:
        """Increment the count for a first name."""

        if not firstname or firstname == 'REDACTED':
            return

        self._counts[firstname] += 1

    def get_top(self, granularity: int = 50) -> Mapping[str, float]:
        """Get most used first names."""

        rounded_counts = {
            firstname: count // granularity
            for firstname, count in self._counts.items()
            if count >= granularity
        }
        total_counts = sum(rounded_counts.values())
        return {
            firstname: count / total_counts
            for firstname, count in rounded_counts.items()
        }


def main() -> None:
    """Aggregate users and populate user_count collection."""

    aggregation = _USER_DB.user.aggregate([
        {'$match': {
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        }},
        {'$unwind': '$projects'},
        {'$project': {
            'created_at': '$projects.createdAt',
            'dep_id': '$projects.city.departementId',
            'firstname': '$profile.name',
            'interview_counts': '$projects.totalInterviewCount',
            'job_search_started_at': '$projects.jobSearchStartedAt',
            'passionate_level': '$projects.passionateLevel',
            'rome_id': '$projects.targetJob.jobGroup.romeId',
            'weekly_applications': '$projects.weeklyApplicationsEstimate',
        }}
    ])

    job_group_counts: Dict[str, int] = collections.defaultdict(int)
    dep_counts: Dict[str, int] = collections.defaultdict(int)
    medium_search_interview_counts: Dict[str, int] = collections.defaultdict(int)
    long_search_interview_counts: Dict[str, int] = collections.defaultdict(int)
    weekly_application_counts: Dict[str, int] = collections.defaultdict(int)
    short_search_passion_counts: Dict[str, int] = collections.defaultdict(int)
    medium_search_passion_counts: Dict[str, int] = collections.defaultdict(int)
    long_search_passion_counts: Dict[str, int] = collections.defaultdict(int)
    firstname_counts = _FirstnameCounter()
    last_id = None
    for user_info in aggregation:
        search_length_months = 0
        if not {'job_search_started_at', 'created_at'} - set(user_info):
            search_length = _convert_date(user_info.get('created_at')) -\
                _convert_date(user_info.get('job_search_started_at'))
            search_length_months = round(search_length.days / 30)

        if 'dep_id' in user_info:
            dep_counts[user_info.get('dep_id', '')] += 1
        if 'rome_id' in user_info:
            job_group_counts[user_info.get('rome_id', '')] += 1
        if 'weekly_applications' in user_info:
            weekly_applications_name = user_info.get('weekly_applications')
            if weekly_applications_name:
                weekly_application_counts[weekly_applications_name] += 1
        if 'interview_counts' in user_info:
            if search_length_months > 5 and search_length_months < 9:
                medium_search_interview_counts[str(user_info.get('interview_counts', -1))] += 1
            if search_length_months > 12:
                long_search_interview_counts[str(user_info.get('interview_counts', -1))] += 1
        if 'passionate_level' in user_info:
            if search_length_months and search_length_months < 4:
                short_search_passion_counts[str(user_info.get('passionate_level'))] += 1
            if search_length_months >= 4 and search_length_months < 13:
                medium_search_passion_counts[str(user_info.get('passionate_level'))] += 1
            if search_length_months >= 13:
                long_search_passion_counts[str(user_info.get('passionate_level'))] += 1

        user_id = user_info.get('_id')
        if user_id != last_id:
            firstname_counts.increment(user_info.get('firstname', ''))
        last_id = user_id

    passion_level_counts = [
        _create_passion_category_counts(short_search_passion_counts, stats_pb2.SHORT_SEARCH_LENGTH),
        _create_passion_category_counts(
            medium_search_passion_counts, stats_pb2.MEDIUM_SEARCH_LENGTH),
        _create_passion_category_counts(long_search_passion_counts, stats_pb2.LONG_SEARCH_LENGTH),
    ]

    user_counts = stats_pb2.UsersCount(
        departement_counts=dep_counts, job_group_counts=job_group_counts,
        weekly_application_counts=weekly_application_counts,
        medium_search_interview_counts=medium_search_interview_counts,
        long_search_interview_counts=long_search_interview_counts,
        passion_level_counts=passion_level_counts,
        frequent_firstnames=firstname_counts.get_top())
    user_counts.aggregated_at.FromDatetime(now.get())
    user_counts.aggregated_at.nanos = 0

    _DB.user_count.replace_one({'_id': ''}, json_format.MessageToDict(user_counts), upsert=True)


if __name__ == '__main__':
    main()
