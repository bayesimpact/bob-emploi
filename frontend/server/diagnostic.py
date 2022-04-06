"""Server part of the Diagnostic.
"""

import logging
import random
import re
from typing import Iterable, Iterator, Optional, Set, Tuple, Union

from bob_emploi.common.python import now
from bob_emploi.common.python import proto as common_proto
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.api import user_pb2

_RANDOM = random.Random()

# Matches bolding separators: <strong> and </strong>.
_BOLDED_STRING_SEP = re.compile(r'</?strong>')


def maybe_diagnose(
        user: user_pb2.User, project: project_pb2.Project, database: mongo.NoPiiMongoDatabase) \
        -> bool:
    """Check if a project needs a diagnostic and populate the diagnostic if so."""

    if project.is_incomplete:
        return False
    if project.diagnostic.categories:
        return False

    diagnose(user, project, database)
    return True


def diagnose(
        user: user_pb2.User, project: project_pb2.Project, database: mongo.NoPiiMongoDatabase) \
        -> diagnostic_pb2.Diagnostic:
    """Diagnose a project.

    Args:
        user: the user's data, mainly used for their profile and features_enabled.
        project: the project data. It will be modified, as its diagnostic field
            will be populated.
        database: access to the MongoDB with market data.
    Returns:
        the modified diagnostic protobuf.
    """

    diagnostic = project.diagnostic

    scoring_project = scoring.ScoringProject(project, user, database, now=now.get())
    return diagnose_scoring_project(scoring_project, diagnostic)


def diagnose_scoring_project(
        scoring_project: scoring.ScoringProject, diagnostic: diagnostic_pb2.Diagnostic) \
        -> diagnostic_pb2.Diagnostic:
    """Diagnose a scoring project.
    Helper function that can be used for real users and personas.

    Args:
        scoring_project: the scoring project we wish to diagnose.
        diagnostic: a protobuf to fill.
    Returns:
        the modified diagnostic protobuf.
    """

    del diagnostic.categories[:]
    diagnostic.categories.extend(cat for cat, _ in set_main_challenges_relevance(scoring_project))
    main_challenge: Optional[diagnostic_pb2.DiagnosticMainChallenge] = None
    for challenge in diagnostic.categories:
        if challenge.relevance == diagnostic_pb2.NEEDS_ATTENTION:
            diagnostic.category_id = challenge.category_id
            main_challenge = challenge
            break
    if not main_challenge:
        logging.error('No diagnostic main challenge relevant for user\n%s', diagnostic.categories)
        return diagnostic

    return _compute_diagnostic_overall(scoring_project, diagnostic, main_challenge)


def _create_bolded_string(text: str) -> diagnostic_pb2.BoldedString:
    """Creates a BoldedString proto from a string containing <strong> markup."""

    return diagnostic_pb2.BoldedString(string_parts=_BOLDED_STRING_SEP.split(text))


def quick_diagnose(
        user: user_pb2.User, project: project_pb2.Project, user_diff: user_pb2.User,
        database: mongo.NoPiiMongoDatabase) -> diagnostic_pb2.QuickDiagnostic:
    """Create a quick diagnostic of a project or user profile focused on the given field."""

    scoring_project = scoring.ScoringProject(
        project or project_pb2.Project(), user, database, now=now.get())

    response = diagnostic_pb2.QuickDiagnostic()
    has_departement_diff = user_diff.projects and user_diff.projects[0].city.departement_id
    if has_departement_diff:
        all_counts = get_users_counts(database)
        if all_counts:
            departement_count = all_counts.departement_counts[project.city.departement_id]
            if departement_count and departement_count > 50:
                response.comments.add(
                    field=diagnostic_pb2.CITY_FIELD,
                    comment=_create_bolded_string(scoring_project.translate_static_string(
                        'Super, <strong>{count}</strong> personnes dans ce département ont déjà '
                        'testé le diagnostic de Bob\xa0!',
                    ).format(count=str(departement_count))),
                )

    has_rome_id_diff = user_diff.projects and user_diff.projects[0].target_job.job_group.rome_id
    if has_rome_id_diff:
        all_counts = get_users_counts(database)
        if all_counts:
            job_group_count = all_counts.job_group_counts[project.target_job.job_group.rome_id]
            if job_group_count and job_group_count > 50:
                response.comments.add(
                    field=diagnostic_pb2.TARGET_JOB_FIELD,
                    comment=_create_bolded_string(scoring_project.translate_static_string(
                        "Ça tombe bien, j'ai déjà accompagné <strong>{count}</strong> personnes "
                        'pour ce métier\xa0!',
                    ).format(count=str(job_group_count))),
                )

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
                        scoring_project.translate_static_string(
                            'En général les gens demandent un salaire {of_salary} par mois.',
                        ).format(of_salary=french.lower_first_letter(salary_estimation.short_text)),
                    ]),
                )

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
                    scoring_project.translate_static_string(
                        'Les offres demandent souvent un {diplomas} ou équivalent.',
                    ).format(diplomas=diplomas),
                ]))

    if has_rome_id_diff or has_departement_diff:
        local_diagnosis = scoring_project.local_diagnosis()
        if local_diagnosis.imt.employment_type_percentages:
            main_employment_type_percentage = local_diagnosis.imt.employment_type_percentages[0]
            if main_employment_type_percentage.percentage > 98:
                comment = scoring_project.translate_static_string(
                    'La plupart des offres sont en {employment_type}.',
                )
            else:
                comment = scoring_project.translate_static_string(
                    'Plus de {percentage}% des offres sont en {employment_type}.',
                )
            if main_employment_type_percentage.employment_type in jobs.EMPLOYMENT_TYPES:
                employment_type = scoring_project.translate_static_string(
                    jobs.EMPLOYMENT_TYPES[main_employment_type_percentage.employment_type])
                response.comments.add(
                    field=diagnostic_pb2.EMPLOYMENT_TYPE_FIELD,
                    is_before_question=True,
                    comment=_create_bolded_string(comment.format(
                        percentage=str(int(main_employment_type_percentage.percentage)),
                        employment_type=employment_type,
                    )),
                )

    return response


_DIAGNOSTIC_OVERALL: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticTemplate] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticTemplate, 'diagnostic_overall', sort_key='_order')
_DIAGNOSTIC_RESPONSES: proto.MongoCachedCollection[diagnostic_pb2.DiagnosticResponse] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticResponse, 'diagnostic_responses', sort_key='order')


def _compute_diagnostic_overall(
        project: scoring.ScoringProject,
        diagnostic: diagnostic_pb2.Diagnostic,
        main_challenge: diagnostic_pb2.DiagnosticMainChallenge) -> diagnostic_pb2.Diagnostic:
    all_overalls = _DIAGNOSTIC_OVERALL.get_collection(project.database)
    restricted_overalls = [o for o in all_overalls if o.category_id == main_challenge.category_id]
    try:
        overall_template = next((
            scoring.filter_using_score(restricted_overalls, lambda t: t.filters, project)))
    except StopIteration:
        logging.warning('No overall template for project: %s', main_challenge.category_id)
        return diagnostic
    diagnostic.overall_sentence = project.populate_template(
        project.translate_airtable_string(
            'diagnosticOverall', overall_template.id, 'sentence_template',
            is_genderized=True, hint=overall_template.sentence_template))
    diagnostic.text = project.populate_template(
        project.translate_airtable_string(
            'diagnosticOverall', overall_template.id, 'text_template',
            is_genderized=True, hint=overall_template.text_template))
    diagnostic.strategies_introduction = project.populate_template(
        project.translate_airtable_string(
            'diagnosticOverall', overall_template.id, 'strategies_introduction',
            is_genderized=True, hint=overall_template.strategies_introduction))
    diagnostic.overall_score = overall_template.score
    diagnostic.bob_explanation = main_challenge.bob_explanation

    all_responses = _DIAGNOSTIC_RESPONSES.get_collection(project.database)
    self_diagnostic_category_id = project.details.original_self_diagnostic.category_id
    response_id = f'{self_diagnostic_category_id}:{main_challenge.category_id}'
    response_text = next((
        response.text for response in all_responses
        if response.response_id == response_id), '')
    diagnostic.response = project.translate_airtable_string(
        'diagnosticResponses', response_id, 'text',
        is_genderized=True, hint=response_text)

    return diagnostic


def get_users_counts(database: mongo.NoPiiMongoDatabase) -> Optional[stats_pb2.UsersCount]:
    """Get the count of users in departements and in job groups."""

    return proto.fetch_from_mongo(database, stats_pb2.UsersCount, 'user_count', '')


_DIAGNOSTIC_MAIN_CHALLENGES: \
    proto.MongoCachedCollection[diagnostic_pb2.DiagnosticMainChallenge] = \
    proto.MongoCachedCollection(
        diagnostic_pb2.DiagnosticMainChallenge, 'diagnostic_main_challenges', sort_key='order')


def list_main_challenges(database: mongo.NoPiiMongoDatabase) \
        -> Iterator[diagnostic_pb2.DiagnosticMainChallenge]:
    """Give the list of main challenges as defined in database."""

    return _DIAGNOSTIC_MAIN_CHALLENGES.get_collection(database)


_MAIN_CHALLENGE_TRANSLATABLE_FIELDS = \
    tuple(common_proto.list_translatable_fields(diagnostic_pb2.DiagnosticMainChallenge))


def translate_main_challenge(
        main_challenge: diagnostic_pb2.DiagnosticMainChallenge, project: scoring.ScoringProject) \
        -> diagnostic_pb2.DiagnosticMainChallenge:
    """Translate the fields of a main challenge template according to a project's preference."""

    translated = diagnostic_pb2.DiagnosticMainChallenge()
    translated.CopyFrom(main_challenge)
    translated.ClearField('relevance_scoring_model')
    for field in _MAIN_CHALLENGE_TRANSLATABLE_FIELDS:
        setattr(translated, field, project.translate_airtable_string(
            'diagnosticMainChallenges', main_challenge.category_id, field,
            is_genderized=True, hint=getattr(main_challenge, field)))
    return translated


# TODO(cyrille): Return NEUTRAL_RELEVANCE when an error is raised without missing_fields.
def _get_relevance_from_its_model(
        main_challenge: diagnostic_pb2.DiagnosticMainChallenge,
        project: scoring.ScoringProject,
        has_missing_fields: bool,
        relevant_should_be_neutral: bool) \
        -> 'diagnostic_pb2.MainChallengeRelevance.V':
    if main_challenge.relevance_scoring_model:
        relevance_score = project.score(main_challenge.relevance_scoring_model)
        if relevance_score <= 0:
            return diagnostic_pb2.NOT_RELEVANT
        if relevance_score >= 3 and not relevant_should_be_neutral:
            return diagnostic_pb2.RELEVANT_AND_GOOD
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    if has_missing_fields:
        return diagnostic_pb2.NEUTRAL_RELEVANCE
    return diagnostic_pb2.NEUTRAL_RELEVANCE if relevant_should_be_neutral else \
        diagnostic_pb2.RELEVANT_AND_GOOD


# TODO(cyrille): Profit from scoring models inheriting RelevanceModelBase.
def _get_relevance(
        main_challenge: diagnostic_pb2.DiagnosticMainChallenge, project: scoring.ScoringProject,
        should_be_neutral: bool) \
        -> Tuple['diagnostic_pb2.MainChallengeRelevance.V', Set[str]]:
    try:
        if project.check_filters(main_challenge.filters):
            if should_be_neutral:
                return diagnostic_pb2.NEUTRAL_RELEVANCE, set()
            return diagnostic_pb2.NEEDS_ATTENTION, set()
        missing_fields: Set[str] = set()
    except scoring.NotEnoughDataException as err:
        # We don't have enough info about this main challenge for the project,
        # so we let the relevance model decide.
        missing_fields = err.fields
    return _get_relevance_from_its_model(
        main_challenge, project, bool(missing_fields), should_be_neutral), missing_fields


def set_main_challenges_relevance(
        project: Union[scoring.ScoringProject, user_pb2.User],
        main_challenges: Optional[Iterable[diagnostic_pb2.DiagnosticMainChallenge]] = None,
        database: Optional[mongo.NoPiiMongoDatabase] = None,
        should_highlight_first_blocker: bool = True) -> \
        Iterator[Tuple[diagnostic_pb2.DiagnosticMainChallenge, list[user_pb2.MissingField]]]:
    """For all main challenges, tell whether it's relevant for a project.

    Arg list:
        - project, either a User proto message, or a ScoringProject for which we want to determine a
            main challenge.
        - main_challenges, a list of DiagnosticMainChallenge to select from. If not specified, will
            try and fetch them from `database`
        - database, the database in which to find the main challenges, if not specified.
            If `project` is a ScoringProject, defaults to `project.database`,
            otherwise, it's mandatory (raises an AttributeError).
        - should_highlight_first_blocker, a flag to make sure the first challenge that needs
            attention is highlighted for the end-user.
    Returns an iterator of main challenges, together with the fields that would help
    better diagnose them.
    Each main challenge has a relevance qualifier and translated natural language fields.
    """

    if isinstance(project, user_pb2.User):
        if not database:
            raise AttributeError(
                'Cannot call set_main_challenges_relevance without a database to call upon.')
        if not project.projects:
            return set()
        project = scoring.ScoringProject(project.projects[0], project, database)
    else:
        database = database or project.database
    if not main_challenges:
        main_challenges = list_main_challenges(database)

    is_highlight_set = False
    should_be_neutral = False
    for main_challenge in main_challenges:
        if main_challenge.are_strategies_for_alpha_only and not project.features_enabled.alpha:
            continue
        translated = translate_main_challenge(main_challenge, project)
        translated.relevance, missing_fields = _get_relevance(
            main_challenge, project, should_be_neutral)
        prioritized_fields = [
            user_pb2.MissingField(field=field, priority=1 if is_highlight_set else 2)
            for field in missing_fields]
        is_blocker = translated.relevance == diagnostic_pb2.NEEDS_ATTENTION
        if not is_blocker or is_highlight_set:
            translated.is_highlighted = False
            translated.ClearField('blocker_sentence')
        elif should_highlight_first_blocker or main_challenge.is_highlighted:
            translated.is_highlighted = True
            is_highlight_set = True
        if is_blocker and main_challenge.is_last_relevant:
            should_be_neutral = True
        yield translated, prioritized_fields


def find_main_challenge(
        project: Union[scoring.ScoringProject, user_pb2.User],
        main_challenges: Optional[Iterable[diagnostic_pb2.DiagnosticMainChallenge]] = None,
        database: Optional[mongo.NoPiiMongoDatabase] = None) \
        -> Optional[diagnostic_pb2.DiagnosticMainChallenge]:
    """Select the available main challenge for a project, if it exists.

    Arg list:
        - project, either a User proto message, or a ScoringProject for which we want to determine a
            main challenge.
        - main_challenges, a list of DiagnosticMainChallenge to select from. If not specified, will
            try and fetch them from `database`
        - database, the database in which to find the main challenges, if not specified.
            If `project` is a ScoringProject, defaults to `project.database`,
            otherwise, it's mandatory (raises an AttributeError).
    Returns either None if no main challenges apply or the first relevant challenge.
    """

    return next((
        c for c, _ in set_main_challenges_relevance(project, main_challenges, database)
        if c.relevance == diagnostic_pb2.NEEDS_ATTENTION), None)
