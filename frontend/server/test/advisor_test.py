"""Unit tests for the bob_emploi.frontend.advisor module."""

import datetime
from os import path
import re
import time
import typing
from typing import Any, Dict
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.test import mailjetmock
from bob_emploi.frontend.server.test import scoring_test


_TEMPLATE_PATH = path.join(path.dirname(path.dirname(__file__)), 'asynchronous/mail/templates')


class _BaseTestCase(unittest.TestCase):

    def setUp(self) -> None:
        super().setUp()
        self.database = mongomock.MongoClient().test
        self.database.action_templates.insert_one({
            '_id': 'rec1CWahSiEtlwEHW',
            'goal': 'Reorientation !',
        })
        self.database.translations.insert_one({
            'string': 'de {job_name}',
            'fr@tu': 'de {job_name}',
        })

        self.user = user_pb2.User(
            features_enabled=user_pb2.Features(advisor=user_pb2.ACTIVE, workbench=user_pb2.ACTIVE),
            profile=user_pb2.UserProfile(
                name='Margaux', gender=user_pb2.FEMININE, email='margaux@example.fr',
                locale='fr@tu'))
        proto.CachedCollection.update_cache_version()


class MaybeAdviseTestCase(_BaseTestCase):
    """Unit tests for the maybe_advise function."""

    @mailjetmock.patch()
    def test_no_advice_if_project_incomplete(self) -> None:
        """Test that the advice do not get populated when the project is marked as incomplete."""

        project = project_pb2.Project(is_incomplete=True)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(len(project.advices), 0)

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mailjetmock.patch()
    def test_missing_module(self) -> None:
        """Test that the advisor does not crash when a module is missing."""

        project = project_pb2.Project(advices=[project_pb2.Advice(
            advice_id='does-not-exist',
            status=project_pb2.ADVICE_ACCEPTED)])
        project_before = str(project)
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(project_before, str(project))

        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch(now.__name__ + '.get')
    @mailjetmock.patch()
    def test_find_all_pieces_of_advice(self, mock_now: mock.MagicMock) -> None:
        """Test that the advisor scores all advice modules."""

        mock_now.return_value = datetime.datetime(2018, 6, 10)

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

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        data = mails_sent[0].properties['Variables']
        with open(path.join(_TEMPLATE_PATH, 'activation-email', 'vars.txt'), 'r') as vars_file:
            template_vars = {v.strip() for v in vars_file}
        self.assertEqual(template_vars, set(data.keys()))

        self.assertEqual('10 juin 2018', data['date'])
        self.assertEqual('Margaux', data['firstName'])
        self.assertEqual('FEMININE', data['gender'])
        self.assertEqual("d'hôtesse", data['ofJob'])
        login_url = data.pop('loginUrl')
        base_url = re.escape(f'http://base.example.com?userId={self.user.user_id}')
        self.assertRegex(login_url, rf'^{base_url}&authToken=\d+\.[a-f0-9]+$')
        email_settings_url = data.pop('changeEmailSettingsUrl')
        base_url = re.escape(f'http://base.example.com/unsubscribe.html?user={self.user.user_id}')
        self.assertRegex(
            email_settings_url,
            rf'^{base_url}&auth=\d+\.[a-f0-9]+&coachingEmailFrequency=UNKNOWN_EMAIL_FREQUENCY&'
            r'hl=fr%40tu$')
        self.assertEqual('', data['isCoachingEnabled'])

    @mailjetmock.patch()
    def test_missing_email_address(self) -> None:
        """Test that we do not send any email if we are missing the address."""

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
        self.user.profile.email = ''

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertFalse(mails_sent)

    @mailjetmock.patch()
    def test_redacted_email_address(self) -> None:
        """Test that we do not send any email if the email address is already redacted."""

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
        self.user.profile.email = 'REDACTED'

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertFalse(mails_sent)

    def test_is_for_alpha_only(self) -> None:
        """Test that the advisor marks modules not ready for prod as alpha only."""

        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
        )
        self.user.features_enabled.alpha = True
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
                'triggerScoringModel': 'constant(1)',
            },
        ])

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        self.assertEqual(
            ['spontaneous-application', 'other-work-env'],
            [a.advice_id for a in project.advices])
        self.assertEqual([False, True], [a.is_for_alpha_only for a in project.advices])

    @mock.patch(advisor.logging.__name__ + '.warning')
    @mailjetmock.patch()
    def test_recommend_advice_none(self, mock_logger: mock.MagicMock) -> None:
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

        self.assertFalse(mailjetmock.get_all_sent_messages())

        mock_logger.assert_called_once()

    @mailjetmock.patch()
    def test_recommend_all_modules(self) -> None:
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

        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))

    @mock.patch(advisor.scoring.scoring_base.__name__ + '.SCORING_MODELS', new_callable=dict)
    @mailjetmock.patch()
    def test_explained_advice(self, mock_scoring_models: Dict[str, Any]) -> None:
        """Test that the advisor gives explanations for the advices."""

        mock_scoring_models['constant(1)'] = mock.MagicMock(spec=[
            'get_advice_override',
            'score_and_explain'])
        mock_scoring_models['constant(1)'].score_and_explain.return_value = \
            scoring.ExplainedScore(1, ['voilà pourquoi', 'explication genré%eFeminine'])
        mock_scoring_models['constant(1)'].get_advice_override.return_value = None

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
        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))

    @mailjetmock.patch()
    def test_incompatible_advice_modules(self) -> None:
        """Test that the advisor discard incompatible advice modules."""

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
        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))

    @mock.patch(advisor.scoring.scoring_base.__name__ + '.SCORING_MODELS', new_callable=dict)
    @mock.patch(advisor.logging.__name__ + '.exception')
    @mailjetmock.patch()
    def test_module_crashes(
            self, mock_logger: mock.MagicMock,
            mock_scoring_models: Dict[str, Any]) -> None:
        """Test that the advisor does not crash if one module does."""

        mock_scoring_models['constant(1)'] = mock.MagicMock(spec=[
            'get_advice_override',
            'score_and_explain'])
        mock_scoring_models['constant(1)'].score_and_explain.return_value = \
            scoring.ExplainedScore(1, [])
        mock_scoring_models['constant(1)'].get_advice_override.return_value = None
        mock_scoring_models['crash-me'] = mock.MagicMock(spec=[
            'get_advice_override',
            'score_and_explain'])
        mock_scoring_models['crash-me'].score_and_explain.side_effect = ValueError('ouch')
        mock_scoring_models['crash-me'].get_advice_override.return_value = None

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
        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))
        mock_logger.assert_called_once()
        self.assertIn('REDACTED', mock_logger.call_args[0][0] % mock_logger.call_args[0][1:])

    @mock.patch(advisor.logging.__name__ + '.warning')
    def test_timeout_on_scoring(self, mock_warning: mock.MagicMock) -> None:
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
        for call_args in mock_warning.call_args_list:
            if 'Timeout while scoring' in call_args[0][0]:
                self.assertEqual('very-long-to-respond', call_args[0][1])
                break
        else:
            self.fail(f'No call to warning with "Timeout"\n:{mock_warning.call_args_list}')

        # Wait for the scorer to finish so that we don't taint other tests.
        time.sleep(2)


class OtherWorkEnvScoringModelTestCase(scoring_test.AdviceScoringModelTestBase):
    """Unit tests for the "Other work environement" advice."""

    model_id = 'advice-other-work-env'

    def test_advice_other_work_env_extra_data(self) -> None:
        """Test that the advisor can compute extra data for the work environment advice."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'

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

        extra_data = typing.cast(
            project_pb2.OtherWorkEnvAdviceData, self._compute_expanded_card_data(persona))

        self.assertEqual(
            ['A', 'B'], extra_data.work_environment_keywords.structures)
        self.assertEqual(
            ['sector Toise', 'sector Gal'], extra_data.work_environment_keywords.sectors)


@mailjetmock.patch()
class OverrideAdviceTestCase(_BaseTestCase):
    """Unit tests for maybe_advise to have overriden values from modules."""

    def test_advice_specific_to_job_override(self) -> None:
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
            'shortTitle': 'Astuces de boulanger',
            'goal': 'impressionner le patron',
            'diagnosticTopics': [
                diagnostic_pb2.MARKET_DIAGNOSTIC, diagnostic_pb2.PROJECT_DIAGNOSTIC],
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
        self.assertEqual('Astuces de boulanger', advice.short_title)
        self.assertEqual(
            [diagnostic_pb2.MARKET_DIAGNOSTIC, diagnostic_pb2.PROJECT_DIAGNOSTIC],
            advice.diagnostic_topics)
        self.assertEqual('impressionner le patron', advice.goal)


if __name__ == '__main__':
    unittest.main()
