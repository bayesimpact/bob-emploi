"""Tests for the eval export feedback endpoint."""

import datetime
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server.test import base_test


@mock.patch('google.oauth2.id_token.verify_oauth2_token')
class EvalExporteedbackTests(base_test.ServerTestCase):
    """Unit tests for the eval export feedback endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._user_db.feedbacks.insert_many([
            # 2022-02-01
            {'_id': mongomock.ObjectId('61f878000000000000000000'), 'userId': 'the first'},
            # 2022-02-02
            {'_id': mongomock.ObjectId('61f9c9800000000000000000'), 'userId': 'someone'},
        ])

    def test_unauthorized(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test that unauthorized access is forbidden."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            # Unauthorized email.
            'email': 'pascal@hacker.ru',
            'sub': '12345',
        }
        response = self.app.get('/api/eval/feedback/export?token=blabla')
        self.assertEqual(401, response.status_code)

    def test_export_csv(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test a CSV export."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get(
            '/api/eval/feedback/export?token=blabla&data=%7B"after"%3A"2022-01-01T12:00:00Z"%7D')
        self.assertEqual(200, response.status_code)
        self.assertIn('someone', response.get_data(as_text=True))

    def test_missing_date(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test that a date is required to start the export."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        response = self.app.get('/api/eval/feedback/export?token=blabla&data=%7B%7D')
        self.assertEqual(422, response.status_code)

    def test_filter_after(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test filtering only recent feedback."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._user_db.feedbacks.insert_many([
            # 2021-01-01
            {'_id': mongomock.ObjectId('5fee66000000000000000000'), 'userId': 'very old feedback'},
            {
                '_id': mongomock.ObjectId.from_datetime(datetime.datetime(2021, 1, 2)),
                'userId': 'very old feedback',
            },
        ])
        response = self.app.get(
            '/api/eval/feedback/export?token=blabla&data=%7B"ater"%3A"2022-02-01T15:00:00Z"%7D')
        self.assertNotIn('very old feedback', response.get_data(as_text=True))

    def test_filter_before(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test filtering out recent feedback."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._user_db.feedbacks.insert_one({
            '_id': mongomock.ObjectId.from_datetime(datetime.datetime(2022, 3, 21)),
            'userId': 'very recent feedback',
        })
        response = self.app.get(
            '/api/eval/feedback/export?token=blabla&data='
            '%7B"ater"%3A"2022-02-01T15:00:00Z","before"%3A"2022-03-20T15:00:00Z"%7D')
        self.assertNotIn('very recent feedback', response.get_data(as_text=True))

    def test_export_no_score(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test export without a score."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._user_db.feedbacks.insert_one({
            '_id': mongomock.ObjectId.from_datetime(datetime.datetime(2022, 3, 21)),
            'feedback': 'my text',
            'userId': 'user has no score',
        })
        response = self.app.get(
            '/api/eval/feedback/export?token=blabla&data=%7B"after"%3A"2022-01-01T12:00:00Z"%7D')
        self.assertEqual(200, response.status_code)
        self.assertIn('my text,,user has no score', response.get_data(as_text=True))

    def test_export_score(self, mock_verify_oauth2_token: mock.MagicMock) -> None:
        """Test export with a score."""

        mock_verify_oauth2_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'pascal@bayesimpact.org',
            'sub': '12345',
        }
        self._user_db.feedbacks.insert_one({
            '_id': mongomock.ObjectId.from_datetime(datetime.datetime(2022, 3, 21)),
            'score': 3,
            'feedback': 'my text',
            'userId': 'user has a score',
        })
        response = self.app.get(
            '/api/eval/feedback/export?token=blabla&data=%7B"after"%3A"2022-01-01T12:00:00Z"%7D')
        self.assertEqual(200, response.status_code)
        self.assertIn('my text,3,user has a score', response.get_data(as_text=True))


if __name__ == '__main__':
    unittest.main()
