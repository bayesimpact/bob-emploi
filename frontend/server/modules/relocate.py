"""Module to advise the user to relocate to another département."""

import logging

from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2


@scoring_base.ScoringProject.cached('relocate')
def _find_best_departements(unused_, project):
    """Find which are the best departement to relocate for a given job group."""

    job_group = project.details.target_job.job_group.rome_id

    local_stats_ids = {
        ('{}:{}'.format(departement_id, job_group)): departement_id
        for departement_id in geo.list_all_departements(project.database)
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
            geo.get_departement_name(project.database, own_departement)
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
            name=geo.get_departement_name(project.database, dep[0]),
            offer_ratio=dep[1] / min_offers)
        for dep in sorted_departements if dep[1] > min_offers]

    return top_departements


class _AdviceRelocateScoringModel(scoring_base.ModelBase):
    """A scoring model to trigger the "Relocate" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module."""

        return project_pb2.RelocateData(
            departement_scores=_find_best_departements(None, project)[:10])

    # TODO(guillaume): Add more tests than just all persona.
    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        reasons = []
        if project.details.mobility.area_type != geo_pb2.COUNTRY and \
                project.details.mobility.area_type != geo_pb2.WORLD:
            return scoring_base.NULL_EXPLAINED_SCORE
        reasons.append(project.translate_string(
            'vous nous avez dit être prêt%eFeminine à déménager'))

        if _find_best_departements(None, project):
            reasons.append(project.translate_string(
                "il y a beaucoup plus d'offres par habitants dans d'autres villes"))
            return scoring_base.ExplainedScore(2, reasons)
        return scoring_base.NULL_EXPLAINED_SCORE


class _GoodMobilityModel(scoring_base.ModelHundredBase):
    """A model that scores whether user has the right level of mobility."""

    def score_to_hundred(self, project):
        """Compute a score for the given ScoringProject."""

        area_type = project.details.mobility.area_type

        if not area_type:
            raise scoring_base.NotEnoughDataException()

        num_better_departements = len(_find_best_departements(None, project))

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

    def score_to_hundred(self, project):
        """Compute a score for the given ScoringProject."""

        area_type = project.details.mobility.area_type

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
