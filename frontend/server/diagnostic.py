"""Server part of the Diagnostic.
"""

import collections
import itertools
import logging
import random
import typing

import pymongo

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.api import user_pb2

_ScoredAdvice = collections.namedtuple('ScoredAdvice', ['advice', 'score'])

_RANDOM = random.Random()


def maybe_diagnose(
        user: user_pb2.User, project: project_pb2.Project, database: pymongo.database.Database) \
        -> bool:
    """Check if a project needs a diagnostic and populate the diagnostic if so."""

    if project.is_incomplete:
        return False
    if project.HasField('diagnostic'):
        return False

    diagnose(user, project, database)
    return True


def diagnose(
        user: user_pb2.User, project: project_pb2.Project, database: pymongo.database.Database) \
        -> typing.Tuple[diagnostic_pb2.Diagnostic, typing.Optional[typing.List[int]]]:
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


def diagnose_scoring_project(
        scoring_project: scoring.ScoringProject, diagnostic: diagnostic_pb2.Diagnostic) \
        -> typing.Tuple[diagnostic_pb2.Diagnostic, typing.Optional[typing.List[int]]]:
    """Diagnose a scoring project.
    Helper function that can be used for real users and personas.

    Args:
        scoring_project: the scoring project we wish to diagnose.
        diagnostic: a protobuf to fill, if none it will be created.
    Returns:
        a tuple with the modified diagnostic protobuf and a list of the orders of missing sentences.
    """

    _compute_sub_diagnostics_scores(scoring_project, diagnostic)
    # TODO(cyrille): Drop overall score computation once overall covers all possible cases.
    # Combine the sub metrics to create the overall score.
    sum_score = 0
    sum_weight = 0
    for sub_diagnostic in diagnostic.sub_diagnostics:
        sum_score += sub_diagnostic.score
        text = _compute_sub_diagnostic_text(scoring_project, sub_diagnostic)
        if not text:
            logging.warning(
                'Uncovered case for subdiagnostic sentences in topic %s:\n%s',
                diagnostic_pb2.DiagnosticTopic.Name(sub_diagnostic.topic),
                scoring_project)
        sub_diagnostic.text = text
        observations = list(
            compute_sub_diagnostic_observations(scoring_project, sub_diagnostic.topic))
        if not observations:
            logging.warning(
                'No observation found on topic %s for project:\n%s',
                diagnostic_pb2.DiagnosticTopic.Name(sub_diagnostic.topic),
                scoring_project)
        del sub_diagnostic.observations[:]
        sub_diagnostic.observations.extend(observations)
        sum_weight += 1
    if sum_weight:
        diagnostic.overall_score = round(sum_score / sum_weight)

    _compute_diagnostic_overall(scoring_project, diagnostic)

    if diagnostic.text:
        return diagnostic, None

    # TODO(cyrille): Drop fallback once overall covers all possible cases.
    diagnostic.text, missing_sentences_orders = _compute_diagnostic_text(
        scoring_project, diagnostic.overall_score)

    return diagnostic, missing_sentences_orders


def quick_diagnose(
        user: user_pb2.User, project: project_pb2.Project, user_diff: user_pb2.User,
        database: pymongo.database.Database) -> diagnostic_pb2.QuickDiagnostic:
    """Create a quick diagnostic of a project or user profile focused on the given field."""

    scoring_project = scoring.ScoringProject(
        project or project_pb2.Project(), user.profile, user.features_enabled,
        database, now=now.get())

    response = diagnostic_pb2.QuickDiagnostic()
    has_departement_diff = user_diff.projects and user_diff.projects[0].city.departement_id
    if has_departement_diff:
        all_counts = _get_users_counts(database)
        if all_counts:
            departement_count = all_counts.departement_counts[project.city.departement_id]
            if departement_count:
                response.comments.add(
                    field=diagnostic_pb2.CITY_FIELD,
                    comment=diagnostic_pb2.BoldedString(string_parts=[
                        'Super, ',
                        str(departement_count),
                        ' personnes dans ce département ont déjà testé le diagnostic de Bob\xa0!',
                    ]))

    has_rome_id_diff = user_diff.projects and user_diff.projects[0].target_job.job_group.rome_id
    if has_rome_id_diff:
        all_counts = _get_users_counts(database)
        if all_counts:
            job_group_count = all_counts.job_group_counts[project.target_job.job_group.rome_id]
            if job_group_count:
                response.comments.add(
                    field=diagnostic_pb2.TARGET_JOB_FIELD,
                    comment=diagnostic_pb2.BoldedString(string_parts=[
                        "Ça tombe bien, j'ai déjà accompagné ",
                        str(job_group_count),
                        ' personnes pour ce métier\xa0!',
                    ]))

    if user_diff.profile.year_of_birth or has_rome_id_diff or has_departement_diff:
        if user.profile.year_of_birth:
            local_diagnosis = scoring_project.local_diagnosis()
            is_senior = scoring_project.get_user_age() >= 35
            if is_senior:
                salary_estimation = local_diagnosis.imt.senior_salary
            else:
                salary_estimation = local_diagnosis.imt.junior_salary
            if salary_estimation.short_text:
                response.comments.add(
                    field=diagnostic_pb2.SALARY_FIELD,
                    is_before_question=True,
                    comment=diagnostic_pb2.BoldedString(string_parts=[
                        'En général les gens demandent un salaire {} par mois.'.format(
                            french.lower_first_letter(salary_estimation.short_text)
                        )
                    ]))

    if has_rome_id_diff:
        diplomas = ', '.join(
            diploma.name for diploma in scoring_project.requirements().diplomas)
        if diplomas:
            response.comments.add(
                field=diagnostic_pb2.REQUESTED_DIPLOMA_FIELD,
                is_before_question=True,
                comment=diagnostic_pb2.BoldedString(string_parts=[
                    'Les offres demandent souvent un {} ou équivalent.'.format(diplomas)
                ]))

    # TODO(pascal): Diagnose more stuff here.

    return response


_SENTENCE_TEMPLATES: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(diagnostic_pb2.DiagnosticTemplate, 'diagnostic_sentences')


_DIAGNOSTIC_OVERALL: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(diagnostic_pb2.DiagnosticTemplate, 'diagnostic_overall')


def _compute_diagnostic_overall(
        project: scoring.ScoringProject,
        diagnostic: diagnostic_pb2.Diagnostic) -> diagnostic_pb2.Diagnostic:
    all_overalls = _DIAGNOSTIC_OVERALL.get_collection(project.database)
    overall_template = next((
        scoring.filter_using_score(all_overalls, lambda t: t.filters, project)), None)
    if not overall_template:
        # TODO(cyrille): Put a warning here once enough cases are covered with overall templates.
        return diagnostic
    diagnostic.overall_sentence = project.populate_template(
        project.translate_string(overall_template.sentence_template))
    diagnostic.text = project.populate_template(
        project.translate_string(overall_template.text_template))
    diagnostic.overall_score = overall_template.score
    return diagnostic


def _compute_diagnostic_text(
        scoring_project: scoring.ScoringProject, unused_overall_score: float) \
        -> typing.Tuple[str, typing.List[int]]:
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


# TODO(cyrille): Rename to diagnostic_submetrics_sentences once scorers are hard-coded.
_SUBTOPIC_SENTENCE_TEMPLATES: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticTemplate, 'diagnostic_submetrics_sentences_new')


def _compute_sub_diagnostic_text(
        scoring_project: scoring.ScoringProject, sub_diagnostic: diagnostic_pb2.SubDiagnostic) \
        -> str:
    """Create the sentence of the diagnostic for a given project on a given topic.

    Returns:
        The text for the diagnostic submetric.
    """

    template = next(
        scoring.filter_using_score((
            template
            for template in _SUBTOPIC_SENTENCE_TEMPLATES.get_collection(scoring_project.database)
            if template.topic == sub_diagnostic.topic
        ), lambda template: template.filters, scoring_project),
        None)
    if not template:
        # TODO(cyrille): Change to warning once we have theoretical complete coverage.
        logging.debug('Could not find a sentence for topic %s for user.', sub_diagnostic.topic)
        return ''
    translated_template = scoring_project.translate_string(template.sentence_template)
    return scoring_project.populate_template(translated_template)


_SUBTOPIC_OBSERVATION_TEMPLATES: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticTemplate, 'diagnostic_observations')


def compute_sub_diagnostic_observations(
        scoring_project: scoring.ScoringProject, topic: diagnostic_pb2.DiagnosticTopic) \
        -> typing.Iterator[diagnostic_pb2.SubDiagnosticObservation]:
    """Find all relevant observations for a given sub-diagnostic topic."""

    templates = scoring.filter_using_score((
        template
        for template in _SUBTOPIC_OBSERVATION_TEMPLATES.get_collection(scoring_project.database)
        if template.topic == topic
    ), lambda template: template.filters, scoring_project)
    for template in templates:
        yield diagnostic_pb2.SubDiagnosticObservation(
            text=scoring_project.populate_template(
                scoring_project.translate_string(template.sentence_template)),
            is_attention_needed=template.is_attention_needed)


_SUBTOPIC_SCORERS: \
    proto.MongoCachedCollection[diagnostic_pb2.DiagnosticSubmetricScorer] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticSubmetricScorer, 'diagnostic_submetrics_scorers')


# TODO(cyrille): Rethink scoring for submetrics.
def _compute_diagnostic_topic_score(
        topic: 'diagnostic_pb2.DiagnosticTopic',
        scorers: typing.Iterable[diagnostic_pb2.DiagnosticSubmetricScorer],
        scoring_project: scoring.ScoringProject) \
        -> typing.Optional[diagnostic_pb2.SubDiagnostic]:
    """Create the score for a given diagnostic submetric on a given project.

    Args:
        topic: the diagnostic topic we wish to evaluate
        scorers: a list of scorers for the given topic, with a weight on each.
        scoring_project: the project we want to score
    Returns:
        the populated subdiagnostic protobuf.
    """

    topic_score = 0.
    topic_weight = 0.
    sub_diagnostic = diagnostic_pb2.SubDiagnostic(topic=topic)

    for scorer in scorers:
        try:
            score = scoring_project.score(scorer.trigger_scoring_model)
        except scoring.NotEnoughDataException:
            continue
        # Use default weight of 1
        weight = scorer.weight or 1
        weighted_score = score * weight
        topic_score += weighted_score
        topic_weight += weight
    if not topic_weight:
        return None

    sub_diagnostic.score = round(topic_score / topic_weight * 100 / 3)

    return sub_diagnostic


def _compute_sub_diagnostics_scores(
        scoring_project: scoring.ScoringProject, diagnostic: diagnostic_pb2.Diagnostic) -> None:
    """populate the submetrics of the diagnostic for a given project."""

    scorers_per_topic = itertools.groupby(
        _SUBTOPIC_SCORERS.get_collection(scoring_project.database),
        key=lambda scorer: scorer.submetric)
    for topic, scorers in scorers_per_topic:
        sub_diagnostic = _compute_diagnostic_topic_score(topic, scorers, scoring_project)
        if sub_diagnostic:
            diagnostic.sub_diagnostics.extend([sub_diagnostic])


# TODO(cyrille): Use fetch_from_mongo once counts are saved under ID 'values'.
def _get_users_counts(database: pymongo.database.Database) -> typing.Optional[stats_pb2.UsersCount]:
    """Get the count of users in departements and in job groups."""

    all_counts = next(
        database.user_count.find({}).sort('aggregatedAt', pymongo.DESCENDING).limit(1), None)
    return proto.create_from_mongo(all_counts, stats_pb2.UsersCount, always_create=False)
