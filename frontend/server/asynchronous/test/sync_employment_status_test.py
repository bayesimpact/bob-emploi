"""Tests for the sync_employment_status module."""
import json
import os
from urllib import parse
import unittest

import requests_mock

from bob_emploi.frontend.asynchronous import sync_employment_status
from bob_emploi.frontend.api import user_pb2


class MainTestCase(unittest.TestCase):
    """Unit tests for the sync_employment_status module."""

    def setUp(self):
        self.since_timestamp = 13451345543
        self.limit = 200
        response_filename = os.path.join(os.path.dirname(__file__), 'typeform_api_response.json')
        with open(response_filename, 'r') as fin:
            self.typeform_response_text = fin.read()
        self.typeform_response_json = json.loads(self.typeform_response_text)
        self.survey = {
            'id': 'jEnbMx',
            'seeking': user_pb2.STOP_SEEKING,
            'questions': {
                'situation': 'list_ZG8hSuiwD3YY_choice',
                'bobHasHelped': 'list_FInQVJzQr71J_choice',
            },
        }

    # TODO(benoit): Remove logic in tests.
    def _build_typeform_url(self, offset=0):
        """Build typeform API url to call."""
        return sync_employment_status.TYPEFORM_API_URL.format(
            self.survey['id'],
            parse.urlencode({
                'key': sync_employment_status.TYPEFORM_API_KEY,
                'since': self.since_timestamp,
                'completed': 'true',
                'offset': offset,
                'limit': self.limit
            }))

    @requests_mock.mock()
    def test_call_typeform_api(self, mock_requests):
        """Simple test to cover call_typeform_api function."""
        mock_requests.get(
            self._build_typeform_url(),
            status_code=200,
            text=self.typeform_response_text,
        )
        data = sync_employment_status.call_typeform_api(
            self.survey['id'], self.since_timestamp, 0, self.limit)
        self.assertEqual(len(self.typeform_response_json['responses']), len(data['responses']))

    @requests_mock.mock()
    def test_iter_survey_responses(self, mock_requests):
        """Test iterations through responses."""
        mock_requests.get(
            self._build_typeform_url(),
            status_code=200,
            text=self.typeform_response_text,
        )
        for pos, item in enumerate(sync_employment_status.iter_survey_responses(
                self.survey, self.since_timestamp, self.limit)):
            self.assertEqual(self.typeform_response_json['responses'][pos], item)

    def test_survey_response_to_bob(self):
        """Test survey_response_to_bob_data function."""
        response = {
            'hidden': {
                'user': 'fakeuser',
                'token': 'faketoken',
                'id': 'toto',
            },
            'answers': {
                'list_ZG8hSuiwD3YY_choice': 'erroneous answer.',
                'list_FInQVJzQr71J_choice': 'erroneous answer.',
            }
        }
        # all answers are erroneous
        data = sync_employment_status.survey_response_to_bob_data(self.survey, response)
        self.assertTrue(data is None)
        # only second answer is erroneous
        response['answers']['list_ZG8hSuiwD3YY_choice'] = 'Je suis en formation'
        data = sync_employment_status.survey_response_to_bob_data(self.survey, response)
        self.assertTrue(data is None)
        # all answers are ok
        response['answers']['list_FInQVJzQr71J_choice'] = 'Oui, vraiment décisif'
        data = sync_employment_status.survey_response_to_bob_data(self.survey, response)
        self.assertEqual({
            'user': 'fakeuser',
            'token': 'faketoken',
            'id': 'toto',
            'seeking': self.survey['seeking'],
            'situation': 'FORMATION',
            'bobHasHelped': 'YES_A_LOT',
        }, data)

    @requests_mock.mock()
    def test_sync_employment_status(self, mock_requests):
        """Test the main sync_employment_status function."""
        mock_requests.get(
            self._build_typeform_url(),
            status_code=200,
            text=self.typeform_response_text,
        )
        expected_counters = {
            'nb_responses': 39,
            'nb_users_to_update': 39,
            'nb_users_updated': 0,
            'nb_errors': 0
        }
        self.assertEqual(
            expected_counters,
            sync_employment_status.sync_employment_status(
                [self.survey], self.since_timestamp, dry_run=True,
                nb_responses_per_call=self.limit))

if __name__ == '__main__':
    unittest.main()  # pragma: no cover
