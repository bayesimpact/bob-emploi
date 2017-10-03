"""Advice module to recommend seasonal jobs in other départements."""
import datetime
import logging

from bob_emploi.frontend import geo
from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.frontend.api import user_pb2


class _AdviceSeasonalRelocate(scoring.ModelBase):
    """A scoring model for the "seasonal relocate" advice module."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        user_age = datetime.date.today().year - project.user_profile.year_of_birth

        # For now we just match for people willing to move to the whole country.
        # There might be cases where we should be able to recommend to people who want to move to
        # their own region, but it would add complexity to find them.
        is_not_ready_to_move = (
            project.details.mobility.area_type != geo_pb2.COUNTRY and
            project.details.mobility.area_type != geo_pb2.WORLD)

        is_not_single = project.user_profile.family_situation != user_pb2.SINGLE
        has_advanced_degree = project.user_profile.highest_degree >= job_pb2.LICENCE_MAITRISE
        is_not_young = user_age > 30
        looks_only_for_cdi = project.details.employment_types == [job_pb2.CDI]

        if (is_not_ready_to_move or is_not_young or is_not_single or has_advanced_degree or
                looks_only_for_cdi):
            return 0

        if len(self._get_seasonal_departements(project).departement_stats) > 1:
            return 2
        return 0

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return self._get_seasonal_departements(project)

    @scoring.ScoringProject.cached('seasonal-departements')
    def _get_seasonal_departements(self, project):
        """Compute departements that propose seasonal jobs."""
        top_departements = seasonal_jobbing_pb2.MonthlySeasonalJobbingStats()

        # TODO(guillaume): Cache this to increase speed.
        proto.parse_from_mongo(
            project.database.seasonal_jobbing.find_one({'_id': project.now.month}),
            top_departements)

        for departement in top_departements.departement_stats:
            # TODO(guillaume): If we don't use deeper jobgroups by october 1st 2017, trim the db.
            del departement.job_groups[6:]

            try:
                departement.departement_in_name = geo.get_in_a_departement_text(
                    departement.departement_id)
            except KeyError:
                logging.exception(
                    'Prefix or name not found for departement: %s', departement.departement_id)
                continue

        for i, departement in enumerate(top_departements.departement_stats[::-1]):
            if not departement.departement_in_name:
                del top_departements.departement_stats[i]

        return top_departements or []


scoring.register_model('advice-seasonal-relocate', _AdviceSeasonalRelocate())
