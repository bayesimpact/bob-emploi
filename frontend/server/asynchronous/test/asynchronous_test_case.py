"""Helpers for unit test for asynchronous scripts."""

import os
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import mongo


class TestCase(unittest.TestCase):
    """Base test case to setup DB and clear cache."""

    def setUp(self) -> None:
        super().setUp()
        self.addCleanup(cache.clear)
        env_patcher = mock.patch.dict(os.environ, {
            'MONGO_URL': 'mongodb://mydata.com/test',
            'USERS_MONGO_URL': 'mongodb://my-database/test',
        })
        env_patcher.start()
        self.addCleanup(env_patcher.stop)

        db_patcher = mongomock.patch((('my-database', 27017), ('mydata.com', 27017)))
        db_patcher.start()
        self.addCleanup(db_patcher.stop)
        self._stats_db, self._user_db, self._eval_db = mongo.get_connections_from_env()
