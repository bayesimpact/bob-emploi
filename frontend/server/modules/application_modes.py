"""Module to advise the user to do spontaneous applications."""

import itertools

from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import job_pb2


class _SpontaneousApplicationScoringModel(scoring_base.ModelBase):
    """A scoring model for the "Send spontaneous applications" advice module."""

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(
            fap_modes.modes[0].mode for fap_modes in application_modes
            if len(fap_modes.modes))
        if job_pb2.SPONTANEOUS_APPLICATION in first_modes:
            return scoring_base.ExplainedScore(3, [project.translate_string(
                "c'est le canal de recrutement n°1 pour votre métier")])

        second_modes = set(
            fap_modes.modes[1].mode for fap_modes in application_modes
            if len(fap_modes.modes) > 1)
        if job_pb2.SPONTANEOUS_APPLICATION in second_modes:
            return scoring_base.ExplainedScore(2, [project.translate_string(
                "c'est un des meilleurs canaux de recrutement pour votre métier")])

        return scoring_base.NULL_EXPLAINED_SCORE

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        return project_pb2.SpontaneousApplicationData(companies=[
            companies.to_proto(c)
            for c in itertools.islice(companies.get_lbb_companies(project.details), 5)])


class _GreatApplicationModeFilter(scoring_base.BaseFilter):
    """A filter for projects where a given application mode is interesting.
    Following recommandations from notebook on delta percentage:
    https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/datasets/imt/application_modes.ipynb
    """

    def __init__(self, application_mode, delta_percentage):
        super(_GreatApplicationModeFilter, self).__init__(self._filter)
        self.application_mode = application_mode
        self.delta_percentage = delta_percentage

    def _filter(self, project):
        """the filtering function for a given ScoringProject."""

        application_modes = project.job_group_info().application_modes.values()
        for fap_modes in application_modes:
            if fap_modes.modes and fap_modes.modes[0].mode == self.application_mode:
                return True
            if len(fap_modes.modes) > 1 \
                    and fap_modes.modes[1].mode == self.application_mode \
                    and fap_modes.modes[0].percentage - fap_modes.modes[1].percentage <= \
                    self.delta_percentage:
                return True

        return False


scoring_base.register_model(
    'advice-spontaneous-application', _SpontaneousApplicationScoringModel())
scoring_base.register_model(
    'for-mainly-hiring-through-network(±15%)', _GreatApplicationModeFilter(
        application_mode=job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS, delta_percentage=15))
scoring_base.register_model(
    'for-mainly-hiring-through-spontaneous(±15%)', _GreatApplicationModeFilter(
        application_mode=job_pb2.SPONTANEOUS_APPLICATION, delta_percentage=15))
