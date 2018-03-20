"""Access to our MongoDB databases."""

import os

import pymongo


def get_connections_from_env(default_mongo_url='mongodb://localhost/test'):
    """Get database connections from environment.

    If at least one of MONGO_URL and USERS_MONGO_URL, use it for both.
    If both are set, use two different databases.
    If none are set use the default mongo url given as argument.

    Returns:
        a tuple with a connection to: the static database, and then the users database.
    """

    mongo_url = os.getenv('MONGO_URL')
    users_mongo_url = os.getenv('USERS_MONGO_URL') or mongo_url

    if not users_mongo_url:
        mongo_url = default_mongo_url
        users_mongo_url = mongo_url
    elif not mongo_url:
        mongo_url = users_mongo_url

    database = pymongo.MongoClient(mongo_url).get_default_database()
    user_database = pymongo.MongoClient(users_mongo_url).get_default_database()
    return database, user_database
