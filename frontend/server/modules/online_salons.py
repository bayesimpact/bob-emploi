"""Module to advise the user to go to pôle emploi online salons."""

import typing

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import online_salon_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base

_AREA_TYPE_TO_ID_GETTER: typing.Dict[
    'geo_pb2.AreaType',
    typing.Callable[[geo_pb2.FrenchCity], str]
] = {
    geo_pb2.REGION: lambda city: city.region_id,
    geo_pb2.DEPARTEMENT: lambda city: city.departement_id,
    geo_pb2.CITY: lambda city: city.city_id,
}


class _AdviceOnlineSalons(scoring_base.ModelBase):
    """A scoring model to trigger the "Create your company" advice."""

    def __init__(self) -> None:
        super().__init__()
        self._salon_db: proto.MongoCachedCollection[online_salon_pb2.OnlineSalon] = \
            proto.MongoCachedCollection(online_salon_pb2.OnlineSalon, 'online_salons')

    @scoring_base.ScoringProject.cached('online_salons')
    def _get_relevant_salons(self, project: scoring_base.ScoringProject) \
            -> typing.List[online_salon_pb2.OnlineSalon]:
        today = project.now
        # TODO(cyrille): Test filters.
        filtered_salons = scoring_base.filter_using_score(
            self._salon_db.get_collection(project.database),
            lambda salon: salon.filters,
            project)
        kept_salons = []
        for salon in filtered_salons:
            score = 0
            if today >= salon.application_end_date.ToDatetime():
                continue
            if salon.locations:
                # Do not show salon if we know user won't move to its location.
                if all(
                        not _might_move_to(project.details, location)
                        for location in salon.locations):
                    continue
                score += 1
            if salon.job_group_ids:
                # Do not show salon if we know user is not interested in its jobs.
                if not _is_in_job_group(
                        project.details.target_job.job_group.rome_id, salon.job_group_ids):
                    continue
                score += 1
            kept_salons.append((salon, score))
        return [salon for salon, score in sorted(
            kept_salons, key=lambda ks: (-ks[1], ks[0].start_date.ToDatetime()))]

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        relevant_salons = self._get_relevant_salons(project)
        if not relevant_salons:
            return scoring_base.NULL_EXPLAINED_SCORE

        reasons = []
        # TODO(cyrille): Refine this depending on salons' locations.
        if project.details.area_type >= geo_pb2.COUNTRY:
            reasons.append(project.translate_string('vous êtes mobile partout en France'))
        elif any(salon.HasField('location') for salon in relevant_salons):
            reasons.append(project.translate_string(
                'certains salons concernent votre zone géographique'))

        if any(salon.job_group_ids for salon in relevant_salons):
            reasons.append('des entreprises {} recherchent du monde'.format(
                project.job_group_info().in_domain))

        return scoring_base.ExplainedScore(1, reasons)

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> online_salon_pb2.OnlineSalons:
        """Retrieve data for the expanded card."""

        salons = self._get_relevant_salons(project)
        return online_salon_pb2.OnlineSalons(salons=salons[:10])


def _is_in_job_group(target_job_group_id: str, job_group_ids: typing.Iterable[str]) -> bool:
    for job_group_id in job_group_ids:
        if target_job_group_id.startswith(job_group_id):
            return True
    return False


def _might_move_to(project: project_pb2.Project, location: geo_pb2.Location) -> bool:
    """Returns whether a user with the given mobility would find an offer at the given location
    interesting.

    This means either the location is within the mobility range, or large enough to include the
    mobility center.
    For instance, an offer in a departement is assumed to be anywhere in that departement, so a user
    that lives in it could be interested, even if they don't want to move from their city.

    Location is assumed to have an area_type and an id for all enclosing areas, if it's smaller than
    COUNTRY. For instance {area_type: 'DEPARTEMENT', city: {region_id: '84', departement_id: '69'}}.
    Mobility is as given from a scoring project, with an area_type and a city with all necessary
    ids.
    """

    area_type = project.area_type
    if not area_type:
        # We know nothing of user's mobility, let's filter nothing out.
        return True
    area_type = max(area_type, location.area_type)
    get_area_type_id = _AREA_TYPE_TO_ID_GETTER.get(area_type, lambda unused_city: '')
    return get_area_type_id(location.city) == get_area_type_id(project.city)


scoring_base.register_model('advice-online-salons', _AdviceOnlineSalons())
