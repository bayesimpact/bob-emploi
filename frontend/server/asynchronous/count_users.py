"""A script to count users in each departement and rome group."""

import collections
import typing

from google.protobuf import json_format

from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now

_DB, _USER_DB, _ = mongo.get_connections_from_env()


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
            'rome_id': '$projects.targetJob.jobGroup.romeId',
        }}
    ])

    job_group_counts: typing.Dict[str, int] = collections.defaultdict(int)
    dep_counts: typing.Dict[str, int] = collections.defaultdict(int)
    for local_info in aggregation:
        if 'dep_id' in local_info:
            dep_counts[local_info.get('dep_id', '')] += 1
        if 'rome_id' in local_info:
            job_group_counts[local_info.get('rome_id', '')] += 1

    user_counts = stats_pb2.UsersCount(
        departement_counts=dep_counts, job_group_counts=job_group_counts)
    user_counts.aggregated_at.FromDatetime(now.get())
    user_counts.aggregated_at.nanos = 0

    # TODO(cyrille): Replace 'values' by '' once https://github.com/mongomock/mongomock/pull/483 is
    # released.
    _DB.user_count.replace_one(
        {'_id': 'values'}, json_format.MessageToDict(user_counts), upsert=True)


if __name__ == '__main__':
    main()
