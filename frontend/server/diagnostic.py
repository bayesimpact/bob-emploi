"""Server part of the Diagnostic.
"""

import collections
import itertools
import logging
import random
from typing import List, Iterable, Iterator, Optional, Tuple, Union

import pymongo

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import job_pb2
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
        -> Tuple[diagnostic_pb2.Diagnostic, Optional[List[int]]]:
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
        -> Tuple[diagnostic_pb2.Diagnostic, Optional[List[int]]]:
    """Diagnose a scoring project.
    Helper function that can be used for real users and personas.

    Args:
        scoring_project: the scoring project we wish to diagnose.
        diagnostic: a protobuf to fill, if none it will be created.
    Returns:
        a tuple with the modified diagnostic protobuf and a list of the orders of missing sentences.
    """

    del diagnostic.categories[:]
    diagnostic.categories.extend(set_categories_relevance(scoring_project))
    category: Optional[diagnostic_pb2.DiagnosticCategory]
    for category in diagnostic.categories:
        if category.relevance == diagnostic_pb2.NEEDS_ATTENTION:
            diagnostic.category_id = category.category_id
            break
    else:
        category = None
    _compute_sub_diagnostics_scores(scoring_project, diagnostic)
    # TODO(cyrille): Drop overall score computation once overall covers all possible cases.
    # Combine the sub metrics to create the overall score.
    sum_score = 0
    sum_weight = 0
    for sub_diagnostic in diagnostic.sub_diagnostics:
        sum_score += sub_diagnostic.score
        text = _compute_sub_diagnostic_text(scoring_project, sub_diagnostic)
        if not text:
            all_texts = _SUBTOPIC_SENTENCE_TEMPLATES.get_collection(scoring_project.database)
            if all_texts:
                logging.warning(
                    'Uncovered case for subdiagnostic sentences in topic %s:\n%s',
                    diagnostic_pb2.DiagnosticTopic.Name(sub_diagnostic.topic),
                    scoring_project)
        sub_diagnostic.text = text
        observations = list(
            compute_sub_diagnostic_observations(scoring_project, sub_diagnostic.topic))
        if not observations:
            all_observations = \
                _SUBTOPIC_OBSERVATION_TEMPLATES.get_collection(scoring_project.database)
            if all_observations:
                logging.warning(
                    'No observation found on topic %s for project:\n%s',
                    diagnostic_pb2.DiagnosticTopic.Name(sub_diagnostic.topic),
                    scoring_project)
        del sub_diagnostic.observations[:]
        sub_diagnostic.observations.extend(observations)
        sum_weight += 1
    if sum_weight:
        diagnostic.overall_score = round(sum_score / sum_weight)

    _compute_diagnostic_overall(scoring_project, diagnostic, category)

    if diagnostic.text:
        return diagnostic, None

    # TODO(cyrille): Drop fallback once overall covers all possible cases.
    diagnostic.text, missing_sentences_orders = _compute_diagnostic_text(
        scoring_project, diagnostic.overall_score)

    return diagnostic, missing_sentences_orders


# TODO(pascal): DRY with imt email.
_EMPLOYMENT_TYPES = {
    job_pb2.INTERNSHIP: 'stage',
    job_pb2.CDI: 'CDI',
    job_pb2.CDD_OVER_3_MONTHS: 'CDD de plus de 3 mois',
    job_pb2.CDD_LESS_EQUAL_3_MONTHS: 'CDD de moins de 3 mois',
    job_pb2.INTERIM: 'intérim',
    job_pb2.ANY_CONTRACT_LESS_THAN_A_MONTH: "contrat de moins d'un mois",
}


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
        all_counts = get_users_counts(database)
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
        all_counts = get_users_counts(database)
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
                        'En général les gens demandent un salaire '
                        f'{french.lower_first_letter(salary_estimation.short_text)} par mois.'
                    ]))

    if has_rome_id_diff:
        required_diplomas = sorted(
            (d for d in scoring_project.requirements().diplomas
             # Only mention real diplomas that are required in 10% or more of job offers.
             if d.diploma.level != job_pb2.NO_DEGREE and d.percent_required > 10),
            key=lambda d: d.percent_required,
            reverse=True,
            # Only take the 2 biggest ones.
        )[:2]
        if len(required_diplomas) == 2:
            if required_diplomas[0].percent_required >= 70:
                # The first one is doing more than 70% of requirements, just keep one.
                required_diplomas = required_diplomas[:1]
            else:
                # Sort by degree level.
                required_diplomas.sort(key=lambda d: d.diploma.level)

        if required_diplomas:
            diplomas = ', '.join(diploma.name for diploma in required_diplomas)
            response.comments.add(
                field=diagnostic_pb2.REQUESTED_DIPLOMA_FIELD,
                is_before_question=True,
                comment=diagnostic_pb2.BoldedString(string_parts=[
                    f'Les offres demandent souvent un {diplomas} ou équivalent.'
                ]))

    if has_rome_id_diff or has_departement_diff:
        local_diagnosis = scoring_project.local_diagnosis()
        if local_diagnosis.imt.employment_type_percentages:
            main_employment_type_percentage = local_diagnosis.imt.employment_type_percentages[0]
            if main_employment_type_percentage.percentage > 98:
                percentage_text = 'La plupart'
            else:
                percentage_text = f'Plus de {int(main_employment_type_percentage.percentage)}%'
            if main_employment_type_percentage.employment_type in _EMPLOYMENT_TYPES:
                response.comments.add(
                    field=diagnostic_pb2.EMPLOYMENT_TYPE_FIELD,
                    is_before_question=True,
                    comment=diagnostic_pb2.BoldedString(string_parts=[
                        f'{percentage_text} des offres sont '
                        f'en {_EMPLOYMENT_TYPES[main_employment_type_percentage.employment_type]}.'
                    ]))

    return response


_SENTENCE_TEMPLATES: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(diagnostic_pb2.DiagnosticTemplate, 'diagnostic_sentences')


_DIAGNOSTIC_OVERALL: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(diagnostic_pb2.DiagnosticTemplate, 'diagnostic_overall')


def _compute_diagnostic_overall(
        project: scoring.ScoringProject,
        diagnostic: diagnostic_pb2.Diagnostic,
        category: Optional[diagnostic_pb2.DiagnosticCategory]) -> diagnostic_pb2.Diagnostic:
    all_overalls = _DIAGNOSTIC_OVERALL.get_collection(project.database)
    restricted_overalls: Iterable[diagnostic_pb2.DiagnosticTemplate] = []
    if category and (
            not category.are_strategies_for_alpha_only or project.features_enabled.alpha):
        restricted_overalls = \
            [o for o in all_overalls if o.category_id == category.category_id]
    if not restricted_overalls:
        restricted_overalls = [o for o in all_overalls if not o.category_id]
    overall_template = next((
        scoring.filter_using_score(restricted_overalls, lambda t: t.filters, project)), None)
    if not overall_template:
        # TODO(cyrille): Put a warning here once enough cases are covered with overall templates.
        return diagnostic
    diagnostic.overall_sentence = project.populate_template(
        project.translate_string(overall_template.sentence_template))
    diagnostic.text = project.populate_template(
        project.translate_string(overall_template.text_template))
    diagnostic.strategies_introduction = project.populate_template(
        project.translate_string(overall_template.strategies_introduction))
    diagnostic.overall_score = overall_template.score
    return diagnostic


def _compute_diagnostic_text(
        scoring_project: scoring.ScoringProject, unused_overall_score: float) \
        -> Tuple[str, List[int]]:
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
        -> Iterator[diagnostic_pb2.SubDiagnosticObservation]:
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
        scorers: Iterable[diagnostic_pb2.DiagnosticSubmetricScorer],
        scoring_project: scoring.ScoringProject) \
        -> Optional[diagnostic_pb2.SubDiagnostic]:
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
    """Populate the submetrics of the diagnostic for a given project."""

    scorers_per_topic = itertools.groupby(
        _SUBTOPIC_SCORERS.get_collection(scoring_project.database),
        key=lambda scorer: scorer.submetric)
    for topic, scorers in scorers_per_topic:
        sub_diagnostic = _compute_diagnostic_topic_score(topic, scorers, scoring_project)
        if sub_diagnostic:
            diagnostic.sub_diagnostics.extend([sub_diagnostic])


# TODO(cyrille): Use fetch_from_mongo once counts are saved under ID 'values'.
def get_users_counts(database: pymongo.database.Database) -> Optional[stats_pb2.UsersCount]:
    """Get the count of users in departements and in job groups."""

    all_counts = next(
        database.user_count.find({}).sort('aggregatedAt', pymongo.DESCENDING).limit(1), None)
    return proto.create_from_mongo(all_counts, stats_pb2.UsersCount, always_create=False)


_DIAGNOSTIC_CATEGORY: \
    proto.MongoCachedCollection[diagnostic_pb2.DiagnosticCategory] = \
    proto.MongoCachedCollection(diagnostic_pb2.DiagnosticCategory, 'diagnostic_category')


def list_categories(database: pymongo.database.Database) \
        -> Iterator[diagnostic_pb2.DiagnosticCategory]:
    """Give the list of categories as defined in database."""

    return _DIAGNOSTIC_CATEGORY.get_collection(database)


def _get_stuck_in_village_relevance(
        unused_project: scoring.ScoringProject) -> diagnostic_pb2.CategoryRelevance:
    return diagnostic_pb2.NOT_RELEVANT


def _get_enhance_methods_relevance(
        project: scoring.ScoringProject) -> diagnostic_pb2.CategoryRelevance:
    if project.get_search_length_at_creation() < 0:
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    return diagnostic_pb2.RELEVANT_AND_GOOD


def _get_stuck_market_relevance(
        project: scoring.ScoringProject) -> diagnostic_pb2.CategoryRelevance:
    if project.market_stress() is None:
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    return diagnostic_pb2.RELEVANT_AND_GOOD


def _get_find_what_you_like_relevance(
        project: scoring.ScoringProject) -> diagnostic_pb2.CategoryRelevance:
    if project.details.passionate_level == project_pb2.LIKEABLE_JOB:
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    market_stress = project.market_stress()
    if project.details.passionate_level < project_pb2.LIKEABLE_JOB and \
            market_stress and market_stress < 10 / 7:
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    return diagnostic_pb2.RELEVANT_AND_GOOD


_CATEGORIES_RELEVANCE_GETTERS = {
    # TODO(pascal): Add a relevance getter for confidence-for-search
    'enhance-methods-to-interview': _get_enhance_methods_relevance,
    'find-what-you-like': _get_find_what_you_like_relevance,
    'stuck-in-village': _get_stuck_in_village_relevance,
    'stuck-market': _get_stuck_market_relevance,
}


def set_categories_relevance(
        project: Union[scoring.ScoringProject, user_pb2.User],
        categories: Optional[Iterable[diagnostic_pb2.DiagnosticCategory]] = None,
        database: Optional[pymongo.database.Database] = None) \
        -> Iterator[diagnostic_pb2.DiagnosticCategory]:
    """For all categories, tell whether it's relevant for a project.

    Arg list:
        - project, either a User proto message, or a ScoringProject for which we want to determine a
            category.
        - categories, a list of DiagnosticCategory to select from. If not specified, will try and
            fetch them from `database`
        - database, the database in which to find the categories, if not specified.
            If `project` is a ScoringProject, defaults to `project.database`,
            otherwise, it's mandatory (raises an AttributeError).
    Returns the list of categories, with a relevance qualifier.
    """

    if isinstance(project, user_pb2.User):
        if not database:
            raise AttributeError(
                'Cannot call score_categories without a database to call upon.')
        if not project.projects:
            return None
        project = scoring.ScoringProject(
            project.projects[0], project.profile, project.features_enabled, database)
    else:
        database = database or project.database
    if not categories:
        categories = list_categories(database)
    for category in categories:
        if project.check_filters(category.filters):
            category.relevance = diagnostic_pb2.NEEDS_ATTENTION
        else:
            try:
                category.relevance = \
                    _CATEGORIES_RELEVANCE_GETTERS[category.category_id](project)
            except KeyError:
                category.relevance = diagnostic_pb2.RELEVANT_AND_GOOD
        yield category


def find_category(
        project: Union[scoring.ScoringProject, user_pb2.User],
        categories: Optional[Iterable[diagnostic_pb2.DiagnosticCategory]] = None,
        database: Optional[pymongo.database.Database] = None) \
        -> Optional[diagnostic_pb2.DiagnosticCategory]:
    """Select the available category for a project, if it exists.

    Arg list:
        - project, either a User proto message, or a ScoringProject for which we want to determine a
            category.
        - categories, a list of DiagnosticCategory to select from. If not specified, will try and
            fetch them from `database`
        - database, the database in which to find the categories, if not specified.
            If `project` is a ScoringProject, defaults to `project.database`,
            otherwise, it's mandatory (raises an AttributeError).
    Returns either None if no category apply or the first relevant category.
    """

    return next((
        c for c in set_categories_relevance(project, categories, database)
        if c.relevance == diagnostic_pb2.NEEDS_ATTENTION), None)
