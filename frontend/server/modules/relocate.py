"""Module to advise the user to relocate to another département."""

import itertools
import typing

from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2


@scoring_base.ScoringProject.cached('relocate')
def _find_best_departements(unused_: typing.Any, project: scoring_base.ScoringProject) \
        -> typing.List[project_pb2.DepartementScore]:
    """Find which are the best departement to relocate for a given job group."""

    own_departement_offers = project.imt_proto().yearly_avg_offers_per_10_candidates

    # If we do not have data about our own departement, we choose not to say anything.
    if not own_departement_offers:
        return []

    best_departements = project.job_group_info().best_departements

    result: typing.List[project_pb2.DepartementScore] = []
    for dep in itertools.islice(best_departements, 10):
        if dep.local_stats.imt.yearly_avg_offers_per_10_candidates <= own_departement_offers:
            return result
        offer_ratio = \
            dep.local_stats.imt.yearly_avg_offers_per_10_candidates / own_departement_offers
        result.append(project_pb2.DepartementScore(
            name=geo.get_departement_name(project.database, dep.departement_id),
            offer_ratio=offer_ratio))
    return result


class _AdviceRelocateScoringModel(scoring_base.ModelBase):
    """A scoring model to trigger the "Relocate" advice."""

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> project_pb2.RelocateData:
        """Compute extra data for this module."""

        return project_pb2.RelocateData(
            departement_scores=_find_best_departements(None, project))

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        reasons = []
        if project.details.area_type < geo_pb2.COUNTRY:
            return scoring_base.NULL_EXPLAINED_SCORE
        reasons.append(project.translate_string(
            'vous nous avez dit être prêt%eFeminine à déménager'))

        local_stats = project.local_diagnosis()
        if local_stats.imt.yearly_avg_offers_per_10_candidates and \
                local_stats.num_less_stressful_departements:
            reasons.append(project.translate_string(
                "il y a beaucoup plus d'offres par habitants dans d'autres villes"))
            return scoring_base.ExplainedScore(2, reasons)
        return scoring_base.NULL_EXPLAINED_SCORE


class _GoodMobilityModel(scoring_base.ModelHundredBase):
    """A model that scores whether user has the right level of mobility."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        area_type = project.details.area_type

        if not area_type:
            raise scoring_base.NotEnoughDataException()

        if not project.imt_proto().yearly_avg_offers_per_10_candidates:
            raise scoring_base.NotEnoughDataException()

        num_better_departements = project.local_diagnosis().num_less_stressful_departements

        # User is already in one of the top 3 départements.
        if num_better_departements < 3:
            raise scoring_base.NotEnoughDataException()

        # Give a score centered around 50 corresponding to the user's mobility.
        # The worse the current département is, the more extreme we set the
        # score.

        score_range = min(num_better_departements * 1.5, 100) / 2

        if area_type >= geo_pb2.COUNTRY:
            return 50 + score_range

        if area_type >= geo_pb2.REGION:
            return 50

        if area_type >= geo_pb2.DEPARTEMENT:
            return 50 - score_range / 2

        return 50 - score_range


class _ProfileMobilityScorerModel(scoring_base.ModelHundredBase):
    """A model that scores the level of mobility of the user."""

    def score_to_hundred(self, project: scoring_base.ScoringProject) -> float:
        """Compute a score for the given ScoringProject."""

        area_type = project.details.area_type

        if not area_type:
            raise scoring_base.NotEnoughDataException()

        if area_type >= geo_pb2.COUNTRY:
            return 100

        if area_type >= geo_pb2.REGION:
            return 70

        if area_type >= geo_pb2.DEPARTEMENT:
            return 50

        return 0


scoring_base.register_model('advice-relocate', _AdviceRelocateScoringModel())
scoring_base.register_model('profile-mobility-scorer', _ProfileMobilityScorerModel())
scoring_base.register_model('project-mobility-score', _GoodMobilityModel())
