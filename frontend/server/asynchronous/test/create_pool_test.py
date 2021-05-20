"""Tests for the create_pool module."""

import unittest
from unittest import mock

import mongomock
import requests_mock

from bob_emploi.frontend.server.asynchronous import create_pool


@mongomock.patch(on_new='create')
class CreatePoolTestCase(unittest.TestCase):
    """Unit tests for the create pool script."""

    def tearDown(self) -> None:
        create_pool.mongo.cache.clear()
        super().tearDown()

    @requests_mock.mock()
    @mock.patch(
        create_pool.__name__ + '._SLACK_CREATE_POOL_URL', 'https://slack.example.com/webhook')
    def test_basic_usage(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic usage."""

        stats_db, user_db, eval_db = create_pool.mongo.get_connections_from_env()
        stats_db.user_count.drop()
        user_db.user.drop()
        eval_db.use_case.drop()

        stats_db.user_count.insert_one({
            'frequentFirstnames': {
                'Nicolas': 1,
            },
        })
        user_db.user.insert_many([
            {
                'googleId': '1234',
                'profile': {
                    'email': 'john@bayes.org',
                    'name': 'John',
                    'yearOfBirth': 1982,
                },
            },
            {
                'googleId': '5678',
                'profile': {
                    'email': 'paul@bayes.org',
                    'name': 'Paul',
                    'yearOfBirth': 1954,
                },
            },
        ])

        mock_requests.post('https://slack.example.com/webhook')
        create_pool.main(pool_name='test-pool', users_json_filters='{}')

        use_cases = list(eval_db.use_case.find())
        self.assertEqual(
            [1954, 1982], sorted(u['userData']['profile']['yearOfBirth'] for u in use_cases))
        self.assertFalse(use_cases[0]['userData']['profile'].get('email'))
        self.assertEqual('Nicolas', use_cases[0]['userData']['profile'].get('name'))
        self.assertFalse(use_cases[0]['userData'].get('googleId'))
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text':
                    'A new use cases pool is ready for evaluation: '
                    '<https://www.bob-emploi.fr/eval/test-pool|test-pool>',
            },
            mock_requests.request_history[0].json(),
        )

    @requests_mock.mock()
    @mock.patch(
        create_pool.__name__ + '._SLACK_CREATE_POOL_URL', 'https://slack.example.com/webhook')
    def test_no_user(self, mock_requests: requests_mock.Mocker) -> None:
        """Don't create a pool if there are no users."""

        stats_db, user_db, eval_db = create_pool.mongo.get_connections_from_env()
        stats_db.user_count.drop()
        user_db.user.drop()
        eval_db.use_case.drop()

        stats_db.user_count.insert_one({
            'frequentFirstnames': {
                'Nicolas': 1,
            },
        })

        mock_requests.post('https://slack.example.com/webhook')
        create_pool.main(pool_name='test-pool', users_json_filters='{}')

        use_cases = list(eval_db.use_case.find())
        self.assertFalse(use_cases)
        self.assertEqual(0, mock_requests.call_count)


if __name__ == '__main__':
    unittest.main()
