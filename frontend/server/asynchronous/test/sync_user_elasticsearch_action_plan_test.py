"""Unit tests for syncing user action plan data to ElasticSearch."""

import datetime
import json
import typing
from typing import Any
import unittest
from unittest import mock

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.server.asynchronous import sync_user_elasticsearch
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


@nowmock.patch(new=lambda: datetime.datetime(2017, 11, 16))
@mock.patch('logging.info', new=mock.MagicMock)
class ActionPlanSyncTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the sync_user_elasticsearch around action plan data."""

    def setUp(self) -> None:
        super().setUp()

        self._db = self._stats_db
        self._user_db = sync_user_elasticsearch.mongo.get_connections_from_env().user_db
        self._user_db.user.drop()
        self.mock_elasticsearch = mock.MagicMock()

    def _test_project(self, project_json: dict[str, Any]) -> dict[str, Any]:
        self._user_db.user.insert_one({
            'registeredAt': '2022-02-12T18:06:08Z',
            'projects': [project_json],
        })
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2022-02-01',
            '--no-dry-run', '--disable-sentry'])

        self.mock_elasticsearch.update.assert_called_once()
        kwargs = self.mock_elasticsearch.update.call_args[1]
        self.assertIn('body', kwargs)
        self.assertIn('doc', kwargs['body'])
        doc = kwargs['body']['doc']
        self.assertTrue(json.dumps(doc), msg='The document should be serializable')
        self.assertIn('project', doc)
        return typing.cast(dict[str, Any], doc['project'])

    def test_action_plan_empty(self) -> None:
        """Action plan status just after the onboarding."""

        project = self._test_project({
            'actions': [
                {
                    'actionId': 'network',
                    'status': 'ACTION_UNREAD',
                },
                {
                    'actionId': 'read-more',
                    'status': 'ACTION_UNREAD',
                },
                {
                    'actionId': 'life-balance',
                    'status': 'ACTION_UNREAD',
                },
            ],
        })

        self.assertLessEqual({'actionPlanStage', 'actionPlanStatus'}, project.keys())
        self.assertEqual(1, project['actionPlanStage'])
        self.assertEqual('EMPTY', project['actionPlanStatus'])

    def test_action_plan_started(self) -> None:
        """Action plan status when some actions have been selected and validated."""

        project = self._test_project({
            'actions': [
                {
                    'actionId': 'network',
                    'status': 'ACTION_CURRENT',
                },
                {
                    'actionId': 'read-more',
                    'status': 'ACTION_CURRENT',
                    'expectedCompletionAt': '2022-02-14T19:06:08Z',
                },
                {
                    'actionId': 'life-balance',
                    'status': 'ACTION_UNREAD',
                },
            ],
            'actionPlanStartedAt': '2022-02-12T19:06:08Z',
        })

        self.assertLessEqual({'actionPlanStage', 'actionPlanStatus'}, project.keys())
        self.assertEqual(3, project['actionPlanStage'])
        self.assertEqual('STARTED', project['actionPlanStatus'])

    def test_action_plan_planned(self) -> None:
        """Action plan status when all selected actions have been scheduled."""

        project = self._test_project({
            'actions': [
                {
                    'actionId': 'network',
                    'status': 'ACTION_UNREAD',
                },
                {
                    'actionId': 'read-more',
                    'status': 'ACTION_CURRENT',
                    'expectedCompletionAt': '2022-02-14T19:06:08Z',
                },
                {
                    'actionId': 'life-balance',
                    'status': 'ACTION_UNREAD',
                },
            ],
            'actionPlanStartedAt': '2022-02-12T19:06:08Z',
        })

        self.assertLessEqual({'actionPlanStage', 'actionPlanStatus'}, project.keys())
        self.assertEqual(4, project['actionPlanStage'])
        self.assertEqual('ALL_PLANNED', project['actionPlanStatus'])

    def test_action_plan_done(self) -> None:
        """Action plan status when all selected actions have been completed."""

        project = self._test_project({
            'actions': [
                {
                    'actionId': 'network',
                    'status': 'ACTION_UNREAD',
                },
                {
                    'actionId': 'read-more',
                    'status': 'ACTION_DONE',
                    'expectedCompletionAt': '2022-02-14T19:06:08Z',
                },
                {
                    'actionId': 'life-balance',
                    'status': 'ACTION_UNREAD',
                },
            ],
            'actionPlanStartedAt': '2022-02-12T19:06:08Z',
        })

        self.assertLessEqual({'actionPlanStage', 'actionPlanStatus'}, project.keys())
        self.assertEqual(5, project['actionPlanStage'])
        self.assertEqual('ALL_DONE', project['actionPlanStatus'])


if __name__ == '__main__':
    unittest.main()
