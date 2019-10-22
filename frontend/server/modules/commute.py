"""Module to advise the user to extend their commute to get more offers."""

import math
from typing import Iterable, Iterator, List

from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import geo_pb2

# Distance below which the city is so close that it is obvious.
_MIN_CITY_DISTANCE = 8

# Distance above which the city is so far that it should not be considered.
_MAX_CITY_DISTANCE = 35


def _get_commuting_cities(
        interesting_cities_for_rome: Iterable[commute_pb2.HiringCity],
        target_city: geo_pb2.FrenchCity) -> Iterator[commute_pb2.CommutingCity]:
    # Get the reference offers per inhabitant.
    ref = next(
        # TODO(cyrille): Replace with h.offers_per_inhabitant once it's been imported.
        (h.offers / h.city.population
         for h in interesting_cities_for_rome
         if h.city.city_id == target_city.city_id and h.city.population), 0)

    for hiring_city in interesting_cities_for_rome:
        distance = math.sqrt(_compute_square_distance(hiring_city.city, target_city))
        if distance >= _MAX_CITY_DISTANCE:
            continue

        try:
            relative_offers = (hiring_city.offers / hiring_city.city.population) / ref
        except ZeroDivisionError:
            relative_offers = 0

        yield commute_pb2.CommutingCity(
            departement_id=hiring_city.city.departement_id,
            name=hiring_city.city.name,
            relative_offers_per_inhabitant=relative_offers,
            distance_km=distance)


class _AdviceCommuteScoringModel(scoring_base.ModelBase):
    """A scoring model to trigger the "Commute" advice."""

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        nearby_cities = self.list_nearby_cities(project)
        if not nearby_cities:
            return scoring_base.NULL_EXPLAINED_SCORE

        if project.details.area_type > geo_pb2.CITY and \
                any(c.relative_offers_per_inhabitant >= 2 for c in nearby_cities):
            return scoring_base.ExplainedScore(
                3, ["il y a beaucoup plus d'offres par habitants dans d'autres villes"])

        return scoring_base.ExplainedScore(
            2, ["il est toujours bon d'avoir une idée des offres dans les autres villes"])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> commute_pb2.CommutingCities:
        """Retrieve data for the expanded card."""

        return commute_pb2.CommutingCities(cities=self.list_nearby_cities(project))

    @scoring_base.ScoringProject.cached('commute')
    def list_nearby_cities(self, project: scoring_base.ScoringProject) \
            -> List[commute_pb2.CommutingCity]:
        """Compute and store all interesting cities that are not too close and not too far.

        Those cities will be used by the Commute advice.
        """

        job_group = project.details.target_job.job_group.rome_id

        interesting_cities_for_rome = (
            proto.fetch_from_mongo(
                project.database, commute_pb2.HiringCities, 'hiring_cities', job_group) or
            commute_pb2.HiringCities()).hiring_cities

        if not interesting_cities_for_rome:
            return []

        target_city = geo.get_city_location(project.database, project.details.city.city_id)
        if not target_city:
            return []

        commuting_cities = _get_commuting_cities(interesting_cities_for_rome, target_city)
        sorted_commuting_cities = sorted(
            commuting_cities, key=lambda city: city.relative_offers_per_inhabitant, reverse=True)

        obvious_cities = [
            city for city in sorted_commuting_cities
            if city.distance_km < _MIN_CITY_DISTANCE]

        interesting_cities = [
            city for city in sorted_commuting_cities
            if city.distance_km >= _MIN_CITY_DISTANCE]

        # If there is only one city nearby and no obvious city, the nearby city becomes obvious, so
        # we do not recommend it.
        if len(interesting_cities) == 1 and not obvious_cities:
            return []

        return interesting_cities


def _compute_square_distance(city_a: geo_pb2.FrenchCity, city_b: geo_pb2.FrenchCity) -> float:
    """Compute the approximative distance between two cities.

    Since we only look at short distances, we can approximate that:
     - 1° latitude = 111km
     - 1° longitude = 111km * cos(lat)
    """

    delta_y = (city_a.latitude - city_b.latitude) * 111
    mean_latitude = (city_a.latitude + city_b.latitude) / 2
    delta_x = (city_a.longitude - city_b.longitude) * 111 * math.cos(math.radians(mean_latitude))
    return delta_x * delta_x + delta_y * delta_y


scoring_base.register_model('advice-commute', _AdviceCommuteScoringModel())
