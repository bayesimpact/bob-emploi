"""A script to count users in each departement and rome group."""

import collections

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now

_, _DB = mongo.get_connections_from_env()


def main():
    """Aggregate users and populate user_count collection."""

    aggregation = _DB.user.aggregate([
        {'$match': {
            'featuresEnabled.excludeFromAnalytics': {'$ne': True},
        }},
        {'$unwind': '$projects'},
        {'$project': {
            '_id': 0,
            'dep_id': '$projects.mobility.city.departementId',
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

    _DB.user_count.insert_one({
        'aggregatedAt': str(now.get()),
        'depCounts': dep_counts,
        'jobGroupCounts': job_group_counts,
    })


if __name__ == '__main__':
    main()
