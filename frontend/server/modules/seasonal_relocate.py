"""Advice module to recommend seasonal jobs in other départements."""

import logging
import typing

from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.frontend.api import user_pb2

_SEASONAL_JOBBING: proto.MongoCachedCollection[seasonal_jobbing_pb2.MonthlySeasonalJobbingStats] = \
    proto.MongoCachedCollection(
        seasonal_jobbing_pb2.MonthlySeasonalJobbingStats, 'seasonal_jobbing')


class _AdviceSeasonalRelocate(scoring_base.ModelBase):
    """A scoring model for the "seasonal relocate" advice module."""

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        reasons: typing.List[str] = []

        # For now we just match for people willing to move to the whole country.
        # There might be cases where we should be able to recommend to people who want to move to
        # their own region, but it would add complexity to find them.
        is_not_ready_to_move = project.details.area_type < geo_pb2.COUNTRY

        is_not_single = project.user_profile.family_situation != user_pb2.SINGLE
        has_advanced_degree = project.user_profile.highest_degree >= job_pb2.LICENCE_MAITRISE
        is_not_young = project.get_user_age() > 30
        looks_only_for_cdi = project.details.employment_types == [job_pb2.CDI]

        if (is_not_ready_to_move or is_not_young or is_not_single or has_advanced_degree or
                looks_only_for_cdi):
            return scoring_base.NULL_EXPLAINED_SCORE
        reasons.append(project.translate_string(
            'vous nous avez dit être prêt%eFeminine à déménager'))
        reasons.append(project.translate_string(
            'vous êtes disponible familialement'))

        if len(self._get_seasonal_departements(project).departement_stats) > 1:
            reasons.append(project.translate_string(
                "il y a plus d'offres saisonnières par habitants dans d'autres villes"))
            return scoring_base.ExplainedScore(2, reasons)
        return scoring_base.NULL_EXPLAINED_SCORE

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> seasonal_jobbing_pb2.MonthlySeasonalJobbingStats:
        """Compute extra data for this module to render a card in the client."""

        return self._get_seasonal_departements(project)

    @scoring_base.ScoringProject.cached('seasonal-departements')
    def _get_seasonal_departements(self, project: scoring_base.ScoringProject) \
            -> seasonal_jobbing_pb2.MonthlySeasonalJobbingStats:
        """Compute departements that propose seasonal jobs."""

        top_departements = seasonal_jobbing_pb2.MonthlySeasonalJobbingStats()
        try:
            top_departements.CopyFrom(
                _SEASONAL_JOBBING.get_collection(project.database)[str(project.now.month)])
        except KeyError:
            pass

        for departement in top_departements.departement_stats:
            try:
                departement.departement_in_name = geo.get_in_a_departement_text(
                    project.database, departement.departement_id)
            except KeyError:
                logging.exception(
                    'Prefix or name not found for departement: %s', departement.departement_id)
                continue

        for i, departement in enumerate(top_departements.departement_stats[::-1]):
            if not departement.departement_in_name:
                del top_departements.departement_stats[i]

        return top_departements


scoring_base.register_model('advice-seasonal-relocate', _AdviceSeasonalRelocate())
