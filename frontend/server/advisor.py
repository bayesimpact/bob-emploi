"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""

import collections
import logging
import threading

import mailjet_rest

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])


def maybe_advise(user, project, database, base_url='http://localhost:3000'):
    """Check if a project needs advice and populate all advice fields if not.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    """

    if project.is_incomplete:
        return
    if _maybe_recommend_advice(user, project, database) and project.advices:
        try:
            _send_activation_email(user, project, database, base_url)
        except mailjet_rest.client.ApiError as error:
            logging.warning('Could not send the activation email: %s', error)


def _maybe_recommend_advice(user, project, database):
    if user.features_enabled.advisor == user_pb2.CONTROL or project.advices:
        return False
    advices = compute_advices_for_project(user, project, database)
    for piece_of_advice in advices.advices:
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
    project.advices.extend(advices.advices[:])
    return True


def maybe_categorize_advice(user, project, database):
    """Check if a project needs advice categories and populate all advice_categories
    fields if not.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    """

    if project.is_incomplete or not project.advices:
        return False
    # TODO(pascal): Drop the workbench feature flag.
    if user.features_enabled.workbench == user_pb2.CONTROL or project.advice_categories:
        return False
    project.advice_categories.extend(compute_advice_categories(project, database).advice_categories)
    return True


def compute_advices_for_project(user, project, database, scoring_timeout_seconds=3):
    """Advise on a user project.

    Args:
        user: the user's data, mainly used for their profile and features_enabled.
        project: the project data. It will not be modified.
        database: access to the MongoDB with market data.
    Returns:
        an Advices protobuffer containing a list of recommendations.
    """

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    scores = {}
    reasons = {}
    advice_modules = _advice_modules(database)
    advice = project_pb2.Advices()
    for module in advice_modules:
        if not module.is_ready_for_prod and not user.features_enabled.alpha:
            continue
        scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
        if scoring_model is None:
            logging.warning(
                'Not able to score advice "%s", the scoring model "%s" is unknown.',
                module.advice_id, module.trigger_scoring_model)
            continue
        if user.features_enabled.all_modules:
            scores[module.advice_id] = 3
        else:
            thread = threading.Thread(
                target=_compute_score_and_reasons,
                args=(scores, reasons, module, scoring_model, scoring_project))
            thread.start()
            # TODO(pascal): Consider scoring different models in parallel.
            thread.join(timeout=scoring_timeout_seconds)
            if thread.is_alive():
                logging.warning(
                    'Timeout while scoring advice "%s" for:\n%s\n%s',
                    module.trigger_scoring_model, scoring_project.user_profile,
                    scoring_project.details)

    modules = sorted(
        advice_modules,
        key=lambda m: (scores.get(m.advice_id, 0), m.advice_id),
        reverse=True)
    incompatible_modules = set()
    for module in modules:
        if not scores.get(module.advice_id):
            # We can break as others will have 0 score as well.
            break
        if module.airtable_id in incompatible_modules and not user.features_enabled.all_modules:
            continue
        piece_of_advice = advice.advices.add()
        piece_of_advice.advice_id = module.advice_id
        piece_of_advice.num_stars = scores.get(module.advice_id)
        piece_of_advice.explanations.extend(
            scoring_project.populate_template(reason)
            for reason in reasons.get(module.advice_id, []))

        incompatible_modules.update(module.incompatible_advice_ids)

        _compute_extra_data(piece_of_advice, module, scoring_project)
        _maybe_override_advice_data(piece_of_advice, module, scoring_project)

    return advice


def compute_advice_categories(project, database):
    """Compute categories on computed advice list.

    Args:
        advice: advice list computed from user's project.
    Yields:
        an advice_category object from the most important to the least.
    """

    if not project.advices:
        return
    categories = collections.defaultdict(list)
    scores = collections.defaultdict(int)
    final_categories = project_pb2.AdviceCategories()
    three_stars_advice = []
    advice_modules = _advice_modules(database)
    advice_categories = {m.advice_id: m.categories for m in advice_modules}
    # advice_categories scores are the sum of their advice's number of stars.
    for piece_of_advice in project.advices:
        if piece_of_advice.num_stars == 3:
            three_stars_advice.append(piece_of_advice.advice_id)
        for category in advice_categories.get(piece_of_advice.advice_id, []):
            categories[category].append(piece_of_advice.advice_id)
            scores[category] += piece_of_advice.num_stars

    if three_stars_advice:
        final_categories.advice_categories.add(
            category_id='three-stars', advice_ids=three_stars_advice)
    for category in sorted(scores, key=scores.get, reverse=True):
        final_categories.advice_categories.add(
            category_id=category, advice_ids=categories[category])

    # Avoid having the first advice being the same for two categories that
    # follow one another.
    for index, category in enumerate(final_categories.advice_categories):
        if index == 0:
            continue
        previous_category = final_categories.advice_categories[index - 1]
        if previous_category.advice_ids[0] != category.advice_ids[0]:
            continue

        if len(category.advice_ids) == 1:
            continue

        # Switch the two first advice IDs.
        newly_ordered_list = list(reversed(category.advice_ids[:2])) + category.advice_ids[2:]
        del category.advice_ids[:]
        category.advice_ids.extend(newly_ordered_list)

    return final_categories


def _compute_score_and_reasons(scores, reasons, module, scoring_model, scoring_project):
    try:
        scores[module.advice_id], reasons[module.advice_id] = \
            scoring_model.score_and_explain(scoring_project)
    except Exception:  # pylint: disable=broad-except
        logging.exception(
            'Scoring "%s" crashed for:\n%s\n%s',
            module.trigger_scoring_model, scoring_project.user_profile,
            scoring_project.details)


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
    try:
        extra_data = compute_extra_data(scoring_project)
    except Exception:  # pylint: disable=broad-except
        logging.exception(
            'Computing extra data "%s" crashed for:\n%s\n%s',
            module.trigger_scoring_model, scoring_project.user_profile,
            scoring_project.details)
        return
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


def _maybe_override_advice_data(piece_of_advice, module, scoring_project):
    scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
    try:
        get_advice_override = scoring_model.get_advice_override
    except AttributeError:
        # The scoring model has no get_advice_override method;
        return
    override_data = get_advice_override(scoring_project, piece_of_advice)
    if not override_data:
        # Nothing to override.
        return
    piece_of_advice.MergeFrom(override_data)


def _send_activation_email(user, project, database, base_url):
    """Send an email to the user just after we have defined their diagnosis."""

    advice_modules = {a.advice_id: a for a in _advice_modules(database)}
    advices = [a for a in project.advices if a.advice_id in advice_modules]
    if not advices:
        logging.error(  # pragma: no-cover
            'Weird: the advices that just got created do not exist in DB.')  # pragma: no-cover
        return  # pragma: no-cover
    data = {
        'baseUrl': base_url,
        'projectId': project.project_id,
        'firstName': user.profile.name,
        'ofProjectTitle': french.maybe_contract_prefix(
            'de ', "d'", french.lower_first_letter(french.genderize_job(
                project.target_job, user.profile.gender))),
        'advices': [
            {'adviceId': a.advice_id, 'title': advice_modules[a.advice_id].title}
            for a in advices
        ],
    }
    # https://app.mailjet.com/template/168827/build
    response = mail.send_template('168827', user.profile, data)
    if response.status_code != 200:
        logging.warning(
            'Error while sending diagnostic email: %s\n%s', response.status_code, response.text)


def list_all_tips(user, project, piece_of_advice, database):
    """List all available tips for a piece of advice.

    Args:
        user: the full user info.
        project: the project to give tips for.
        piece_of_advice: the piece of advice to give tips for.
        database: access to the database to get modules and tips.
    Returns:
        An iterable of tips for this module.
    """

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

    # Filter tips.
    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    filtered_tips = scoring.filter_using_score(
        tip_templates, lambda t: t.filters, scoring_project)

    return filtered_tips


# Cache (from MongoDB) of known advice module.
_ADVICE_MODULES = proto.MongoCachedCollection(advisor_pb2.AdviceModule, 'advice_modules')


def _advice_modules(database):
    return _ADVICE_MODULES.get_collection(database)


def get_advice_module(advice_id, database):
    """Get a module by its ID."""

    try:
        return next(a for a in _advice_modules(database) if a.advice_id == advice_id)
    except StopIteration:
        return None


# Cache (from MongoDB) of known tip templates.
_TIP_TEMPLATES = proto.MongoCachedCollection(action_pb2.ActionTemplate, 'tip_templates')


def _tip_templates(database):
    """Returns a list of known tip templates as protos."""

    return _TIP_TEMPLATES.get_collection(database)


# TODO(cyrille): Replace this with cache deprecation mechanism from proto module.
def clear_cache():
    """Clear all caches for this module."""

    _ADVICE_MODULES.reset_cache()
    _TIP_TEMPLATES.reset_cache()
