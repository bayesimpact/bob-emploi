"""Unit tests for the bob_emploi.frontend.advisor module."""
import logging
import unittest

import mock
import mongomock

from bob_emploi.frontend import action
from bob_emploi.frontend import advisor
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class MaybeAdviseTestCase(unittest.TestCase):
    """Unit tests for the maybe_advise function."""

    def setUp(self):
        super(MaybeAdviseTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })
        self.user = user_pb2.User(features_enabled=user_pb2.Features(
            sticky_actions=user_pb2.ACTIVE,
            advisor=user_pb2.ACTIVE))
        action.clear_cache()

    def test_populate_engage_action(self):
        """Test that the engage action gets populated when the advice is accepted."""
        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='reorientation',
            status=project_pb2.ADVICE_ACCEPTED)])
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual('Reorientation !', project.advices[0].engagement_action.goal)

    def test_populate_engage_action_declined_advice(self):
        """Test that the engage action gets populated when the advice is declined."""
        project = project_pb2.Project(
            advices=[project_pb2.Advice(
                advice_id='reorientation',
                status=project_pb2.ADVICE_DECLINED)])
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual('Reorientation !', project.advices[0].engagement_action.goal)

    def test_not_populate_engage_action_recommended_advice(self):
        """Test that the engage action does not get populated when the advice is recommended."""
        project = project_pb2.Project(
            advices=[project_pb2.Advice(
                advice_id='reorientation',
                status=project_pb2.ADVICE_RECOMMENDED)])
        advisor.maybe_advise(self.user, project, self.database)

        self.assertFalse(project.advices[0].engagement_action.goal)

    def test_populate_engage_actions(self):
        """Test that the engage actions get populated."""
        self.database.action_templates.insert_one({
            '_id': 'recmBrBpGNTaF6CPA',
            'goal': 'Network !',
        })
        project = project_pb2.Project(
            advices=[
                project_pb2.Advice(
                    advice_id='reorientation',
                    status=project_pb2.ADVICE_ACCEPTED),
                project_pb2.Advice(
                    advice_id='network-application',
                    status=project_pb2.ADVICE_NOT_RECOMMENDED),
            ])
        advisor.maybe_advise(self.user, project, self.database)

        self.assertFalse(project.sticky_actions)
        self.assertEqual(
            ['Reorientation !', 'Network !'],
            [a.engagement_action.goal for a in project.advices])

    @mock.patch(logging.__name__ + '.error')
    def test_missing_module(self, mock_error):
        """Test that the advisor does not crash when a module is missing."""
        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='does-not-exist',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))
        mock_error.assert_called_with('The Advice Module "%s" is gone.', 'does-not-exist')

    @mock.patch(logging.__name__ + '.error')
    def test_missing_engage_sticky_action(self, mock_error):
        """Test that the advisor does not crash when a sticky action is missing."""
        self.database.action_templates.drop()
        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='reorientation',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))
        mock_error.assert_called_with(
            'The Advice Module (%s) engage sticky action "%s" is missing.',
            'reorientation',
            'rec1CWahSiEtlwEHW')

    @mock.patch(advisor.scoring.__name__ + '.get_scoring_model')
    def test_find_all_pieces_of_advice(self, mock_get_scoring_model):
        """Test that the advisor scores all advice modules."""
        project = project_pb2.Project()

        def _get_scoring_model(model_name):
            model = mock.MagicMock()
            if model_name != 'chantier-spontaneous-application':
                model.score().score = 0
            else:
                model.score().score = 3
            return model

        mock_get_scoring_model.side_effect = _get_scoring_model

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual('spontaneous-application', project.advices[0].advice_id)
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)
        self.assertEqual(
            {project_pb2.ADVICE_NOT_RECOMMENDED}, {a.status for a in project.advices[1:]})

    @mock.patch(advisor.scoring.__name__ + '.get_scoring_model')
    def test_recommend_advice_none(self, mock_get_scoring_model):
        """Test that the advisor does not recommend anyting if all modules score 0."""
        project = project_pb2.Project()
        mock_get_scoring_model().score().score = 0
        mock_get_scoring_model.reset_mock()

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(
            {project_pb2.ADVICE_NOT_RECOMMENDED},
            {a.status for a in project.advices})


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
