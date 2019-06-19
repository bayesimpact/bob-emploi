"""Access to our MongoDB databases.

We have three logical databases, corresponding to three environment variables:
- USERS_MONGO_URL contains all tables with PII. It's main table of interest is 'user'. Frontend
    servers heavily read from and write to it.
- MONGO_URL contains all data tables. Frontend servers are not able to write on it. They only
    access to it to determine diagnostic/advices for users. Data might be coming from
    by-hand imports (such as job_group_info, ...) or scheduled tasks which might extract
    non-personal data from USERS_MONGO_URL (such as users_count).
- EVAL_MONGO_URL contains all tables related to the eval tool. Those don't have any PII but need to
    be accessible from frontend servers (at least for now) to update evaluations.
"""

import os
import typing

import pymongo
from pymongo import database as pymongo_db


# TODO(pascal): Add NewType for personal database.
def get_connections_from_env(default_mongo_url: str = 'mongodb://localhost/test') \
        -> typing.Tuple[pymongo_db.Database, pymongo_db.Database, pymongo_db.Database]:
    """Get database connections from environment.

    If MONGO_URL is not set, use the first defined of the following instead:
        USERS_MONGO_URL, EVAL_MONGO_URL or default_mongo_url
    If either USERS_MONGO_URL or EVAL_MONGO_URL is not set, use MONGO_URL instead

    Returns:
        a tuple with a connection to: the static database, the users database, and then the eval
        database.
    """

    mongo_url = os.getenv('MONGO_URL')
    users_mongo_url = os.getenv('USERS_MONGO_URL')
    eval_mongo_url = os.getenv('EVAL_MONGO_URL')

    if not mongo_url:
        mongo_url = users_mongo_url or eval_mongo_url or default_mongo_url
    users_mongo_url = users_mongo_url or mongo_url
    eval_mongo_url = eval_mongo_url or mongo_url

    database = pymongo.MongoClient(mongo_url).get_database()
    user_database = pymongo.MongoClient(users_mongo_url).get_database()
    eval_database = pymongo.MongoClient(eval_mongo_url).get_database()

    return database, user_database, eval_database
