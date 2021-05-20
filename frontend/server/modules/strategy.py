"""Module to score email campaigns corresponding to stragies."""

import re

from bob_emploi.frontend.server import scoring_base


class _FavorStrategy(scoring_base.ModelBase):
    """A scoring model to favor using one or multiple strategies."""

    def __init__(self, strategies: str) -> None:
        super().__init__()
        self._strategies = {strategy.strip() for strategy in strategies.split(',')}

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        for opened_strategy in project.details.opened_strategies:
            if opened_strategy.strategy_id in self._strategies:
                return scoring_base.ExplainedScore(
                    3, ['vous avez démarré une stratégie qui correspond'])

        for strategy in project.details.strategies:
            if strategy.strategy_id in self._strategies:
                return scoring_base.ExplainedScore(
                    2, ["c'est une stratégie qui pourrait marcher dans votre cas"])

        return scoring_base.ExplainedScore(1, [])


# Matches strings like "favor-strategy(other-leads)" or "favor-strategy(a, b, c)".
scoring_base.register_regexp(
    re.compile(r'^favor-strategy\((.*)\)$'), _FavorStrategy, 'favor-strategy(A12, A13)')
