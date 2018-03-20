"""Module to advise the user on specific jobboard they might not be aware of."""

import random

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class _AdviceJobBoards(scoring_base.LowPriorityAdvice):
    """A scoring model to trigger the "Find job boards" advice."""

    def __init__(self):
        super(_AdviceJobBoards, self).__init__(user_pb2.NO_OFFERS)
        self._db = proto.MongoCachedCollection(jobboard_pb2.JobBoard, 'jobboards')

    def _explain(self, project):
        """Compute a score for the given ScoringProject, and with why it's received this score."""

        if self._main_frustration in project.user_profile.frustrations:
            return [project.translate_string(
                "vous nous avez dit ne pas trouver assez d'offres")]
        return []

    @scoring_base.ScoringProject.cached('jobboards')
    def list_jobboards(self, project):
        """List all job boards for this project."""

        all_job_boards = self._db.get_collection(project.database)
        return list(scoring_base.filter_using_score(all_job_boards, lambda j: j.filters, project))

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""

        jobboards = [j for j in self.list_jobboards(project) if not j.is_well_known]
        if not jobboards:
            return None
        sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
        best_job_board = sorted_jobboards[0]
        return project_pb2.JobBoardsData(
            job_board_title=best_job_board.title,
            is_specific_to_job_group=any(
                f.startswith('for-job') for f in best_job_board.filters),
            is_specific_to_region=any(
                f.startswith('for-departement') for f in best_job_board.filters),
        )

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        jobboards = self.list_jobboards(project)
        sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
        return jobboard_pb2.JobBoards(job_boards=sorted_jobboards)


scoring_base.register_model('advice-job-boards', _AdviceJobBoards())
