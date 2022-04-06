"""Module to define strategies for a user."""

import collections
import itertools
import logging
import typing
from typing import Optional, Tuple

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import strategy_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring


_STRATEGY_ADVICE_TEMPLATES: proto.MongoCachedCollection[strategy_pb2.StrategyAdviceTemplate] = \
    proto.MongoCachedCollection(strategy_pb2.StrategyAdviceTemplate, 'strategy_advice_templates')

_STRATEGY_MODULES: proto.MongoCachedCollection[strategy_pb2.StrategyModule] = \
    proto.MongoCachedCollection(strategy_pb2.StrategyModule, 'strategy_modules')

_STRATEGY_MODULES_WITH_TEMPLATES: list[Tuple[
    mongo.NoPiiMongoDatabase,
    dict[str, list[strategy_pb2.StrategyModule]]]] = []

_SPECIFIC_TO_JOB_ADVICE_ID = 'specific-to-job'

# Strategy with score less than that is considered less relevant to the user.
_MAXIMUM_SECONDARY_SCORE = 10


def clear_cache() -> None:
    """Clear cached strategy modules with their advice."""

    _STRATEGY_MODULES_WITH_TEMPLATES.clear()


cache.register_clear_func(clear_cache)


def _get_strategy_modules_by_category(database: mongo.NoPiiMongoDatabase) \
        -> dict[str, list[strategy_pb2.StrategyModule]]:
    """Populate the strategy modules with advice templates, and return them grouped by
    diagnostic category.
    """

    # Try to use the cache.
    if _STRATEGY_MODULES_WITH_TEMPLATES and _STRATEGY_MODULES_WITH_TEMPLATES[0][0] == database:
        return _STRATEGY_MODULES_WITH_TEMPLATES[0][1]

    strategies = {s.strategy_id: s for s in _STRATEGY_MODULES.get_collection(database)}
    advice_templates = itertools.groupby(
        _STRATEGY_ADVICE_TEMPLATES.get_collection(database), lambda at: at.strategy_id)
    for strategy_id, full_advice in advice_templates:
        try:
            strategy = strategies[strategy_id]
        except KeyError:
            logging.error(
                'Missing strategy "%s" for advice modules "%s"',
                strategy_id, ', '.join(a.advice_id for a in full_advice))
        strategy.pieces_of_advice.extend(full_advice)
    strategies_by_category: dict[str, list[strategy_pb2.StrategyModule]] = \
        collections.defaultdict(list)
    for strategy in strategies.values():
        for category_id in strategy.category_ids:
            strategies_by_category[category_id].append(strategy)

    # Cache the result.
    _STRATEGY_MODULES_WITH_TEMPLATES.clear()
    _STRATEGY_MODULES_WITH_TEMPLATES.append(
        (database, strategies_by_category))
    return strategies_by_category


class _RequirableModule(typing.NamedTuple):
    module: strategy_pb2.StrategyModule
    is_required: bool


def maybe_strategize(
        user: user_pb2.User, project: project_pb2.Project, database: mongo.NoPiiMongoDatabase) \
        -> bool:
    """Check if a project needs strategies and populate the strategies if so."""

    if project.is_incomplete or project.strategies:
        return False
    strategize(user, project, database)
    return True


def strategize(
        user: user_pb2.User, project: project_pb2.Project, database: mongo.NoPiiMongoDatabase) \
        -> None:
    """Make strategies for the user."""

    scoring_project = scoring.ScoringProject(project, user, database)
    advice_scores = {a.advice_id: a.num_stars for a in project.advices}
    category_modules = _get_strategy_modules_by_category(database).get(
        project.diagnostic.category_id, [])
    for module in category_modules:
        _make_strategy(scoring_project, module, advice_scores)
    scoring_project.details.strategies.sort(key=lambda s: -s.score)
    if not scoring_project.details.strategies:
        if category_modules:
            logging.error(
                'We could not find *any* strategy for a project:\n'
                'Existing strategies: %s\n'
                "User's advice modules: %s\n"
                '%s',
                ', '.join(strategy.strategy_id for strategy in category_modules),
                ', '.join(advice.advice_id for advice in project.advices),
                str(scoring_project))
        return
    scoring_project.details.strategies[0].is_principal = True


def _make_strategy(
        project: scoring.ScoringProject, module: strategy_pb2.StrategyModule,
        advice_scores: dict[str, float]) -> Optional[strategy_pb2.Strategy]:
    if module.is_for_alpha and not project.features_enabled.alpha:
        return None
    score = project.score(module.trigger_scoring_model)
    if not score:
        return None
    score = min(score * 100 / 3, 100 - project.details.diagnostic.overall_score)
    pieces_of_advice = []
    for advice in module.pieces_of_advice:
        user_advice_id = next((a for a in advice_scores if a.startswith(advice.advice_id)), None)
        if not user_advice_id:
            if advice.is_required:
                # A necessary advice is missing, we drop everything.
                return None
            continue
        pieces_of_advice.append(strategy_pb2.StrategyAdvice(
            advice_id=user_advice_id,
            teaser=project.populate_template(project.translate_string(advice.teaser_template)),
            why=project.populate_template(project.translate_string(advice.why_template))))
    if _SPECIFIC_TO_JOB_ADVICE_ID in advice_scores:
        specific_to_job_config = project.specific_to_job_advice_config()
        if specific_to_job_config and module.strategy_id in specific_to_job_config.strategy_ids:
            pieces_of_advice.append(strategy_pb2.StrategyAdvice(
                advice_id=_SPECIFIC_TO_JOB_ADVICE_ID))
    if not pieces_of_advice and not module.external_url_template:
        # Don't want to show a strategy without any advice modules.
        return None
    strategy = project.details.strategies.add(
        description=project.populate_template(project.translate_airtable_string(
            'strategyModules', module.strategy_id, 'description_template',
            hint=module.description_template)),
        score=int(score),
        is_secondary=score <= 10,
        title=project.translate_airtable_string(
            'strategyModules', module.strategy_id, 'title', hint=module.title),
        header=project.populate_template(project.translate_airtable_string(
            'strategyModules', module.strategy_id, 'header_template',
            hint=module.header_template)),
        strategy_id=module.strategy_id,
        external_url=project.populate_template(module.external_url_template),
        infinitive_title=project.translate_airtable_string(
            'strategyModules', module.strategy_id, 'infinitive_title',
            hint=module.infinitive_title),
        action_ids=module.action_ids,
        description_speech=project.populate_template(project.translate_airtable_string(
            'strategyModules', module.strategy_id, 'description_speech',
            hint=module.description_speech, is_genderized=True)),
    )

    if strategy.external_url and pieces_of_advice:
        logging.error(
            'Strategy %s has both an external URL and some pieces of advice:\n%s',
            strategy.strategy_id, ', '.join(a.advice_id for a in pieces_of_advice))

    # Sort found pieces of advice by descending score.
    pieces_of_advice.sort(key=lambda a: advice_scores[a.advice_id], reverse=True)
    strategy.pieces_of_advice.extend(pieces_of_advice)
    return strategy
