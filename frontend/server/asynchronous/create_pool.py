"""Script to create a pool of use cases from actual users."""
import datetime
import json
import os
import re
import sys

from google.protobuf import json_format
import pymongo

from bob_emploi.frontend import privacy
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import user_pb2

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()

_YESTERDAY = (datetime.date.today() + datetime.timedelta(days=-1)).strftime('%Y-%m-%d')
_DEFAULT_USERS_FILTER = {
    'profile.email': {'$not': re.compile('@example.com|@bayes')},
    'registeredAt': {'$gt': _YESTERDAY, '$lt': '%sT24' % _YESTERDAY},
    'projects.createdAt': {'$exists': True},
    'projects.isIncomplete': {'$ne': True},
}


def main(pool_name=_YESTERDAY, users_json_filters=None, limit=20):
    """Create a pool of use cases and store them in MongoDB."""
    users_filters = json.loads(users_json_filters) if users_json_filters else _DEFAULT_USERS_FILTER
    user_iterator = _DB.user.find(users_filters).limit(int(limit))
    for user_index, user_dict in enumerate(user_iterator):
        user_proto = user_pb2.User()
        if not proto.parse_from_mongo(user_dict, user_proto):
            continue
        privacy.anonymize_proto(user_proto, field_usages_to_clear={
            options_pb2.PERSONAL_IDENTIFIER, options_pb2.APP_ONLY, options_pb2.ALGORITHM_RESULT,
        })
        use_case = json_format.MessageToDict(user_proto)
        use_case['_id'] = '%s_%02x' % (pool_name, user_index)
        use_case['_poolName'] = pool_name
        use_case['_indexInPool'] = user_index
        try:
            _DB.use_case.insert_one(use_case)
        except pymongo.errors.DuplicateKeyError:
            _DB.use_case.replace_one({'_id': use_case['_id']}, use_case)


if __name__ == '__main__':
    main(*sys.argv[1:])
