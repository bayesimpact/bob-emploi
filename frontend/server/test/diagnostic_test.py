"""Unit tests for the diagnostic part of bob_emploi.frontend.advisor module."""

import json
import logging
import typing
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.test import base_test


class MaybeDiagnoseTestCase(unittest.TestCase):
    """Unit tests for the maybe_diagnose function."""

    def setUp(self) -> None:
        super().setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })

        self.user = user_pb2.User(
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE, workbench=user_pb2.ACTIVE),
            profile=user_pb2.UserProfile(name='Margaux', gender=user_pb2.FEMININE))
        proto.CachedCollection.update_cache_version()

    def test_no_diagnostic_if_project_incomplete(self) -> None:
        """The diagnostic does not get populated when the project is marked as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        self.assertFalse(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertFalse(project.HasField('diagnostic'))

    def test_no_diagnostic_if_already_diagnosed(self) -> None:
        """The diagnostic does not get computed again."""

        project = project_pb2.Project(is_incomplete=True, diagnostic=diagnostic_pb2.Diagnostic())
        self.assertFalse(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual('', str(project.diagnostic))

    @mock.patch(diagnostic.logging.__name__ + '.error')
    def test_missing_subdiagnostic_scoring_model(self, mock_logging_error: mock.MagicMock) -> None:
        """An unknown scoring model raises a logging error but silently."""

        project = project_pb2.Project()
        self.database.diagnostic_submetrics_scorers.insert_many([
            {
                '_id': 'recJ3ugOeIIM6BlN3',
                'triggerScoringModel': 'unknown-scoring-model',
                'submetric': 'MARKET_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'rechFiNr6aEXMp0Gu',
                'triggerScoringModel': 'constant(1)',
                'submetric': 'PROFILE_DIAGNOSTIC',
                'weight': 1,
            },
        ])

        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertLess(project.diagnostic.overall_score, 100)
        self.assertTrue(mock_logging_error.called)
        self.assertTrue(any(
            'unknown-scoring-model' in call[0][0] % call[0][1:]
            for call in mock_logging_error.call_args_list), msg=mock_logging_error.call_args_list)

    def test_subdiagnostic_text_with_filters(self) -> None:
        """Generate a text for a sub-diagnostic from filters."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_scorers.insert_one({
            '_id': 'rechFiNr6aEXMp0Gv',
            'triggerScoringModel': 'constant(3)',
            'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            'weight': 1,
        })
        self.database.diagnostic_submetrics_sentences_new.insert_many([
            {
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'sentenceTemplate': "Votre métier n'est pas du futur",
                'filters': ['constant(0)']
            },
            {
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'sentenceTemplate': 'Votre métier est du futur',
                'filters': ['constant(3)']
            }
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))

        sub_diagnostics = project.diagnostic.sub_diagnostics
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next(
            (sub for sub in sub_diagnostics if sub.topic == topic),
            None)

        assert sub_diagnostic
        self.assertEqual('Votre métier est du futur', sub_diagnostic.text)

    def test_subdiagnostic_observations(self) -> None:
        """Generate observations for a sub-diagnostic."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_scorers.insert_many([
            {
                '_id': 'rechFiNr6aEXMp0Gv',
                'triggerScoringModel': 'constant(3)',
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'rechFiNr6aEXMp0GW',
                'triggerScoringModel': 'constant(0)',
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
            },
        ])
        self.database.diagnostic_observations.insert_many([
            {
                'filters': ['constant(3)'],
                'isAttentionNeeded': True,
                'sentenceTemplate': "Il vous manque des compétences d'avenir",
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            },
            {
                'filters': ['constant(3)'],
                'sentenceTemplate': "Votre métier est d'avenir",
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            },
            {
                'filters': ['constant(0)'],
                'sentenceTemplate': "Vous n'êtes pas prêt pour ce job",
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))

        sub_diagnostics = project.diagnostic.sub_diagnostics
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next(
            (sub for sub in sub_diagnostics if sub.topic == topic),
            None)

        assert sub_diagnostic
        self.assertEqual(2, len(sub_diagnostic.observations))
        self.assertEqual(
            ["Il vous manque des compétences d'avenir"],
            [obs.text for obs in sub_diagnostic.observations if obs.is_attention_needed])
        self.assertEqual(
            ["Votre métier est d'avenir"],
            [obs.text for obs in sub_diagnostic.observations if not obs.is_attention_needed])

    @mock.patch('logging.warning')
    def test_missing_observation(self, mock_warning: mock.MagicMock) -> None:
        """Warn if no observation as found for a submetric topic."""

        self.database.diagnostic_overall.insert_one({
            'sentenceTemplate': 'Projet à préciser',
            'score': 50,
            'textTemplate': 'Je ne sais rien sur vous, mais continuez comme ça.',
        })
        self.database.diagnostic_observations.insert_one({
            'sentenceTemplate': 'Vous faites un métier du futur',
            'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
        })
        self.database.diagnostic_submetrics_sentences_new.insert_many([
            {
                'sentenceTemplate': 'Voici des conseils pour votre futur.',
                'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            },
            {
                'sentenceTemplate': 'Voici des conseils pour votre recherche.',
                'topic': 'JOB_SEARCH_DIAGNOSTIC',
            },
        ])
        self.database.diagnostic_submetrics_scorers.insert_many([
            {
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'triggerScoringModel': 'constant(2.7)',
                'weight': 1,
            },
            {
                'submetric': 'JOB_SEARCH_DIAGNOSTIC',
                'triggerScoringModel': 'constant(1.5)',
                'weight': 1,
            },
        ])
        project = self.user.projects.add(title='Pompier de Paris')
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(2, len(project.diagnostic.sub_diagnostics))
        future_diagnostic = next(
            sd for sd in project.diagnostic.sub_diagnostics
            if sd.topic == diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC)
        self.assertTrue(future_diagnostic.observations)
        search_diagnostic = next(
            sd for sd in project.diagnostic.sub_diagnostics
            if sd.topic == diagnostic_pb2.JOB_SEARCH_DIAGNOSTIC)
        self.assertFalse(search_diagnostic.observations)
        mock_warning.assert_called_once()
        self.assertIn(
            'Pompier de Paris', mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    def test_no_diagnostic_sentence(self) -> None:
        """Don't generate a general sentence if database is not populated."""

        project = self.user.projects.add()
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertFalse(project.diagnostic.overall_sentence)

    def test_diagnostic_text_tutoie(self) -> None:
        """Generate a text for diagnostic and a subdiagnostic using tutoiement."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'Vous êtes une star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_scorers.insert_many([
            {
                'triggerScoringModel': 'constant(3)',
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
            },
            {
                'triggerScoringModel': 'constant(0)',
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
            },
        ])
        self.database.diagnostic_submetrics_sentences_new.insert_one({
            'filters': ['constant(3)'],
            'sentenceTemplate': "Votre métier est d'avenir",
            'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
        })
        self.database.translations.insert_many([
            {
                'string': 'Vous êtes une star',
                'fr_FR@tu': 'Tu es une star',
            },
            {
                'string': "Votre métier est d'avenir",
                'fr_FR@tu': "Ton métier est d'avenir",
            },
        ])
        self.user.profile.can_tutoie = True
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))

        self.assertEqual('Tu es une star', project.diagnostic.text)

        sub_diagnostics = project.diagnostic.sub_diagnostics
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next((sub for sub in sub_diagnostics if sub.topic == topic), None)

        self.assertGreater(project.diagnostic.overall_score, 0)
        assert sub_diagnostic
        self.assertEqual("Ton métier est d'avenir", sub_diagnostic.text)

    @mock.patch('logging.warning')
    def test_missing_submetric_sentence(self, mock_warning: mock.MagicMock) -> None:
        """Logs a warning if no submetric sentence is found."""

        self.database.diagnostic_observations.insert_one({
            'sentenceTemplate': 'Vous faites un métier du futur.',
            'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
        })
        self.database.diagnostic_submetrics_scorers.insert_one({
            'triggerScoringModel': 'constant(3)',
            'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            'weight': 1,
        })
        project = project_pb2.Project(title='Pompier de Paris')
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next(
            (sub for sub in project.diagnostic.sub_diagnostics if sub.topic == topic), None)

        assert sub_diagnostic
        self.assertFalse(sub_diagnostic.text)
        mock_warning.assert_called_once()
        self.assertIn(
            'Pompier de Paris', mock_warning.call_args[0][0] % mock_warning.call_args[0][1:])

    def test_diagnostic(self) -> None:
        """Compute the diagnostic."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_scorers.insert_many([
            {
                '_id': 'recJ3ugOeIIM6BlN3',
                'triggerScoringModel': 'constant(1.1)',
                'submetric': 'PROFILE_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'recJ3ugOeIIM6BlN4',
                'triggerScoringModel': 'constant(2.1)',
                'submetric': 'PROJECT_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'recJ3ugOeIIM6BlN5',
                'triggerScoringModel': 'constant(0.5)',
                'submetric': 'JOB_SEARCH_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'rechFiNr6aEXMp0Gu',
                'triggerScoringModel': 'constant(1)',
                'submetric': 'MARKET_DIAGNOSTIC',
                'weight': 1,
            },
            {
                '_id': 'rechFiNr6aEXMp0Gv',
                'triggerScoringModel': 'constant(3)',
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertLess(project.diagnostic.overall_score, 100)
        self.assertEqual(5, len(project.diagnostic.sub_diagnostics))
        self.assertEqual(5, len({
            sub_diagnostic.topic for sub_diagnostic in project.diagnostic.sub_diagnostics}))
        self.assertEqual('You are a star', project.diagnostic.text)

    def test_diagnostic_overall(self) -> None:
        """Compute a nice diagnostic with overall sentence."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(50, project.diagnostic.overall_score, msg=project.diagnostic)
        self.assertEqual(
            'Manque de précision dans la recherche', project.diagnostic.overall_sentence)
        self.assertEqual('Vous devriez réfléchir à vos méthodes', project.diagnostic.text)

    def test_translate_diagnostic_overall(self) -> None:
        """Diagnostic overall uses translations."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.can_tutoie = True
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans votre recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.translations.insert_many([
            {
                'string': 'Vous devriez réfléchir à vos méthodes',
                'fr_FR@tu': 'Tu devrais réfléchir à tes méthodes',
            },
            {
                'string': 'Manque de précision dans votre recherche',
                'fr_FR@tu': 'Manque de précision dans ta recherche',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Manque de précision dans ta recherche', project.diagnostic.overall_sentence)
        self.assertEqual('Tu devrais réfléchir à tes méthodes', project.diagnostic.text)

    def test_templates_diagnostic_overall(self) -> None:
        """Diagnostic overall uses templates."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        project.target_job.name = 'Directrice technique'
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Améliorez votre recherche pour le métier %ofJobName',
            'textTemplate': 'Vous étes motivé%eFeminine',
        })
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Améliorez votre recherche pour le métier de directrice technique',
            project.diagnostic.overall_sentence)
        self.assertEqual('Vous étes motivée', project.diagnostic.text)

    def test_overall_overrides_sentences(self) -> None:
        """If both behaviour as available, choose the overall template over the sentences templates.
        """

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        project.target_job.name = 'Directrice technique'
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'All good',
            'order': 1,
            'filters': ['for-women'],
        })
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual('Vous devriez réfléchir à vos méthodes', project.diagnostic.text)

    def test_overall_overrides_score(self) -> None:
        """The score given from a DiagnosticTemplate override the one computed from the submetrics.
        """

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        project.target_job.name = 'Directrice technique'
        self.database.diagnostic_submetrics_scorers.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(2.1)',
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
        })
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(50, project.diagnostic.overall_score, msg=project.diagnostic)

    def test_diagnostic_overall_restrict_to_category(self) -> None:
        """Get the overall sentence for a specific category."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.can_tutoie = True
        self.database.translations.insert_one({
            'string': 'Voici vos stratégies',
            'fr_FR@tu': 'Voici tes stratégi%eFeminines',
        })
        self.database.diagnostic_category.insert_one({
            'categoryId': 'women',
            'strategiesIntroduction': 'Voici vos strats',
            'filters': ['for-women'],
            'order': 1,
        })
        self.database.diagnostic_overall.insert_many([
            {
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if no category',
            },
            {
                'categoryId': 'women',
                'filters': ['for-women'],
                'strategiesIntroduction': 'Voici vos stratégies',
                'sentenceTemplate': 'Overall text for women if category set',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women if category set', project.diagnostic.overall_sentence)
        self.assertEqual('Voici tes stratégies', project.diagnostic.strategies_introduction)

    def test_diagnostic_overall_restrict_to_missing_category(self) -> None:
        """Get the overall sentence when a category has no value in the templates yet."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.database.diagnostic_category.insert_one({
            'categoryId': 'not-men',
            'filters': ['for-women'],
            'order': 1,
        })
        self.database.diagnostic_overall.insert_many([
            {
                'categoryId': 'women',
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if category set',
            },
            {
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if no category',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women if no category', project.diagnostic.overall_sentence)

    def test_diagnostic_overall_restrict_to_alpha_category(self) -> None:
        """Get the overall sentence when a category is reserved for alpha users."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.database.diagnostic_category.insert_one({
            'areStrategiesForAlphaOnly': True,
            'categoryId': 'women',
            'filters': ['for-women'],
            'order': 1,
        })
        self.database.diagnostic_overall.insert_many([
            {
                'categoryId': 'women',
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if category set',
            },
            {
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if no category',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women if no category', project.diagnostic.overall_sentence)

    def test_diagnostic_text(self) -> None:
        """Compute a nice diagnostic text."""

        project = project_pb2.Project(job_search_length_months=-1)
        project.target_job.feminine_name = 'Directrice technique'
        self.user.profile.year_of_birth = 2017
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'All good',
                'order': 1,
                'filters': ['not-for-young(25)'],
            },
            {
                'sentenceTemplate': 'Vous êtes jeune pour %aJobName.',
                'order': 1,
            },
            {
                'sentenceTemplate': 'Nous allons vous aider.',
                'filters': ['for-young(25)'],
                'order': 2,
            },
            {
                'sentenceTemplate': 'Nous allons essayer de vous aider.',
                'order': 2,
            },
        ])

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual(
            'Vous êtes jeune pour une directrice technique.\n\n'
            'Nous allons vous aider.',
            project.diagnostic.text)

    def test_diagnostic_text_missing_phrase(self) -> None:
        """Try computing a diagnostic text but missing a phrase."""

        project = project_pb2.Project(job_search_length_months=-1)
        project.target_job.feminine_name = 'Directrice technique'
        self.user.profile.year_of_birth = 2017
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'All good',
                'order': 1,
                'filters': ['not-for-young(25)'],
            },
            {
                'sentenceTemplate': 'Nous allons vous aider.',
                'filters': ['for-young(25)'],
                'order': 2,
            },
        ])

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertFalse(project.diagnostic.text)

    def test_diagnostic_text_missing_optional_phrase(self) -> None:
        """Try computing a diagnostic text that is missing an optional phrase."""

        project = project_pb2.Project(job_search_length_months=-1)
        project.target_job.feminine_name = 'Directrice technique'
        self.user.profile.year_of_birth = 2017
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'All good',
                'order': 1,
                'optional': True,
                'filters': ['constant(0)'],
            },
            {
                'sentenceTemplate': 'Nous allons vous aider.',
                'order': 2,
            },
        ])

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Nous allons vous aider.', project.diagnostic.text)

    def test_text_filtering_uses_overall_score(self) -> None:
        """The filtering of sentences uses the overall score."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'All good',
                'order': 1,
                'filters': ['for-good-overall-score(50)'],
            },
            {
                'sentenceTemplate': 'Bad',
                'order': 1,
            },
        ])
        self.database.diagnostic_submetrics_scorers.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(3)',
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
        })

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('All good', project.diagnostic.text)

    def test_text_filtering_uses_bad_overall_score(self) -> None:
        """The filtering of sentences uses the bad overall score."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'All good',
                'order': 1,
                'filters': ['for-good-overall-score(50)'],
            },
            {
                'sentenceTemplate': 'Bad',
                'order': 1,
            },
        ])
        self.database.diagnostic_submetrics_scorers.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(0)',
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
        })

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Bad', project.diagnostic.text)

    @mock.patch(logging.__name__ + '.exception')
    def test_diagnostic_text_tutoiement_missing_translation(
            self, mock_logging: mock.MagicMock) -> None:
        """Compute diagnostic text for tutoiement, but one tranlsation is missing."""

        project = project_pb2.Project()
        self.user.profile.can_tutoie = True
        self.database.diagnostic_sentences.insert_many([
            {
                'sentenceTemplate': 'Vous êtes jeune.',
                'order': 1,
            },
            {
                'sentenceTemplate': 'Nous allons vous aider.',
                'order': 2,
            },
        ])
        self.database.translations.insert_one({
            'string': 'Vous êtes jeune.',
            'fr_FR@tu': 'Tu es jeune.',
        })

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Tu es jeune.\n\nNous allons vous aider.', project.diagnostic.text)
        mock_logging.assert_called_once()

    def test_diagnostic_category(self) -> None:
        """Compute the diagnostic category for a project."""

        project = project_pb2.Project()
        self.database.diagnostic_category.insert_one({
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'order': 1,
        })
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('everyone', project.diagnostic.category_id)

    def test_missing_diagnostic_category(self) -> None:
        """Does not set a category ID if none is found."""

        project = project_pb2.Project()
        self.database.diagnostic_category.insert_one({
            'categoryId': 'everyone',
            'filters': ['constant(0)'],
            'order': 1,
        })
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertFalse(project.diagnostic.category_id)


class QuickAdvisorTest(base_test.ServerTestCase):
    """Unit tests for the quick advisor."""

    def setUp(self) -> None:
        super().setUp()
        user_info = {'profile': {'name': 'Albert', 'yearOfBirth': 1973}}
        self.user_id, self.auth_token = self.create_user_with_token(data=user_info)

    def _update_user(self, user_data: typing.Dict[str, typing.Any]) -> None:
        self.app.post(
            '/api/user',
            data=json.dumps(user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})

    def test_empty_project(self) -> None:
        """Test a quick save when no project is set yet."""

        response = self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'profile': {'yearOfBirth': 1987}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        self.assertEqual(200, response.status_code)

        json_user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(1987, json_user.get('profile', {}).get('yearOfBirth'))

    def test_city_field(self) -> None:
        """Test a quick advice when setting the city field."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'departementCounts': {
                '69': 365,
            },
        })

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [{'city': {'departementId': '69'}}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'CITY_FIELD',
                'comment': {'stringParts': [
                    'Super, ', '365', ' personnes dans ce département ont déjà testé le '
                    'diagnostic de Bob\xa0!',
                ]},
            }]},
            response,
        )

    def test_target_job_field(self) -> None:
        """Test a quick advice when setting the target job field."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'jobGroupCounts': {
                'L1510': 256
            },
        })

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'TARGET_JOB_FIELD',
                'comment': {'stringParts': [
                    "Ça tombe bien, j'ai déjà accompagné ", '256', ' personnes pour ce métier\xa0!',
                ]},
            }]},
            response,
        )

    def test_salary_field(self) -> None:
        """Test a quick advice when setting the target job field to advise on salary."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{'city': {'departementId': '69'}}]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'SALARY_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'En général les gens demandent un salaire de 1 300 € à 15 200 € par mois.',
                ]},
            }]},
            response,
        )

    def test_salary_field_already_sent(self) -> None:
        """Test that we do not send the salary again if nothing changed."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{
            'city': {'departementId': '69'},
            'targetJob': {'jobGroup': {'romeId': 'L1510'}},
        }]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'name': 'New name'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertFalse(response)

    def test_required_diplomas_field(self) -> None:
        """Test that we send the required diplomas once we know the target job."""

        self._db.job_group_info.insert_one({
            '_id': 'B9876',
            'requirements': {'diplomas': [{'name': 'CAP'}]},
        })

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'B9876'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'REQUESTED_DIPLOMA_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'Les offres demandent souvent un CAP ou équivalent.',
                ]},
            }]},
            response,
        )


class FindCategoryTestCase(base_test.ServerTestCase):
    """Test the find_category function."""

    def setUp(self) -> None:
        super().setUp()
        self.user = user_pb2.User()
        self.user.projects.add()

    def test_need_category_or_database(self) -> None:
        """Cannot be invoked with neither categories nor database."""

        with self.assertRaises(AttributeError):
            diagnostic.find_category(self.user)

    def test_get_category(self) -> None:
        """The first category relevant to the user is selected."""

        self._db.diagnostic_category.insert_many([
            {
                'categoryId': 'no-profile',
                'filters': ['constant(0)'],
            },
            {
                'categoryId': 'every-one',
                'filters': ['constant(3)'],
                'order': 1,
            },
            {
                'categoryId': 'every-one-but-less-important',
                'filters': ['constant(2)'],
                'order': 2,
            }
        ])
        category = diagnostic.find_category(self.user, database=self._db)
        assert category
        self.assertEqual('every-one', category.category_id)

    def test_no_category(self) -> None:
        """Does not return a category if none match."""

        self._db.diagnostic_category.insert_one({
            'categoryId': 'no-profile',
            'filters': ['constant(0)'],
        })
        category = diagnostic.find_category(self.user, database=self._db)
        self.assertIsNone(category)

    def test_project_category(self) -> None:
        """The first category relevant for the project is selected."""

        project = diagnostic.scoring.ScoringProject(
            self.user.projects[0], self.user.profile, self.user.features_enabled, self._db)
        self._db.diagnostic_category.insert_many([
            {
                'categoryId': 'no-profile',
                'filters': ['constant(0)'],
            },
            {
                'categoryId': 'every-one',
                'filters': ['constant(3)'],
                'order': 1,
            },
            {
                'categoryId': 'every-one-but-less-important',
                'filters': ['constant(2)'],
                'order': 2,
            }
        ])
        category = diagnostic.find_category(project)
        assert category
        self.assertEqual('every-one', category.category_id)

    def test_param_overrides_project(self) -> None:
        """Explicit database is more relevant than scoring project's."""

        project = diagnostic.scoring.ScoringProject(
            self.user.projects[0], self.user.profile, self.user.features_enabled, self._db)
        self._db.diagnostic_category.insert_one({
            'categoryId': 'every-one',
            'filters': ['constant(3)'],
            'order': 1,
        })
        _db = mongomock.MongoClient().test
        _db.diagnostic_category.insert_one({
            'categoryId': 'every-one-in-custom-db',
            'filters': ['constant(2)'],
            'order': 2,
        })
        category = diagnostic.find_category(project, database=_db)
        assert category
        self.assertEqual('every-one-in-custom-db', category.category_id)


if __name__ == '__main__':
    unittest.main()
