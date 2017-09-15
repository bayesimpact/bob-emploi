"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""
import collections
import logging
import os

import mailjet_rest

from bob_emploi.frontend import french
from bob_emploi.frontend import mail
from bob_emploi.frontend import now
from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])

_EMAIL_ACTIVATION_ENABLED = not os.getenv('DEBUG', '')


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
    if user.features_enabled.advisor != user_pb2.ACTIVE or project.advices:
        return False
    advices = compute_advices_for_project(user, project, database)
    for piece_of_advice in advices.advices:
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
    project.advices.extend(advices.advices[:])
    return True


def compute_advices_for_project(user, project, database):
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
            try:
                scores[module.advice_id] = scoring_model.score(scoring_project)
            except Exception:  # pylint: disable=broad-except
                logging.exception(
                    'Scoring "%s" crashed for:\n%s\n%s',
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

        incompatible_modules.update(module.incompatible_advice_ids)

        _compute_extra_data(piece_of_advice, module, scoring_project)
        _maybe_override_advice_data(piece_of_advice, module, scoring_project)

    return advice


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
            'de ', "d'", french.lower_first_letter(_get_job_name(
                project.target_job, user.profile.gender))),
        'advices': [
            {'adviceId': a.advice_id, 'title': advice_modules[a.advice_id].title}
            for a in advices
        ],
    }
    response = mail.send_template(
        # https://app.mailjet.com/template/168827/build
        '168827', user.profile, data, dry_run=not _EMAIL_ACTIVATION_ENABLED)
    if response.status_code != 200:
        logging.warning(
            'Error while sending diagnostic email: %s\n%s', response.status_code, response.text)


def _get_job_name(job, gender):
    if gender == user_pb2.FEMININE:
        return job.feminine_name or job.name
    if gender == user_pb2.MASCULINE:
        return job.masculine_name or job.name
    return job.name


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
            project, user.profile, user.features_enabled, database, now=now.get())
        cache['scoring_project'] = scoring_project
    filtered_tips = scoring.filter_using_score(
        tip_templates, lambda t: t.filters, scoring_project)

    return filtered_tips


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
