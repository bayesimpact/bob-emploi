"""Module to advise the user to try an immersion."""

from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import project_pb2


class _ImmersionMissionLocale(scoring_base.ModelBase):
    """A scoring model to trigger the "Immersion with Mission Locale" advice."""

    def score_and_explain(self, project):
        """Compute a score for the given ScoringProject."""

        if project.details.previous_job_similarity != project_pb2.NEVER_DONE or \
                project.get_user_age() > 25:
            return scoring_base.NULL_EXPLAINED_SCORE

        explanations = []
        score = 2

        if project.details.network_estimate <= 2:
            explanations.append(project.translate_string('ça vous aide à développer votre réseau'))
            score += .5

        if project.details.passionate_level >= project_pb2.PASSIONATING_JOB:
            explanations.append(project.translate_string('ça montre votre motivation'))
            score += .5

        return scoring_base.ExplainedScore(score, explanations)

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        return project.mission_locale_data()


scoring_base.register_model('advice-immersion-milo', _ImmersionMissionLocale())
