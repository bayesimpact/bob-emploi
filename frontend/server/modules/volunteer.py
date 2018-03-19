"""Module to advise the user to volunteer with non-profits."""

import collections

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import project_pb2


class _AdviceVolunteer(scoring_base.ModelBase):
    """A scoring model to trigger the "Try volunteering" Advice."""

    @scoring_base.ScoringProject.cached('volunteering')
    def volunteering_missions(self, project):
        """Return a list of volunteering mission close to the project."""

        departement_id = project.details.mobility.city.departement_id

        # Get data from MongoDB.
        volunteering_missions_dict = collections.defaultdict(association_pb2.VolunteeringMissions)
        collection = project.database.volunteering_missions
        for record in collection.find({'_id': {'$in': [departement_id, '']}}):
            record_id = record.pop('_id')
            proto.parse_from_mongo(record, volunteering_missions_dict[record_id])

        # TODO(pascal): First get missions from target city if any.

        # Merge data.
        project_missions = association_pb2.VolunteeringMissions()
        for scope in [departement_id, '']:
            for mission in volunteering_missions_dict[scope].missions:
                mission.is_available_everywhere = not scope
                project_missions.missions.add().CopyFrom(mission)

        return project_missions

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        association_names = [
            m.association_name for m in self.volunteering_missions(project).missions]

        # Deduplicate association names.
        seen = set()
        association_names = [n for n in association_names if not (n in seen or seen.add(n))]

        return project_pb2.VolunteerData(association_names=association_names[:3])

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        missions = self.volunteering_missions(project).missions
        if not missions:
            return scoring_base.NULL_EXPLAINED_SCORE
        if project.get_search_length_at_creation() < 9:
            return scoring_base.ExplainedScore(1, [])
        return scoring_base.ExplainedScore(2, [
            'ça fait du bien de garder une activité sociale dans une recherche longue'])

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        return self.volunteering_missions(project)


scoring_base.register_model('advice-volunteer', _AdviceVolunteer())
