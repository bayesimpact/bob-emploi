"""Module to advise the user to get helped by a local association."""
import random

from bob_emploi.frontend import proto
from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class _AdviceAssociationHelp(scoring.ModelBase):
    """A scoring model to trigger the "Find an association to help you" advice."""

    def __init__(self):
        super(_AdviceAssociationHelp, self).__init__()
        self._db = proto.MongoCachedCollection(association_pb2.Association, 'associations')

    @scoring.ScoringProject.cached('associations')
    def list_associations(self, project):
        """List all associations for a project."""
        all_associations = self._db.get_collection(project.database)
        return list(scoring.filter_using_score(all_associations, lambda j: j.filters, project))

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        associations = self.list_associations(project)
        if not associations:
            return 0
        if user_pb2.MOTIVATION in project.user_profile.frustrations:
            return 3
        if len(associations) >= 3 and project.details.job_search_length_months >= 6:
            return 3
        if project.details.job_search_length_months >= 12:
            return 3
        return 2

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        associations = self.list_associations(project)
        if not associations:
            return None
        sorted_associations = sorted(associations, key=lambda j: (-len(j.filters), random.random()))
        return project_pb2.AssociationsData(association_name=sorted_associations[0].name)

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""
        associations = self.list_associations(project)
        sorted_associations = sorted(associations, key=lambda j: (-len(j.filters), random.random()))
        return association_pb2.Associations(associations=sorted_associations)


scoring.register_model('advice-association-help', _AdviceAssociationHelp())
