"""Tests for thhe senioroty module."""

import datetime

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import scoring_test


class YoungInexperiencedTestCase(scoring_test.ScoringModelTestBase):
    """Tests for "young-inexperienced" scorer."""

    model_id = 'young-inexperienced'

    def test_old(self) -> None:
        """User is too old."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 26

        self.assertEqual(0, self._score_persona(persona))

    def test_seniority(self) -> None:
        """User has some experience in the domain."""

        persona = self._random_persona().clone()
        if persona.project.seniority <= project_pb2.INTERN:
            persona.project.seniority = project_pb2.JUNIOR

        self.assertEqual(0, self._score_persona(persona))

    def test_young_unknown_seniority(self) -> None:
        """User has unknown seniority and is very young."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.UNKNOWN_PROJECT_SENIORITY
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 20

        self.assertEqual(3, self._score_persona(persona))

    def test_young_no_seniority(self) -> None:
        """User has unknown seniority and is very young."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.NO_SENIORITY
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 20

        self.assertEqual(3, self._score_persona(persona))

    def test_youngish_no_seniority(self) -> None:
        """User has unknown seniority and is very young."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.NO_SENIORITY
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 23

        self.assertLess(0, self._score_persona(persona))


class OldDisillusionedTestCase(scoring_test.ScoringModelTestBase):
    """Tests for "young-inexperienced" scorer."""

    model_id = 'old-too-experienced'

    def test_young(self) -> None:
        """User is too young."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 49

        self.assertEqual(0, self._score_persona(persona))

    def test_short_search(self) -> None:
        """User hasn't been searching for a long time."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=30))

    def test_seniority(self) -> None:
        """User has not enough experience in the domain."""

        persona = self._random_persona().clone()
        if persona.project.seniority == project_pb2.CARREER:
            persona.project.seniority = project_pb2.JUNIOR

        self.assertEqual(0, self._score_persona(persona))

    def test_old_unknown_seniority(self) -> None:
        """User has unknown seniority and is very old."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.UNKNOWN_PROJECT_SENIORITY
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 55

        # If they don't know about their seniority, they probably don't have much...
        self.assertEqual(0, self._score_persona(persona))

    def test_old_carreer_man(self) -> None:
        """User has very long seniority and is very old."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=100))
        persona.project.seniority = project_pb2.CARREER
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 60

        self.assertEqual(3, self._score_persona(persona))

    def test_old_enough_carreer_man(self) -> None:
        """User has very long seniority and is old enough."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=100))
        persona.project.seniority = project_pb2.CARREER
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 51

        self.assertLess(0, self._score_persona(persona))
