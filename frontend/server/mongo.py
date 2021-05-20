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
from typing import Any, Literal

import pymongo
from pymongo import database as pymongo_db

from bob_emploi.frontend.server import cache


class UsersDatabase(typing.NamedTuple):
    """Users Database.

    This is a proxy object to avoid exposing the full pymongo Database object and restrict
    statically which collections are accessed.
    """

    feedbacks: pymongo.collection.Collection
    user: pymongo.collection.Collection
    user_auth: pymongo.collection.Collection

    @classmethod
    def from_database(cls, database: pymongo_db.Database) -> 'UsersDatabase':
        """Create a UsersDatabase from a pymongo DB."""

        return cls(
            # TODO(pascal): Rename to a singular or another plural word.
            database.feedbacks,
            database.user,
            database.user_auth,
        )

    def get_collection(self, name: Literal['user']) \
            -> pymongo.collection.Collection:
        """Get a collection by name."""

        return self.user.database.get_collection(name)

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, self.__class__):
            return other.user == self.user
        return NotImplemented

    def __hash__(self) -> int:
        return hash((self.user.database.client.address, self.user.database.name))


# Pymongo Database that does not contain any PII
NoPiiMongoDatabase = typing.NewType('NoPiiMongoDatabase', pymongo_db.Database)


# TODO(pascal): Drop this once pymongo_db.Database objects are hashable.
class HashableNoPiiMongoDatabase:
    """A hashable holder of a NoPiiMongoDatabase."""

    def __init__(self, database: NoPiiMongoDatabase) -> None:
        self._database = database

    @property
    def database(self) -> NoPiiMongoDatabase:
        """The database held by this proxy."""

        return self._database

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, self.__class__):
            return other._database == self._database
        return NotImplemented

    def __hash__(self) -> int:
        return hash((self._database.client.address, self._database.name))


class _Databases(typing.NamedTuple):
    stats_db: NoPiiMongoDatabase
    user_db: UsersDatabase
    eval_db: NoPiiMongoDatabase


@cache.lru(maxsize=1)
def get_connections_from_env(default_mongo_url: str = 'mongodb://localhost/test') -> _Databases:
    """Get database connections from environment.

    If MONGO_URL is not set, use the first defined of the following instead:
        USERS_MONGO_URL, EVAL_MONGO_URL or default_mongo_url
    If either USERS_MONGO_URL or EVAL_MONGO_URL is not set, use MONGO_URL instead

    Returns:
        a tuple with a connection to: the static database, the users database, and then the eval
        database.
    """

    # TODO(sil): Clean up the unverified_data_zones table in _DB.
    mongo_url = os.getenv('MONGO_URL')
    users_mongo_url = os.getenv('USERS_MONGO_URL')
    eval_mongo_url = os.getenv('EVAL_MONGO_URL')

    if not mongo_url:
        mongo_url = users_mongo_url or eval_mongo_url or default_mongo_url
    users_mongo_url = users_mongo_url or mongo_url
    eval_mongo_url = eval_mongo_url or mongo_url

    database = NoPiiMongoDatabase(pymongo.MongoClient(mongo_url).get_database())
    user_pymongo_db = pymongo.MongoClient(users_mongo_url).get_database()
    user_database = UsersDatabase.from_database(user_pymongo_db)
    eval_database = NoPiiMongoDatabase(pymongo.MongoClient(eval_mongo_url).get_database())

    return _Databases(database, user_database, eval_database)
