"""Module to advise the user to volunteer with non-profits."""

import collections
from typing import Dict

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import association_pb2


class _AdviceVolunteer(scoring_base.ModelBase):
    """A scoring model to trigger the "Try volunteering" Advice."""

    @scoring_base.ScoringProject.cached('volunteering')
    def volunteering_missions(self, project: scoring_base.ScoringProject) \
            -> association_pb2.VolunteeringMissions:
        """Return a list of volunteering mission close to the project."""

        departement_id = project.details.city.departement_id

        # Get data from MongoDB.
        volunteering_missions_dict: Dict[str, association_pb2.VolunteeringMissions] = \
            collections.defaultdict(association_pb2.VolunteeringMissions)
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

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        missions = self.volunteering_missions(project).missions
        if not missions:
            return scoring_base.NULL_EXPLAINED_SCORE
        if project.get_search_length_at_creation() < 9:
            return scoring_base.ExplainedScore(1, [])
        return scoring_base.ExplainedScore(2, [
            'ça fait du bien de garder une activité sociale dans une recherche longue'])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> association_pb2.VolunteeringMissions:
        """Retrieve data for the expanded card."""

        return self.volunteering_missions(project)


scoring_base.register_model('advice-volunteer', _AdviceVolunteer())
