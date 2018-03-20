"""Module to advise the user to create their own company."""

import datetime
import math
import random

from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base


_SQUARE_DEGREES_TO_SQUARE_KMS = 111.7 * 111.7


def _compute_square_degree_distance(location_a, location_b):
    delta_lat = abs(location_a.latitude - location_b.latitude)
    delta_lng = abs(location_a.longitude - location_b.longitude)
    lng_stretch = math.cos(math.radians(location_a.longitude))
    delta_lng_stretched = delta_lng * lng_stretch
    return delta_lng_stretched * delta_lng_stretched + delta_lat * delta_lat


def _find_closest_city_with_events(events, target):
    """Find the closest city from target location with at least one event.

    Args:
        events: a list of Event protos.
        target: a FrenchCity proto.

    Returns:
        A tuple with the city's name and the square distance to that city.
    """

    event = min(events, key=lambda event: _compute_square_degree_distance(event, target))
    square_distance = _compute_square_degree_distance(event, target) * _SQUARE_DEGREES_TO_SQUARE_KMS
    return event.city_name, square_distance


class _AdviceCreateYourCompany(scoring_base.ModelBase):
    """A scoring model to trigger the "Create your company" advice."""

    def __init__(self):
        super(_AdviceCreateYourCompany, self).__init__()
        self._db = proto.MongoCachedCollection(event_pb2.Event, 'adie_events')

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        discrimination_reason = project.translate_string(
            'vous nous avez dit que les employeurs ne '
            'vous donnent pas votre chance')
        relevant_frustrations = {
            user_pb2.AGE_DISCRIMINATION: discrimination_reason,
            user_pb2.ATYPIC_PROFILE: discrimination_reason,
            user_pb2.NO_OFFERS: project.translate_string(
                "vous nous avez dit ne pas trouver d'offres correspondant "
                'à vos critères'),
            user_pb2.SEX_DISCRIMINATION: discrimination_reason,
        }
        its_easy = project.translate_string(
            "c'est plus facile à faire qu'on peut le croire")

        # TODO(pascal): Make this dynamic if we get data for after Feb 2018.
        if project.now >= datetime.datetime(2018, 2, 7):
            return scoring_base.NULL_EXPLAINED_SCORE
        frustration_reasons = {
            relevant_frustrations[frustration] for frustration in project.user_profile.frustrations
            if frustration in relevant_frustrations}
        if frustration_reasons or project.get_search_length_now() > 3:
            return scoring_base.ExplainedScore(2, list(frustration_reasons) or [its_easy])
        return scoring_base.ExplainedScore(1, [its_easy])

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        return project_pb2.CreateYourCompanyData(
            city=self.find_closest_city_with_events(project),
            # TODO(pascal): Make this dynamic if we get data for after Feb 2018.
            period=project.translate_string('du 5 au 7 février'),
        )

    @scoring_base.ScoringProject.cached('create_your_company')
    def find_closest_city_with_events(self, project):
        """Find the closest city of project's location with events."""

        target_city = _get_target_city_proto(project)
        if not target_city:
            return ''
        all_events = self._db.get_collection(project.database)
        if not all_events:
            return ''
        city_name, square_distance = _find_closest_city_with_events(all_events, target_city)
        # We expect that users will not be interested in events further than 50km.
        if square_distance < 50 * 50:
            return city_name
        return ''

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        city_name = self.find_closest_city_with_events(project)
        if not city_name:
            all_events = list(self._db.get_collection(project.database))
            target_city = _get_target_city_proto(project)
            if target_city and target_city.latitude:
                sorted_events = sorted(
                    all_events,
                    key=lambda event: _compute_square_degree_distance(event, target_city))
                events = sorted_events[:5]
            else:
                events = random.sample(all_events, min(5, len(all_events)))
            return event_pb2.CloseByEvents(events=events)
        all_events = self._db.get_collection(project.database)
        return event_pb2.CloseByEvents(
            city=city_name,
            events=[event for event in all_events if event.city_name == city_name],
        )


def _get_target_city_proto(project):
    city_dict = project.database.cities.find_one({
        '_id': project.details.mobility.city.city_id})
    return proto.create_from_mongo(city_dict, geo_pb2.FrenchCity, always_create=False)


scoring_base.register_model('advice-create-your-company', _AdviceCreateYourCompany())
