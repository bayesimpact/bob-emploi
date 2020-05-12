"""Unit tests for the diagnostic part of bob_emploi.frontend.advisor module."""

import logging
from typing import List
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.server.test import base_test

# TODO(cyrille): Put quick-diagnostic tests in a different module.


class NeverEnoughDataScoringModel(scoring_base.ModelBase):
    """A scoring model that always throws a NotEnoughDataException."""

    def score(self, project: scoring_base.ScoringProject) -> float:
        raise scoring_base.NotEnoughDataException(fields={'projects.0'})


class MaybeDiagnoseTestCase(unittest.TestCase):
    """Unit tests for the maybe_diagnose function."""

    def setUp(self) -> None:
        super().setUp()
        self.database = mongomock.MongoClient().test
        self.database.diagnostic_category.insert_many([
            {
                'categoryId': 'women',
                'strategiesIntroduction': 'Voici vos strats',
                'filters': ['for-women'],
                'order': 1,
            },
            {
                'categoryId': 'bravo',
                'strategiesIntroduction': 'Voici vos stratégies',
                'order': 2,
            },
        ])
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

    def test_no_diagnostic_sentence(self) -> None:
        """Don't generate a general sentence if database is not populated."""

        project = self.user.projects.add()
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertFalse(project.diagnostic.overall_sentence)

    @mock.patch('logging.exception')
    def test_diagnostic(self, mock_logging: mock.MagicMock) -> None:
        """Compute a nice diagnostic with overall sentence."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.locale = 'fr'
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
        mock_logging.assert_not_called()

    def test_translate_diagnostic_overall(self) -> None:
        """Diagnostic overall uses translations."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.locale = 'fr@tu'
        self.database.diagnostic_overall.insert_one({
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans votre recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.translations.insert_many([
            {
                'string': 'Vous devriez réfléchir à vos méthodes',
                'fr@tu': 'Tu devrais réfléchir à tes méthodes',
            },
            {
                'string': 'Manque de précision dans votre recherche',
                'fr@tu': 'Manque de précision dans ta recherche',
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

    def test_diagnostic_overall_sorted(self) -> None:
        """Get the overall sentence in order."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.database.diagnostic_overall.insert_many([
            {
                '_order': 1,
                'sentenceTemplate': 'Overall text for women if nothing triggered',
            },
            {
                '_order': 0,
                'sentenceTemplate': 'Overall text for women as first pass',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women as first pass', project.diagnostic.overall_sentence)

    def test_diagnostic_overall_restrict_to_category(self) -> None:
        """Get the overall sentence for a specific category."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.locale = 'fr@tu'
        self.database.translations.insert_many([
            {
                'string': 'Voici vos stratégies',
                'fr@tu': 'Voici tes stratégi%eFeminines',
            },
            {
                'string': 'Overall text for women if category set',
                'fr@tu': 'Overall text for women if category set',
            },
        ])
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
        self.database.diagnostic_category.drop()
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
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_many([
            {
                'areStrategiesForAlphaOnly': True,
                'categoryId': 'women',
                'filters': ['for-women'],
                'order': 1,
            },
            {
                'categoryId': 'bravo',
                'order': 1,
            },
        ])
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
        self.assertEqual('bravo', project.diagnostic.category_id)

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

    @mock.patch(logging.__name__ + '.exception')
    def test_diagnostic_text_tutoiement_missing_translation(
            self, mock_logging: mock.MagicMock) -> None:
        """Compute diagnostic text for tutoiement, but one tranlsation is missing."""

        project = project_pb2.Project()
        self.user.profile.locale = 'fr@tu'
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
            'fr@tu': 'Tu es jeune.',
        })

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Tu es jeune.\n\nNous allons vous aider.', project.diagnostic.text)
        mock_logging.assert_called_once()

    def test_diagnostic_category(self) -> None:
        """Compute the diagnostic category for a project."""

        project = project_pb2.Project()
        self.user.profile.ClearField('gender')
        self.user.profile.locale = ''
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_one({
            'blockerSentence': 'bad profile',
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'metricDetails': 'Libéré·e',
            'order': 1,
        })
        self.database.translations.insert_many([
            {
                'string': 'Libéré·e_FEMININE',
                'fr': 'Libérée',
            },
            {
                'string': 'Libéré·e_MASCULINE',
                'fr': 'Libéré',
            },
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('everyone', project.diagnostic.category_id)
        self.assertEqual(['everyone'], [c.category_id for c in project.diagnostic.categories])
        self.assertEqual('Libéré·e', project.diagnostic.categories[0].metric_details)
        self.assertEqual(diagnostic_pb2.NEEDS_ATTENTION, project.diagnostic.categories[0].relevance)
        self.assertTrue(project.diagnostic.categories[0].is_highlighted)
        self.assertEqual('bad profile', project.diagnostic.categories[0].blocker_sentence)

    def test_diagnostic_category_translation(self) -> None:
        """Translate the diagnostic category for a project."""

        project = project_pb2.Project()
        self.user.profile.ClearField('gender')
        self.user.profile.locale = 'nl'
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_one({
            'blockerSentence': 'bad profile',
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'metricDetails': 'Libéré·e',
            'order': 1,
        })
        self.database.translations.insert_many([
            {
                'string': 'bad profile',
                'nl': 'slecht profiel',
            }
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('slecht profiel', project.diagnostic.categories[0].blocker_sentence)

    def test_diagnostic_category_genderized(self) -> None:
        """Compute the diagnostic category for a project and use its genderized details."""

        project = project_pb2.Project()
        self.user.profile.gender = user_pb2.MASCULINE
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_one({
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'metricDetails': 'Libéré·e',
            'order': 1,
        })
        self.database.translations.insert_many([
            {
                'string': 'Libéré·e_FEMININE',
                'fr': 'Libérée',
            },
            {
                'string': 'Libéré·e_MASCULINE',
                'fr': 'Libéré',
            },
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual(['Libéré'], [c.metric_details for c in project.diagnostic.categories])

    def test_missing_diagnostic_category(self) -> None:
        """Does not set a category ID if none is found."""

        project = project_pb2.Project()
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_one({
            'categoryId': 'noone',
            'filters': ['constant(0)'],
            'order': 1,
        })
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertFalse(project.diagnostic.category_id)
        self.assertEqual(['noone'], [c.category_id for c in project.diagnostic.categories])
        self.assertEqual(
            diagnostic_pb2.RELEVANT_AND_GOOD, project.diagnostic.categories[0].relevance)

    def test_diagnostic_multiple_categories(self) -> None:
        """Compute the diagnostic category for a project."""

        project = project_pb2.Project()
        self.database.diagnostic_category.drop()
        self.database.diagnostic_category.insert_many([
            {
                'categoryId': 'second',
                'filters': ['constant(0)'],
                'order': 2,
            },
            {
                'categoryId': 'first',
                'filters': ['constant(2)'],
                'order': 1,
            },
            {
                'categoryId': 'third',
                'filters': ['constant(3)'],
                'order': 3,
            },
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('first', project.diagnostic.category_id)
        self.assertEqual(
            ['first', 'second', 'third'], [c.category_id for c in project.diagnostic.categories])
        self.assertEqual(
            [
                diagnostic_pb2.NEEDS_ATTENTION,
                diagnostic_pb2.RELEVANT_AND_GOOD,
                diagnostic_pb2.NEEDS_ATTENTION
            ],
            [c.relevance for c in project.diagnostic.categories])
        self.assertEqual(
            [True, False, False],
            [c.is_highlighted for c in project.diagnostic.categories])


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

        project = diagnostic.scoring.ScoringProject(self.user.projects[0], self.user, self._db)
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

        project = diagnostic.scoring.ScoringProject(self.user.projects[0], self.user, self._db)
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

    @mock.patch.dict(scoring_base.SCORING_MODELS, {'fake-scorer': NeverEnoughDataScoringModel()})
    def test_missing_fields(self) -> None:
        """Missing fields are set when categories raises NotEnoughDataException."""

        self._db.diagnostic_category.insert_one({
            'categoryId': 'always-raises',
            'filters': ['fake-scorer'],
        })
        categories_iterator = diagnostic.set_categories_relevance(self.user, database=self._db)
        unused_category, missing_fields = next(categories_iterator)
        self.assertEqual(1, len(missing_fields))
        self.assertEqual('projects.0', missing_fields[0].field)

        # Only one category.
        self.assertFalse(next(categories_iterator, None))

    @mock.patch.dict(scoring_base.SCORING_MODELS, {'fake-scorer': NeverEnoughDataScoringModel()})
    def test_fields_priority(self) -> None:
        """Missing fields have priority according to where they are wrt the main blocker."""

        self._db.diagnostic_category.insert_many([
            {
                'categoryId': 'always-raises',
                'filters': ['fake-scorer'],
                'order': 0,
            },
            {
                'categoryId': 'always-scores',
                'filters': [],
                'order': 1,
            },
            {
                'categoryId': 'always-raises-again',
                'filters': ['fake-scorer'],
                'order': 2,
            },
        ])
        categories: List[diagnostic_pb2.DiagnosticCategory] = []
        missing_fields: List[List[user_pb2.MissingField]] = []
        for category, fields in diagnostic.set_categories_relevance(self.user, database=self._db):
            categories.append(category)
            missing_fields.append(fields)
        self.assertEqual(3, len(categories))
        self.assertEqual(
            [['projects.0'], [], ['projects.0']],
            [[mf.field for mf in fields] for fields in missing_fields])
        self.assertEqual(
            [[2], [], [1]],
            [[mf.priority for mf in fields] for fields in missing_fields])


if __name__ == '__main__':
    unittest.main()
