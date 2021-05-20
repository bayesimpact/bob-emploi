"""Tests for the eval endpoints of the server module."""

import datetime
import json
import unittest
from unittest import mock
import typing
from typing import List

from pymongo import errors

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock

if typing.TYPE_CHECKING:
    from bob_emploi.frontend.server.mail import mail_send


@mock.patch(auth.__name__ + '.id_token.verify_oauth2_token')
@mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', 'ze-admin-token')
class EvalTestCase(base_test.ServerTestCase):
    """Unit tests for eval endpoints."""

    def test_get_authorized(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Basic call to /api/eval/authorized"""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(204, response.status_code)

    def test_get_authorized_failure(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Unauthorized access to /api/eval/authorized"""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            # Unauthorized email.
            'email': 'pascal@hacker.ru',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(401, response.status_code)

    def test_get_authorized_admin(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Access to /api/eval/authorized through the admin token."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            # Unauthorized email.
            'email': 'pascal@hacker.ru',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'ze-admin-token'})
        self.assertEqual(204, response.status_code)

    def test_get_missing_bearer_token(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Missing Bearer in the Authorization header."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'blabla'})
        self.assertEqual(401, response.status_code)

    def test_get_pools(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Basic usage of /api/eval/use-case-pools endpoint."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._eval_db.use_case.insert_many([{
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'indexInPool': 0,
            'userData': {
                'registeredAt': '2017-09-01T08:00:00Z',
            },
        }, {
            '_id': 'pool-2_00',
            'poolName': 'pool-2',
            'indexInPool': 0,
            'userData': {
                'registeredAt': '2017-09-02T08:00:00Z',
            },
            'evaluation': {
                'score': 'EXCELLENT',
            },
        }])

        response = self.app.get(
            '/api/eval/use-case-pools',
            headers={'Authorization': 'Bearer blabla'})
        pools = self.json_from_response(response)
        self.assertEqual([{
            'name': 'pool-2',
            'useCaseCount': 1,
            'evaluatedUseCaseCount': 1,
            'lastUserRegisteredAt': '2017-09-02T08:00:00Z',
        }, {
            'name': 'pool-1',
            'useCaseCount': 1,
            'lastUserRegisteredAt': '2017-09-01T08:00:00Z',
        }], pools.get('useCasePools'))

    def test_get_use_cases(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Basic usage of /api/eval/use-cases/... endpoint."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        # Insert in reverse to check that the sorting will work correctly.
        self._eval_db.use_case.insert_many([
            {
                '_id': 'pool-1_01',
                'poolName': 'pool-1',
                'indexInPool': 1,
                'userData': {
                    'profile': {'yearOfBirth': 1983},
                    'projects': [{'city': {'name': 'Toulouse'}}],
                },
            },
            {
                '_id': 'pool-1_00',
                'poolName': 'pool-1',
                'indexInPool': 0,
                'userData': {
                    'profile': {'yearOfBirth': 1982},
                    'projects': [{'city': {'name': 'Lyon'}}],
                },
            },
        ])

        response = self.app.get(
            '/api/eval/use-cases/pool-1',
            headers={'Authorization': 'Bearer blabla'})
        use_cases = self.json_from_response(response)
        self.assertEqual(
            ['pool-1_00', 'pool-1_01'],
            [u.get('useCaseId') for u in use_cases.get('useCases', [])])
        self.assertEqual(
            [1982, 1983],
            [u.get('userData', {}).get('profile', {}).get('yearOfBirth')
             for u in use_cases.get('useCases', [])])
        self.assertEqual(
            ['Lyon', 'Toulouse'],
            [u.get('userData', {}).get('projects', [{}])[0].get('city', {}).get('name')
             for u in use_cases.get('useCases', [])])

    def test_eval_use_case(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test the endpoint to evaluate a use case."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._eval_db.use_case.insert_one({
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'userData': {
                'profile': {'yearOfBirth': 1982},
            },
        })
        time_before = datetime.datetime.now() - datetime.timedelta(seconds=1)
        response = self.app.post(
            '/api/eval/use-case/pool-1_00',
            data='{"score": "EXCELLENT", "comments": "What do I know?"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(200, response.status_code)

        use_case = self._eval_db.use_case.find_one()
        assert use_case
        # Remove the variable part.
        evaluated_at = use_case.get('evaluation', {}).pop('evaluatedAt', None)
        self.assertEqual({
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'userData': {
                'profile': {'yearOfBirth': 1982},
            },
            'evaluation': {
                'by': 'pascal@bayesimpact.org',
                'score': 'EXCELLENT',
                'comments': 'What do I know?',
            },
        }, use_case)

        evaluated_date = datetime.datetime.strptime(evaluated_at, '%Y-%m-%dT%H:%M:%SZ')
        self.assertLessEqual(time_before, evaluated_date)
        self.assertLessEqual(evaluated_date, datetime.datetime.now())

    def test_eval_use_case_by_admin(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test the endpoint to evaluate a use case, using the admin token."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._eval_db.use_case.insert_one({
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'userData': {
                'profile': {'yearOfBirth': 1982},
            },
        })
        response = self.app.post(
            '/api/eval/use-case/pool-1_00',
            data='{"score": "EXCELLENT", "comments": "What do I know?"}',
            content_type='application/json',
            headers={'Authorization': 'ze-admin-token'})
        self.assertEqual(200, response.status_code)

        use_case = self._eval_db.use_case.find_one()
        assert use_case
        # Remove the variable part.
        use_case.get('evaluation', {}).pop('evaluatedAt', None)
        self.assertEqual({
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'userData': {
                'profile': {'yearOfBirth': 1982},
            },
            'evaluation': {
                'by': 'admin@bayesimpact.org',
                'score': 'EXCELLENT',
                'comments': 'What do I know?',
            },
        }, use_case)

    def test_create(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use case from a user."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self.create_user(email='pascal@example.fr')
        response = self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        use_case = self.json_from_response(response)

        self.assertEqual('newPool_00', use_case.get('useCaseId'))
        self.assertTrue(use_case.get('userData', {}).get('hasAccount'))

        db_use_case = self._eval_db.use_case.find_one()
        assert db_use_case
        db_use_case['useCaseId'] = db_use_case.pop('_id')
        self.assertEqual(use_case, db_use_case)

        # Creating a second time, actually creates a second use case.
        use_case2 = self.json_from_response(self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'}))

        self.assertEqual('newPool_01', use_case2.get('useCaseId'))

    def test_create_from_ticket(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use case from a user with an opened support ticket."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self.create_user(data={
            'profile': {'yearOfBirth': 1987},
            'supportTickets': [{'ticketId': 'support-id'}],
        })
        response = self.app.post(
            '/api/eval/use-case/create',
            data='{"ticketId": "support-id"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        use_case = self.json_from_response(response)

        self.assertEqual('_00', use_case.get('useCaseId'))
        self.assertEqual(1987, use_case.get('userData', {}).get('profile', {}).get('yearOfBirth'))
        self.assertNotIn('support-id', json.dumps(use_case))

    def test_create_from_guest(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use case from a guest user."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        user_id, unused_token = self.create_guest_user(first_name='Pascal')
        response = self.app.post(
            '/api/eval/use-case/create',
            data=f'{{"userId": "{user_id}", "poolName": "newPool"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        use_case = self.json_from_response(response)

        self.assertEqual('newPool_00', use_case.get('useCaseId'))
        self.assertFalse(use_case.get('userData', {}).get('hasAccount'))

        db_use_case = self._eval_db.use_case.find_one()
        assert db_use_case
        db_use_case['useCaseId'] = db_use_case.pop('_id')
        self.assertEqual(use_case, db_use_case)

    def test_create_unauthorized(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use case from a user."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@unauthorized.org',
            'sub': '12345',
        }
        self.create_user(email='pascal@example.fr')
        response = self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(
            401,
            response.status_code,
            msg='Unauthorized modification must return status 401')

    def test_use_cases_from_filters(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Get recent use cases from a set of filters."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self._eval_db.use_case.insert_many([
            {
                '_id': f'2019-18-01_{index:02x}',
                'userData': {'projects': [{
                    'networkEstimate': (index % 3) + 1
                }]},
            } for index in range(10)
        ])
        response = self.app.post(
            'api/eval/use-case/filters',
            data=json.dumps({'filters': ['for-network(1)']}),
            headers={'Authorization': 'Bearer blabla'})
        use_cases = self.json_from_response(response).get('useCases', [])
        self.assertCountEqual(
            ['2019-18-01_00', '2019-18-01_03', '2019-18-01_06', '2019-18-01_09'],
            [uc.get('useCaseId') for uc in use_cases])

    def test_use_cases_from_unknown_filter(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Abort if one of the filters does not exist."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self._eval_db.use_case.insert_many([
            {
                '_id': f'2019-18-01_{index:02x}',
                'userData': {'projects': [{
                    'networkEstimate': (index % 3) + 1
                }]},
            } for index in range(10)
        ])

        response = self.app.post(
            'api/eval/use-case/filters',
            data=json.dumps({'filters': ['undefined-filter']}),
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(404, response.status_code, msg=response.get_data(as_text=True))
        self.assertIn('undefined-filter', response.get_data(as_text=True))

    def test_make_diagnostic_main_challenge_distribution(
            self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test the make_diagnostic_main_challenge_distribution function."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        # This test uses frustration 1 to 4 without caring about the actual values.
        def _frustration_name(value: int) -> str:
            return user_pb2.Frustration.Name(typing.cast('user_pb2.Frustration.V', value))

        self._eval_db.use_case.insert_many([{
            '_id': f'2019-18-01_{d}',
            'userData': {
                # One on three use cases has a different frustration.
                'profile': {'frustrations': [_frustration_name(d % 3 + 1)]},
                'projects': [{}],
            },
        } for d in range(20)])

        # First use case also has another frustration.
        self._eval_db.use_case.update_one(
            {'_id': '2019-18-01_0'},
            {'$push': {'userData.profile.frustrations': _frustration_name(4)}})

        # Main challenges are as follow:
        # - 1st main challenge needs frustration 1 and 4
        # - 2nd main challenge needs frustration 2
        # - 3rd main challenge needs frustration 3
        main_challenges = [{
            'categoryId': f'frustration-{d + 1}',
            'filters': [f'for-frustrated({_frustration_name(d + 1)})']
        } for d in range(3)]
        typing.cast(List[str], main_challenges[0]['filters']).append(
            f'for-frustrated({_frustration_name(4)})')
        self._db.diagnostic_main_challenges.insert_many(main_challenges)

        response = self.app.post(
            '/api/eval/main-challenge/distribution',
            data='{}', headers={'Authorization': 'Bearer blabla'})
        distribution = self.json_from_response(response)
        self.assertEqual(20, distribution.get('totalCount'))

        self.assertEqual(6, distribution.get('missingUseCases', {}).get('count'))
        self.assertEqual(4, len(distribution['missingUseCases'].get('examples', [])))
        self.assertFalse(
            set(uc.get('useCaseId') for uc in distribution['missingUseCases']['examples']) -
            {
                '2019-18-01_3', '2019-18-01_6', '2019-18-01_9',
                '2019-18-01_12', '2019-18-01_15', '2019-18-01_18'})

        frustration_1 = distribution.get('distribution', {}).get('frustration-1', {})
        self.assertTrue(frustration_1)
        self.assertEqual(1, frustration_1.get('count'))
        self.assertEqual(1, len(frustration_1.get('examples', [])))
        self.assertEqual('2019-18-01_0', frustration_1['examples'][0].get('useCaseId'))

        frustration_2 = distribution['distribution'].get('frustration-2')
        self.assertTrue(frustration_2)
        self.assertEqual(7, frustration_2.get('count'))
        self.assertEqual(4, len(frustration_2.get('examples', [])))
        self.assertFalse(
            set(uc.get('useCaseId') for uc in frustration_2['examples']) -
            {
                '2019-18-01_1', '2019-18-01_4', '2019-18-01_7', '2019-18-01_10',
                '2019-18-01_13', '2019-18-01_16', '2019-18-01_19'})

        frustration_3 = distribution['distribution'].get('frustration-3')
        self.assertTrue(frustration_3)
        self.assertEqual(6, frustration_3.get('count'))
        self.assertEqual(4, len(frustration_3.get('examples')))
        self.assertFalse(
            set(uc.get('useCaseId') for uc in frustration_3['examples']) -
            {
                '2019-18-01_2', '2019-18-01_5', '2019-18-01_8',
                '2019-18-01_11', '2019-18-01_14', '2019-18-01_17'})

    def test_make_distribution_from_main_challenges(
            self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """make_distribution_from_main_challenges works when given a list of main challenges."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self._eval_db.use_case.insert_one({
            '_id': '2019-01-20_3',
            'userData': {
                'profile': {'frustrations': ['MOTIVATION']},
                'projects': [{}],
            }
        })
        self._eval_db.use_case.insert_many([{
            '_id': f'2019-01-20_{d}',
            'userData': {'projects': [{}]},
        } for d in range(3)])
        data = {'categories': [{
            'categoryId': 'remotivate-yourself',
            'filters': ['for-frustrated(MOTIVATION)'],
        }]}
        self._db.diagnostic_main_challenges.insert_many([
            {
                'categoryId': 'keep-your-job',
                'filters': ['for-employed'],
                'order': 0,
            },
            {
                'categoryId': 'you-re-motivated',
                'filters': ['not-for-frustrated(MOTIVATION)'],
                'order': 1,
            },
        ])

        response = self.app.post(
            '/api/eval/main-challenge/distribution',
            data=json.dumps(data), headers={'Authorization': 'Bearer blabla'})
        distribution = self.json_from_response(response)

        self.assertEqual(4, distribution.get('totalCount'))

        self.assertEqual(3, distribution.get('missingUseCases', {}).get('count'))
        self.assertEqual(3, len(distribution['missingUseCases'].get('examples', [])))
        self.assertEqual(
            set(uc.get('useCaseId') for uc in distribution['missingUseCases']['examples']),
            {'2019-01-20_0', '2019-01-20_1', '2019-01-20_2'})

        frustration = distribution.get('distribution', {}).get('remotivate-yourself', {})
        self.assertTrue(frustration)
        self.assertEqual(1, frustration.get('count'))
        self.assertEqual(1, len(frustration.get('examples', [])))
        self.assertEqual('2019-01-20_3', frustration['examples'][0].get('useCaseId'))

    def test_make_distribution_capped(self, mock_verify_oauth2_token: mock.MagicMock) \
            -> None:
        """make distribution endpoint works with a cap on the number of use cases to test."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self._eval_db.use_case.insert_one({
            '_id': '2019-01-20_3',
            'userData': {
                'profile': {'frustrations': ['MOTIVATION']},
                'projects': [{}],
            }
        })
        self._eval_db.use_case.insert_many([{
            '_id': f'2019-01-20_{d}',
            'userData': {'projects': [{}]},
        } for d in range(3)])
        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'remotivate-yourself',
            'filters': ['for-frustrated(MOTIVATION)'],
        })

        response = self.app.post(
            '/api/eval/main-challenge/distribution',
            data=json.dumps({'maxUseCases': 2}), headers={'Authorization': 'Bearer blabla'})
        distribution = self.json_from_response(response)

        self.assertEqual(2, distribution.get('totalCount'))

        self.assertEqual(1, distribution.get('missingUseCases', {}).get('count'))
        self.assertEqual(1, len(distribution['missingUseCases'].get('examples', [])))
        self.assertEqual(
            '2019-01-20_2', distribution['missingUseCases']['examples'][0].get('useCaseId'))

        frustration = distribution.get('distribution', {}).get('remotivate-yourself', {})
        self.assertTrue(frustration)
        self.assertEqual(1, frustration.get('count'))
        self.assertEqual(1, len(frustration.get('examples', [])))
        self.assertEqual('2019-01-20_3', frustration['examples'][0].get('useCaseId'))

    def test_get_main_challenges(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """get_relevant_main_challenges returns all main challenges, with a is_relevant flag."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self._db.diagnostic_main_challenges.insert_many([
            {
                'categoryId': 'relevant',
                'filters': ['constant(3)'],
            },
            {
                'categoryId': 'not-relevant',
                'filters': ['constant(0)'],
            },
            {
                'categoryId': 'less-relevant',
                'filters': ['constant(2)'],
            },
        ])
        use_case_json = {
            'useCaseId': '2019-01-20_00',
            'userData': {'projects': [{}]},
        }
        response = self.app.post(
            '/api/eval/use-case/main-challenges',
            data=json.dumps(use_case_json), headers={'Authorization': 'Bearer blabla'})
        main_challenges = self.json_from_response(response)['categories']
        self.assertEqual(
            ['relevant', 'not-relevant', 'less-relevant'],
            [c['categoryId'] for c in main_challenges])
        self.assertEqual(
            ['NEEDS_ATTENTION', 'RELEVANT_AND_GOOD', 'NEEDS_ATTENTION'],
            [c.get('relevance') for c in main_challenges])

    def test_create_unsaved(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use case from a user, without saving it."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self.create_user(email='pascal@example.fr')
        response = self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'})
        use_case = self.json_from_response(response)

        self.assertEqual('_00', use_case.get('useCaseId'))

        db_use_case = self._eval_db.use_case.find_one()
        self.assertFalse(db_use_case)

    def test_log_fetched_email(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Whenever a use-case is requested from an email address, the request is logged."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self.create_user(email='me@example.com')

        response = self.app.post(
            '/api/eval/use-case/create', headers={'Authorization': 'Bearer blabla'},
            data=json.dumps({'email': 'me@example.com'}))
        self.json_from_response(response)

        response = self.app.post(
            '/api/eval/use-case/create', headers={'Authorization': 'Bearer blabla'},
            data=json.dumps({'email': 'not-found@example.com'}))
        self.assertEqual(404, response.status_code)

        self.assertCountEqual(
            ['me@example.com', 'not-found@example.com'],
            [log['email'] for log in self._eval_db.email_requests.find({})])

        self.assertEqual({'eval'}, {log['action'] for log in self._eval_db.email_requests.find({})})

    def test_no_use_case_if_no_log(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Do not create a use-case if there's no write access to the log table."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        self.create_user(email='me@example.com')

        real_insert_one = self._eval_db.email_requests.insert_one

        def _cleanup() -> None:
            self._eval_db.email_requests.insert_one = real_insert_one  # type: ignore
        self.addCleanup(_cleanup)

        mock_insert_one = mock.MagicMock()
        self._eval_db.email_requests.insert_one = mock_insert_one  # type: ignore
        mock_insert_one.side_effect = errors.OperationFailure('No write access to the database.')

        response = self.app.post(
            '/api/eval/use-case/create', headers={'Authorization': 'Bearer blabla'},
            data=json.dumps({'email': 'me@example.com'}))
        self.assertEqual(401, response.status_code)

    def test_create_from_id(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Create a use-case from a user ID."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }

        user_id = self.create_user(email='me@example.com')

        response = self.app.post(
            '/api/eval/use-case/create', headers={'Authorization': 'Bearer blabla'},
            data=json.dumps({'userId': user_id, 'poolName': 'test-pool'}))
        self.json_from_response(response)

        self.assertTrue(self._eval_db.use_case.find_one({'poolName': 'test-pool'}))


@mailjetmock.patch()
class EmailForwardTestCase(base_test.ServerTestCase):
    """Base class for tests on the email-forwarding route."""

    def setUp(self) -> None:
        super().setUp()
        self.parse_email: 'mail_send._MailjetParseJson' = {
            'Sender': 'joanna@bob-emploi.fr',
            'Recipient': 'user@bob-emploi.fr',
            'Date': '20190701',
            'From': 'Joanna de Bob <joanna@bob-emploi.fr>',
            'Text-part': 'Merci de nous avoir dit que vous nous aimez\u00A0!',
            'Html-part': '<div>Merci de nous avoir dit que vous nous aimez&nbsp;!</div>',
            'SpamAssassinScore': '0',
        }

    def _assert_mailer_daemon(self) -> None:
        self.assertEqual(
            ['joanna@bob-emploi.fr'],
            [msg.recipient['Email'] for msg in mailjetmock.get_all_sent_messages()])

    def test_forward(self) -> None:
        """Basic usage of email-forwarder."""

        user_id = self.create_user(email='cyrille@example.com')

        parse_email = dict(self.parse_email, Subject=f'{user_id} Merci pour votre retour')
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            ['cyrille@example.com'],
            [msg.recipient['Email'] for msg in mailjetmock.get_all_sent_messages()])
        self.assertEqual(
            ['Merci pour votre retour'],
            [msg.properties.get('Subject') for msg in mailjetmock.get_all_sent_messages()])

    @mock.patch('logging.warning')
    def test_wrong_subject(self, mock_warning: mock.MagicMock) -> None:
        """Forwarding message without a user ID in the subject."""

        parse_email = dict(self.parse_email, Subject='Merci!')
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self._assert_mailer_daemon()
        self.assertEqual(202, response.status_code)
        mock_warning.assert_called_once()

    @mock.patch('logging.warning')
    def test_missing_user_id(self, mock_warning: mock.MagicMock) -> None:
        """Forwarding message without a user ID in the subject."""

        parse_email = dict(self.parse_email, Subject='Merci pour votre retour')
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self._assert_mailer_daemon()
        self.assertEqual(202, response.status_code)
        mock_warning.assert_called_once()

    @mock.patch('logging.error')
    def test_missing_user(self, mock_error: mock.MagicMock) -> None:
        """Forwarding message to a missing user."""

        parse_email = dict(
            self.parse_email, Subject='0123456789ab0123456789ab Merci pour votre retour')
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self._assert_mailer_daemon()
        self.assertEqual(202, response.status_code)
        mock_error.assert_called_once()

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', 'ze-admin-token')
    @mock.patch('logging.error')
    def test_missing_email(self, mock_error: mock.MagicMock) -> None:
        """Forwarding email to a user with deleted account."""

        user_id, auth_token = self.create_user_with_token(email='cyrille@example.com')
        user_dict = self.get_user_info(user_id, auth_token)
        response = self.app.delete(
            '/api/user', data=json.dumps(user_dict),
            headers={'Authorization': 'Bearer ze-admin-token'})
        self.assertEqual(user_id, self.json_from_response(response).get('userId'))

        parse_email = dict(self.parse_email, Subject=f'{user_id} Merci pour votre retour')
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self._assert_mailer_daemon()
        self.assertEqual(202, response.status_code)
        mock_error.assert_called_once()

    def test_attachment(self) -> None:
        """Forwarding an email with attachments."""

        user_id = self.create_user(email='cyrille@example.com')

        parse_email = typing.cast('mail_send._MailjetParseJson', dict(
            self.parse_email, Subject='{} Merci pour votre retour'.format(user_id),
            Attachement1='SGVsbG8gV29ybGQh',
            Attachement2='SGVsbG8gV29ybGQhjklmjkljq',
            Parts=[
                {
                    'ContentRef': 'Attachment1',
                    'Headers': {
                        'Content-Type': ['text/plain; charset=utf-8; name=helloworld.txt'],
                        'Content-Transfer-Encoding': ['base64'],
                        'Content-Disposition': ['attachment; filename=helloworld.txt'],
                    },
                },
                {
                    'ContentRef': 'Attachment2',
                    'Headers': {
                        'Content-Type': ['text/plain; charset=utf-8; name=helloworld.txt'],
                        'Content-Transfer-Encoding': ['base64'],
                        'Content-Disposition': ['attachment; filename="spaced name.pdf"'],
                    },
                },
            ]))
        response = self.app.post('/api/eval/mailjet', data=json.dumps(parse_email))
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            ['helloworld.txt', '"spaced name.pdf"'],
            [
                att.get('Filename')
                for msg in mailjetmock.get_all_sent_messages()
                for att in msg.properties.get('Attachments', [])
            ])


if __name__ == '__main__':
    unittest.main()
