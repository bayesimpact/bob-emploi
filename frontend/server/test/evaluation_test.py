"""Tests for the eval endpoints of the server module."""

import datetime
import unittest
from unittest import mock

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test


@mock.patch(auth.__name__ + '.client.verify_id_token')
@mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', 'ze-admin-token')
class EvalTestCase(base_test.ServerTestCase):
    """Unit tests for eval endpoints."""

    def test_get_authorized(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Basic call to /api/eval/authorized"""

        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(204, response.status_code)

    def test_get_authorized_failure(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Unauthorized access to /api/eval/authorized"""

        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            # Unauthorized email.
            'email': 'pascal@hacker.ru',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'Bearer blabla'})
        self.assertEqual(401, response.status_code)

    def test_get_authorized_admin(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Access to /api/eval/authorized through the admin token."""

        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            # Unauthorized email.
            'email': 'pascal@hacker.ru',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'ze-admin-token'})
        self.assertEqual(204, response.status_code)

    def test_get_missing_bearer_token(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Missing Bearer in the Authorization header."""

        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/authorized',
            headers={'Authorization': 'blabla'})
        self.assertEqual(401, response.status_code)

    def test_get_pools(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Basic usage of /api/eval/use-case-pools endpoint."""

        mock_verify_id_token.return_value = {
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

    def test_get_use_cases(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Basic usage of /api/eval/use-cases/... endpoint."""

        mock_verify_id_token.return_value = {
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

    def test_eval_use_case(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Test the endpoint to evaluate a use case."""

        mock_verify_id_token.return_value = {
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

    def test_eval_use_case_by_admin(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Test the endpoint to evaluate a use case, using the admin token."""

        mock_verify_id_token.return_value = {
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

    def test_create(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Create a use case from a user."""

        mock_verify_id_token.return_value = {
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

        db_use_case = self._eval_db.use_case.find_one()
        db_use_case['useCaseId'] = db_use_case.pop('_id')
        self.assertEqual(use_case, db_use_case)

        # Creating a second time, actually creates a second use case.
        use_case2 = self.json_from_response(self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer blabla'}))

        self.assertEqual('newPool_01', use_case2.get('useCaseId'))

    def test_create_unauthorized(self, mock_verify_id_token: mock.MagicMock) -> None:
        """Create a use case from a user."""

        mock_verify_id_token.return_value = {
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


if __name__ == '__main__':
    unittest.main()
