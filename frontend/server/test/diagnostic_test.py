"""Unit tests for the diagnostic part of bob_emploi.frontend.advisor module."""

import json
import logging
import unittest

import mock
import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server.test import base_test


class MaybeDiagnoseTestCase(unittest.TestCase):
    """Unit tests for the maybe_diagnose function."""

    def setUp(self):
        super(MaybeDiagnoseTestCase, self).setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })

        self.user = user_pb2.User(
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE, workbench=user_pb2.ACTIVE),
            profile=user_pb2.UserProfile(name='Margaux', gender=user_pb2.FEMININE))
        diagnostic.clear_cache()

    def test_no_diagnostic_if_project_incomplete(self):
        """The diagnostic does not get populated when the project is marked as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        self.assertFalse(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertFalse(project.HasField('diagnostic'))

    def test_no_diagnostic_if_already_diagnosed(self):
        """The diagnostic does not get computed again."""

        project = project_pb2.Project(is_incomplete=True, diagnostic=diagnostic_pb2.Diagnostic())
        self.assertFalse(diagnostic.maybe_diagnose(self.user, project, self.database))
        self.assertEqual('', str(project.diagnostic))

    @mock.patch(diagnostic.logging.__name__ + '.error')
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

        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
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
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))

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

    def test_subdiagnostic_text_with_filters(self):
        """Generate a text for a sub-diagnostic from filters."""

        project = project_pb2.Project()
        self.database.diagnostic_sentences.insert_one({
            'sentenceTemplate': 'You are a star',
            'order': 1,
        })
        self.database.diagnostic_submetrics_sentences.insert_one({
            '_id': 'rechFiNr6aEXMp0Gv',
            'triggerScoringModel': 'constant(3)',
            'positiveSentenceTemplate': "votre métier est d'avenir",
            'submetric': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            'negativeSentenceTemplate': "votre métier n'est pas d'avenir",
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

        self.assertIsNotNone(sub_diagnostic)
        self.assertEqual('Votre métier est du futur', sub_diagnostic.text)

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
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))

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
        self.assertTrue(diagnostic.maybe_diagnose(self.user, project, self.database))
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

        diagnostic.maybe_diagnose(self.user, project, self.database)

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

        diagnostic.maybe_diagnose(self.user, project, self.database)

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

        diagnostic.maybe_diagnose(self.user, project, self.database)

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

        diagnostic.maybe_diagnose(self.user, project, self.database)

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

        diagnostic.maybe_diagnose(self.user, project, self.database)

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

        diagnostic.maybe_diagnose(self.user, project, self.database)

        self.assertEqual('Tu es jeune.\n\nNous allons vous aider.', project.diagnostic.text)
        mock_logging.assert_called_once()


class QuickAdvisorTest(base_test.ServerTestCase):
    """Unit tests for the quick advisor."""

    def setUp(self):
        super(QuickAdvisorTest, self).setUp()
        user_info = {'profile': {'name': 'Albert', 'yearOfBirth': 1973}}
        self.user_id, self.auth_token = self.create_user_with_token(data=user_info)

    def _update_user(self, user_data):
        self.app.post(
            '/api/user',
            data=json.dumps(user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})

    def test_city_field(self):
        """Test a quick advice when setting the city field."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'departementCounts': {
                '69': 365,
            },
        })

        response = self.json_from_response(self.app.post(
            '/api/user/{}/update-and-quick-diagnostic'.format(self.user_id),
            data=json.dumps({'user': {'projects': [
                {'mobility': {'city': {'departementId': '69'}}}
            ]}}),
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

    def test_target_job_field(self):
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

    def test_salary_field(self):
        """Test a quick advice when setting the target job field to advise on salary."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{'mobility': {'city': {'departementId': '69'}}}]
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

    def test_salary_field_already_sent(self):
        """Test that we do not send the salary again if nothing changed."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{
            'mobility': {'city': {'departementId': '69'}},
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

    def test_required_diplomas_field(self):
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


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
