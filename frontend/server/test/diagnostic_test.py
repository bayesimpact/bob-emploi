"""Unit tests for the diagnostic part of bob_emploi.frontend.advisor module."""

import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.test import base_test

# TODO(cyrille): Put quick-diagnostic tests in a different module.


class NeverEnoughDataScoringModel(scoring.ModelBase):
    """A scoring model that always throws a NotEnoughDataException."""

    def score(self, project: scoring.ScoringProject) -> float:
        raise scoring.NotEnoughDataException(fields={'projects.0'})


class MaybeDiagnoseTestCase(unittest.TestCase):
    """Unit tests for the maybe_diagnose function."""

    def setUp(self) -> None:
        super().setUp()
        mongo.cache.clear()
        self.database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        self.database.diagnostic_main_challenges.insert_many([
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
            features_enabled=features_pb2.Features(
                advisor=features_pb2.ACTIVE, workbench=features_pb2.ACTIVE),
            profile=user_profile_pb2.UserProfile(name='Margaux', gender=user_profile_pb2.FEMININE))
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
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.locale = 'fr'
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'women',
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
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.locale = 'fr@tu'
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'women',
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

    def test_translate_diagnostic_overall_using_key(self) -> None:
        """Diagnostic overall uses keyed translations."""

        project = project_pb2.Project()
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.locale = 'fr@tu'
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'women',
            'id': 'rec0123456789',
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans votre recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.translations.insert_many([
            {
                'string': 'diagnosticOverall:rec0123456789:sentence_template',
                'fr@tu': 'You should check your methods',
            },
            {
                'string': 'diagnosticOverall:rec0123456789:sentence_template_FEMININE',
                'fr@tu': 'You should check your methods, woman!',
            },
            {
                'string': 'diagnosticOverall:rec0123456789:text_template',
                'fr@tu': 'Not enough precision in your search',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'You should check your methods, woman!', project.diagnostic.overall_sentence)
        self.assertEqual('Not enough precision in your search', project.diagnostic.text)

    def test_templates_diagnostic_overall(self) -> None:
        """Diagnostic overall uses templates."""

        project = project_pb2.Project()
        self.user.profile.gender = user_profile_pb2.FEMININE
        project.target_job.name = 'Directrice technique'
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'women',
            'filters': ['for-women'],
            'score': 50,
            'sentenceTemplate': 'Améliorez votre recherche pour le métier %ofJobName',
            'textTemplate': 'Vous êtes motivé%eFeminine',
        })
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Améliorez votre recherche pour le métier de directrice technique',
            project.diagnostic.overall_sentence)
        self.assertEqual('Vous êtes motivée', project.diagnostic.text)

    def test_diagnostic_overall_sorted(self) -> None:
        """Get the overall sentence in order."""

        project = project_pb2.Project()
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.database.diagnostic_overall.insert_many([
            {
                '_order': 1,
                'categoryId': 'women',
                'sentenceTemplate': 'Overall text for women if nothing triggered',
            },
            {
                '_order': 0,
                'categoryId': 'women',
                'sentenceTemplate': 'Overall text for women as first pass',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women as first pass', project.diagnostic.overall_sentence)

    def test_diagnostic_overall_restrict_to_main_challenge(self) -> None:
        """Get the overall sentence for a specific main challenge."""

        project = project_pb2.Project()
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.locale = 'fr@tu'
        self.database.translations.insert_many([
            {
                'string': 'Voici vos stratégies',
                'fr@tu': 'Voici tes stratégi%eFeminines',
            },
            {
                'string': 'Overall text for women if main challenge set',
                'fr@tu': 'Overall text for women if main challenge set',
            },
        ])
        self.database.diagnostic_main_challenges.insert_one({
            'categoryId': 'women',
            'strategiesIntroduction': 'Voici vos strats',
            'filters': ['for-women'],
            'order': 1,
        })
        self.database.diagnostic_overall.insert_many([
            {
                'categoryId': 'other-category',
                'filters': ['for-women'],
                'sentenceTemplate': 'Overall text for women if no main challenge',
            },
            {
                'categoryId': 'women',
                'filters': ['for-women'],
                'strategiesIntroduction': 'Voici vos stratégies',
                'sentenceTemplate': 'Overall text for women if main challenge set',
            },
        ])
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual(
            'Overall text for women if main challenge set', project.diagnostic.overall_sentence)
        self.assertEqual('Voici tes stratégies', project.diagnostic.strategies_introduction)

    def test_diagnostic_main_challenges(self) -> None:
        """Compute the diagnostic main challenge for a project."""

        project = project_pb2.Project()
        project.original_self_diagnostic.category_id = 'bravo'
        self.user.profile.ClearField('gender')
        self.user.profile.locale = ''
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_one({
            'blockerSentence': 'bad profile',
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'metricDetails': 'Libéré·e',
            'order': 1,
            'bobExplanation': "postuler à des offres en ligne n'est pas le canal le plus efficace.",
        })
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'everyone',
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.diagnostic_responses.insert_one({
            'responseId': 'bravo:everyone',
            'text': "You shouldn't congratulate yourself just yet",
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
            {
                'string': "postuler à des offres en ligne n'est pas le canal le plus efficace.",
                'fr': "postuler à des offres en ligne n'est pas le canal le plus efficace.",
            },
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('everyone', project.diagnostic.category_id)
        self.assertEqual(['everyone'], [c.category_id for c in project.diagnostic.categories])
        self.assertEqual('Libéré·e', project.diagnostic.categories[0].metric_details)
        self.assertEqual(diagnostic_pb2.NEEDS_ATTENTION, project.diagnostic.categories[0].relevance)
        self.assertTrue(project.diagnostic.categories[0].is_highlighted)
        self.assertEqual('bad profile', project.diagnostic.categories[0].blocker_sentence)
        self.assertEqual("postuler à des offres en ligne n'est pas le canal le plus efficace.",
                         project.diagnostic.bob_explanation)
        self.assertEqual(
            "You shouldn't congratulate yourself just yet", project.diagnostic.response)

    def test_diagnostic_main_challenges_translation(self) -> None:
        """Translate the diagnostic main challenge for a project."""

        project = project_pb2.Project()
        self.user.profile.ClearField('gender')
        self.user.profile.locale = 'nl'
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_one({
            'blockerSentence': 'bad profile',
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'order': 1,
            'bobExplanation': "postuler à des offres en ligne n'est pas le canal le plus efficace.",
        })
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'everyone',
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.translations.insert_many([
            {
                'string': 'Manque de précision dans la recherche',
                'nl': 'Gebrek aan precisie in onderzoek',
            },
            {
                'string': 'Vous devriez réfléchir à vos méthodes',
                'nl': 'U moet nadenken over uw methoden',
            },
            {
                'string': 'bad profile',
                'nl': 'slecht profiel',
            },
            {
                'string': "postuler à des offres en ligne n'est pas le canal le plus efficace.",
                'nl': 'Online solliciteren is niet het meest efficiënte kanaal.',
            }
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual('slecht profiel', project.diagnostic.categories[0].blocker_sentence)
        self.assertEqual('Online solliciteren is niet het meest efficiënte kanaal.',
                         project.diagnostic.bob_explanation)

    def test_diagnostic_main_challenges_genderized(self) -> None:
        """Compute the diagnostic main challenge for a project and use its genderized details."""

        project = project_pb2.Project()
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_one({
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

    def test_diagnostic_main_challenges_translation_key(self) -> None:
        """Compute the diagnostic main challenge for a project and use keys to translate it."""

        project = project_pb2.Project()
        project.original_self_diagnostic.category_id = 'bravo'
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_one({
            'categoryId': 'everyone',
            'filters': ['constant(3)'],
            'metricTitle': 'overriden by the translation',
            'order': 1,
            'bobExplanation': 'overriden by the translation',
        })
        self.database.diagnostic_overall.insert_one({
            'categoryId': 'everyone',
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans la recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        self.database.diagnostic_responses.insert_one({
            'responseId': 'bravo:everyone',
            'text': 'Yo, random text!',
        })
        self.database.translations.insert_many([
            {
                'string': 'diagnosticMainChallenges:everyone:metric_details_FEMININE',
                'fr': 'Libérée',
            },
            {
                'string': 'diagnosticMainChallenges:everyone:metric_title',
                'fr': 'The title',
            },
            {
                'string': 'diagnosticMainChallenges:everyone:metric_details_MASCULINE',
                'fr': 'Libéré',
            },
            {
                'string': 'diagnosticMainChallenges:everyone:bob_explanation',
                'fr': 'postuler',
            },
            {
                'string': 'diagnosticResponses:bravo:everyone:text',
                'fr': 'You do not have a job yet',
            }
        ])
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertEqual(['The title'], [c.metric_title for c in project.diagnostic.categories])
        self.assertEqual(['Libéré'], [c.metric_details for c in project.diagnostic.categories])
        self.assertEqual('postuler', project.diagnostic.bob_explanation)
        self.assertEqual('You do not have a job yet', project.diagnostic.response)

    def test_missing_diagnostic_main_challenges(self) -> None:
        """Does not set a main challenge ID if none is found."""

        project = project_pb2.Project()
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_one({
            'categoryId': 'noone',
            'filters': ['constant(0)'],
            'order': 1,
        })
        diagnostic.maybe_diagnose(self.user, project, self.database)
        self.assertFalse(project.diagnostic.category_id)
        self.assertEqual(['noone'], [c.category_id for c in project.diagnostic.categories])
        self.assertEqual(
            diagnostic_pb2.RELEVANT_AND_GOOD, project.diagnostic.categories[0].relevance)

    def test_diagnostic_multiple_main_challenges(self) -> None:
        """Compute the diagnostic main challenge for a project."""

        project = project_pb2.Project()
        self.database.diagnostic_main_challenges.drop()
        self.database.diagnostic_main_challenges.insert_many([
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


class FindMainChallengeTests(base_test.ServerTestCase):
    """Test the find_main_challenge function."""

    def setUp(self) -> None:
        super().setUp()
        self.user = user_pb2.User()
        self.user.projects.add()

    def test_need_main_challenges_or_database(self) -> None:
        """Cannot be invoked with neither main challenges nor database."""

        with self.assertRaises(AttributeError):
            diagnostic.find_main_challenge(self.user)

    def test_get_main_chalenge(self) -> None:
        """The first main challenge relevant to the user is selected."""

        self._db.diagnostic_main_challenges.insert_many([
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
        main_challenge = diagnostic.find_main_challenge(self.user, database=self._db)
        assert main_challenge
        self.assertEqual('every-one', main_challenge.category_id)

    def test_no_matching_challenge(self) -> None:
        """Does not return a main challenge if none match."""

        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'no-profile',
            'filters': ['constant(0)'],
        })
        main_challenge = diagnostic.find_main_challenge(self.user, database=self._db)
        self.assertIsNone(main_challenge)

    def test_project_challenge(self) -> None:
        """The first main challenge relevant for the project is selected."""

        project = diagnostic.scoring.ScoringProject(self.user.projects[0], self.user, self._db)
        self._db.diagnostic_main_challenges.insert_many([
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
        main_challenge = diagnostic.find_main_challenge(project)
        assert main_challenge
        self.assertEqual('every-one', main_challenge.category_id)

    def test_param_overrides_project(self) -> None:
        """Explicit database is more relevant than scoring project's."""

        project = diagnostic.scoring.ScoringProject(self.user.projects[0], self.user, self._db)
        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'every-one',
            'filters': ['constant(3)'],
            'order': 1,
        })
        _db = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        _db.diagnostic_main_challenges.insert_one({
            'categoryId': 'every-one-in-custom-db',
            'filters': ['constant(2)'],
            'order': 2,
        })
        main_challenge = diagnostic.find_main_challenge(project, database=_db)
        assert main_challenge
        self.assertEqual('every-one-in-custom-db', main_challenge.category_id)

    @mock.patch.dict(scoring.SCORING_MODELS, {'fake-scorer': NeverEnoughDataScoringModel()})
    def test_missing_fields(self) -> None:
        """Missing fields are set when main challenges raises NotEnoughDataException."""

        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'always-raises',
            'filters': ['fake-scorer'],
        })
        challenges_iterator = diagnostic.set_main_challenges_relevance(self.user, database=self._db)
        unused_main_challenge, missing_fields = next(challenges_iterator)
        self.assertEqual(1, len(missing_fields))
        self.assertEqual('projects.0', missing_fields[0].field)

        # Only one main challenge.
        self.assertFalse(next(challenges_iterator, None))

    @mock.patch.dict(scoring.SCORING_MODELS, {'fake-scorer': NeverEnoughDataScoringModel()})
    def test_fields_priority(self) -> None:
        """Missing fields have priority according to where they are wrt the main blocker."""

        self._db.diagnostic_main_challenges.insert_many([
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
        main_challenges: list[diagnostic_pb2.DiagnosticMainChallenge] = []
        missing_fields: list[list[user_pb2.MissingField]] = []
        relevances = diagnostic.set_main_challenges_relevance(self.user, database=self._db)
        for main_challenge, fields in relevances:
            main_challenges.append(main_challenge)
            missing_fields.append(fields)
        self.assertEqual(3, len(main_challenges))
        self.assertEqual(
            [['projects.0'], [], ['projects.0']],
            [[mf.field for mf in fields] for fields in missing_fields])
        self.assertEqual(
            [[2], [], [1]],
            [[mf.priority for mf in fields] for fields in missing_fields])


if __name__ == '__main__':
    unittest.main()
