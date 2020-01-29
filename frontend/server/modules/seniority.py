"""Modules for scoring models related to job seniority."""

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import scoring_base


class _YoungInexperiencedModel(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        # If seniority is unknown, it usually means that previous job similarity is NEVER_DONE.
        if project.details.seniority > project_pb2.INTERN:
            return 0

        return max(0, min(3, (25 - project.get_user_age())))


class _DisillusionedOldCareerManModel(scoring_base.ModelBase):

    def score(self, project: scoring_base.ScoringProject) -> float:
        # TODO(cyrille): Find a way to make sure they're really desillusioned.
        if project.get_search_length_now() < 3:
            # User is probably not disillusioned yet.
            return 0
        if project.details.seniority < project_pb2.CARREER:
            return 0

        return max(0, min(3, project.get_user_age() - 50))


scoring_base.register_model('young-inexperienced', _YoungInexperiencedModel())
scoring_base.register_model('old-too-experienced', _DisillusionedOldCareerManModel())
