"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""
import collections
import logging

from bob_emploi.frontend import action
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


# TODO(pascal): Import from AirTable.
_ADVICE_MODULES = {
    'reorientation': advisor_pb2.AdviceModule(
        trigger_scoring_model='advice-reorientation',
        engage_sticky_action_template='rec1CWahSiEtlwEHW',
        is_ready_for_prod=True),
}

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])


# TODO(pascal): Add unit tests when there is more logic.

def maybe_advise(user, project, database):
    """Check if a project needs advice and find the best advice for it.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    Returns:
        Whether an advice was triggered.
    """
    _maybe_populate_engage_action(user, project, database)
    return _maybe_find_best_advice(user, project, database)


def _maybe_find_best_advice(user, project, database):
    if user.features_enabled.advisor != user_pb2.ACTIVE or project.best_advice_id:
        return False
    best_score = 0
    best_advice = None
    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database)
    for advice, module in _ADVICE_MODULES.items():
        if not module.is_ready_for_prod and user.features_enabled.alpha:
            continue
        scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
        if scoring_model is None:
            logging.warning(
                'Not able to score advice "%s", the scoring model "%s" is unknown.',
                advice, module.trigger_scoring_model)
            continue
        score = scoring_model.score(scoring_project).score
        if score > best_score:
            best_score = score
            best_advice = advice
    if not best_advice:
        return False

    project.best_advice_id = best_advice
    project.advice_status = project_pb2.ADVICE_RECOMMENDED
    return True


def _maybe_populate_engage_action(user, project, database):
    if (not project.best_advice_id or
            project.advice_status != project_pb2.ADVICE_ACCEPTED or
            project.sticky_actions):
        return False

    module = _ADVICE_MODULES.get(project.best_advice_id)
    if not module:
        logging.error('The Advice Module "%s" is gone.', project.best_advice_id)
        return False
    if not module.engage_sticky_action_template:
        logging.error(
            'The Advice Module "%s" is missing an engage sticky action.',
            project.best_advice_id)
        return False

    template = action.templates(database).get(module.engage_sticky_action_template)
    if not template:
        logging.error(
            'The Advice Module (%s) engage sticky action "%s" is missing.',
            project.best_advice_id, module.engage_sticky_action_template)
        return False

    sticky_action = action.instantiate(
        project.sticky_actions.add(), user, project, template, set(), database, {})
    sticky_action.status = action_pb2.ACTION_STUCK
    return True
