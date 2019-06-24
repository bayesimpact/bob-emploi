"""Advice module to recommend using your network to find opportunities."""

import random
import typing

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import network_pb2


class _ImproveYourNetworkScoringModel(scoring_base.ModelBase):
    """A scoring model for Advice that user needs to improve their network."""

    def __init__(self, network_level: int) -> None:
        super().__init__()
        self._db: proto.MongoCachedCollection[network_pb2.ContactLeadTemplate] = \
            proto.MongoCachedCollection(network_pb2.ContactLeadTemplate, 'contact_lead')
        self._network_level = network_level

    def score_and_explain(self, project: scoring_base.ScoringProject) \
            -> scoring_base.ExplainedScore:
        """Compute a score for the given ScoringProject."""

        if project.details.network_estimate != self._network_level:
            return scoring_base.NULL_EXPLAINED_SCORE

        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(fap_modes.modes[0].mode for fap_modes in application_modes)
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return scoring_base.ExplainedScore(3, [
                'le réseau est le canal n°1 pour trouver un métier %inDomain'])
        return scoring_base.ExplainedScore(2, [])

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> network_pb2.ContactLeads:
        """Retrieve data for the expanded card."""

        contact_leads = self._list_contact_leads(project)
        sorted_leads = sorted(contact_leads, key=lambda l: (-len(l.filters), random.random()))
        return network_pb2.ContactLeads(leads=[
            network_pb2.ContactLead(
                name=project.populate_template(project.translate_string(template.name)),
                email_example=project.populate_template(template.email_template),
                contact_tip=project.translate_string(template.contact_tip))
            for template in sorted_leads
        ])

    @scoring_base.ScoringProject.cached('contact-leads')
    def _list_contact_leads(self, project: scoring_base.ScoringProject) \
            -> typing.Iterator[network_pb2.ContactLeadTemplate]:
        return scoring_base.filter_using_score(
            self._db.get_collection(project.database), lambda l: l.filters, project)


scoring_base.register_model('advice-better-network', _ImproveYourNetworkScoringModel(2))
scoring_base.register_model('advice-improve-network', _ImproveYourNetworkScoringModel(1))
scoring_base.register_model('advice-use-good-network', _ImproveYourNetworkScoringModel(3))
