"""Module to advise the user to relocate to another département."""
import logging

from bob_emploi.frontend import geo
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2


class _AdviceRelocateScoringModel(scoring.ModelBase):
    """A scoring model to trigger the "Relocate" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module."""
        return project_pb2.RelocateData(departement_scores=self._find_best_departements(project))

    # TODO(guillaume): Add more tests than just all persona.
    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.mobility.area_type != geo_pb2.COUNTRY and \
                project.details.mobility.area_type != geo_pb2.WORLD:
            return 0

        if self._find_best_departements(project):
            return 2
        return 0

    @scoring.ScoringProject.cached('relocate')
    def _find_best_departements(self, project):
        """Find which are the best departement to relocate for a given job group."""
        job_group = project.details.target_job.job_group.rome_id

        local_stats_ids = {
            ('{}:{}'.format(departement_id, job_group)): departement_id
            for departement_id in geo.list_all_departements()
        }

        local_stats = project.database.local_diagnosis.find({'_id': {'$in': list(local_stats_ids)}})

        departement_to_offers = {}
        for departement_local_stats in local_stats:
            departement_id = local_stats_ids[departement_local_stats['_id']]
            departement_to_offers[departement_id] = \
                departement_local_stats.get('imt', {}).get('yearlyAvgOffersPer10Candidates', 0) or 0

        # If we do not have data about our own departement, we chose not to say anything.
        own_departement = project.details.mobility.city.departement_id
        if own_departement:
            try:
                geo.get_departement_name(own_departement)
            except KeyError:
                logging.warning(
                    'We cannot find the name of the French département "%s"', own_departement)

        # We only advice departements that are better than own departement.
        min_offers = departement_to_offers.get(own_departement, 0)

        if not min_offers:
            return []

        # Compute the score for each departement.
        sorted_departements = sorted(
            departement_to_offers.items(), key=lambda x: x[1], reverse=True)

        # Get only departements that are strictly better than own departement.
        top_departements = [
            project_pb2.DepartementScore(
                name=geo.get_departement_name(dep[0]),
                offer_ratio=dep[1] / min_offers)
            for dep in sorted_departements if dep[1] > min_offers]

        # Return at most 10 departements.
        return top_departements[:10]


scoring.register_model('advice-relocate', _AdviceRelocateScoringModel())
