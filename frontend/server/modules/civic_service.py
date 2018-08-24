"""Module to advise the user to do a civic service mission."""

from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base


class _AdviceCivicService(scoring_base.ModelBase):
    """A scoring model for the civic service advice.

    """

    def __init__(self):
        super(_AdviceCivicService, self).__init__()
        self._db = proto.MongoCachedCollection(
            association_pb2.VolunteeringMissions, 'local_missions')

    @scoring_base.ScoringProject.cached('local_missions')
    def get_local_missions(self, project):
        """Get the civic service missions for the user departement"""

        departement_id = project.details.city.departement_id \
            or project.details.mobility.city.departement_id
        if not departement_id:
            return association_pb2.VolunteeringMissions()
        try:
            local_missions = self._db.get_collection(project.database)[departement_id]
        except KeyError:
            return association_pb2.VolunteeringMissions()
        return local_missions

    def get_expanded_card_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        return self.get_local_missions(project)

    def score_and_explain(self, project):
        """Compute the score for a given project and explains it.

        Requirements are:
        - being between 16 and 30 y.o if having a handicap or between 16 and 25 otherwise
        - having low or no experience (internship maximum)
        """

        age = project.get_user_age()
        seniority = project.details.seniority
        reasons = []
        if age < 16 or seniority > project_pb2.INTERNSHIP:
            return scoring_base.NULL_EXPLAINED_SCORE
        if project.user_profile.has_handicap and age <= 30:
            reasons = [project.translate_string('vous avez entre 16 et 30 ans')]
        if age <= 25:
            reasons = [project.translate_string('vous avez entre 16 et 25 ans')]
        if not reasons:
            return scoring_base.NULL_EXPLAINED_SCORE
        return scoring_base.ExplainedScore(2, reasons)


scoring_base.register_model(
    'advice-civic-service', _AdviceCivicService())
