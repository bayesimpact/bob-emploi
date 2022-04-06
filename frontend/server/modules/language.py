"""Module to score the language requirements of a project."""

import typing
from typing import Iterable, Iterator, Mapping, Optional, Tuple

from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import scoring_base

_UNKNOWN_LANG = user_profile_pb2.LanguageKnowledge()


class _LanguageRequirement(typing.NamedTuple):
    rome_prefixes: list[str] = []
    is_spoken_required: bool = False
    is_written_required: bool = False


_NO_REQUIREMENTS = _LanguageRequirement()


_LANGUAGE_REQUIREMENTS = {
    'BRU': {'fr', 'nl'},
}


_JOBS_REQUIREMENTS: Iterable[_LanguageRequirement] = (
    # Administrative jobs.
    _LanguageRequirement(
        rome_prefixes=[
            'M1607', 'M1604', 'M1501', 'M1605', 'M1203', 'M1025', 'M1502', 'M1602',
            'M1608', 'M1609', 'M1601',
        ],
        is_spoken_required=True,
        is_written_required=True,
    ),
    # Lodging and restaurant jobs.
    _LanguageRequirement(
        rome_prefixes=['G17', 'G18'],
        is_spoken_required=True,
    ),
    # Sales.
    _LanguageRequirement(
        rome_prefixes=['D12'],
        is_spoken_required=True,
    ),
)


def _ensure_no_prefix_conflicts(items: Iterator[Tuple[str, _LanguageRequirement]]) \
        -> Mapping[str, _LanguageRequirement]:
    result: dict[str, _LanguageRequirement] = {}
    for prefix, requirement in items:
        for existing_prefix in result:
            if existing_prefix.startswith(prefix) or prefix.startswith(existing_prefix):
                raise ValueError(
                    f'Conflict: several requirements for jobs {existing_prefix} or {prefix}')
        result[prefix] = requirement
    return result


_JOBS_REQUIREMENTS_BY_PREFIX = _ensure_no_prefix_conflicts(
    (prefix, requirement)
    for requirement in _JOBS_REQUIREMENTS
    for prefix in requirement.rome_prefixes
)


def _get_job_requirements(rome_id: str) -> _LanguageRequirement:
    for i in range(len(rome_id) - 1):
        try:
            return _JOBS_REQUIREMENTS_BY_PREFIX[rome_id[:-i] if i else rome_id]
        except KeyError:
            pass
    return _NO_REQUIREMENTS


def _get_project_requirements(project: scoring_base.ScoringProject) \
        -> Optional[_LanguageRequirement]:
    job_groups = {
        p.target_job.job_group.rome_id
        for p in project.user.projects
        if p.target_job.job_group.rome_id
    }
    job_requirements = [
        _get_job_requirements(job_group)
        for job_group in job_groups
    ]
    if all(r == _NO_REQUIREMENTS for r in job_requirements):
        return None
    return _LanguageRequirement(
        rome_prefixes=[],
        is_spoken_required=any(r.is_spoken_required for r in job_requirements),
        is_written_required=any(r.is_written_required for r in job_requirements),
    )


class _MissingLanguage(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        lang_requirements = _LANGUAGE_REQUIREMENTS.get(project.details.city.departement_id)
        if not lang_requirements:
            # Default for France.
            lang_requirements = {'fr'}

        lang_knowledge = {
            knowledge.locale: knowledge
            for knowledge in project.user_profile.languages
            if knowledge.locale in lang_requirements
        }

        missing_fields = set()

        # Check that the user speaks at least one of the required languages.
        for lang in lang_requirements:
            knowledge = lang_knowledge.get(lang, _UNKNOWN_LANG)
            if knowledge.has_spoken_knowledge == boolean_pb2.UNKNOWN_BOOL:
                # No clue about their level.
                missing_fields.add(f'profile.languages.{lang}.hasSpokenKnowledge')
                continue
            if knowledge.has_spoken_knowledge == boolean_pb2.TRUE:
                # User has at least one required spoken language.
                missing_fields = set()
                break
        else:
            if not missing_fields:
                # User does not speak any of the required language.
                return 3

        if missing_fields:
            raise scoring_base.NotEnoughDataException(
                'Need local spoken language knowledge', fields=missing_fields)
        return 0


class _MissingJobLanguage(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        # For specific job groups, check that the user speaks or write all the required languages.
        project_requirements = _get_project_requirements(project)

        if not project_requirements:
            return 0

        lang_requirements = _LANGUAGE_REQUIREMENTS.get(project.details.city.departement_id)
        if not lang_requirements:
            # Default for France.
            lang_requirements = {'fr'}

        lang_knowledge = {
            knowledge.locale: knowledge
            for knowledge in project.user_profile.languages
            if knowledge.locale in lang_requirements
        }

        missing_fields = set()
        for lang in lang_requirements:
            knowledge = lang_knowledge.get(lang, _UNKNOWN_LANG)
            if project_requirements.is_spoken_required:
                if knowledge.has_spoken_knowledge == boolean_pb2.FALSE:
                    return 3
                if knowledge.has_spoken_knowledge == boolean_pb2.UNKNOWN_BOOL:
                    missing_fields.add(f'profile.languages.{lang}.hasSpokenKnowledge')
            if project_requirements.is_written_required:
                if knowledge.has_written_knowledge == boolean_pb2.FALSE:
                    return 3
                if knowledge.has_written_knowledge == boolean_pb2.UNKNOWN_BOOL:
                    missing_fields.add(f'profile.languages.{lang}.hasWrittenKnowledge')
        if missing_fields:
            raise scoring_base.NotEnoughDataException(
                'Need project-specific language knowledge', fields=missing_fields)

        return 0


class _LanguageRelevance(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        lang_requirements = _LANGUAGE_REQUIREMENTS.get(project.details.city.departement_id)
        if not lang_requirements:
            # Language is not relevant for this city.
            return 0

        try:
            project.score('for-missing-language')
        except scoring_base.NotEnoughDataException:
            return 1
        return 3


scoring_base.register_model('for-missing-language', _MissingLanguage())
scoring_base.register_model('for-missing-job-language', _MissingJobLanguage())
scoring_base.register_model('language-relevance', _LanguageRelevance())
scoring_base.register_model('for-foreign-language', scoring_base.BaseFilter(
    lambda project: user_profile_pb2.LANGUAGE in project.user_profile.frustrations))
