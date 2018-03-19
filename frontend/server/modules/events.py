"""Module to advise the user to go to events."""

import random

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2


class _AdviceEventScoringModel(scoring_base.ModelBase):
    """A scoring model for Advice that user needs to go to events."""

    def __init__(self):
        super(_AdviceEventScoringModel, self).__init__()
        self._db = proto.MongoCachedCollection(event_pb2.Event, 'events')

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(fap_modes.modes[0].mode for fap_modes in application_modes)
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return scoring_base.ExplainedScore(2, [project.translate_string(
                'les embauches se font surtout par les contacts personnels ou professionnels dans'
                ' votre métier')])

        return scoring_base.ExplainedScore(1, [project.translate_string(
            "c'est un bon moyen d'étendre votre réseau")])

    @scoring_base.ScoringProject.cached('events')
    def list_events(self, project):
        """List all events close to the project's target."""

        today = project.now.strftime('%Y-%m-%d')
        all_events = [e for e in self._db.get_collection(project.database) if e.start_date >= today]
        return list(scoring_base.filter_using_score(all_events, lambda e: e.filters, project))

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        all_events = self.list_events(project)
        if not all_events:
            return None
        return project_pb2.EventsData(event_name=all_events[0].title)

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        events = self.list_events(project)
        sorted_events = sorted(
            events, key=lambda j: (j.start_date, -len(j.filters), random.random()))
        return event_pb2.Events(events=sorted_events)


scoring_base.register_model('advice-event', _AdviceEventScoringModel())
