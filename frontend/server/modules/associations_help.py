"""Module to advise the user to get helped by a local association."""

import random
from typing import List

from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import user_pb2


class _AdviceAssociationHelp(scoring_base.ModelBase):
    """A scoring model to trigger the "Find an association to help you" advice."""

    def __init__(self) -> None:
        super().__init__()
        self._db = scoring_base.ASSOCIATIONS

    @scoring_base.ScoringProject.cached('associations')
    def list_associations(self, project: scoring_base.ScoringProject) \
            -> List[association_pb2.Association]:
        """List all associations for a project."""

        all_associations = self._db.get_collection(project.database)
        return list(
            scoring_base.filter_using_score(all_associations, lambda j: j.filters, project))

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        associations = self.list_associations(project)
        search_length_reason = project.translate_static_string(
            "vous nous avez dit que vous êtes en recherche d'emploi "
            'depuis %jobSearchLengthMonthsAtCreation mois')
        if not associations:
            return scoring_base.NULL_EXPLAINED_SCORE
        if user_pb2.MOTIVATION in project.user_profile.frustrations:
            return scoring_base.ExplainedScore(3, [project.translate_static_string(
                'vous nous avez dit avoir du mal à garder votre ' +
                'motivation au top')])
        if len(associations) >= 3 and project.get_search_length_at_creation() >= 6:
            return scoring_base.ExplainedScore(3, [search_length_reason])
        if project.get_search_length_at_creation() >= 12:
            return scoring_base.ExplainedScore(3, [search_length_reason])
        return scoring_base.ExplainedScore(2, [project.translate_static_string(
            "l'accompagnement humain peut beaucoup vous apporter")])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> association_pb2.Associations:
        """Retrieve data for the expanded card."""

        associations = self.list_associations(project)
        sorted_associations = sorted(associations, key=lambda j: (-len(j.filters), random.random()))
        return association_pb2.Associations(associations=sorted_associations)


scoring_base.register_model('advice-association-help', _AdviceAssociationHelp())
