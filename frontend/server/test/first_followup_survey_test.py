"""Unit tests for First Followup Survey server endpoints."""

import unittest
from urllib import parse

from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server.test import base_test


class FFSRedirectUpdateTestCase(base_test.ServerTestCase):
    """Unit tests for the /api/first-followup-survey endpoint"""

    def setUp(self) -> None:
        """Create a user and get its FFS auth token."""

        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token()
        self.ffs_auth_token = auth_token.create_token(self.user_id, role='first-followup-survey')

    def test_set_ffs_and_redirect(self) -> None:
        """Set the first answer and redirect to end of survey."""

        response = self.app.get('/api/first-followup-survey', query_string={
            'redirect': 'https://typeform.com/abcde',
            'answer': 'yes',
            'token': self.ffs_auth_token,
            'user': self.user_id,
        })

        self.assertEqual(302, response.status_code)
        assert response.location
        self.assertTrue(
            response.location.startswith('https://typeform.com/abcde'),
            msg=response.location)
        redirect_url = parse.urlparse(response.location)
        redirect_args = dict(parse.parse_qsl(redirect_url.query))
        self.assertEqual(
            {'token': self.ffs_auth_token, 'user': self.user_id, 'answer': 'yes'},
            redirect_args)

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertTrue(user.get('firstFollowupSurveyResponse', {}).get('hasTriedSomethingNew'))

    def test_wrong_auth_token(self) -> None:
        """Wrong auth token."""

        response = self.app.get('/api/first-followup-survey', query_string={
            'answer': '',
            'token': self.ffs_auth_token + '0',
            'user': self.user_id,
        })
        self.assertEqual(403, response.status_code)
        self.assertIn('Accès non autorisé', response.get_data(as_text=True))


class FFSAnswersEndpointTestCase(base_test.ServerTestCase):
    """Tests for the /api/user/.../first-followup-survey endpoint."""

    def setUp(self) -> None:
        """Create a user and get its FFS auth token."""

        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token()
        self.ffs_auth_token = auth_token.create_token(self.user_id, role='first-followup-survey')

    def test_set_ffs_response(self) -> None:
        """Set the FFS response"""

        response = self.app.post(
            f'/api/user/{self.user_id}/first-followup-survey',
            data='{"comment":"Yay!","newIdeasScore":4,"hasTriedSomethingNew":"TRUE"}',
            headers={'Authorization': f'Bearer {self.ffs_auth_token}'},
            content_type='application/json')
        self.assertEqual(204, response.status_code)

        updated_user_data = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(
            {'comment': 'Yay!', 'hasTriedSomethingNew': True, 'newIdeasScore': 4},
            updated_user_data.get('firstFollowupSurveyResponse'))


if __name__ == '__main__':
    unittest.main()
