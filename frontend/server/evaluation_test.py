"""Tests for the eval endpoints of the server module."""
import datetime
import unittest

from bob_emploi.frontend import base_test


class EvalTestCase(base_test.ServerTestCase):
    """Unit tests for eval endpoints."""

    def test_eval_use_cases(self):
        """Basic usage of /api/eval/use-cases/... endpoint."""
        self._db.use_case.insert_many([
            {
                '_id': 'pool-1_00',
                'poolName': 'pool-1',
                'userData': {
                    'profile': {'yearOfBirth': 1982},
                },
            },
        ])

        response = self.app.get('/api/eval/use-cases/pool-1')
        use_cases = self.json_from_response(response)
        self.assertEqual(
            ['pool-1_00'],
            [u.get('useCaseId') for u in use_cases.get('useCases')])
        self.assertEqual(
            [1982],
            [u.get('userData', {}).get('profile', {}).get('yearOfBirth')
             for u in use_cases.get('useCases')])
        self.assertEqual(
            ['pool-1_00'],
            [u.get('useCaseId') for u in use_cases.get('newUseCases')])
        self.assertEqual(
            [1982],
            [u.get('userData', {}).get('profile', {}).get('yearOfBirth')
             for u in use_cases.get('newUseCases')])

    def test_eval_use_case(self):
        """Test the endpoint to evaluate a use case."""
        self._db.use_case.insert_one({
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
            content_type='application/json')
        self.assertEqual(200, response.status_code)

        use_case = self._db.use_case.find_one()
        # Remove the variable part.
        evaluated_at = use_case.get('evaluation', {}).pop('evaluatedAt', None)
        self.assertEqual({
            '_id': 'pool-1_00',
            'poolName': 'pool-1',
            'userData': {
                'profile': {'yearOfBirth': 1982},
            },
            'evaluation': {
                'score': 'EXCELLENT',
                'comments': 'What do I know?',
            },
        }, use_case)

        evaluated_date = datetime.datetime.strptime(evaluated_at, '%Y-%m-%dT%H:%M:%SZ')
        self.assertLessEqual(time_before, evaluated_date)
        self.assertLessEqual(evaluated_date, datetime.datetime.now())

    def test_create(self):
        """Create a use case from a user."""
        self.create_user(email='pascal@example.fr')

        response = self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json')
        use_case = self.json_from_response(response)

        self.assertEqual('newPool_00', use_case.get('useCaseId'))

        # Creating a second time, actually creates a second use case.
        use_case2 = self.json_from_response(self.app.post(
            '/api/eval/use-case/create',
            data='{"email": "pascal@example.fr", "poolName": "newPool"}',
            content_type='application/json'))

        self.assertEqual('newPool_01', use_case2.get('useCaseId'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
