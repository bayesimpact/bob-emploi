"""Tests for scoring model(s) in the bob_emploi.frontend.modules.project_clarity module."""

import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import filters_test
from bob_emploi.frontend.server.test import scoring_test


class UnclearProjectTest(scoring_test.ScoringModelTestBase):
    """Tests for the scoring model "for-unclear-project"."""

    model_id = 'for-unclear-project'

    def test_one_job_only(self) -> None:
        """User that has one simple target job."""

        persona = self._random_persona().clone()
        if not persona.project.target_job.job_group.rome_id:
            persona.project.target_job.job_group.rome_id = 'A1234'
        del persona.user.projects[1:]
        persona.project.ClearField('has_clear_project')
        self._assert_missing_fields_to_score_persona({'projects.0.hasClearProject'}, persona)

    def test_one_clear_job(self) -> None:
        """User that has one simple target job, but they're sure of it."""

        persona = self._random_persona().clone()
        if not persona.project.target_job.job_group.rome_id:
            persona.project.target_job.job_group.rome_id = 'A1234'
        del persona.user.projects[1:]
        persona.project.has_clear_project = project_pb2.TRUE
        self.assertEqual(0, self._score_persona(persona))

    def test_no_target_job(self) -> None:
        """User that has no target job."""

        persona = self._random_persona().clone()
        persona.project.ClearField('target_job')
        del persona.user.projects[1:]
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_three_very_different_jobs(self) -> None:
        """User that has 3 target jobs that are quite different."""

        persona = self._random_persona().clone()
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'A1234'
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'B5678'
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'C9012'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_three_time_same_job_group(self) -> None:
        """User that has 3 target jobs that are quite close."""

        persona = self._random_persona().clone()
        project = persona.project
        del persona.user.projects[1:]
        project.target_job.job_group.rome_id = 'A1234'
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'A1234'
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=persona.name)

    def test_three_time_same_super_job_group(self) -> None:
        """User that has 3 target jobs that are in the same super job group (artist)."""

        persona = self._random_persona().clone()
        project = persona.project
        project.target_job.job_group.rome_id = 'L1234'
        del persona.user.projects[1:]
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'B5678'
        project = persona.user.projects.add()
        project.target_job.job_group.rome_id = 'L0123'
        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=persona.name)


class FirstLeverModuleTestCase(filters_test.FilterTestBase):
    """Test suite for the lever modules."""

    model_id = 'for-too-many-objectives'

    def test_too_many_projects(self) -> None:
        """The user has too many projects."""

        self.persona.user.projects.extend([
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234'))),
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='B1234'))),
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='C1234'))),
        ])
        self._assert_pass_filter()

    def test_only_two_projects(self) -> None:
        """The user only has two projects."""

        del self.persona.user.projects[:]
        self.persona.user.projects.extend([
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='B1234'))),
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='C1234'))),
        ])
        self._assert_fail_filter()


class UnsureProjectTestCase(filters_test.FilterTestBase):
    """Tests for the "for-no-clear-project" filter."""

    model_id = 'for-no-clear-project'

    def test_single_unclear_project(self) -> None:
        """The user has only one project and we know they're not sure of it."""

        del self.persona.user.projects[1:]
        if not self.persona.project.target_job.job_group.rome_id:
            self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.has_clear_project = project_pb2.FALSE
        self._assert_pass_filter()

    def test_single_clear_project(self) -> None:
        """The user has only one project and we know they're sure of it."""

        del self.persona.user.projects[1:]
        if not self.persona.project.target_job.job_group.rome_id:
            self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.has_clear_project = project_pb2.TRUE
        self._assert_fail_filter()

    def test_single_unsure_project(self) -> None:
        """The user has only one project, we don't know whether they're sure of it."""

        del self.persona.user.projects[1:]
        if not self.persona.project.target_job.job_group.rome_id:
            self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.ClearField('has_clear_project')
        self._assert_missing_fields_to_score_persona({'projects.0.hasClearProject'}, self.persona)

    def test_several_projects(self) -> None:
        """The user has at least two projects."""

        project = self.persona.user.projects.add()
        project.target_job.job_group.rome_id = 'A1234'
        project = self.persona.user.projects.add()
        project.target_job.job_group.rome_id = 'B5677'
        self._assert_fail_filter()

    def test_project_with_no_target(self) -> None:
        """The user has no idea what they want to do."""

        del self.persona.user.projects[1:]
        self.persona.project.ClearField('target_job')
        self._assert_pass_filter()


class CantSellSelfTestCase(filters_test.FilterTestBase):
    """Tests for the cant-sell-self filter."""

    model_id = 'cant-sell-self'

    def test_unclear_project(self) -> None:
        """Project is unclear."""

        self.persona.user.projects.extend([
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234'))),
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='B1234'))),
            project_pb2.Project(
                target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='C1234'))),
        ])
        self._assert_fail_filter()

    def test_no_project(self) -> None:
        """Project is not defined."""

        del self.persona.user.projects[1:]
        self.persona.project.ClearField('target_job')
        self._assert_fail_filter()

    def test_unexperienced(self) -> None:
        """User is not much experienced in their job."""

        if self.persona.project.seniority >= project_pb2.SENIOR:
            self.persona.project.seniority = project_pb2.INTERMEDIARY
        self._assert_fail_filter()

    def test_autonomy_unknown(self) -> None:
        """We don't know whether user is autonomous."""

        del self.persona.user.projects[1:]
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.seniority = project_pb2.SENIOR
        self.persona.user_profile.ClearField('is_autonomous')
        self._assert_missing_fields_to_score_persona({'profile.isAutonomous'}, self.persona)

    def test_autonomous(self) -> None:
        """User is autonomous."""

        self.persona.user_profile.is_autonomous = project_pb2.TRUE
        self._assert_fail_filter()

    def test_not_autonomous(self) -> None:
        """User is not autonomous."""

        del self.persona.user.projects[1:]
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.seniority = project_pb2.SENIOR
        self.persona.user_profile.is_autonomous = project_pb2.FALSE
        self._assert_pass_filter()


if __name__ == '__main__':
    unittest.main()
