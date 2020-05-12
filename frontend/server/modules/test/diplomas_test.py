""" Tests for the diplomas module."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server.test import scoring_test


class MissingDiplomaScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the missing required diplomas category."""

    model_id = 'missing-required-diploma'

    def test_no_job_group(self) -> None:
        """User doesn't have any job group."""

        persona = self._random_persona().clone()
        persona.project.ClearField('target_job')
        self._assert_missing_fields_to_score_persona(
            {'projects.0.targetJob.jobGroup.romeId'}, persona)

    def test_unknown_requirement(self) -> None:
        """User is in a job group with unknown required diploma."""

        self.database.job_group_info.delete_one({'_id': 'A1234'})
        persona = self._random_persona().clone()
        if persona.user_profile.highest_degree == job_pb2.DEA_DESS_MASTER_PHD:
            persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        persona.project.target_job.job_group.rome_id = 'A1234'
        self._assert_missing_fields_to_score_persona(
            {'data.job_group_info.A1234.requirements.diplomas'}, persona)

    def test_database_requirement(self) -> None:
        """User is in a job-group with no degree needed according to database."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {'diplomas': [{'diploma': {'level': 'NO_DEGREE'}}]},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        self.assertEqual(0, self._score_persona(persona))

    def test_user_with_master(self) -> None:
        """User with a master should not need more diplomas."""

        persona = self._random_persona().clone()
        persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        persona.project.target_job.job_group.rome_id = 'A1234'
        self.assertEqual(0, self._score_persona(persona))

    def test_hardcoded_requirement(self) -> None:
        """User is in a job-group with a needed CAP according to hard-coded values."""

        self.database.job_group_info.delete_one({'_id': 'N4104'})
        persona = self._random_persona().clone()
        persona.user_profile.highest_degree = job_pb2.CAP_BEP
        persona.project.target_job.job_group.rome_id = 'N4104'
        self.assertEqual(0, self._score_persona(persona))

    def test_database_prevail_on_harcoded(self) -> None:
        """User is in a job-group with both a database and hard-coded requirement."""

        self.database.job_group_info.insert_one({
            '_id': 'N4104',
            'requirements': {'diplomas': [{'diploma': {'level': 'NO_DEGREE'}}]},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'N4104'
        self.assertEqual(0, self._score_persona(persona))

    def test_requirement_not_met(self) -> None:
        """User doesn't have the required diploma."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {'diplomas': [{'diploma': {'level': 'DEA_DESS_MASTER_PHD'}}]},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        self.assertEqual(3, self._score_persona(persona))
