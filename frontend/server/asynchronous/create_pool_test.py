"""Tests for the create_pool module."""
import unittest

import mock
import mongomock

from bob_emploi.frontend.asynchronous import create_pool


class CreatePoolTestCase(unittest.TestCase):
    """Unit tests for the create pool script."""

    def setUp(self):
        super(CreatePoolTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        self._db_patcher = mock.patch(create_pool.__name__ + '._DB', self._db)
        self._db_patcher.start()

    def tearDown(self):
        self._db_patcher.stop()
        super(CreatePoolTestCase, self).tearDown()

    def test_basic_usage(self):
        """Basic usage."""
        self._db.user.insert_many([
            {
                'googleId': '1234',
                'profile': {
                    'email': 'john@bayes.org',
                    'yearOfBirth': 1982,
                },
            },
            {
                'googleId': '5678',
                'profile': {
                    'email': 'paul@bayes.org',
                    'yearOfBirth': 1954,
                },
            },
        ])

        create_pool.main(pool_name='test-pool', users_json_filters='{}')

        use_cases = list(self._db.use_case.find())
        self.assertEqual([1954, 1982], sorted(u['profile']['yearOfBirth'] for u in use_cases))
        self.assertFalse(use_cases[0]['profile'].get('email'))
        self.assertFalse(use_cases[0].get('googleId'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
