""" Tests for the diplomas module."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.test import scoring_test


class MissingDiplomaScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the missing required diplomas category."""

    model_id = 'missing-required-diploma'

    def test_no_job_group(self) -> None:
        """User doesn't have any job group."""

        persona = self._random_persona().clone()
        persona.project.ClearField('target_job')
        with self.assertRaises(scoring.NotEnoughDataException) as err:
            self._score_persona(persona)
        self.assertIn('projects.0.targetJob.jobGroup.romeId', err.exception.fields)

    def test_unknown_requirement(self) -> None:
        """User is in a job group with unknown required diploma."""

        self.database.job_group_info.delete_one({'_id': 'A1234'})
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        with self.assertRaises(scoring.NotEnoughDataException) as err:
            self._score_persona(persona)
        self.assertIn('data.job_group_info.requirements.diplomas', err.exception.fields)

    def test_database_requirement(self) -> None:
        """User is in a job-group with no degree needed according to database."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {'diplomas': [{'diploma': {'level': 'NO_DEGREE'}}]},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        self.assertEqual(0, self._score_persona(persona))

    def test_hardcoded_requirement(self) -> None:
        """User is in a job-group with a needed master according to hard-coded values."""

        self.database.job_group_info.delete_one({'_id': 'L120301'})
        persona = self._random_persona().clone()
        persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        persona.project.target_job.job_group.rome_id = 'L120301'
        self.assertEqual(0, self._score_persona(persona))

    def test_database_prevail_on_harcoded(self) -> None:
        """User is in a job-group with both a database and hard-coded requirement."""

        self.database.job_group_info.insert_one({
            '_id': 'L120301',
            'requirements': {'diplomas': [{'diploma': {'level': 'NO_DEGREE'}}]},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'L120301'
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
