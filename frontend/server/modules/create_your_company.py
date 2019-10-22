"""Module to advise the user to create their own company."""

import math
import random
import typing
from typing import Iterable, Optional, Set, Tuple

from bob_emploi.frontend.api import create_company_expanded_data_pb2
from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import testimonial_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base

if typing.TYPE_CHECKING:
    import typing_extensions

    # TODO(cyrille): Move to a lib if we need it somewhere else.
    class GeoLocalizationProtocol(typing_extensions.Protocol):
        """Typing protocol for protos localized on a sphere."""

        latitude: float
        longitude: float


_SQUARE_DEGREES_TO_SQUARE_KMS = 111.7 * 111.7


def _compute_square_degree_distance(
        location_a: 'GeoLocalizationProtocol',
        location_b: 'GeoLocalizationProtocol') -> float:
    delta_lat = abs(location_a.latitude - location_b.latitude)
    delta_lng = abs(location_a.longitude - location_b.longitude)
    lng_stretch = math.cos(math.radians(location_a.longitude))
    delta_lng_stretched = delta_lng * lng_stretch
    return delta_lng_stretched * delta_lng_stretched + delta_lat * delta_lat


def _find_closest_city_with_events(
        events: Iterable[event_pb2.Event],
        target: geo_pb2.FrenchCity) -> Tuple[str, float]:
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

    def __init__(self) -> None:
        super().__init__()
        self.testimonial_db: proto.MongoCachedCollection[testimonial_pb2.Testimonial] = \
            proto.MongoCachedCollection(testimonial_pb2.Testimonial, 'adie_testimonials')
        self.event_db: proto.MongoCachedCollection[event_pb2.Event] = \
            proto.MongoCachedCollection(event_pb2.Event, 'adie_events')

    def _get_frustrations_reasons(self, project: scoring_base.ScoringProject) \
            -> Set[str]:
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
        frustration_reasons = {
            relevant_frustrations[frustration] for frustration in project.user_profile.frustrations
            if frustration in relevant_frustrations}
        return frustration_reasons

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        frustration_reasons = list(self._get_frustrations_reasons(project))
        its_easy = project.translate_string(
            "c'est plus facile à faire qu'on peut le croire")

        if frustration_reasons or project.get_search_length_now() > 3:
            return scoring_base.ExplainedScore(2, frustration_reasons or [its_easy])
        return scoring_base.ExplainedScore(1, [its_easy])

    @scoring_base.ScoringProject.cached('create_your_company')
    def find_closest_city_with_events(self, project: scoring_base.ScoringProject) -> str:
        """Find the closest city of project's location with events."""

        target_city = geo.get_city_location(project.database, project.details.city.city_id)
        if not target_city:
            return ''
        all_events = self.event_db.get_collection(project.database)
        if not all_events:
            return ''
        city_name, square_distance = _find_closest_city_with_events(all_events, target_city)
        # We expect that users will not be interested in events further than 50km.
        if square_distance < 50 * 50:
            return city_name
        return ''

    def _find_closest_events(self, project: scoring_base.ScoringProject) -> event_pb2.CloseByEvents:
        """Find the events nearest to the project's location."""

        now_date = project.now.strftime('%Y-%m-%d')
        event_collection = [
            event for event in self.event_db.get_collection(project.database)
            if not event.start_date or event.start_date >= now_date
        ]

        city_name = self.find_closest_city_with_events(project)
        if not city_name:
            all_events = list(event_collection)
            target_city = geo.get_city_location(
                project.database, project.details.city.city_id) or geo_pb2.FrenchCity()
            if not target_city.latitude:
                return event_pb2.CloseByEvents(
                    events=random.sample(all_events, min(5, len(all_events))))
            sorted_events = sorted(
                all_events, key=lambda event: _compute_square_degree_distance(event, target_city))
            return event_pb2.CloseByEvents(events=sorted_events[:5])

        return event_pb2.CloseByEvents(
            city=city_name,
            events=[event for event in event_collection if event.city_name == city_name],
        )

    def _find_relevant_testimonials(self, project: scoring_base.ScoringProject) \
            -> Optional[testimonial_pb2.Testimonials]:
        """Find the testimonials relevant for the user's project."""

        max_testimonial_num = 8
        all_testimonials = self.testimonial_db.get_collection(project.database)

        if not all_testimonials:
            return None
        job_group_id = project.details.target_job.job_group.rome_id

        filtered_testimonials = list(
            scoring_base.filter_using_score(all_testimonials, lambda j: j.filters, project))
        if not filtered_testimonials:
            return None

        same_job_testimonials = [
            testimonial for testimonial in filtered_testimonials if _is_in_job_group(
                job_group_id, testimonial.preferred_job_group_ids)]

        if not same_job_testimonials:
            return testimonial_pb2.Testimonials(
                testimonials=filtered_testimonials[:max_testimonial_num])
        return testimonial_pb2.Testimonials(
            testimonials=same_job_testimonials[:max_testimonial_num])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> create_company_expanded_data_pb2.CreateCompanyExpandedData:
        """Retrieve data for the expanded card."""

        events = self._find_closest_events(project)
        testimonials = self._find_relevant_testimonials(project)
        return create_company_expanded_data_pb2.CreateCompanyExpandedData(
            close_by_events=events, related_testimonials=testimonials)


def _is_in_job_group(target_job_group_id: str, job_group_ids: Iterable[str]) -> bool:
    for job_group_id in job_group_ids:
        if target_job_group_id.startswith(job_group_id):
            return True
    return False


scoring_base.register_model('advice-create-your-company', _AdviceCreateYourCompany())
