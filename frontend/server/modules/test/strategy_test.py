"""Unit tests for the reorient-jobbing module."""

import unittest

from bob_emploi.frontend.server.test import scoring_test


class FavorStrategyTest(scoring_test.ScoringModelTestBase):
    """Unit tests for the "explore-safe-jobs" advice module."""

    model_id = 'favor-strategy(depth-first, picky)'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.strategies.add(strategy_id='a-started-strategy')
        self.persona.project.strategies.add(strategy_id='another-strategy')
        self.persona.project.opened_strategies.add(strategy_id='a-started-strategy')

    def test_user_has_started_all_strategies(self) -> None:
        """User has started all the strategies from the model."""

        self.persona.project.strategies.add(strategy_id='depth-first')
        self.persona.project.strategies.add(strategy_id='picky')
        self.persona.project.opened_strategies.add(strategy_id='depth-first')
        self.persona.project.opened_strategies.add(strategy_id='picky')
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_user_has_started_one_strategy(self) -> None:
        """User has started one of the strategies from the model."""

        self.persona.project.strategies.add(strategy_id='picky')
        self.persona.project.opened_strategies.add(strategy_id='picky')
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg=f'Failed for "{self.persona.name}"')

    def test_strategy_is_useful_for_main_challenge(self) -> None:
        """User hasn't started any strategy but one could be useful for them."""

        self.persona.project.strategies.add(strategy_id='depth-first')
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Failed for "{self.persona.name}"')

    def test_strategies_are_useless_for_main_challenge(self) -> None:
        """The strategies are useless for the user's main challenge."""

        score = self._score_persona(self.persona)
        self.assertEqual(score, 1, msg=f'Failed for "{self.persona.name}"')


if __name__ == '__main__':
    unittest.main()
