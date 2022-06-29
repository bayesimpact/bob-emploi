"""Unit tests for the frontend.server.features module."""

import os
import unittest
from unittest import mock

from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import features


class FeaturesTest(unittest.TestCase):
    """Unit tests for the assign_features function."""

    def setUp(self) -> None:
        super().setUp()
        self.addCleanup(cache.clear)
        logging_error_patcher = mock.patch('logging.error')
        self._mock_logging_error = logging_error_patcher.start()
        self.addCleanup(self._mock_logging_error.assert_not_called)
        self.addCleanup(logging_error_patcher.stop)

    def _assert_is_empty(self, features_enabled: features_pb2.Features) -> None:
        self.assertFalse(str(features_enabled))

    def _assert_logging_error(self, needle: str) -> None:
        self._mock_logging_error.assert_called_once()
        try:
            self.assertIn(
                needle,
                self._mock_logging_error.call_args[0][0] %
                self._mock_logging_error.call_args[0][1:])
        finally:
            self._mock_logging_error.reset_mock()

    @mock.patch.dict(os.environ, {'EXPERIMENTS_ROLLOUTS': ''})
    def test_assign_no_env_var(self) -> None:
        """No assignment of features when no env var."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self._assert_is_empty(features_enabled)

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS': '{"action_plan":{"newUsersInActive": 100}}'})
    def test_assign_all_new(self) -> None:
        """Assignment of an experiment to all new users."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self.assertEqual(features_pb2.ACTIVE, features_enabled.action_plan)

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS':
        '{"action_plan":{"newUsersInControl": 30, "newUsersInActive": 30}}'})
    def test_assign_random_new(self) -> None:
        """Assign randomly in two branches and unassigned depending on thresholds for new users."""

        with mock.patch('random.random', new=lambda: .1):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=True)
            self.assertEqual(features_pb2.CONTROL, features_enabled.action_plan)

        with mock.patch('random.random', new=lambda: .5):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=True)
            self.assertEqual(features_pb2.ACTIVE, features_enabled.action_plan)

        with mock.patch('random.random', new=lambda: .8):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=True)
            self._assert_is_empty(features_enabled)

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS':
        '{"action_plan":{"unassignedUsersInControl": 30, "unassignedUsersInActive": 30}}'})
    def test_assign_random_existing(self) -> None:
        """Assign randomly in two branches and unassigned depending on thresholds for old users."""

        with mock.patch('random.random', new=lambda: .1):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=False)
            self.assertEqual(features_pb2.CONTROL, features_enabled.action_plan)

        with mock.patch('random.random', new=lambda: .5):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=False)
            self.assertEqual(features_pb2.ACTIVE, features_enabled.action_plan)

        with mock.patch('random.random', new=lambda: .8):
            features_enabled = features_pb2.Features()
            features.assign_features(features_enabled, is_new=False)
            self._assert_is_empty(features_enabled)

    @mock.patch.dict(os.environ, {'EXPERIMENTS_ROLLOUTS': '{A:B}'})
    def test_error_in_json(self) -> None:
        """No assignment of features if we have a JSON error in the env var."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self._assert_is_empty(features_enabled)

        self._assert_logging_error('EXPERIMENTS_ROLLOUTS env')

    @mock.patch.dict(os.environ, {
        # The feature use the camelCase name instead of snake_case.
        'EXPERIMENTS_ROLLOUTS': '{"actionPlan":{"newUsersInActive": 100}}'})
    def test_error_in_feature_name(self) -> None:
        """Does not crash if we use the wrong env var."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self._assert_is_empty(features_enabled)

        self._assert_logging_error(
            'Feature configured in EXPERIMENTS_ROLLOUTS env var does not exist: actionPlan')

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS':
        '{"action_plan":{"newUsersInActive": 100}, "b": {"newUsersInActive": 100}}'})
    def test_error_in_other_feature_name(self) -> None:
        """Still apply an experiment if another one use the wrong env var."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self.assertEqual(features_pb2.ACTIVE, features_enabled.action_plan)

        self._assert_logging_error(
            'Feature configured in EXPERIMENTS_ROLLOUTS env var does not exist: b')

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS': '{"follow_up_long_term":{"newUsersInActive": 100}}'})
    def test_not_a_binary_experiment(self) -> None:
        """Does not work (but no crash) if we use a feature that is not an experiment."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self._assert_is_empty(features_enabled)

        self._assert_logging_error(
            'Feature configured in EXPERIMENTS_ROLLOUTS env var is not a binary experiment: '
            'follow_up_long_term')

    @mock.patch.dict(os.environ, {
        'EXPERIMENTS_ROLLOUTS':
        '{"action_plan":{"newUsersInActive": 80, "newUsersInControl": 80}}'})
    def test_assign_more_than_100_percent(self) -> None:
        """Trying to assign more than 100% of users."""

        features_enabled = features_pb2.Features()
        features.assign_features(features_enabled, is_new=True)
        self._assert_is_empty(features_enabled)

        self._assert_logging_error(
            'Config for feature "action_plan" is invalid in EXPERIMENTS_ROLLOUTS env var:')


if __name__ == '__main__':
    unittest.main()
