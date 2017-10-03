"""Script to fix employment_status of users with erroneous values."""
import os

from google.protobuf import json_format
import pymongo

from bob_emploi.frontend import proto
from bob_emploi.frontend.api import user_pb2

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()
_DRY_RUN = not os.getenv('NO_DRY_RUN', '')


def main(user_db, dry_run=True):
    """Fix projects with very old field values."""
    if dry_run:
        print('Running in dry mode, no changes will be pushed to MongoDB.')
    users_to_fix = user_db.find({
        'employment_status': {'$elemMatch': {
            'createdAt': {'$lt': '2017-10-12'},
            'seeking': {'$exists': False}}},
    })
    user_count = 0
    for user_dict in users_to_fix:
        user_id = user_dict.pop('_id')
        user = user_pb2.User()
        proto.parse_from_mongo(user_dict, user)

        updated = False
        for pos, status in enumerate(user.employment_status):
            if status.seeking:
                continue
            updated = True
            if dry_run:
                print('Would change status for', user_id, pos)
            else:
                status.seeking = user_pb2.STOP_SEEKING
                user_db.update_one(
                    {'_id': user_id},
                    {'$set': {
                        'employment_status.{}'.format(pos): json_format.MessageToDict(status)
                    }},
                )

        if updated:
            user_count += 1
    print('{} users updated'.format(user_count))


if __name__ == '__main__':
    main(_DB.user, _DRY_RUN)
