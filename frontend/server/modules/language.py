"""Module to score the language requirements of a project."""

import typing
from typing import Iterable, List, Optional

from bob_emploi.frontend.server import scoring_base


class _LanguageRequirement(typing.NamedTuple):
    rome_prefixes: List[str] = []
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
            'M1607', 'M1604', 'M1501', 'M1605', 'M1203', 'M1025', 'M1502', 'M1602', 'M1607',
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


# TODO(pascal): Make sure that there are no conflicts (a job in several requirements).
_JOBS_REQUIREMENTS_BY_PREFIX = {
    prefix: requirement
    for requirement in _JOBS_REQUIREMENTS
    for prefix in requirement.rome_prefixes
}


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

        if not lang_knowledge:
            # Unknown.
            return 0

        # Check that the user speaks at least one of the required languages.
        for lang in lang_requirements:
            if not lang_knowledge.get(lang):
                # No clue about their level.
                break
            if lang_knowledge[lang].has_spoken_knowledge:
                # User has at least one required spoken language.
                break
        else:
            # User does not speak any of the required language.
            return 3

        # For specific job groups, check that the user speaks or write all the required languages.
        project_requirements = _get_project_requirements(project)

        if not project_requirements:
            return 0

        for lang in lang_requirements:
            if not lang_knowledge.get(lang):
                # No clue about their level.
                continue
            if project_requirements.is_spoken_required and \
                    not lang_knowledge[lang].has_spoken_knowledge:
                return 3
            if project_requirements.is_written_required and \
                    not lang_knowledge[lang].has_written_knowledge:
                return 3

        return 0


class _LanguageRelevance(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        lang_requirements = _LANGUAGE_REQUIREMENTS.get(project.details.city.departement_id)
        if not lang_requirements:
            # Language is not relevant for this city.
            return 0

        lang_knowledge = {
            knowledge.locale: knowledge
            for knowledge in project.user_profile.languages
            if knowledge.locale in lang_requirements
        }

        if not lang_knowledge:
            # We have no clue of user's language so we cannot say whether this is a big problem or
            # not: neutral relevance.
            return 1

        project_requirements = _get_project_requirements(project)

        # Check that the user speaks at least one of the required languages or, if there are some
        # project requirements, that those are met for all the required languages.
        for lang in lang_requirements:
            if not lang_knowledge.get(lang):
                # No clue about their level.
                if project_requirements:
                    # User has an unknown level in a required language.
                    return 1
                continue
            if lang_knowledge[lang].has_spoken_knowledge and not project_requirements:
                # User has at least one required spoken language.
                return 3

        return 3


scoring_base.register_model('for-missing-language', _MissingLanguage())
scoring_base.register_model('language-relevance', _LanguageRelevance())
