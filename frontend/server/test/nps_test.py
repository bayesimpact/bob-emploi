"""Unit tests for the module TODO: module name."""

import unittest
from unittest import mock
from urllib import parse

import requests_mock

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test


class NPSSurveyEndpointTestCase(base_test.ServerTestCase):
    """Tests for the /api/user/nps-survey-response endpoint."""

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='')
    def test_set_nps_survey_response(self) -> None:
        """Calls to "/api/user/<user_email>/nps-survey-response"."""

        user_email = 'foo@bar.fr'
        user_id, auth_token = self.create_user_with_token(email=user_email)
        old_user_data = self.get_user_info(user_id, auth_token)
        # Make sure we actually have some fields in the user data, as we will check later
        # that old fields are not overridden.
        self.assertTrue(old_user_data)

        # Simulate when the user fills the survey.
        response = self.app.post(
            '/api/user/nps-survey-response',
            data=f'{{"email": "{user_email}", "score": 10, '
            '"wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}',
            content_type='application/json')
        self.assertEqual(204, response.status_code, response.get_data(as_text=True))

        # Simulate when one team member curates 'which_advices_were_useful_comment' to normalize it
        # in 'curated_useful_advice_ids'.
        response = self.app.post(
            '/api/user/nps-survey-response',
            data=f'{{"email": "{user_email}", "curatedUsefulAdviceIds":["improve-resume"]}}',
            content_type='application/json')
        self.assertEqual(204, response.status_code, response.get_data(as_text=True))

        # Check the data was correctly saved in the database.
        new_user_data = self.get_user_info(user_id, auth_token)
        nps_survey_response = new_user_data.pop('netPromoterScoreSurveyResponse', None)
        other_fields_in_new_user_data = new_user_data
        self.assertEqual({
            'score': 10,
            'wereAdvicesUsefulComment': 'So\ncool!',
            'whichAdvicesWereUsefulComment': 'The CV tip',
            'generalFeedbackComment': 'RAS',
            'curatedUsefulAdviceIds': ['improve-resume'],
        }, nps_survey_response)

        # Check that we did not override any other field than netPromoterScoreSurveyResponse.
        self.assertEqual(old_user_data, other_fields_in_new_user_data)

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='')
    def test_set_nps_survey_response_wrong_email(self) -> None:
        """Testing /api/user/<user_email>/nps-survey-response with wrong user email."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)

        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "otherfoo@bar.fr", "score": 10}',
            content_type='application/json')
        self.assertEqual(404, response.status_code, response.get_data(as_text=True))

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_missing_auth(self) -> None:
        """Endpoint protected and no auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data=f'{{"email": "{user_email}", "score": 10, '
            '"wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}',
            content_type='application/json')
        self.assertEqual(401, response.status_code)

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_wrong_auth(self) -> None:
        """Endpoint protected and wrong auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data=f'{{"email": "{user_email}", "score": 10, '
            '"wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}',
            content_type='application/json',
            headers={'Authorization': 'wrong-token'})
        self.assertEqual(403, response.status_code)

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_correct_auth(self) -> None:
        """Endpoint protected and correct auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data=f'{{"email": "{user_email}", "score": 10,"wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}',
            content_type='application/json',
            headers={'Authorization': 'cryptic-admin-auth-token-123'})
        self.assertEqual(204, response.status_code)


class NPSUpdateTestCase(base_test.ServerTestCase):
    """Unit tests for the /api/nps endpoints"""

    def setUp(self) -> None:
        """Create a user and get its nps auth token."""

        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token()
        self.nps_auth_token = auth.create_token(self.user_id, role='nps')

    def test_set_nps_and_redirect(self) -> None:
        """Set the NPS score and redirect to end of survey."""

        response = self.app.get('/api/nps', query_string={
            'redirect': 'https://typeform.com/abcde',
            'score': '8',
            'token': self.nps_auth_token,
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
            {'token': self.nps_auth_token, 'user': self.user_id, 'score': '8'},
            redirect_args)

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse', {}).get('score'))

    def test_set_nps_no_redirect(self) -> None:
        """Set the NPS but do not redirect."""

        response = self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        self.assertEqual(200, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse', {}).get('score'))

    def test_bad_score_format(self) -> None:
        """The score parameter is not an int."""

        response = self.app.get('/api/nps', query_string={
            'score': 'eight',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })
        self.assertEqual(422, response.status_code)
        self.assertIn('Paramètre score invalide', response.get_data(as_text=True))

    def test_score_too_high(self) -> None:
        """The score parameter is bigger than 10."""

        response = self.app.get('/api/nps', query_string={
            'score': '100',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })
        self.assertEqual(422, response.status_code)
        self.assertIn('Paramètre score invalide', response.get_data(as_text=True))

    def test_wrong_auth_token(self) -> None:
        """Wrong auth token."""

        response = self.app.get('/api/nps', query_string={
            'score': '100',
            'token': self.nps_auth_token + '0',
            'user': self.user_id,
        })
        self.assertEqual(403, response.status_code)
        self.assertIn('Accès non autorisé', response.get_data(as_text=True))

    def test_set_nps_comment_with_wrong_token(self) -> None:
        """Try to set the NPS score then comment but with wrong token."""

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId": "{self.user_id}", "comment": "My own comment"}}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        self.assertEqual(403, response.status_code)

    def test_set_nps_comment(self) -> None:
        """Set the NPS score then comment."""

        self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId": "{self.user_id}", "comment": "My own comment", "selfDiagnostic":'
            '{"categoryId": "this_one", "status": "KNOWN_SELF_DIAGNOSTIC"},'
            '"hasActionsIdea": "FALSE"}',
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})
        self.assertEqual(204, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse', {}).get('score'))
        self.assertEqual(
            'My own comment',
            user.get('netPromoterScoreSurveyResponse', {}).get('generalFeedbackComment'))
        self.assertEqual(
            {'categoryId': 'this_one', 'status': 'KNOWN_SELF_DIAGNOSTIC'},
            user.get('netPromoterScoreSurveyResponse', {}).get('npsSelfDiagnostic'))
        self.assertEqual('FALSE', user['netPromoterScoreSurveyResponse'].get('hasActionsIdea'))

    def test_set_nps_next_actions(self) -> None:
        """Set the NPS score then the next actions."""

        self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId":"{self.user_id}","nextActions":["sleep","eat","code","repeat"]}}',
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})
        self.assertEqual(204, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse', {}).get('score'))
        self.assertEqual(
            ['sleep', 'eat', 'code', 'repeat'],
            user.get('netPromoterScoreSurveyResponse', {}).get('nextActions'))

    # TODO(cyrille): Externalize in own module (or add PR to requests_mock).
    def _match_request_data(self, request: 'requests_mock._RequestObjectProxy') -> bool:
        self.assertEqual(
            ':mega: [NPS Score: 0] '
            f'<http://localhost/eval?userId={self.user_id}|{self.user_id}>\n> '
            'This is a bad comment',
            request.json().get('text', ''))
        return True

    @mock.patch(base_test.server.user.__name__ + '._SLACK_WEBHOOK_URL', new='slack://bob-bots')
    @requests_mock.mock()
    def test_nps_zero_score_and_comment(self, mock_requests: requests_mock.Mocker) -> None:
        """Set the NPS score to 0 then comment"""

        mock_requests.post(
            'slack://bob-bots', request_headers={'Content-Type': 'application/json'},
            additional_matcher=self._match_request_data)

        self.app.get('/api/nps', query_string={
            'score': '0',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId": "{self.user_id}", "comment": "This is a bad comment"}}',
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})
        self.assertEqual(204, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

    def test_set_nps_no_content(self) -> None:
        """Call the NPS API but without any content."""

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId": "{self.user_id}"}}',
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})

        self.assertEqual(204, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

    def test_set_nps_full_fields(self) -> None:
        """Call the NPS API with answers from the full NPS form."""

        self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        response = self.app.post(
            '/api/nps',
            data=f'{{"userId": "{self.user_id}", '
            '"answers": {"localMarketEstimate": 2, "email": "secret@example.com"}}',
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})

        self.assertEqual(204, response.status_code, msg=response.get_data(as_text=True))
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse', {}).get('score'))
        self.assertEqual(
            'LOCAL_MARKET_BAD',
            user.get('netPromoterScoreSurveyResponse', {}).get('localMarketEstimate'))
        self.assertFalse(user.get('netPromoterScoreSurveyResponse', {}).get('email'))


class NPSUserTests(base_test.ServerTestCase):
    """Unit tests for the /api/nps/user endpoint"""

    def test_get_user(self) -> None:
        """Get user info."""

        user_id = self.create_user_with_token(data={
            'profile': {'name': 'Pascale', 'gender': 'FEMININE'},
            'projects': [{
                'city': {'name': 'Lyon'},
                'createdAt': '2017-05-31T19:25:01Z',
                'targetJob': {'name': 'CTO'}}]})[0]
        nps_auth_token = auth.create_token(user_id, role='nps')

        response = self.app.get(
            f'/api/nps/user/{user_id}',
            headers={'Authorization': 'Bearer ' + nps_auth_token})

        user = self.json_from_response(response)
        self.assertEqual(
            {
                'profile': {'gender': 'FEMININE'},
                'projects': [{
                    'city': {'name': 'Lyon'},
                    'targetJob': {'name': 'CTO'},
                }],
            },
            user)


if __name__ == '__main__':
    unittest.main()
