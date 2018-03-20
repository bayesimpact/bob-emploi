"""Advice module to recommend seasonal jobs in other départements."""

import logging

from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.frontend.api import user_pb2


class _AdviceSeasonalRelocate(scoring_base.ModelBase):
    """A scoring model for the "seasonal relocate" advice module."""

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        reasons = []

        # For now we just match for people willing to move to the whole country.
        # There might be cases where we should be able to recommend to people who want to move to
        # their own region, but it would add complexity to find them.
        is_not_ready_to_move = (
            project.details.mobility.area_type != geo_pb2.COUNTRY and
            project.details.mobility.area_type != geo_pb2.WORLD)

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

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        return self._get_seasonal_departements(project)

    @scoring_base.ScoringProject.cached('seasonal-departements')
    def _get_seasonal_departements(self, project):
        """Compute departements that propose seasonal jobs."""

        # TODO(guillaume): Cache this to increase speed.
        top_departements = proto.create_from_mongo(
            project.database.seasonal_jobbing.find_one({'_id': project.now.month}),
            seasonal_jobbing_pb2.MonthlySeasonalJobbingStats)

        for departement in top_departements.departement_stats:
            # TODO(guillaume): If we don't use deeper jobgroups by october 1st 2017, trim the db.
            del departement.job_groups[6:]

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

        return top_departements or []


scoring_base.register_model('advice-seasonal-relocate', _AdviceSeasonalRelocate())
