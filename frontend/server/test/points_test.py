"""Unit tests for the Bob Points endpoints."""

import json
import unittest

import mongomock

from bob_emploi.frontend.server.test import base_test


class TransactionTest(base_test.ServerTestCase):
    """Test the transaction endpoint."""

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(TransactionTest, self).setUp()
        self.user_id, self.auth_token = self.create_user_with_token()

    def _call_endpoint(self, data):
        return self.app.post(
            '/api/user/points/{}'.format(self.user_id),
            data=json.dumps(data),
            headers={
                'Authorization': 'Bearer ' + self.auth_token,
                'Content-Type': 'application/json',
            })

    def _set_current_points(self, num_points):
        self._user_db.user.update_one(
            {'_id': mongomock.ObjectId(self.user_id)},
            {'$set': {'appPoints.current': num_points}})

    def test_unknown_transaction(self):
        """Unknown transaction."""

        response = self._call_endpoint({})
        self.assertEqual(422, response.status_code)

    def test_share_reward(self):
        """Get a share reward."""

        response = self._call_endpoint({'reason': 'SHARE_REWARD', 'network': 'facebook'})
        app_points = self.json_from_response(response)
        self.assertEqual(100, app_points.get('current'))

    def test_share_reward_missing_network(self):
        """Try to get a share reward without a network name."""

        response = self._call_endpoint({'reason': 'SHARE_REWARD'})
        self.assertEqual(422, response.status_code)

    def test_rate_reward(self):
        """Get a rate reward."""

        response = self._call_endpoint({'reason': 'RATE_REWARD'})
        app_points = self.json_from_response(response)
        self.assertEqual(150, app_points.get('current'))

    def test_unlock_advice_module(self):
        """Unlock an advice."""

        self._set_current_points(1000)
        response = self._call_endpoint({'reason': 'UNLOCK_ADVICE_MODULE', 'adviceId': 'good-one'})
        app_points = self.json_from_response(response)
        self.assertEqual(900, app_points.get('current'))
        self.assertTrue(app_points.get('unlockedAdviceModules', {}).get('good-one'))

    def test_unlock_advice_module_missing_id(self):
        """Try to unlock an advice, but with no ID."""

        self._set_current_points(1000)
        response = self._call_endpoint({'reason': 'UNLOCK_ADVICE_MODULE'})
        self.assertEqual(422, response.status_code)

    def test_unlock_advice_module_not_enough_points(self):
        """Try to unlock an advice, but with not enough points."""

        response = self._call_endpoint({'reason': 'UNLOCK_ADVICE_MODULE', 'adviceId': 'good-one'})
        self.assertEqual(423, response.status_code)

    def test_unlock_advice_module_twice(self):
        """Unlock an advice twice."""

        self._set_current_points(1000)
        self._call_endpoint({'reason': 'UNLOCK_ADVICE_MODULE', 'adviceId': 'good-one'})

        response = self._call_endpoint({'reason': 'UNLOCK_ADVICE_MODULE', 'adviceId': 'good-one'})
        app_points = self.json_from_response(response)
        self.assertEqual(900, app_points.get('current'), msg='Points were spent only once')
        self.assertTrue(app_points.get('unlockedAdviceModules', {}).get('good-one'))

    def test_explore_advice_module(self):
        """Explore an advice."""

        response = self._call_endpoint({'reason': 'EXPLORE_ADVICE_REWARD', 'adviceId': 'good-one'})
        app_points = self.json_from_response(response)
        self.assertEqual(20, app_points.get('current'))
        self.assertTrue(app_points.get('exploredAdviceModules', {}).get('good-one'))

    def test_explore_advice_module_missing_id(self):
        """Try to explore an advice, but with no ID."""

        response = self._call_endpoint({'reason': 'EXPLORE_ADVICE_REWARD'})
        self.assertEqual(422, response.status_code)

    def test_explore_advice_module_twice(self):
        """Explore an advice twice."""

        self._call_endpoint({'reason': 'EXPLORE_ADVICE_REWARD', 'adviceId': 'good-one'})

        response = self._call_endpoint({'reason': 'EXPLORE_ADVICE_REWARD', 'adviceId': 'good-one'})
        app_points = self.json_from_response(response)
        self.assertEqual(20, app_points.get('current'), msg='Points were earned only once')
        self.assertTrue(app_points.get('exploredAdviceModules', {}).get('good-one'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
