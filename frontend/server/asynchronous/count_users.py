"""A script to count users in each departement and rome group."""

import collections

from google.protobuf import json_format

from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now

_DB, _USER_DB = mongo.get_connections_from_env()


def main():
    """Aggregate users and populate user_count collection."""

    aggregation = _USER_DB.user.aggregate([
        {'$match': {
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        }},
        {'$unwind': '$projects'},
        {'$project': {
            '_id': 0,
            'dep_id': {'$ifNull': [
                # TODO(pascal): Switch those once
                # https://github.com/mongomock/mongomock/issues/404 is fixed.
                '$projects.mobility.city.departementId',
                '$projects.city.departementId',
            ]},
            'rome_id': '$projects.targetJob.jobGroup.romeId',
        }}
    ])

    job_group_counts = collections.defaultdict(int)
    dep_counts = collections.defaultdict(int)
    for local_info in aggregation:
        if 'dep_id' in local_info:
            dep_counts[local_info.get('dep_id')] += 1
        if 'rome_id' in local_info:
            job_group_counts[local_info.get('rome_id')] += 1

    user_counts = stats_pb2.UsersCount(
        departement_counts=dep_counts, job_group_counts=job_group_counts)
    user_counts.aggregated_at.FromDatetime(now.get())
    user_counts.aggregated_at.nanos = 0

    _DB.user_count.insert_one(json_format.MessageToDict(user_counts))


if __name__ == '__main__':
    main()
