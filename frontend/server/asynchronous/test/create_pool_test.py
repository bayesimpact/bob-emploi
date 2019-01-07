"""Tests for the create_pool module."""

import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server.asynchronous import create_pool


class CreatePoolTestCase(unittest.TestCase):
    """Unit tests for the create pool script."""

    def setUp(self) -> None:
        super(CreatePoolTestCase, self).setUp()
        client = mongomock.MongoClient()

        self._db = client.test
        patcher = mock.patch(create_pool.__name__ + '._DB', self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

        self._user_db = client.user_test
        patcher = mock.patch(create_pool.__name__ + '._USER_DB', self._user_db)
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch(create_pool.__name__ + '.requests.post')
    @mock.patch(
        create_pool.__name__ + '._SLACK_CREATE_POOL_URL', 'https://slack.example.com/webhook')
    def test_basic_usage(self, mock_post: mock.MagicMock) -> None:
        """Basic usage."""

        self._user_db.user.insert_many([
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
        self.assertEqual(
            [1954, 1982], sorted(u['userData']['profile']['yearOfBirth'] for u in use_cases))
        self.assertFalse(use_cases[0]['userData']['profile'].get('email'))
        self.assertFalse(use_cases[0]['userData'].get('googleId'))
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    'A new use cases pool is ready for evaluation: '
                    '<https://www.bob-emploi.fr/eval?poolName=test-pool|test-pool>',
            },
        )


if __name__ == '__main__':
    unittest.main()
