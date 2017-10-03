"""Module to advise the user to extend their commute to get more offers."""
import math

from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2

# Distance below which the city is so close that it is obvious.
_MIN_CITY_DISTANCE = 8

# Distance above which the city is so far that it should not be considered.
_MAX_CITY_DISTANCE = 35


class _AdviceCommuteScoringModel(scoring.ModelBase):
    """A scoring model to trigger the "Commute" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.CommuteData(cities=[c.name for c in self.list_nearby_cities(project)])

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        nearby_cities = self.list_nearby_cities(project)
        if not nearby_cities:
            return 0

        if project.details.mobility.area_type > geo_pb2.CITY and \
                any(c.relative_offers_per_inhabitant >= 2 for c in nearby_cities):
            return 3

        return 2

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""
        return commute_pb2.CommutingCities(cities=self.list_nearby_cities(project))

    @scoring.ScoringProject.cached('commute')
    def list_nearby_cities(self, project):
        """Compute and store all interesting cities that are not too close and not too far.

        Those cities will be used by the Commute advice.
        """
        job_group = project.details.target_job.job_group.rome_id

        all_cities = commute_pb2.HiringCities()
        proto.parse_from_mongo(
            project.database.hiring_cities.find_one({'_id': job_group}), all_cities)
        interesting_cities_for_rome = all_cities.hiring_cities

        if not interesting_cities_for_rome:
            return []

        target_city = geo_pb2.FrenchCity()
        mongo_city = project.database.cities.find_one(
            {'_id': project.details.mobility.city.city_id})
        if not mongo_city:
            return []
        proto.parse_from_mongo(mongo_city, target_city)

        commuting_cities = list(_get_commuting_cities(interesting_cities_for_rome, target_city))

        obvious_cities = [
            city for city in commuting_cities
            if city.distance_km < _MIN_CITY_DISTANCE]

        interesting_cities = [
            city for city in commuting_cities
            if city.distance_km >= _MIN_CITY_DISTANCE]

        # If there is only one city nearby and no obvious city, the nearby city becomes obvious, so
        # we do not recommend it.
        if len(interesting_cities) == 1 and not obvious_cities:
            return []

        return interesting_cities


def _get_commuting_cities(interesting_cities_for_rome, target_city):
    # Get the reference offers per inhabitant.
    ref = next(
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
            name=hiring_city.city.name,
            relative_offers_per_inhabitant=relative_offers,
            distance_km=distance)


def _compute_square_distance(city_a, city_b):
    """Compute the approximative distance between two cities.

    Since we only look at short distances, we can approximate that:
     - 1° latitude = 111km
     - 1° longitude = 111km * cos(lat)
    """
    delta_y = (city_a.latitude - city_b.latitude) * 111
    mean_latitude = (city_a.latitude + city_b.latitude) / 2
    delta_x = (city_a.longitude - city_b.longitude) * 111 * math.cos(math.radians(mean_latitude))
    return delta_x * delta_x + delta_y * delta_y


scoring.register_model('advice-commute', _AdviceCommuteScoringModel())
