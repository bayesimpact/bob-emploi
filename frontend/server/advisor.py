"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""

import collections
import itertools
import logging
import os
import threading

import mailjet_rest

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])

_EMAIL_ACTIVATION_ENABLED = not os.getenv('DEBUG', '')


def maybe_diagnose(user, project, database):
    """Check if a project needs a diagnostic and populate the diagnostic if so."""

    if project.is_incomplete:
        return False
    if project.HasField('diagnostic'):
        return False

    diagnose(user, project, database)
    return True


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


def maybe_categorize_advice(user, project, database):
    """Check if a project needs advice categories and populate all advice_categories
    fields if not.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    """

    if project.is_incomplete or not project.advices:
        return False
    if user.features_enabled.workbench != user_pb2.ACTIVE or project.advice_categories:
        return False
    project.advice_categories.extend(compute_advice_categories(project, database).advice_categories)
    return True


def diagnose(user, project, database):
    """Diagnose a project.

    Args:
        user: the user's data, mainly used for their profile and features_enabled.
        project: the project data. It will be modified, as its diagnostic field
            will be populated.
        database: access to the MongoDB with market data.
        diagnostic: a protobuf to fill, if none it will be created.
    Returns:
        the modified diagnostic protobuf.
    """

    diagnostic = project.diagnostic

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    return diagnose_scoring_project(scoring_project, diagnostic)


def diagnose_scoring_project(scoring_project, diagnostic):
    """Diagnose a scoring project.
    Helper function that can be used for real users and personas.

    Args:
        scoring_project: the scoring project we wish to diagnose.
        diagnostic: a protobuf to fill, if none it will be created.
    Returns:
        a tuple with the modified diagnostic protobuf and a list of the orders of missing sentences.
    """

    _compute_sub_diagnostics(scoring_project, diagnostic)
    # Combine the sub metrics to create the overall score.
    sum_score = 0
    sum_weight = 0
    for sub_diagnostic in diagnostic.sub_diagnostics:
        sum_score += sub_diagnostic.score
        sum_weight += 1
    if sum_weight:
        diagnostic.overall_score = round(sum_score / sum_weight)

    diagnostic.text, missing_sentences_orders = _compute_diagnostic_text(
        scoring_project, diagnostic.overall_score)

    return diagnostic, missing_sentences_orders


_SENTENCE_TEMPLATES = proto.MongoCachedCollection(
    diagnostic_pb2.DiagnosticSentenceTemplate, 'diagnostic_sentences')


def _compute_diagnostic_text(scoring_project, unused_overall_score):
    """Create the left-side text of the diagnostic for a given project.

    Returns:
        A tuple containing the text,
        and a list of the orders of missing sentences (if text is empty).
    """

    sentences = []
    missing_sentences_orders = []
    templates_per_order = itertools.groupby(
        _SENTENCE_TEMPLATES.get_collection(scoring_project.database),
        key=lambda template: template.order)
    for order, templates_iterator in templates_per_order:
        templates = list(templates_iterator)
        template = next(
            scoring.filter_using_score(
                templates, lambda template: template.filters, scoring_project),
            None)
        if not template:
            if any(template.optional for template in templates):
                continue
            # TODO(pascal): Set to warning when we have theoretical complete coverage.
            logging.debug('Could not find a sentence %d for user.', order)
            missing_sentences_orders.append(order)
            continue
        translated_template = scoring_project.translate_string(template.sentence_template)
        sentences.append(scoring_project.populate_template(translated_template))
    return '\n\n'.join(sentences) if not missing_sentences_orders else '', missing_sentences_orders


_SUBTOPIC_SENTENCE_TEMPLATES = proto.MongoCachedCollection(
    diagnostic_pb2.DiagnosticSubmetricsSentenceTemplate, 'diagnostic_submetrics_sentences')


_SCORE_AVERAGE = 1.5


def _compute_diagnostic_topic_score_and_text(topic, scorers, scoring_project):
    """Create the score and text for a given diagnostic submetric on a given project.

    Args:
        topic: the diagnostic topic we wish to evaluate
        scorers: a list of scorers for the given topic, with their template sentences
        scoring_project: the project we want to score
    Returns:
        the populated subdiagnostic protobuf.
    """

    topic_score = 0
    topic_weight = 0
    min_score = None
    max_score = None
    max_scorer = None
    min_scorer = None
    for scorer in scorers:
        model = scoring.get_scoring_model(scorer.trigger_scoring_model)
        if not model:
            logging.error(
                'Diagnostic for topic "%s" uses the scoring model "%s" which does not exist.',
                diagnostic_pb2.DiagnosticTopic.Name(topic), scorer.trigger_scoring_model)
            continue
        try:
            score = model.score(scoring_project)
        except scoring.NotEnoughDataException:
            continue
        # Use default weight of 1
        weight = scorer.weight or 1
        weighted_score = score * weight
        topic_score += weighted_score
        topic_weight += weight
        # Use positive sentence only for scores above average.
        if score > _SCORE_AVERAGE:
            positive_score = (score - _SCORE_AVERAGE) * weight
            if max_score is None or positive_score > max_score:
                max_score = positive_score
                max_scorer = scorer
        # Use negative sentence only for scores below average.
        else:
            negative_score = (_SCORE_AVERAGE - score) * weight
            if min_score is None or negative_score > min_score:
                min_score = negative_score
                min_scorer = scorer
    if not topic_weight:
        return None

    sub_diagnostic = diagnostic_pb2.SubDiagnostic(
        topic=topic, score=round(topic_score / topic_weight * 100 / 3))
    sentences = []

    def _append_sentence(template):
        translated_template = scoring_project.translate_string(template)
        sentences.append(scoring_project.populate_template(translated_template))

    # Do not put positive sentence if score is below 40.
    if max_scorer and sub_diagnostic.score > 40:
        _append_sentence(max_scorer.positive_sentence_template)
    # Do not put negative sentence if score is above 80.
    if min_scorer and sub_diagnostic.score < 80:
        _append_sentence(min_scorer.negative_sentence_template)

    sub_diagnostic.text = french.join_sentences_properly(sentences)

    return sub_diagnostic


def _compute_sub_diagnostics(scoring_project, diagnostic):
    """populate the submetrics of the diagnostic for a given project."""

    scorers_per_topic = itertools.groupby(
        _SUBTOPIC_SENTENCE_TEMPLATES.get_collection(scoring_project.database),
        key=lambda scorer: scorer.submetric)
    for topic, scorers in scorers_per_topic:
        sub_diagnostic = _compute_diagnostic_topic_score_and_text(topic, scorers, scoring_project)
        if sub_diagnostic:
            diagnostic.sub_diagnostics.extend([sub_diagnostic])


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
    response = mail.send_template(
        # https://app.mailjet.com/template/168827/build
        '168827', user.profile, data, dry_run=not _EMAIL_ACTIVATION_ENABLED)
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
    _SENTENCE_TEMPLATES.reset_cache()
    _SUBTOPIC_SENTENCE_TEMPLATES.reset_cache()
