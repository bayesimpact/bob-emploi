"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""
import collections
import datetime
import logging
import random

from bson import objectid

from bob_emploi.frontend import action
from bob_emploi.frontend import now
from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

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


def _maybe_recommend_advice(user, project, database):
    if user.features_enabled.advisor != user_pb2.ACTIVE or project.advices:
        return False

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database)
    scores = {}
    advice_modules = _advice_modules(database)
    for module in advice_modules:
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
        advice_modules,
        key=lambda m: (scores.get(m.advice_id, 0), m.advice_id),
        reverse=True)
    incompatible_modules = set()
    for module in modules:
        if not scores.get(module.advice_id):
            # We can break as others will have 0 score as well.
            break
        if module.airtable_id in incompatible_modules:
            continue
        piece_of_advice = project.advices.add()
        piece_of_advice.advice_id = module.advice_id
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
        piece_of_advice.num_stars = scores.get(module.advice_id)

        incompatible_modules.update(module.incompatible_advice_ids)

        _compute_extra_data(piece_of_advice, module, scoring_project)

    return True


def _compute_extra_data(piece_of_advice, module, scoring_project):
    if not module.extra_data_field_name:
        return
    scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
    try:
        compute_extra_data = scoring_model.compute_extra_data
    except AttributeError:
        logging.warning(
            'The scoring model %s has no compute_extra_data method', module.trigger_scoring_model)
        return
    extra_data = compute_extra_data(scoring_project)
    if not extra_data:
        return
    try:
        data_field = getattr(piece_of_advice, module.extra_data_field_name)
    except NameError:
        logging.warning(
            'The Advice proto does not have a %s field as requested by the module %s',
            module.extra_data_field_name, module.advice_id)
        return
    data_field.CopyFrom(extra_data)


def list_all_tips(user, project, piece_of_advice, database, cache=None, filter_tip=None):
    """List all available tips for a piece of advice.

    Args:
        user: the full user info.
        project: the project to give tips for.
        piece_of_advice: the piece of advice to give tips for.
        database: access to the database to get modules and tips.
        cache: an optional dict that is used across calls to this function to
            cache data when scoring tips.
        filter_tip: a function to select which tips to keep, by default (None)
            keeps all of them.
    Returns:
        An iterable of tips for this module.
    """
    if not cache:
        cache = {}

    try:
        module = next(
            m for m in _advice_modules(database)
            if m.advice_id == piece_of_advice.advice_id)
    except StopIteration:
        logging.warning('Advice module %s does not exist anymore', piece_of_advice.advice_id)
        return []

    # Get tip templates.
    all_tip_templates = _tip_templates(database)
    tip_templates = filter(None, (all_tip_templates.get(t) for t in module.tip_template_ids))

    # Additional filter from caller.
    if filter_tip:
        tip_templates = filter(filter_tip, tip_templates)

    # Filter tips.
    scoring_project = cache.get('scoring_project')
    if not scoring_project:
        scoring_project = scoring.ScoringProject(
            project, user.profile, user.features_enabled, database)
        cache['scoring_project'] = scoring_project
    filtered_tips = scoring.filter_using_score(
        tip_templates, lambda t: t.filters, scoring_project)

    return filtered_tips


def select_advice_for_email(user, weekday, database):
    """Select an advice to promote in a follow-up email."""
    if not user.projects:
        return None

    project = user.projects[0]
    if not project.advices:
        return None

    easy_advice_modules = _easy_advice_modules(database)
    history = advisor_pb2.EmailHistory()
    history_dict = database.email_history.find_one({'_id': objectid.ObjectId(user.user_id)})
    proto.parse_from_mongo(history_dict, history)

    today = now.get()
    last_monday = today - datetime.timedelta(days=today.weekday())

    def _score_advice(priority_and_advice):
        """Score piece of advice to compare to others, the higher the better."""
        priority, advice = priority_and_advice
        score = 0

        # Enforce priority advice on Mondays (between -10 and +10).
        if weekday == user_pb2.MONDAY:
            priority_score = (advice.score or 5) - 10 * priority / len(project.advices)
            score += priority_score

        # Enforce easy advice on Fridays (between +0 and +1).
        if weekday == user_pb2.FRIDAY and advice.advice_id in easy_advice_modules:
            score += 1

        random_factor = (advice.score or 5) / 10

        last_sent = history.advice_modules[advice.advice_id].ToDatetime()
        last_sent_monday = last_sent - datetime.timedelta(days=last_sent.weekday())

        # Do not send the same advice in the same week (+0 or -20).
        if last_sent_monday >= last_monday:
            score -= 20
        # Reduce the random boost if advice was sent in past weeks (*0.2 the
        # week just before, *0.45 the week before that, *0.585, *0.669, …) .
        else:
            num_weeks_since_last_sent = (last_monday - last_sent_monday).days / 7
            random_factor *= .2**(1 / num_weeks_since_last_sent)

        # Randomize pieces of advice with the same score (between +0 and +1).
        score += random.random() * random_factor

        return score

    candidates = sorted(enumerate(project.advices), key=_score_advice, reverse=True)
    return next(advice for priority, advice in candidates)


def select_tips_for_email(user, project, piece_of_advice, database, num_tips=3):
    """Select tips to promote an advice in a follow-up email."""
    all_templates = list_all_tips(
        user, project, piece_of_advice, database, filter_tip=lambda t: t.is_ready_for_email)

    # TODO(pascal): Factorize with above.
    history = advisor_pb2.EmailHistory()
    history_dict = database.email_history.find_one({'_id': objectid.ObjectId(user.user_id)})
    proto.parse_from_mongo(history_dict, history)

    today = now.get()

    def _score_tip_template(tip_template):
        """Score tip template to compare to others, the higher the better."""
        score = 0

        last_sent = history.tips[tip_template.action_template_id].ToDatetime()
        # Score higher the tips that have not been sent for longer time.
        score += (today - last_sent).days

        # Randomize tips with the same score.
        score += random.random()

        return score

    selected_templates = sorted(all_templates, key=_score_tip_template)[-num_tips:]
    if not selected_templates:
        return None

    # Instantiate actual tips.
    selected_tips = [
        action.instantiate(action_pb2.Action(), user, project, template, for_email=True)
        for template in selected_templates]

    # Replicate tips if we do not have enough.
    while len(selected_tips) < num_tips:
        selected_tips.extend(selected_tips)

    return selected_tips[:num_tips]


# Cache (from MongoDB) of known advice module.
_ADVICE_MODULES = proto.MongoCachedCollection(advisor_pb2.AdviceModule, 'advice_modules')
_EASY_ADVICE_MODULES = set()


def _advice_modules(database):
    return _ADVICE_MODULES.get_collection(database)


def get_advice_module(advice_id, database):
    """Get a module by its ID."""
    try:
        return next(a for a in _advice_modules(database) if a.advice_id == advice_id)
    except StopIteration:
        return None


def _easy_advice_modules(database):
    if _EASY_ADVICE_MODULES:
        return _EASY_ADVICE_MODULES
    _EASY_ADVICE_MODULES.update(
        a.advice_id for a in _advice_modules(database)
        if a.is_easy)
    return _EASY_ADVICE_MODULES


# Cache (from MongoDB) of known tip templates.
_TIP_TEMPLATES = proto.MongoCachedCollection(action_pb2.ActionTemplate, 'tip_templates')


def _tip_templates(database):
    """Returns a list of known tip templates as protos."""
    return _TIP_TEMPLATES.get_collection(database)


def clear_cache():
    """Clear all caches for this module."""
    _ADVICE_MODULES.reset_cache()
    _EASY_ADVICE_MODULES.clear()
    _TIP_TEMPLATES.reset_cache()
