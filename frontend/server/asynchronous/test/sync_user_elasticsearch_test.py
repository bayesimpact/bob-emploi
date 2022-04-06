"""Unit tests for the module sync_user_elasticsearch."""

import collections
import datetime
import json
import os
import typing
from typing import Any, Callable, Tuple
import unittest
from unittest import mock

from google.protobuf import json_format
import requests_mock

from bob_emploi.common.python import now
from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous import sync_user_elasticsearch
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


def _user_and_its_nps() -> Tuple[user_pb2.User, user_pb2.NPSSurveyResponse]:
    user = user_pb2.User()
    project = user.projects.add()
    project.original_self_diagnostic.CopyFrom(diagnostic_pb2.SelfDiagnostic(
        status=diagnostic_pb2.KNOWN_SELF_DIAGNOSTIC, category_id='stuck-market'))
    project.diagnostic.category_id = 'stuck-market'
    response = user.net_promoter_score_survey_response
    response.responded_at.FromDatetime(datetime.datetime(2018, 11, 20, 18, 29))
    response.has_actions_idea = boolean_pb2.TRUE
    response.nps_self_diagnostic.CopyFrom(diagnostic_pb2.SelfDiagnostic(
        status=diagnostic_pb2.KNOWN_SELF_DIAGNOSTIC, category_id='missing-diploma'))
    response.score = 0
    return user, response


@nowmock.patch(new=lambda: datetime.datetime(2017, 11, 16))
@mock.patch('logging.info', new=mock.MagicMock)
class SyncTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()

        self._db = self._stats_db
        self._user_db = sync_user_elasticsearch.mongo.get_connections_from_env().user_db
        self._user_db.user.drop()
        self.mock_elasticsearch = mock.MagicMock()

    @mock.patch(sync_user_elasticsearch.focus.__name__ + '.simulate_coaching_emails')
    @mock.patch('random.randint')
    def test_main(self, mock_randint: mock.MagicMock, mock_simulate: mock.MagicMock) -> None:
        """Test main."""

        mock_randint.return_value = 42
        mock_simulate.return_value = [
            email_pb2.EmailSent(campaign_id='focus-resume'),
        ]
        self.maxDiff = None  # pylint: disable=invalid-name
        self._user_db.user.insert_one({
            'profile': {
                'locale': 'fr@tu',
                'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                'customGender': 'DECLINE_TO_ANSWER',
                'email': 'pascal@corpet.net',
                'familySituation': 'FAMILY_WITH_KIDS',
                'gender': 'MASCULINE',
                'isArmyVeteran': False,
                'yearOfBirth': 1982,
                'highestDegree': 'DEA_DESS_MASTER_PHD',
                'origin': 'FROM_A_FRIEND',
                'races': ['WHITE'],
            },
            'projects': [{
                'createdAt': '2018-12-01T00:00:00Z',
                'kind': 'FIND_ANOTHER_JOB',
                'targetJob': {
                    'name': 'Boulanger',
                    'jobGroup': {'name': 'Boulangerie', 'romeId': 'D0001'},
                },
                'areaType': 'REGION',
                'city': {
                    'cityId': '69123',
                    'name': 'Lyon',
                    'departementName': 'Rhône',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'urbanScore': 7,
                },
                'jobSearchStartedAt': '2018-08-01T00:00:00Z',
                'minSalary': 45000,
                'employmentTypes': ['CDD_OVER_3_MONTHS', 'CDI'],
                'trainingFulfillmentEstimate': 'ENOUGH_EXPERIENCE',
                'passionateLevel': 'ALIMENTARY_JOB',
                'previousJobSimilarity': 'NEVER_DONE',
                'seniority': 'NO_SENIORITY',
                'networkEstimate': 1,
                'weeklyOffersEstimate': 'LESS_THAN_2',
                'weeklyApplicationsEstimate': 'SOME',
                'totalInterviewsEstimate': 'SOME',
                'advices': [
                    {
                        'adviceId': 'network',
                        'numStars': 3,
                        'status': 'ADVICE_RECOMMENDED',
                    },
                    {
                        'adviceId': 'read-more',
                        'numStars': 1,
                        'status': 'ADVICE_READ',
                    },
                    {
                        'adviceId': 'life-balance',
                        'numStars': 1,
                        'numExplorations': 2,
                        'status': 'ADVICE_READ',
                    },
                ],
                'actions': [
                    {
                        'actionId': 'network',
                        'status': 'ACTION_UNREAD',
                    },
                    {
                        'actionId': 'read-more',
                        'status': 'ACTION_CURRENT',
                    },
                    {
                        'actionId': 'life-balance',
                        'status': 'ACTION_CURRENT',
                    },
                ],
                'wasFeedbackRequested': True,
                'feedback': {
                    'score': 5,
                    'challengeAgreementScore': 1,
                    'actionPlanHelpsPlanScore': 3,
                },
                'diagnostic': {
                    'categoryId': 'stuck-market',
                },
                'originalSelfDiagnostic': {
                    'status': 'KNOWN_SELF_DIAGNOSTIC',
                    'categoryId': 'stuck-market',
                },
                'strategies': [
                    {'strategyId': 'likeable-job'},
                    {'strategyId': 'confidence-boost'},
                ],
                'openedStrategies': [
                    {
                        'startedAt': '2018-12-01T00:00:00Z',
                        'reachedGoals': {'this goal': True, 'that goal': False},
                        'strategyId': 'likeable-job',
                    },
                ],
            }],
            'employmentStatus': [{
                'bobHasHelped': 'YES',
                'bobRelativePersonalization': 12,
                'createdAt': '2017-07-25T18:06:08Z',
                'hasBeenPromoted': 'FALSE',
                'hasGreaterRole': 'TRUE',
                'hasSalaryIncreased': 'TRUE',
                'isJobInDifferentSector': 'FALSE',
                'otherCoachesUsed': ['PE_COUNSELOR_MEETING', 'MUTUAL_AID_ORGANIZATION'],
            }],
            'clientMetrics': {
                'amplitudeId': '1234ab34f13e5',
                'firstSessionDurationSeconds': 250,
                'isFirstSessionMobile': 'TRUE',
            },
            'emailsSent': [
                # Ignored because there's another one that was read later.
                {
                    'campaignId': 'focus-network',
                    'sentAt': '2017-10-15T18:06:08Z',
                    'status': 'EMAIL_SENT_SENT',
                },
                {
                    'campaignId': 'focus-spontaneous',
                    'sentAt': '2017-10-15T18:06:08Z',
                    'status': 'EMAIL_SENT_OPENED',
                },
                {
                    'campaignId': 'focus-network',
                    'sentAt': '2017-11-15T18:06:08Z',
                    'status': 'EMAIL_SENT_CLICKED',
                },
            ],
            'origin': {
                'source': 'facebook',
                'medium': 'ad',
                'campaign': 'metiers porteurs',
            },
            'registeredAt': '2017-07-15T18:06:08Z',
            'hasAccount': True,
        })
        self._db.cities.insert_one({
            '_id': '69123',
            'name': 'Lyon',
            'urbanContext': 2,
        })
        db_user = self._user_db.user.find_one()
        assert db_user
        user_id = str(db_user['_id'])

        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--no-dry-run', '--disable-sentry'])

        # TODO(cyrille): DRY with _compute_user_data.
        self.mock_elasticsearch.update.assert_called_once()
        kwargs = self.mock_elasticsearch.update.call_args[1]
        body = kwargs.pop('body')
        self.assertEqual(
            {
                'index': 'bobusers',
                'doc_type': '_doc',
                'id': user_id,
            },
            kwargs)
        doc = body.pop('doc')
        self.assertEqual({
            'doc_as_upsert': True
        }, body)
        # Ensure the document is serializable.
        self.assertTrue(json.dumps(doc))
        self.assertEqual(
            {
                'randomGroup': .42,
                'finishedOnboardingPercent': 100,
                'profile': {
                    'ageGroup': 'D. 35-44',
                    'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                    'customGender': 'DECLINE_TO_ANSWER',
                    'familySituation': 'FAMILY_WITH_KIDS',
                    'frustrations': [],
                    'gender': 'MASCULINE',
                    'hasHandicap': False,
                    'highestDegree': '6 - DEA_DESS_MASTER_PHD',
                    'isArmyVeteran': False,
                    'locale': 'fr@tu',
                    'origin': 'FROM_A_FRIEND',
                    'races': ['WHITE'],
                },
                'project': {
                    'advices': ['network'],
                    'exploredAdvices': ['life-balance'],
                    'readAdvices': ['read-more', 'life-balance'],
                    'numAdvicesRead': 2,
                    'job_search_length_months': 4,
                    'isComplete': True,
                    'kind': 'FIND_ANOTHER_JOB',
                    'areaType': 'REGION',
                    'city': {
                        'regionName': 'Auvergne-Rhône-Alpes',
                        'urbanScore': 7,
                        'urbanContext': '2 - PERIURBAN',
                    },
                    'targetJob': {
                        'domain': 'Commerce, vente et grande distribution',
                        'name': 'Boulanger',
                        'job_group': {
                            'name': 'Boulangerie',
                        },
                    },
                    'wasFeedbackRequested': True,
                    'feedbackScore': 5,
                    'feedbackLoveScore': 1,
                    'actionPlanHelpsPlanScore': 3,
                    'challengeAgreementScore': 0,
                    'minSalary': 45000,
                    'employmentTypes': ['CDD_OVER_3_MONTHS', 'CDI'],
                    'trainingFulfillmentEstimate': 'ENOUGH_EXPERIENCE',
                    'passionateLevel': 'ALIMENTARY_JOB',
                    'previousJobSimilarity': 'NEVER_DONE',
                    'seniority': 'NO_SENIORITY',
                    'networkEstimate': 'LOW',
                    'weeklyOffersEstimate': 'LESS_THAN_2',
                    'weeklyApplicationsEstimate': 'SOME',
                    'totalInterviewsEstimate': 'SOME',
                    'diagnostic': {
                        'categoryId': 'stuck-market',
                    },
                    'originalSelfDiagnostic': {
                        'categoryId': 'stuck-market',
                        'isSameAsSelf': True,
                        'status': 'KNOWN_SELF_DIAGNOSTIC',
                    },
                    'tocScore': 0,
                    'ratioOpenedStrategies': .5,
                    'openedStrategies': ['likeable-job'],
                    'numStrategiesShown': 2,
                    'hasReachedAStrategyGoal': True,
                    'actionPlanStage': 2,
                    'actionPlanStatus': 'ADDING_ACTIONS',
                },
                'registeredAt': '2017-07-15T18:06:08Z',
                'employmentStatus': {
                    'bobHasHelped': 'YES',
                    'bobHasHelpedScore': 1,
                    'createdAt': '2017-07-25T18:06:08Z',
                    'daysSinceRegistration': 10,
                    'hasBeenPromoted': 'FALSE',
                    'hasGreaterRole': 'TRUE',
                    'hasSalaryIncreased': 'TRUE',
                    'isJobInDifferentSector': 'FALSE',
                    'otherCoachesUsed': ['PE_COUNSELOR_MEETING', 'MUTUAL_AID_ORGANIZATION'],
                    'bobRelativePersonalization': 12,
                },
                'emailsSent': {
                    'focus-network': 'EMAIL_SENT_CLICKED',
                    'focus-spontaneous': 'EMAIL_SENT_OPENED',
                },
                'coachingEmails': ['focus-network', 'focus-resume', 'focus-spontaneous'],
                'coachingEmailsExpected': 3,
                'coachingEmailsSent': 2,
                'coachingEmailsClicked': 1,
                'coachingEmailsClickedRatio': .5,
                'coachingEmailsOpened': 2,
                'coachingEmailsOpenedRatio': 1,
                'clientMetrics': {
                    'firstSessionDurationSeconds': 250,
                    'isFirstSessionMobile': 'TRUE',
                },
                'origin': {
                    'medium': 'ad',
                    'source': 'facebook',
                    'campaign': 'metiers porteurs',
                },
                'hasAccount': True,
                'isHooked': True,
            },
            doc)

    @mock.patch('logging.error')
    def test_report_sentry(self, mock_error: mock.MagicMock) \
            -> None:
        """Test the error message if we forgot to set SENTRY reporting."""

        sync_user_elasticsearch.main(
            self.mock_elasticsearch, ['--registered-from', '2017-07', '--no-dry-run'])

        mock_error.assert_called_once_with(
            'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')

    def _check_city_corner_case(
            self, expected_city: dict[str, Any], city_json: dict[str, Any]) -> None:

        self._user_db.user.insert_one({
            'projects': [{'city': {'cityId': '69123'}}],
            'registeredAt': '2017-07-15T18:06:08Z',
        })
        self._db.cities.insert_one(city_json | {'_id': '69123'})

        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--no-dry-run', '--disable-sentry'])

        # TODO(cyrille): DRY with _compute_user_data.
        self.mock_elasticsearch.update.assert_called_once()
        body = self.mock_elasticsearch.update.call_args[1]['body']['doc']
        city = body['project']['city']
        del city['regionName']
        del city['urbanScore']
        self.assertEqual(expected_city, body['project']['city'])

    def test_snake_case_field_in_city(self) -> None:
        """Try with a city containing fields in snake case instead of camel case."""

        self._check_city_corner_case({'urbanContext': '3 - URBAN'}, {'urban_context': 3})

    def test_float_for_enum_field_in_city(self) -> None:
        """Try with a city containing a float to define an enum."""

        self._check_city_corner_case({'urbanContext': '3 - URBAN'}, {'urbanContext': 3.})

    def test_string_for_enum_field_in_city(self) -> None:
        """Try with a city containing a string to define an enum."""

        self._check_city_corner_case({'urbanContext': '3 - URBAN'}, {'urbanContext': 'URBAN'})

    @requests_mock.mock()
    @mock.patch.dict(os.environ, {
        'ELASTICSEARCH_URL': 'http://elastic-dev:9200',
        'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI': '/get-my-credentials',
    })
    def test_es_client_from_env_aws_in_docker(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Get an Elasticsearch client for a task running in AWS ECS Docker."""

        mock_requests.get(
            'http://169.254.170.2/get-my-credentials',
            json={'AccessKeyId': 'my-access-key', 'SecretAccessKey': 'super-secret'})
        client = sync_user_elasticsearch.get_es_client_from_env()
        http_auth = client.transport.kwargs['http_auth']
        self.assertEqual('my-access-key', http_auth.access_id)
        self.assertEqual('super-secret', http_auth.signing_key.secret_key)
        self.assertEqual('es', http_auth.service)

    @mock.patch.dict(os.environ, {
        'ELASTICSEARCH_URL': 'http://elastic-dev:9200',
        'AWS_ACCESS_KEY_ID': 'my-access-key',
        'AWS_SECRET_ACCESS_KEY': 'mega-secret',
    })
    def test_es_client_for_aws_access(self) -> None:
        """Get an Elasticsearch client that can access a server on AWS."""

        client = sync_user_elasticsearch.get_es_client_from_env()
        http_auth = client.transport.kwargs['http_auth']
        self.assertEqual('my-access-key', http_auth.access_id)
        self.assertEqual('mega-secret', http_auth.signing_key.secret_key)
        self.assertEqual('es', http_auth.service)

    @mock.patch.dict(os.environ, {
        'ELASTICSEARCH_URL': 'http://elastic-dev:9200',
        'AWS_SECRET_ACCESS_KEY': 'mega-secret',
    })
    def test_es_client_for_aws_access_without_key(self) -> None:
        """Try getting an Elasticsearch client that can access a server on AWS with no key."""

        client = sync_user_elasticsearch.get_es_client_from_env()
        http_auth = client.transport.kwargs['http_auth']
        self.assertFalse(http_auth)

    def test_create_index(self) -> None:
        """Create ES index if it doesn't already exist."""

        self.mock_elasticsearch.indices.exists.return_value = False
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--index', 'bobusers',
            '--no-dry-run', '--disable-sentry'])
        self.assertFalse(self.mock_elasticsearch.indices.delete.called)
        self.mock_elasticsearch.indices.create.assert_called_once_with(index='bobusers')

    def test_update_index(self) -> None:
        """No ES index operation if index already exists."""

        self.mock_elasticsearch.indices.exists.return_value = True
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--index', 'bobusers',
            '--no-dry-run', '--disable-sentry'])
        self.assertFalse(self.mock_elasticsearch.indices.delete.called)
        self.assertFalse(self.mock_elasticsearch.indices.create.called)

    def test_force_recreate(self) -> None:
        """ES drops index and recreates it at start."""

        called_indices_methods: list[str] = []

        def _save_called_func(method_name: str) -> Callable[[str], None]:

            def _side_effect(index: str) -> None:  # pylint: disable=unused-argument
                called_indices_methods.append(method_name)
                return None
            return _side_effect
        self.mock_elasticsearch.indices.exists.return_value = True
        self.mock_elasticsearch.indices.delete.side_effect = _save_called_func('delete')
        self.mock_elasticsearch.indices.create.side_effect = _save_called_func('create')
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--index', 'bobusers',
            '--force-recreate', '--no-dry-run', '--disable-sentry'])
        self.mock_elasticsearch.indices.delete.assert_called_once_with(index='bobusers')
        self.mock_elasticsearch.indices.create.assert_called_once_with(index='bobusers')
        self.assertEqual(['delete', 'create'], called_indices_methods)

    def _compute_user_data(self, user: user_pb2.User) -> dict[str, Any]:
        if not user.HasField('registered_at'):
            user.registered_at.GetCurrentTime()
        self._user_db.user.drop()
        self._user_db.user.insert_one(json_format.MessageToDict(user))
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--no-dry-run', '--disable-sentry'])
        kwargs = self.mock_elasticsearch.update.call_args[1]
        return typing.cast(dict[str, Any], kwargs.pop('body')['doc'])

    def test_infinite_salary(self) -> None:
        """Test that infinite salaries are not kept."""

        user = user_pb2.User()
        project = user.projects.add()
        project.min_salary = float('inf')

        data = self._compute_user_data(user)

        self.assertNotIn('minSalary', data['project'])

    def test_nan_salary(self) -> None:
        """Test that NaN salaries are not kept."""

        user = user_pb2.User()
        project = user.projects.add()
        project.min_salary = float('nan')

        data = self._compute_user_data(user)

        self.assertNotIn('minSalary', data['project'])

    def test_age_group(self) -> None:
        """Test various age groups."""

        age_group_counts: dict[str, int] = collections.defaultdict(int)
        age_groups: list[str] = []

        for year in range(1940, 2020):
            user = user_pb2.User()
            user.profile.year_of_birth = year
            data = self._compute_user_data(user)
            age_group = data.get('profile', {}).get('ageGroup')
            age_group_counts[age_group] += 1
            age_groups.append(age_group)

        self.assertEqual(
            sorted(age_groups, reverse=True), age_groups, msg='Grouping ages should keep ordering')

        self.assertEqual(
            {'A. -18', 'B. 18-24', 'C. 25-34', 'D. 35-44', 'E. 45-54', 'F. 55-64', 'G. 65+'},
            set(age_group_counts.keys()))

    def _compute_user_data_for_nps(
            self, responded_at: datetime.datetime, score: int,
            has_actions_idea: 'boolean_pb2.OptionalBool.V',
            self_diagnostic: diagnostic_pb2.SelfDiagnostic) -> dict[str, Any]:
        user = user_pb2.User()
        project = user.projects.add()
        project.original_self_diagnostic.CopyFrom(diagnostic_pb2.SelfDiagnostic(
            status=diagnostic_pb2.KNOWN_SELF_DIAGNOSTIC, category_id='stuck-market'))
        project.diagnostic.CopyFrom(
            diagnostic_pb2.Diagnostic(category_id='stuck-market'))
        response = user.net_promoter_score_survey_response
        response.responded_at.FromDatetime(responded_at)
        response.has_actions_idea = has_actions_idea
        response.nps_self_diagnostic.CopyFrom(self_diagnostic)
        response.score = score
        return self._compute_user_data(user)

    def test_nps_best_score(self) -> None:
        """Test NPS best score."""

        data = self._compute_user_data_for_nps(
            datetime.datetime(2018, 11, 20, 18, 29), 10, boolean_pb2.FALSE,
            diagnostic_pb2.SelfDiagnostic(status=diagnostic_pb2.UNKNOWN_SELF_DIAGNOSTIC))
        self.assertEqual(
            {
                'hasActionsIdea': 'FALSE',
                'selfDiagnostic': {
                    'status': 'UNKNOWN_SELF_DIAGNOSTIC',
                },
                'score': 10,
                'time': '2018-11-20T18:29:00Z',
                'loveScore': 1,
            },
            data.get('nps_response'))

    def test_nps_medium_score(self) -> None:
        """Test NPS medium score."""

        data = self._compute_user_data_for_nps(
            datetime.datetime(2018, 11, 20, 18, 29), 7, boolean_pb2.FALSE,
            diagnostic_pb2.SelfDiagnostic(status=diagnostic_pb2.UNKNOWN_SELF_DIAGNOSTIC))
        self.assertEqual(
            {
                'hasActionsIdea': 'FALSE',
                'selfDiagnostic': {
                    'status': 'UNKNOWN_SELF_DIAGNOSTIC',
                },
                'score': 7,
                'time': '2018-11-20T18:29:00Z',
                'loveScore': 0,
            },
            data.get('nps_response'))

    def test_nps_bad_score(self) -> None:
        """Test NPS bad score."""

        data = self._compute_user_data_for_nps(
            datetime.datetime(2018, 11, 20, 18, 29), 0, boolean_pb2.FALSE,
            diagnostic_pb2.SelfDiagnostic(status=diagnostic_pb2.UNKNOWN_SELF_DIAGNOSTIC))
        self.assertEqual(
            {
                'hasActionsIdea': 'FALSE',
                'selfDiagnostic': {
                    'status': 'UNKNOWN_SELF_DIAGNOSTIC',
                },
                'score': 0,
                'time': '2018-11-20T18:29:00Z',
                'loveScore': -1,
            },
            data.get('nps_response'))

    @mock.patch('logging.warning')
    def test_nps_crazy_score(self, mock_warning: mock.MagicMock) -> None:
        """NPS crazy score."""

        data = self._compute_user_data_for_nps(
            datetime.datetime(2018, 11, 20, 18, 29), 200, boolean_pb2.FALSE,
            diagnostic_pb2.SelfDiagnostic(status=diagnostic_pb2.UNKNOWN_SELF_DIAGNOSTIC))
        self.assertEqual(
            {
                'hasActionsIdea': 'FALSE',
                'selfDiagnostic': {
                    'status': 'UNKNOWN_SELF_DIAGNOSTIC',
                },
                'score': 200,
                'time': '2018-11-20T18:29:00Z',
            },
            data.get('nps_response'))

        mock_warning.assert_called_once_with('Cannot convert nps_score %s', 200)

    def test_nps_self_diagnostic_category(self) -> None:
        """Test NPS self diagnostic with category Id."""

        data = self._compute_user_data_for_nps(
            datetime.datetime(2018, 11, 20, 18, 29), 0, boolean_pb2.TRUE,
            diagnostic_pb2.SelfDiagnostic(
                status=diagnostic_pb2.KNOWN_SELF_DIAGNOSTIC, category_id='missing-diploma'))
        self.assertEqual(
            {
                'hasActionsIdea': 'TRUE',
                'selfDiagnostic': {
                    'categoryId': 'missing-diploma',
                    'hasChanged': 'changed_to_other',
                    'status': 'KNOWN_SELF_DIAGNOSTIC',
                },
                'score': 0,
                'time': '2018-11-20T18:29:00Z',
                'loveScore': -1,
            },
            data.get('nps_response'))

    def test_nps_local_market_estimate(self) -> None:
        """Test NPS local market estimate."""

        user, response = _user_and_its_nps()
        response.local_market_estimate = user_pb2.LOCAL_MARKET_GOOD
        data = self._compute_user_data(user)
        self.assertEqual(
            'LOCAL_MARKET_GOOD', data.get('nps_response', {}).get('localMarketEstimate'))

    def test_nps_bob_relative_personalization(self) -> None:
        """Test NPS bob relative personalization."""

        user, response = _user_and_its_nps()
        response.bob_relative_personalization = 10
        data = self._compute_user_data(user)
        self.assertEqual('Equally', data.get('nps_response', {}).get('bobRelativePersonalization'))

    def test_nps_user_informed_about_career_options(self) -> None:
        """Test NPS user informed about career options."""

        user, response = _user_and_its_nps()
        response.user_informed_about_career_options = 1
        data = self._compute_user_data(user)
        self.assertEqual(
            'No change', data.get('nps_response', {}).get('userInformedAboutCareerOptions'))

    def test_nps_product_usability_score(self) -> None:
        """Test NPS product usability score."""

        user, response = _user_and_its_nps()
        response.product_usability_score = 1
        data = self._compute_user_data(user)
        self.assertEqual('Very poor', data.get('nps_response', {}).get('productUsabilityScore'))

    def test_nps_next_actions(self) -> None:
        """Test NPS product usability score."""

        self._db.challenge_actions.insert_many([
            {
                '_id': 'action-1',
                'scoreByChallenge': {
                    'stuck-market': 1,
                    'missing-diploma': 2,
                }
            },
            {
                '_id': 'action-2',
                'scoreByChallenge': {
                    'stuck-market': 3,
                    'missing-diploma': 8,
                }
            },
            {
                '_id': 'action-3',
                'scoreByChallenge': {
                    'stuck-market': 6,
                }
            },
        ])
        user, response = _user_and_its_nps()
        response.next_actions.extend(['action-1', 'action-2'])
        data = self._compute_user_data(user)
        self.assertEqual({
            'stuck-market': .4,
            'missing-diploma': 1,
            'diagnostic': .4,
            'selfDiagnostic': 1,
            'originalSelfDiagnostic': .4,
        }, data.get('nps_response', {}).get('challengeScores'))

    def test_nps_request(self) -> None:
        """NPS request computation."""

        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime(2019, 10, 19, 20, 31, 33))
        nps_email = user.emails_sent.add(campaign_id='nps')
        nps_email.sent_at.FromDatetime(datetime.datetime(2019, 10, 22, 8, 15))
        user.net_promoter_score_survey_response.responded_at.FromDatetime(
            datetime.datetime(2019, 10, 22, 8, 15))
        data = self._compute_user_data(user)
        self.assertEqual(
            {'hasResponded': True, 'sentAfterDays': 2},
            data.get('nps_request'))

    def _compute_data_bob_has_helped(
            self, created_at: datetime.datetime, bob_has_helped: str) -> dict[str, Any]:
        user = user_pb2.User()
        user.registered_at.FromDatetime(now.get())
        status = user.employment_status.add()
        status.bob_has_helped = bob_has_helped
        status.created_at.FromDatetime(created_at)
        return self._compute_user_data(user)

    def test_no_bob_has_helped(self) -> None:
        """No Bob has helped."""

        data = self._compute_data_bob_has_helped(
            datetime.datetime(2018, 11, 20, 18, 29), '')
        self.assertEqual(
            {
                'createdAt': '2018-11-20T18:29:00Z',
                'daysSinceRegistration': 369,
            },
            data.get('employmentStatus'))

    def test_bob_has_helped(self) -> None:
        """Bob has helped."""

        data = self._compute_data_bob_has_helped(
            datetime.datetime(2018, 11, 20, 18, 29), 'YES_A_LOT')
        self.assertEqual(
            {
                'bobHasHelped': 'YES_A_LOT',
                'bobHasHelpedScore': 1,
                'createdAt': '2018-11-20T18:29:00Z',
                'daysSinceRegistration': 369,
            },
            data.get('employmentStatus'))

    def test_bob_has_not_helped(self) -> None:
        """Bob has not helped."""

        data = self._compute_data_bob_has_helped(
            datetime.datetime(2018, 11, 20, 18, 29), 'NO')
        self.assertEqual(
            {
                'bobHasHelped': 'NO',
                'bobHasHelpedScore': -1,
                'createdAt': '2018-11-20T18:29:00Z',
                'daysSinceRegistration': 369,
            },
            data.get('employmentStatus'))

    @mock.patch('logging.warning')
    def test_bob_has_helped_is_weird(self, mock_warning: mock.MagicMock) -> None:
        """Bob has not helped."""

        data = self._compute_data_bob_has_helped(
            datetime.datetime(2018, 11, 20, 18, 29), 'WEIRD')
        self.assertEqual(
            {
                'bobHasHelped': 'WEIRD',
                'createdAt': '2018-11-20T18:29:00Z',
                'daysSinceRegistration': 369,
            },
            data.get('employmentStatus'))

        mock_warning.assert_called_once_with('bobHasHelped field has unknown answer "%s"', 'WEIRD')

    def _compute_data_feedback_score(self, feedback_score: int) -> dict[str, Any]:
        user = user_pb2.User()
        project = user.projects.add()
        project.feedback.score = feedback_score
        return self._compute_user_data(user)

    def test_low_feedback_score(self) -> None:
        """Low feedback score."""

        data = self._compute_data_feedback_score(1)
        self.assertEqual(
            {
                'feedbackScore': 1,
                'feedbackLoveScore': -1,
            },
            {k: v for k, v in data.get('project', {}).items() if k.startswith('feedback')})

    def test_good_feedback_score(self) -> None:
        """Good feedback score."""

        data = self._compute_data_feedback_score(5)
        self.assertEqual(
            {
                'feedbackScore': 5,
                'feedbackLoveScore': 1,
            },
            {k: v for k, v in data.get('project', {}).items() if k.startswith('feedback')})

    def test_medium_feedback_score(self) -> None:
        """Medium feedback score."""

        data = self._compute_data_feedback_score(3)
        self.assertEqual(
            {
                'feedbackScore': 3,
                'feedbackLoveScore': 0,
            },
            {k: v for k, v in data.get('project', {}).items() if k.startswith('feedback')})

    @mock.patch('logging.warning')
    def test_feedback_score_out_of_bounds(self, mock_warning: mock.MagicMock) -> None:
        """Feedback score way too high."""

        data = self._compute_data_feedback_score(51)
        self.assertEqual(
            {
                'feedbackScore': 51,
            },
            {k: v for k, v in data.get('project', {}).items() if k.startswith('feedback')})

        mock_warning.assert_called_with('Cannot convert feedback_score %s', 51)

    def test_with_domain_info(self) -> None:
        """Gives the job domain from database when available."""

        self._db.job_group_info.insert_one({'_id': 'J1234', 'domain': 'Médecine et Santé'})
        user = user_pb2.User()
        project = user.projects.add()
        project.target_job.job_group.rome_id = 'J1234'
        data = self._compute_user_data(user)
        self.assertEqual(
            'Médecine et Santé', data.get('project', {}).get('targetJob', {}).get('domain'))

    def test_ffs(self) -> None:
        """Info from the FFS."""

        self._user_db.user.insert_one({
            'registeredAt': '2022-02-12T18:06:08Z',
            'emailsSent': [
                {
                    'campaignId': 'first-followup-survey',
                    # 7 days after registration.
                    'sentAt': '2022-02-19T18:06:08Z',
                    'status': 'EMAIL_SENT_SENT',
                },
                {
                    'campaignId': 'focus-spontaneous',
                    'sentAt': '2022-02-21T18:06:08Z',
                    'status': 'EMAIL_SENT_OPENED',
                },
            ],
            'firstFollowupSurveyResponse': {
                # 8 days after registration.
                'respondedAt': '2022-02-20T19:06:00Z',
                'hasTriedSomethingNew': True,
                'newIdeasScore': 4,
            },
        })
        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2022-02-01',
            '--no-dry-run', '--disable-sentry'])

        self.mock_elasticsearch.update.assert_called_once()
        kwargs = self.mock_elasticsearch.update.call_args[1]
        self.assertIn('body', kwargs)
        self.assertIn('doc', kwargs['body'])
        doc = kwargs['body']['doc']
        self.assertTrue(json.dumps(doc), msg='The document should be serializable')
        self.assertLessEqual({'ffsRequest', 'ffsResponse'}, doc.keys())
        self.assertEqual({'hasResponded': True, 'sentAfterDays': 7}, doc['ffsRequest'])
        self.assertEqual(
            {'hasTriedSomethingNew': True, 'newIdeasScore': 4, 'respondedDaysAfterRegistration': 8},
            doc['ffsResponse'])


if __name__ == '__main__':
    unittest.main()
