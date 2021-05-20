"""Tests for scoring model(s) in the bob_emploi.frontend.modules.language module."""

import unittest

from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import filters_test
from bob_emploi.frontend.server.test import scoring_test


class MissingLanguageTest(scoring_test.ScoringModelTestBase):
    """Tests for the scoring model "for-missing-language"."""

    model_id = 'for-missing-language'

    def test_unknown_knowledge(self) -> None:
        """User might or might not speak any language."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        self._assert_missing_fields_to_score_persona(
            {'profile.languages.fr.hasSpokenKnowledge'}, persona)

    def test_no_french(self) -> None:
        """User does not speak French."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.FALSE)
        persona.project.city.departement_id = '31'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_no_french_dutch_in_brussels(self) -> None:
        """User does not speak French nor Dutch in Brussels."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.FALSE)
        persona.user_profile.languages.add(locale='nl', has_spoken_knowledge=boolean_pb2.FALSE)
        persona.user_profile.languages.add(locale='en', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.project.city.departement_id = 'BRU'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)


class MissingJobLanguageTest(scoring_test.ScoringModelTestBase):
    """Tests for the scoring model "for-missing-job-language"."""

    model_id = 'for-missing-job-language'

    def test_french_sale_in_brussels(self) -> None:
        """User only speaks French in Brussels but want to work as a sale."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.user_profile.languages.add(locale='nl', has_spoken_knowledge=boolean_pb2.FALSE)
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'D1201'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_bilingual_in_brussels(self) -> None:
        """User speaks French and Dutch in Brussels."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.user_profile.languages.add(locale='nl', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=persona.name)

    def test_sale_in_brussels(self) -> None:
        """User is a sale and speaks French and Dutch in Brussels."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.user_profile.languages.add(locale='nl', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'D1201'
        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=persona.name)

    def test_unknown_spoken_sales_in_brussels(self) -> None:
        """User is in sales and speaks French in Brussels but no info about spoken Dutch."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.user_profile.languages.add(locale='nl')
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'D1201'
        self._assert_missing_fields_to_score_persona(
            {'profile.languages.nl.hasSpokenKnowledge'}, persona)

    def test_administrative_in_brussels_no_written(self) -> None:
        """User cannot write French in Brussels but wants to work in administrative jobs."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(
            locale='fr',
            has_spoken_knowledge=boolean_pb2.TRUE,
            has_written_knowledge=boolean_pb2.FALSE)
        persona.user_profile.languages.add(
            locale='nl',
            has_spoken_knowledge=boolean_pb2.TRUE,
            has_written_knowledge=boolean_pb2.TRUE)
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'M1605'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_administrative_in_brussels_missing_info(self) -> None:
        """User wants to work in administrative jobs in Brussels, but we don't know much."""

        persona = self._random_persona().clone()
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr')
        persona.user_profile.languages.add(locale='nl', has_written_knowledge=boolean_pb2.TRUE)
        persona.project.city.departement_id = 'BRU'
        persona.project.target_job.job_group.rome_id = 'M1605'
        self._assert_missing_fields_to_score_persona({
            'profile.languages.fr.hasSpokenKnowledge',
            'profile.languages.fr.hasWrittenKnowledge',
            'profile.languages.nl.hasSpokenKnowledge',
        }, persona)


class LanguageRelevanceTest(scoring_test.ScoringModelTestBase):
    """Tests for the scoring model "language-relevance"."""

    model_id = 'language-relevance'

    def test_no_required_language(self) -> None:
        """User is in a city where languages are not a big deal."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = '69'
        score = self._score_persona(persona)
        self.assertLessEqual(0, score, msg=persona.name)

    def test_unknown_knowledge(self) -> None:
        """User might or might not speak any language."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = 'BRU'
        del persona.user_profile.languages[:]
        score = self._score_persona(persona)
        self.assertEqual(1, score, msg=persona.name)

    def test_french_in_brussels(self) -> None:
        """User speaks French in Brussels."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = 'BRU'
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.TRUE)
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)
        self.assertEqual(3, score, msg=persona.name)

    def test_no_french_in_brussels(self) -> None:
        """User doesn't speak French in Brussels, Dutch status unknown."""

        persona = self._random_persona().clone()
        persona.project.city.departement_id = 'BRU'
        del persona.user_profile.languages[:]
        del persona.user.projects[1:]
        persona.user_profile.languages.add(locale='fr', has_spoken_knowledge=boolean_pb2.FALSE)
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)
        self.assertEqual(1, score, msg=persona.name)


class LanguageFrustrationTestCase(filters_test.FilterTestBase):
    """Testing the for-foreign-language filter."""

    model_id = 'for-foreign-language'

    def test_no_language_issue(self) -> None:
        """User is not frustrated by language issues."""

        if user_pb2.LANGUAGE in self.persona.user_profile.frustrations:
            self.persona.user_profile.frustrations.remove(user_pb2.LANGUAGE)
        self._assert_fail_filter()

    def test_language_issue(self) -> None:
        """User is frustrated by not speaking the country's main language."""

        self.persona.user_profile.frustrations.append(user_pb2.LANGUAGE)
        self._assert_pass_filter()


if __name__ == '__main__':
    unittest.main()
