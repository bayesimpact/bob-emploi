"""Module to advise the user on specific jobboard they might not be aware of."""

import random
from typing import Iterator, List

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import user_pb2

_JOBBOARDS: proto.MongoCachedCollection[jobboard_pb2.JobBoard] = \
    proto.MongoCachedCollection(jobboard_pb2.JobBoard, 'jobboards')


def list_jobboards(project: scoring_base.ScoringProject) -> Iterator[jobboard_pb2.JobBoard]:
    """List all job boards for this project."""

    all_job_boards = _JOBBOARDS.get_collection(project.database)
    for job_board_template in scoring_base.filter_using_score(
            all_job_boards, lambda j: j.filters, project):
        job_board = jobboard_pb2.JobBoard()
        job_board.CopyFrom(job_board_template)
        job_board.link = project.populate_template(job_board.link)
        yield job_board


class _AdviceJobBoards(scoring_base.LowPriorityAdvice):
    """A scoring model to trigger the "Find job boards" advice."""

    def __init__(self) -> None:
        super().__init__(user_pb2.NO_OFFERS)

    def _explain(self, project: scoring_base.ScoringProject) -> List[str]:
        """Compute a score for the given ScoringProject, and with why it's received this score."""

        if self._main_frustration in project.user_profile.frustrations:
            return [project.translate_static_string(
                "vous nous avez dit ne pas trouver assez d'offres")]
        return []

    @scoring_base.ScoringProject.cached('jobboards')
    def list_jobboards(self, project: scoring_base.ScoringProject) \
            -> List[jobboard_pb2.JobBoard]:
        """List all job boards for this project."""

        return list(list_jobboards(project))

    def get_expanded_card_data(self, project: scoring_base.ScoringProject) \
            -> jobboard_pb2.JobBoards:
        """Retrieve data for the expanded card."""

        jobboards = self.list_jobboards(project)
        sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
        return jobboard_pb2.JobBoards(job_boards=sorted_jobboards)


scoring_base.register_model('advice-job-boards', _AdviceJobBoards())
