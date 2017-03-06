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
_ADVICE_MODULES = [
    # TODO(pascal): Clean up scoring model then remove.
    advisor_pb2.AdviceModule(
        advice_id='reorientation',
        trigger_scoring_model='advice-reorientation',
        # https://airtable.com/tblsScCB9ouUfiQ8q/viwBc6UUcEcxN2wC4/rec1CWahSiEtlwEHW
        engage_sticky_action_template='rec1CWahSiEtlwEHW'),
    advisor_pb2.AdviceModule(
        advice_id='spontaneous-application',
        trigger_scoring_model='constant(2)',
        # https://airtable.com/tblsScCB9ouUfiQ8q/viwBc6UUcEcxN2wC4/recx1jyNbJWmcK7XP
        engage_sticky_action_template='recx1jyNbJWmcK7XP',
        is_ready_for_prod=True),
    advisor_pb2.AdviceModule(
        advice_id='network-application',
        trigger_scoring_model='advice-improve-network',
        # https://airtable.com/tblsScCB9ouUfiQ8q/viwBc6UUcEcxN2wC4/recmBrBpGNTaF6CPA
        engage_sticky_action_template='recmBrBpGNTaF6CPA',
        is_ready_for_prod=True),
    # TODO(pascal): Clean up scoring model then remove.
    advisor_pb2.AdviceModule(
        advice_id='long-cdd',
        trigger_scoring_model='advice-long-cdd',
        engage_sticky_action_template='recWvSwLhhlIpVyJl'),
    advisor_pb2.AdviceModule(
        advice_id='other-work-env',
        trigger_scoring_model='advice-other-work-env',
        # TODO(pascal): Fix when ready.
        engage_sticky_action_template='reciXQKXyZb1beHXz',
        extra_data_field_name='other_work_env_advice_data',
        is_ready_for_prod=True),
    advisor_pb2.AdviceModule(
        advice_id='improve-success',
        # TODO(guillaume): Fix with correct model.
        trigger_scoring_model='constant(2)',
        # TODO(guillaume): Fix with correct sticky.
        engage_sticky_action_template='reciXQKXyZb1beHXz'),
]

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])


def maybe_advise(user, project, database):
    """Check if a project needs advice and populate all advice fields if not.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    """
    if project.is_incomplete:
        return
    _maybe_recommend_advice(user, project, database)
    _maybe_populate_engage_action(user, project, database)


def _maybe_recommend_advice(user, project, database):
    if user.features_enabled.advisor != user_pb2.ACTIVE or project.advices:
        return False

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database)
    scores = {}
    for module in _ADVICE_MODULES:
        if not module.is_ready_for_prod and not user.features_enabled.alpha:
            continue
        scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
        if scoring_model is None:
            logging.warning(
                'Not able to score advice "%s", the scoring model "%s" is unknown.',
                module.advice_id, module.trigger_scoring_model)
            continue
        scores[module.advice_id] = scoring_model.score(scoring_project).score

    modules = sorted(
        _ADVICE_MODULES,
        key=lambda m: (scores.get(m.advice_id, 0), m.advice_id),
        reverse=True)
    for module in modules:
        if not scores.get(module.advice_id):
            break
        piece_of_advice = project.advices.add()
        piece_of_advice.advice_id = module.advice_id
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
        piece_of_advice.num_stars = scores.get(module.advice_id)

        # TODO(pascal): Refactor with a cleaner pattern when/if we have more fields.
        if module.extra_data_field_name == 'other_work_env_advice_data':
            job_group_info = scoring_project.job_group_info()
            if job_group_info.HasField('work_environment_keywords'):
                piece_of_advice.other_work_env_advice_data.work_environment_keywords.CopyFrom(
                    job_group_info.work_environment_keywords)

    return True


def _maybe_populate_engage_action(user, project, database):
    for advice in project.advices:
        if not _advice_need_engage_action(advice):
            continue
        template = _get_engagement_action_template(advice.advice_id, database)
        if template:
            engagement_action = action.instantiate(
                advice.engagement_action, user, project, template, set(), database, {})
            engagement_action.status = action_pb2.ACTION_STUCK


def _advice_need_engage_action(advice):
    return advice.advice_id and not advice.engagement_action.action_id


def _get_engagement_action_template(advice_id, database):
    try:
        module = next(m for m in _ADVICE_MODULES if m.advice_id == advice_id)
    except StopIteration:
        logging.error('The Advice Module "%s" is gone.', advice_id)
        return None
    if not module.engage_sticky_action_template:
        logging.error(
            'The Advice Module "%s" is missing an engage sticky action.',
            advice_id)
        return None

    template = action.templates(database).get(module.engage_sticky_action_template)
    if not template:
        logging.error(
            'The Advice Module (%s) engage sticky action "%s" is missing.',
            advice_id, module.engage_sticky_action_template)
        return None

    return template
