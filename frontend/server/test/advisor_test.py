"""Unit tests for the bob_emploi.frontend.advisor module."""

import datetime
import os
from os import path
import re
import time
import typing
import unittest
from unittest import mock

import mongomock

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail.test import campaign_helper
from bob_emploi.frontend.server.test import mailjetmock
from bob_emploi.frontend.server.test import scoring_test


_FAKE_TRANSLATIONS_FILE = path.join(path.dirname(__file__), 'testdata/translations.json')


class _BaseTestCase(unittest.TestCase):

    def setUp(self) -> None:
        super().setUp()
        self.database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        i18n.cache.clear()

        self.user = user_pb2.User(
            features_enabled=features_pb2.Features(
                advisor=features_pb2.ACTIVE, workbench=features_pb2.ACTIVE),
            profile=user_profile_pb2.UserProfile(
                name='Margaux', gender=user_profile_pb2.FEMININE, email='margaux@example.fr',
                locale='fr@tu'))
        proto.CachedCollection.update_cache_version()


class _ScoringModelMock:
    def __init__(self) -> None:
        self.score_and_explain = mock.MagicMock()
        self.get_advice_override = mock.MagicMock()


class MaybeAdviseTestCase(_BaseTestCase, campaign_helper.CampaignTestBase):
    """Unit tests for the maybe_advise function."""

    campaign_id = 'activation-email'

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

    @nowmock.patch()
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

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com/')
        self.assertEqual(['spontaneous-application'], [a.advice_id for a in project.advices])
        self.assertEqual(project_pb2.ADVICE_RECOMMENDED, project.advices[0].status)

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        data = mails_sent[0].properties['Variables']
        self._assert_all_template_variables(data)

        self.assertEqual('10 juin 2018', data['date'])
        self.assertEqual('Margaux', data['firstName'])
        self.assertEqual('FEMININE', data['gender'])
        self.assertEqual("d'hôtesse", data['ofJob'])
        self.assertEqual('Tabitha', data['firstTeamMember'])
        self.assertIn('John, Pascal', data['teamMembers'])
        self.assertGreaterEqual(data['numberTeamMembers'], 6)
        login_url = data.pop('loginUrl')
        base_url = re.escape(f'http://base.example.com/?userId={self.user.user_id}')
        self.assertRegex(login_url, rf'^{base_url}&authToken=\d+\.[a-f0-9]+$')
        email_settings_url = data.pop('changeEmailSettingsUrl')
        base_url = re.escape(f'http://base.example.com/unsubscribe.html?user={self.user.user_id}')
        self.assertRegex(
            email_settings_url,
            rf'^{base_url}&auth=\d+\.[a-f0-9]+&coachingEmailFrequency=UNKNOWN_EMAIL_FREQUENCY&'
            r'hl=fr%40tu$')
        self.assertEqual('', data['isCoachingEnabled'])
        self.assertEqual('Bob', data['productName'])
        self.assertEqual('https://www.bob-emploi.fr', data['baseUrl'])

    @mailjetmock.patch()
    @mock.patch.dict(os.environ, {'BOB_DEPLOYMENT': 'usa'})
    def test_generate_actions(self) -> None:
        """Test that the advisor generates actions if the action_plan feature is active."""

        self.database.action_templates.insert_many([
            {
                'actionTemplateId': 'review-me',
                'triggerScoringModel': 'constant(1)',
                'tags': ['chrome-tool'],
                'duration': 'FIFTEEN_TO_30_MIN',
                'resourceUrl': 'https://bar',
            },
            {
                'actionTemplateId': 'not-for-you',
                'triggerScoringModel': 'constant(0)',
            },
            {
                'actionTemplateId': 'finish-the-sprint',
                'triggerScoringModel': 'constant(2)',
            },
        ])
        self.database.translations.insert_many([
            {'string': 'actionTemplates:review-me:title', 'en': 'Review me!'},
            {'string': 'actionTemplates:review-me:short_description', 'en': 'Please review me now'},
            {
                'string': 'actionTemplates:review-me:short_description_FEMININE',
                'en': 'Please review me now, Madam',
            },
            {'string': 'actionTemplates:tags:chrome-tool', 'en': 'Chrome Tool'},
            {'string': 'actionTemplates:review-me:resource_url_usa', 'en': 'https://foo'},
        ])
        self.user.features_enabled.action_plan = features_pb2.ACTIVE
        self.user.profile.locale = 'en'
        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
        )

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com/')

        self.assertEqual(['finish-the-sprint', 'review-me'], [a.action_id for a in project.actions])
        review_me = project.actions[1]
        self.assertEqual('Review me!', review_me.title)
        self.assertEqual('Please review me now, Madam', review_me.short_description)
        self.assertEqual(['Chrome Tool'], review_me.tags)
        self.assertEqual(action_pb2.FIFTEEN_TO_30_MIN, review_me.duration)
        self.assertEqual('https://foo', review_me.resource_url)

    def test_all_action_modules(self) -> None:
        """A user with all_modules enabled should get all actions."""

        self.database.action_templates.insert_many([
            {
                'actionTemplateId': 'not-for-you',
                'triggerScoringModel': 'constant(0)',
            },
            {
                'actionTemplateId': 'review-me',
                'triggerScoringModel': 'constant(1)',
                'tags': ['chrome-tool'],
                'duration': 'FIFTEEN_TO_30_MIN',
            },
            {
                'actionTemplateId': 'finish-the-sprint',
                'triggerScoringModel': 'constant(2)',
            },
        ])
        self.user.features_enabled.action_plan = features_pb2.ACTIVE
        self.user.features_enabled.all_modules = True
        project = project_pb2.Project(
            project_id='1234',
            target_job=job_pb2.Job(
                name='Steward/ Hôtesse',
                feminine_name='Hôtesse',
                masculine_name='Steward',
            ),
        )
        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com/')

        self.assertEqual(
            ['review-me', 'not-for-you', 'finish-the-sprint'],
            [a.action_id for a in project.actions])

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    @nowmock.patch()
    @mailjetmock.patch()
    def test_activation_email_in_english(self, mock_now: mock.MagicMock) -> None:
        """Test that the date is set in English in the activation email."""

        mock_now.return_value = datetime.datetime(2018, 6, 10)

        self.user.profile.locale = 'en'
        project = project_pb2.Project()
        self.database.advice_modules.insert_one({
            'adviceId': 'spontaneous-application',
            'categories': ['first'],
            'triggerScoringModel': 'constant(2)',
            'isReadyForProd': True,
        })

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        data = mails_sent[0].properties['Variables']

        self.assertEqual('June 10 2018', data['date'])
        self.assertIn('mailto:?body=Hi%2C%0A%0A', data['viralityTemplate'])
        self.assertIn(
            'subject=It+made+me+think+about+you%E2%80%A6', data['viralityTemplate'])

    @nowmock.patch()
    @mailjetmock.patch()
    def test_activation_email_in_english_uk(self, mock_now: mock.MagicMock) -> None:
        """Test that the date is set in English for the UK in the activation email."""

        mock_now.return_value = datetime.datetime(2018, 6, 10)

        self.user.profile.locale = 'en_UK'
        project = project_pb2.Project()
        self.database.advice_modules.insert_one({
            'adviceId': 'spontaneous-application',
            'categories': ['first'],
            'triggerScoringModel': 'constant(2)',
            'isReadyForProd': True,
        })

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        data = mails_sent[0].properties['Variables']

        self.assertEqual('June 10 2018', data['date'])

    @mock.patch('logging.exception')
    @nowmock.patch()
    @mailjetmock.patch()
    def test_activation_email_in_spanish(
            self, mock_now: mock.MagicMock, mock_logger: mock.MagicMock) -> None:
        """Test that we log an error when sending the activation email in an unknown locale."""

        mock_now.return_value = datetime.datetime(2018, 6, 10)

        self.user.profile.locale = 'es'
        project = project_pb2.Project()
        self.database.advice_modules.insert_one({
            'adviceId': 'spontaneous-application',
            'categories': ['first'],
            'triggerScoringModel': 'constant(2)',
            'isReadyForProd': True,
        })

        advisor.maybe_advise(self.user, project, self.database, 'http://base.example.com')

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)

        mock_logger.assert_called()
        for call_args in mock_logger.call_args_list:
            error = call_args[0][0] % call_args[0][1:]
            if 'Sending an email with an unknown locale: es' in error:
                break
        else:
            self.fail(f'1234 was never logged as an error\n{mock_logger.call_args_list}')

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

    @mock.patch('logging.warning')
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

    @mock.patch.dict(scoring.SCORING_MODELS, {
        'constant(1)': _ScoringModelMock()
    }, clear=True)
    @mailjetmock.patch()
    def test_explained_advice(self) -> None:
        """Test that the advisor gives explanations for the advices."""

        mock_scoring_model = typing.cast(_ScoringModelMock, scoring.SCORING_MODELS['constant(1)'])
        mock_scoring_model.score_and_explain.return_value = \
            scoring.ExplainedScore(1, ['voilà pourquoi', 'explication genré%eFeminine'])
        mock_scoring_model.get_advice_override.return_value = None

        project = project_pb2.Project()
        self.database.advice_modules.insert_one({
            'adviceId': 'network',
            'categories': ['first'],
            'triggerScoringModel': 'constant(1)',
            'isReadyForProd': True,
        })
        self.user.profile.gender = user_profile_pb2.FEMININE
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

    @mock.patch.dict(scoring.SCORING_MODELS, {
        'constant(1)': _ScoringModelMock(),
        'crash-me': _ScoringModelMock(),
    }, clear=True)
    @mock.patch('logging.exception')
    @mailjetmock.patch()
    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_module_crashes(self, mock_logger: mock.MagicMock) -> None:
        """Test that the advisor does not crash if one module does."""

        constant_1_model = typing.cast(_ScoringModelMock, scoring.SCORING_MODELS['constant(1)'])
        constant_1_model.score_and_explain.return_value = scoring.ExplainedScore(1, [])
        constant_1_model.get_advice_override.return_value = None
        crash_me_model = typing.cast(_ScoringModelMock, advisor.scoring.SCORING_MODELS['crash-me'])
        crash_me_model.score_and_explain.side_effect = ValueError('ouch')
        crash_me_model.get_advice_override.return_value = None

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

        self.user.profile.locale = 'fr'
        advisor.maybe_advise(self.user, project, self.database)

        self.assertEqual(['network'], [a.advice_id for a in project.advices])
        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))
        mock_logger.assert_called_once()
        self.assertIn('REDACTED', mock_logger.call_args[0][0] % mock_logger.call_args[0][1:])

    @mailjetmock.patch()
    @mock.patch.dict(scoring.SCORING_MODELS, {
        'missing-data': _ScoringModelMock()
    }, clear=True)
    def test_module_has_missing_data(self) -> None:
        """A module fails because of missing data."""

        mock_scoring_model = typing.cast(_ScoringModelMock, scoring.SCORING_MODELS['missing-data'])
        mock_scoring_model.get_advice_override.return_value = None
        mock_scoring_model.score_and_explain.side_effect = advisor.scoring.NotEnoughDataException(
            'Please, feed me data', fields={'field1', 'field2'}, reasons=['missing-diploma'])
        self.database.advice_modules.insert_one({
            'advice_id': 'get-a-diploma',
            'triggerScoringModel': 'missing-data',
            'isReadyForProd': True,
        })
        project = project_pb2.Project()
        advisor.maybe_advise(self.user, project, self.database)
        self.assertEqual(1, len(project.advices), msg=project.advices)
        advice = project.advices[0]
        self.assertIn('missing-diploma', advice.explanations)
        self.assertEqual('get-a-diploma', advice.advice_id)
        self.assertAlmostEqual(.1, advice.num_stars)

    @mock.patch('logging.warning')
    @mock.patch.dict(scoring.SCORING_MODELS, {
        'very-long-to-respond': _ScoringModelMock(),
    }, clear=True)
    def test_timeout_on_scoring(self, mock_warning: mock.MagicMock) -> None:
        """Check that we don't wait scoring models for ever."""

        mock_scoring_model = typing.cast(
            _ScoringModelMock, scoring.SCORING_MODELS['very-long-to-respond'])
        mock_scoring_model.score_and_explain.side_effect = lambda *unused_args: time.sleep(2)
        self.database.advice_modules.insert_one({
            'adviceId': 'crazy-advice',
            'categories': ['first'],
            'triggerScoringModel': 'very-long-to-respond',
            'isReadyForProd': True,
        })

        time_before_computing = time.time()
        scoring_project = scoring.ScoringProject(
            project_pb2.Project(), self.user, self.database)
        advisor.compute_advices_for_project(scoring_project, scoring_timeout_seconds=0.01)
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
            'id': 'baker',
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

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_advice_specific_to_job_override_i18n(self) -> None:
        """Test that the advisor translate overrides with the "Specific to Job" module."""

        self.user.profile.locale = 'en'
        self.database.translations.insert_many([
            {'string': 'specificToJobAdvice:baker:title', 'en': 'Get there early'},
            {'string': 'Astuces de boulanger', 'en': 'Baker tips'},
        ])
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
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            'shortTitle': 'Astuces de boulanger',
            'goal': 'impressionner le patron',
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
        self.assertEqual('Get there early', advice.title)
        self.assertEqual('Baker tips', advice.short_title)


if __name__ == '__main__':
    unittest.main()
