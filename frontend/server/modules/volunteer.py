"""Module to advise the user to volunteer with non-profits."""
import collections

from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import project_pb2


class _AdviceVolunteer(scoring.ModelBase):
    """A scoring model to trigger the "Try volunteering" Advice."""

    @scoring.ScoringProject.cached('volunteering')
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

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        missions = self.volunteering_missions(project).missions
        if not missions:
            return 0
        if project.details.job_search_length_months < 9:
            return 1
        return 2

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""
        return self.volunteering_missions(project)


scoring.register_model('advice-volunteer', _AdviceVolunteer())
