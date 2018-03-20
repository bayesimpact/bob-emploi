"""Unit tests for the bob_emploi.frontend.advisor module."""

import logging
import time
import unittest

import mock
import mongomock

from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

# TODO(pascal): Split in several modules and remove the line below.
# pylint: disable=too-many-lines


class _BaseTestCase(unittest.TestCase):

    def setUp(self):
        super(_BaseTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })

        self.user = user_pb2.User(
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE, workbench=user_pb2.ACTIVE),
            profile=user_pb2.UserProfile(name='Margaux', gender=user_pb2.FEMININE))
        advisor.clear_cache()


class MaybeCategorizeAdviceTestCase(_BaseTestCase):
    """Unit tests for the _maybe_categorize_advice function."""

    def test_no_categories_if_project_incomplete(self):
        """The advice_categorues field does not get populated when the project is marked
            as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        self.assertFalse(advisor.maybe_categorize_advice(self.user, project, self.database))

    def test_no_categories_if_already_categorized(self):
        """The advice_categories field does not get computed again."""

        project = project_pb2.Project(
            advice_categories=[project_pb2.AdviceCategory(category_id='very-old-category')],
            advices=[
                project_pb2.Advice(
                    advice_id='spontaneous-application',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=3)]
            )
        self.database.advice_modules.insert_one(
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first', 'second'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            }
        )

        self.assertFalse(advisor.maybe_categorize_advice(self.user, project, self.database))
        self.assertEqual(['very-old-category'], [c.category_id for c in project.advice_categories])

    def test_no_categories_if_no_advice(self):
        """The advice_categories field does not get populated when advice aren't."""

        project = project_pb2.Project()
        self.assertFalse(advisor.maybe_categorize_advice(self.user, project, self.database))

    def test_categorize_all_pieces_of_advice(self):
        """Test that the advisor categorize all advice modules."""

        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
            advices=[
                project_pb2.Advice(
                    advice_id='spontaneous-application',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=3),
                project_pb2.Advice(
                    advice_id='other-work-env',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=2),
                project_pb2.Advice(
                    advice_id='one-star',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=1),
            ]
        )
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first', 'second'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'categories': ['second'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'one-star',
                'categories': ['second'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_categorize_advice(self.user, project, self.database)
        # First category is the category with all the 3-stars advice.
        self.assertEqual(
            ['spontaneous-application'], project.advice_categories[0].advice_ids)
        self.assertEqual('three-stars', project.advice_categories[0].category_id)
        self.assertEqual(
            ['other-work-env', 'spontaneous-application', 'one-star'],
            project.advice_categories[1].advice_ids)
        self.assertEqual('second', project.advice_categories[1].category_id)

    def test_avoid_double_first_advice(self):
        """The advisor avoids having the same first advice for two neighbor categories."""

        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
            advices=[
                project_pb2.Advice(
                    advice_id='spontaneous-application',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=2),
                project_pb2.Advice(
                    advice_id='other-work-env',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=1)]
        )
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first', 'second', 'third'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'categories': ['first', 'second', 'third'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_categorize_advice(self.user, project, self.database)
        # First category is the category with all the 3-stars advice.
        self.assertEqual(3, len(project.advice_categories), msg=project.advice_categories)
        self.assertEqual(
            ['spontaneous-application', 'other-work-env'],
            project.advice_categories[0].advice_ids)
        self.assertEqual(
            ['other-work-env', 'spontaneous-application'],
            project.advice_categories[1].advice_ids)
        self.assertEqual(
            ['spontaneous-application', 'other-work-env'],
            project.advice_categories[2].advice_ids)

    def test_categorize_advice_missing(self):
        """Test that the advisor does not choke on an ancient advice that does not exist anymore."""

        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
            advices=[
                project_pb2.Advice(
                    advice_id='spontaneous-application',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=2),
                project_pb2.Advice(
                    advice_id='advice-does-no-exist-anymore',
                    status=project_pb2.ADVICE_RECOMMENDED,
                    num_stars=2),
            ]
        )
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first', 'second'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_categorize_advice(self.user, project, self.database)
        # Point check that some categorization happened.
        self.assertEqual(
            ['spontaneous-application'], project.advice_categories[0].advice_ids)


class MaybeDiagnoseTestCase(_BaseTestCase):
    """Unit tests for the maybe_diagnose function."""

    def test_no_diagnostic_if_project_incomplete(self):
        """The diagnostic does not get populated when the project is marked as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        self.assertFalse(advisor.maybe_diagnose(self.user, project, self.database))
        self.assertFalse(project.HasField('diagnostic'))

    def test_no_diagnostic_if_already_diagnosed(self):
        """The diagnostic does not get computed again."""

        project = project_pb2.Project(is_incomplete=True, diagnostic=diagnostic_pb2.Diagnostic())
        self.assertFalse(advisor.maybe_diagnose(self.user, project, self.database))
        self.assertEqual('', str(project.diagnostic))

    @mock.patch(advisor.logging.__name__ + '.error')
    def test_missing_subdiagnostic_scoring_model(self, mock_logging_error):
        """An unknown scoring model raises a logging error but silently."""

        project = project_pb2.Project()
        self.database.diagnostic_submetrics_sentences.insert_many([
            {
                '_id': 'recJ3ugOeIIM6BlN3',
                'triggerScoringModel': 'unkown-scoring-model',
                'positiveSentenceTemplate': "Vous avez de l'expérience.",
                'submetric': 'MARKET_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': "Vous manquez d'expérience.",
            },
            {
                '_id': 'rechFiNr6aEXMp0Gu',
                'triggerScoringModel': 'constant(1)',
                'positiveSentenceTemplate':
                    "Vous venez de commencer votre recherche d'emploi",
                'submetric': 'PROFILE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate':
                    "Vous êtes au chômage depuis longtemps, \
                    c'est le moment de relancer votre recherche.",
            },
        ])

        self.assertTrue(advisor.maybe_diagnose(self.user, project, self.database))
        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertLess(project.diagnostic.overall_score, 100)
        self.assertEqual(
            [diagnostic_pb2.PROFILE_DIAGNOSTIC],
            [sub_diagnostic.topic for sub_diagnostic in project.diagnostic.sub_diagnostics])
        self.assertTrue(mock_logging_error.called)

    def test_subdiagnostic_text(self):
        """Generate a text for a sub-diagnostic from sentences templates."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_sentences.insert_many([
            {
                '_id': 'rechFiNr6aEXMp0Gv',
                'triggerScoringModel': 'constant(3)',
                'positiveSentenceTemplate': "votre métier est d'avenir",
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': "votre métier n'est pas d'avenir",
            },
            {
                '_id': 'rechFiNr6aEXMp0Gw',
                'triggerScoringModel': 'constant(0)',
                'positiveSentenceTemplate': "des postes se créent dans votre secteur d'emploi",
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate':
                    "de plus en plus de postes disparaissent dans votre secteur d'emploi",
            },
        ])
        self.assertTrue(advisor.maybe_diagnose(self.user, project, self.database))

        sub_diagnostics = project.diagnostic.sub_diagnostics
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next(
            (sub for sub in sub_diagnostics if sub.topic == topic),
            None)

        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertIsNotNone(sub_diagnostic)
        self.assertEqual(
            "Votre métier est d'avenir mais " +
            "de plus en plus de postes disparaissent dans votre secteur d'emploi.",
            sub_diagnostic.text)

    def test_diagnostic_text_tutoie(self):
        """Generate a text for diagnostic and a subdiagnostic using tutoiement."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'Vous êtes une star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_sentences.insert_many([
            {
                'triggerScoringModel': 'constant(3)',
                'positiveSentenceTemplate': "votre métier est d'avenir",
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': "votre métier n'est pas d'avenir",
            },
            {
                'triggerScoringModel': 'constant(0)',
                'positiveSentenceTemplate': "des postes se créent dans votre secteur d'emploi",
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate':
                    "de plus en plus de postes disparaissent dans votre secteur d'emploi",
            },
        ])
        self.database.translations.insert_many([
            {
                'string': 'Vous êtes une star',
                'fr_FR@tu': 'Tu es une star',
            },
            {
                'string': "votre métier est d'avenir",
                'fr_FR@tu': "ton métier est d'avenir",
            },
            {
                'string': "de plus en plus de postes disparaissent dans votre secteur d'emploi",
                'fr_FR@tu': "de plus en plus de postes disparaissent dans ton secteur d'emploi",
            },
        ])
        self.user.profile.can_tutoie = True
        self.assertTrue(advisor.maybe_diagnose(self.user, project, self.database))

        self.assertEqual('Tu es une star', project.diagnostic.text)

        sub_diagnostics = project.diagnostic.sub_diagnostics
        topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        sub_diagnostic = next((sub for sub in sub_diagnostics if sub.topic == topic), None)

        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertEqual(
            "Ton métier est d'avenir mais " +
            "de plus en plus de postes disparaissent dans ton secteur d'emploi.",
            sub_diagnostic.text)

    def test_diagnostic(self):
        """Compute the diagnostic."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_sentences.insert_many([
            {
                '_id': 'recJ3ugOeIIM6BlN3',
                'triggerScoringModel': 'constant(1.1)',
                'positiveSentenceTemplate': 'Vous avez un bon profil.',
                'submetric': 'PROFILE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': 'Vous avez un mauvais profil.',
            },
            {
                '_id': 'recJ3ugOeIIM6BlN4',
                'triggerScoringModel': 'constant(2.1)',
                'positiveSentenceTemplate': 'Vous avez un bon projet.',
                'submetric': 'PROJECT_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': 'Vous avez un mauvais projet.',
            },
            {
                '_id': 'recJ3ugOeIIM6BlN5',
                'triggerScoringModel': 'constant(0.5)',
                'positiveSentenceTemplate': 'Vous faites une bonne recherche.',
                'submetric': 'JOB_SEARCH_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': 'Vous faites une mauvaise recherche.',
            },
            {
                '_id': 'rechFiNr6aEXMp0Gu',
                'triggerScoringModel': 'constant(1)',
                'positiveSentenceTemplate': 'Votre marché est favorable',
                'submetric': 'MARKET_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': "Votre marché n'est pas favorable.",
            },
            {
                '_id': 'rechFiNr6aEXMp0Gv',
                'triggerScoringModel': 'constant(3)',
                'positiveSentenceTemplate': "Votre métier est d'avenir.",
                'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
                'weight': 1,
                'negativeSentenceTemplate': "Votre métier n'est pas d'avenir.",
            },
        ])
        self.assertTrue(advisor.maybe_diagnose(self.user, project, self.database))
        self.assertGreater(project.diagnostic.overall_score, 0)
        self.assertLess(project.diagnostic.overall_score, 100)
        self.assertEqual(5, len(project.diagnostic.sub_diagnostics))
        self.assertEqual(5, len({
            sub_diagnostic.topic for sub_diagnostic in project.diagnostic.sub_diagnostics}))
        self.assertEqual('You are a star', project.diagnostic.text)

    def test_diagnostic_text(self):
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

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertEqual(
            'Vous êtes jeune pour une directrice technique.\n\n'
            'Nous allons vous aider.',
            project.diagnostic.text)

    def test_diagnostic_text_missing_phrase(self):
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

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertFalse(project.diagnostic.text)

    def test_diagnostic_text_missing_optional_phrase(self):
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

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Nous allons vous aider.', project.diagnostic.text)

    def test_text_filtering_uses_overall_score(self):
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
        self.database.diagnostic_submetrics_sentences.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(3)',
            'positiveSentenceTemplate': "Vous avez de l'expérience.",
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
            'negativeSentenceTemplate': "Vous manquez d'expérience.",
        })

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('All good', project.diagnostic.text)

    def test_text_filtering_uses_bad_overall_score(self):
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
        self.database.diagnostic_submetrics_sentences.insert_one({
            '_id': 'recJ3ugOeIIM6BlN3',
            'triggerScoringModel': 'constant(0)',
            'positiveSentenceTemplate': "Vous avez de l'expérience.",
            'submetric': 'PROFILE_DIAGNOSTIC',
            'weight': 1,
            'negativeSentenceTemplate': "Vous manquez d'expérience.",
        })

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Bad', project.diagnostic.text)

    @mock.patch(logging.__name__ + '.exception')
    def test_diagnostic_text_tutoiement_missing_translation(self, mock_logging):
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

        advisor.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Tu es jeune.\n\nNous allons vous aider.', project.diagnostic.text)
        mock_logging.assert_called_once()


@mock.patch(advisor.mail.__name__ + '.send_template')
class MaybeAdviseTestCase(_BaseTestCase):
    """Unit tests for the maybe_advise function."""

    def test_no_advice_if_project_incomplete(self, mock_send_template):
        """Test that the advice do not get populated when the project is marked as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(len(project.advices), 0)

        mock_send_template.assert_not_called()

    def test_missing_module(self, mock_send_template):
        """Test that the advisor does not crash when a module is missing."""

        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='does-not-exist',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))

        mock_send_template.assert_not_called()

    def test_find_all_pieces_of_advice(self, mock_send_template):
        """Test that the advisor scores all advice modules."""

        mock_send_template().status_code = 200
        mock_send_template.reset_mock()
        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
        )
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

        mock_send_template.assert_called_once()
        data = mock_send_template.call_args[0][2]
        self.assertEqual(
            ['advices', 'baseUrl', 'firstName', 'ofProjectTitle', 'projectId'],
            sorted(data.keys()))
        self.assertEqual('http://base.example.com', data['baseUrl'])
        self.assertEqual('Margaux', data['firstName'])
        self.assertEqual("d'hôtesse", data['ofProjectTitle'])
        self.assertEqual('1234', data['projectId'])

    def test_recommend_advice_none(self, mock_send_template):
        """Test that the advisor does not recommend anyting if all modules score 0."""

        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'other-work-env',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertFalse(project.advices)

        mock_send_template.assert_not_called()

    def test_recommend_all_modules(self, mock_send_template):
        """Test that all advice are recommended when all_modules is true even if incompatible."""

        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
                'airtableId': 'abc',
                'incompatibleAdviceIds': ['def'],
            },
            {
                'adviceId': 'other-work-env',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
                'airtableId': 'def',
            },
            {
                'adviceId': 'new-advice',
                'categories': ['first'],
                'triggerScoringModel': 'constant(0)',
                'isReadyForProd': True,
                'airtableId': 'def',
                'incompatibleAdviceIds': ['abc'],
            },
        ])

        self.user.features_enabled.all_modules = True
        advisor.maybe_advise(self.user, project, self.database)
        self.assertEqual(
            ['spontaneous-application', 'other-work-env', 'new-advice'],
            [a.advice_id for a in project.advices])

        mock_send_template.assert_called_once()

    @mock.patch(advisor.scoring.scoring_base.__name__ + '.SCORING_MODELS', new_callable=dict)
    def test_explained_advice(self, mock_scoring_models, mock_send_template):
        """Test that the advisor gives explanations for the advices."""

        mock_send_template().status_code = 200
        mock_send_template.reset_mock()

        mock_scoring_models['constant(1)'] = mock.MagicMock(spec=['score_and_explain'])
        mock_scoring_models['constant(1)'].score_and_explain.return_value = \
            scoring.ExplainedScore(1, ['voilà pourquoi', 'explication genré%eFeminine'])

        project = project_pb2.Project()
        self.database.advice_modules.insert_one({
            'adviceId': 'network',
            'categories': ['first'],
            'triggerScoringModel': 'constant(1)',
            'isReadyForProd': True,
        })
        self.user.profile.gender = user_pb2.FEMININE
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(
            ['network'],
            [a.advice_id for a in project.advices])
        self.assertEqual(
            ['voilà pourquoi', 'explication genrée'],
            project.advices[0].explanations)
        mock_send_template.assert_called_once()

    def test_incompatible_advice_modules(self, mock_send_template):
        """Test that the advisor discard incompatible advice modules."""

        mock_send_template().status_code = 200
        mock_send_template.reset_mock()
        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'other-work-env',
                'airtableId': 'abc',
                'categories': ['first'],
                'triggerScoringModel': 'constant(2)',
                'isReadyForProd': True,
                'incompatibleAdviceIds': ['def'],
            },
            {
                'adviceId': 'spontaneous-application',
                'categories': ['first'],
                'airtableId': 'def',
                'triggerScoringModel': 'constant(3)',
                'isReadyForProd': True,
                'incompatibleAdviceIds': ['abc'],
            },
            {
                'adviceId': 'final-one',
                'categories': ['first'],
                'airtableId': 'ghi',
                'triggerScoringModel': 'constant(1)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(
            ['spontaneous-application', 'final-one'],
            [a.advice_id for a in project.advices])
        mock_send_template.assert_called_once()

    @mock.patch(advisor.scoring.scoring_base.__name__ + '.SCORING_MODELS', new_callable=dict)
    @mock.patch(advisor.logging.__name__ + '.exception')
    def test_module_crashes(self, mock_logger, mock_scoring_models, mock_send_template):
        """Test that the advisor does not crash if one module does."""

        mock_send_template().status_code = 200
        mock_send_template.reset_mock()

        mock_scoring_models['constant(1)'] = mock.MagicMock(spec=['score_and_explain'])
        mock_scoring_models['constant(1)'].score_and_explain.return_value = \
            scoring.ExplainedScore(1, [])
        mock_scoring_models['crash-me'] = mock.MagicMock(spec=['score_and_explain'])
        mock_scoring_models['crash-me'].score_and_explain.side_effect = ValueError('ouch')

        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'other-work-env',
                'categories': ['first'],
                'triggerScoringModel': 'crash-me',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'network',
                'categories': ['first'],
                'triggerScoringModel': 'constant(1)',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(['network'], [a.advice_id for a in project.advices])
        mock_send_template.assert_called_once()
        mock_logger.assert_called_once()

    @mock.patch(advisor.logging.__name__ + '.warning')
    def test_timeout_on_scoring(self, mock_warning, unused_mock_send_template):
        """Check that we don't wait scoring models for ever."""

        patcher = mock.patch(advisor.scoring.__name__ + '.get_scoring_model')
        mock_get_scoring_model = patcher.start()
        self.addCleanup(patcher.stop)
        mock_get_scoring_model().score_and_explain.side_effect = lambda *unused_args: time.sleep(2)
        self.database.advice_modules.insert_one({
            'adviceId': 'crazy-advice',
            'categories': ['first'],
            'triggerScoringModel': 'very-long-to-respond',
            'isReadyForProd': True,
        })

        time_before_computing = time.time()
        advisor.compute_advices_for_project(
            self.user, project_pb2.Project(), self.database,
            scoring_timeout_seconds=0.01)
        time_after_computing = time.time()

        self.assertLess(time_after_computing - time_before_computing, 1)
        self.assertTrue(mock_warning.called)
        self.assertIn('Timeout while scoring', mock_warning.call_args[0][0])
        self.assertEqual('very-long-to-respond', mock_warning.call_args[0][1])


class ExtraDataTestCase(_BaseTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def setUp(self):
        super(ExtraDataTestCase, self).setUp()
        self.mail_patcher = mock.patch(advisor.mail.__name__ + '.send_template')
        mock_send_template = self.mail_patcher.start()
        mock_send_template().status_code = 200

    def tearDown(self):
        self.mail_patcher.stop()
        super(ExtraDataTestCase, self).tearDown()

    def test_advice_other_work_env_extra_data(self):
        """Test that the advisor computes extra data for the work environment advice."""

        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
        )
        self.user.features_enabled.alpha = True
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'workEnvironmentKeywords': {
                'structures': ['A', 'B'],
                'sectors': ['sector Toise', 'sector Gal'],
            },
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'other-work-env',
            'categories': ['first'],
            'triggerScoringModel': 'advice-other-work-env',
            'extraDataFieldName': 'other_work_env_advice_data',
            'isReadyForProd': True,
        })

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'other-work-env')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            ['A', 'B'], advice.other_work_env_advice_data.work_environment_keywords.structures)
        self.assertEqual(
            ['sector Toise', 'sector Gal'],
            advice.other_work_env_advice_data.work_environment_keywords.sectors)

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    def test_advice_spontaneous_application_extra_data(self, mock_get_lbb_companies):
        """Test that the advisor computes extra data for the "Spontaneous Application" advice."""

        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
            mobility=geo_pb2.Location(city=geo_pb2.FrenchCity(departement_id='14')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            total_interview_count=1,
        )
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        }
                    ],
                }
            },
        })
        self.database.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'categories': ['first'],
            'triggerScoringModel': 'advice-spontaneous-application',
            'extraDataFieldName': 'spontaneous_application_data',
            'isReadyForProd': True,
        })
        mock_get_lbb_companies.return_value = iter([
            {'name': 'EX NIHILO'},
            {'name': 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'},
        ])
        advisor.clear_cache()

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'my-advice')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            ['EX NIHILO', 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'],
            [c.name for c in advice.spontaneous_application_data.companies])

    @mock.patch(advisor.scoring.scoring_base.__name__ + '.SCORING_MODELS', new_callable=dict)
    @mock.patch(advisor.logging.__name__ + '.exception')
    def test_module_crashes(self, mock_logger, mock_scoring_models):
        """Test that the advisor does not crash if one module does while getting extra data."""

        mock_scoring_models['constant(1)'] = mock.MagicMock(
            spec=['score_and_explain', 'compute_extra_data'])
        mock_scoring_models['constant(1)'].score_and_explain.return_value = \
            scoring.ExplainedScore(1, [])
        mock_scoring_models['constant(1)'].compute_extra_data.return_value = \
            project_pb2.CommuteData(cities=['Lyon', 'Paris'])
        mock_scoring_models['crash-me'] = mock.MagicMock(
            spec=['score_and_explain', 'compute_extra_data'])
        mock_scoring_models['crash-me'].score_and_explain.return_value = \
            scoring.ExplainedScore(2, [])
        mock_scoring_models['crash-me'].compute_extra_data.side_effect = ValueError('ouch')

        project = project_pb2.Project()
        self.database.advice_modules.insert_many([
            {
                'adviceId': 'other-work-env',
                'categories': ['first'],
                'triggerScoringModel': 'constant(1)',
                'extraDataFieldName': 'commute_data',
                'isReadyForProd': True,
            },
            {
                'adviceId': 'network',
                'categories': ['first'],
                'triggerScoringModel': 'crash-me',
                'extraDataFieldName': 'commute_data',
                'isReadyForProd': True,
            },
        ])

        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(['network', 'other-work-env'], [a.advice_id for a in project.advices])
        self.assertFalse(project.advices[0].WhichOneof('extra_data'))
        self.assertEqual(['Lyon', 'Paris'], project.advices[1].commute_data.cities)
        mock_logger.assert_called_once()


class OverrideAdviceTestCase(_BaseTestCase):
    """Unit tests for maybe_advise to have overriden values from modules."""

    def setUp(self):
        super(OverrideAdviceTestCase, self).setUp()
        self.mail_patcher = mock.patch(advisor.mail.__name__ + '.send_template')
        mock_send_template = self.mail_patcher.start()
        mock_send_template().status_code = 200

    def tearDown(self):
        self.mail_patcher.stop()
        super(OverrideAdviceTestCase, self).tearDown()

    def test_advice_specific_to_job_override(self):
        """Test that the advisor overrides some advice data with the "Specific to Job" module."""

        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='D1102')),
        )
        self.database.advice_modules.insert_one({
            'adviceId': 'custom-advice-id',
            'categories': ['first'],
            'triggerScoringModel': 'advice-specific-to-job',
            'isReadyForProd': True,
        })
        self.database.specific_to_job_advice.insert_one({
            'title': 'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            'filters': ['for-job-group(D1102)', 'not-for-job(12006)'],
            'cardText':
            'Allez à la boulangerie la veille pour savoir à quelle '
            'heure arrive le chef boulanger.',
            'expandedCardHeader': "Voilà ce qu'il faut faire",
            'expandedCardItems': [
                'Se présenter aux boulangers entre 4h et 7h du matin.',
                'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin',
                'Contacter les fournisseurs de farine locaux : ils connaissent '
                'tous les boulangers du coin et sauront où il y a des '
                'embauches.',
            ],
        })

        advisor.maybe_advise(self.user, project, self.database)

        advice = next(a for a in project.advices if a.advice_id == 'custom-advice-id')
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, advice.status)
        self.assertEqual(
            'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            advice.title)
        self.assertEqual("Voilà ce qu'il faut faire", advice.expanded_card_header)
        self.assertTrue(advice.card_text)
        self.assertTrue(advice.expanded_card_items)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
