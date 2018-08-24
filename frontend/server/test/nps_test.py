"""Unit tests for the module TODO: module name."""

import unittest
from urllib import parse

import mock
import requests_mock

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.test import base_test


class NPSSurveyEndpointTestCase(base_test.ServerTestCase):
    """Tests for the /api/user/nps-survey-response endpoint."""

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='')
    def test_set_nps_survey_response(self):
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
            data='{{"email": "{}", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}'.format(user_email),
            content_type='application/json')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

        # Simulate when one team member curates 'which_advices_were_useful_comment' to normalize it
        # in 'curated_useful_advice_ids'.
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{{"email": "{}", "curatedUsefulAdviceIds":["improve-resume"]}}'
            .format(user_email),
            content_type='application/json')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))

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
    def test_set_nps_survey_response_wrong_email(self):
        """Testing /api/user/<user_email>/nps-survey-response with wrong user email."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)

        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{"email": "otherfoo@bar.fr", "score": 10}',
            content_type='application/json')
        self.assertEqual(404, response.status_code, response.get_data(as_text=True))

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_missing_auth(self):
        """Endpoint protected and no auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{{"email": "{}", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}'.format(user_email),
            content_type='application/json')
        self.assertEqual(401, response.status_code)

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_wrong_auth(self):
        """Endpoint protected and wrong auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{{"email": "{}", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}'.format(user_email),
            content_type='application/json',
            headers={'Authorization': 'wrong-token'})
        self.assertEqual(403, response.status_code)

    @mock.patch(auth.__name__ + '._ADMIN_AUTH_TOKEN', new='cryptic-admin-auth-token-123')
    def test_set_nps_survey_response_correct_auth(self):
        """Endpoint protected and correct auth token sent"."""

        user_email = 'foo@bar.fr'
        self.create_user(email=user_email)
        response = self.app.post(
            '/api/user/nps-survey-response',
            data='{{"email": "{}", "score": 10, "wereAdvicesUsefulComment": "So\\ncool!",'
            '"whichAdvicesWereUsefulComment": "The CV tip",'
            '"generalFeedbackComment": "RAS"}}'.format(user_email),
            content_type='application/json',
            headers={'Authorization': 'cryptic-admin-auth-token-123'})
        self.assertEqual(200, response.status_code)


class NPSUpdateTestCase(base_test.ServerTestCase):
    """Unit tests for the /api/nps endpoints"""

    def setUp(self):  # pylint: disable=invalid-name
        """Create a user and get its nps auth token."""

        super(NPSUpdateTestCase, self).setUp()
        self.user_id, self.auth_token = self.create_user_with_token()
        self.nps_auth_token = auth.create_token(self.user_id, role='nps')

    def test_set_nps_and_redirect(self):
        """Set the NPS score and redirect to end of survey."""

        response = self.app.get('/api/nps', query_string={
            'redirect': 'https://typeform.com/abcde',
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        self.assertEqual(302, response.status_code)
        self.assertTrue(
            response.location.startswith('https://typeform.com/abcde'),
            msg=response.location)
        redirect_url = parse.urlparse(response.location)
        redirect_args = dict(parse.parse_qsl(redirect_url.query))
        self.assertEqual(
            {'token': self.nps_auth_token, 'user': self.user_id, 'score': '8'},
            redirect_args)

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse').get('score'))

    def test_set_nps_no_redirect(self):
        """Set the NPS but do not redirect."""

        response = self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        self.assertEqual(200, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse').get('score'))

    def test_bad_score_format(self):
        """The score parameter is not an int."""

        response = self.app.get('/api/nps', query_string={
            'score': 'eight',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })
        self.assertEqual(422, response.status_code)
        self.assertIn('Paramètre score invalide', response.get_data(as_text=True))

    def test_score_too_high(self):
        """The score parameter is bigger than 10."""

        response = self.app.get('/api/nps', query_string={
            'score': '100',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })
        self.assertEqual(422, response.status_code)
        self.assertIn('Paramètre score invalide', response.get_data(as_text=True))

    def test_wrong_auth_token(self):
        """Wrong auth token."""

        response = self.app.get('/api/nps', query_string={
            'score': '100',
            'token': self.nps_auth_token + '0',
            'user': self.user_id,
        })
        self.assertEqual(403, response.status_code)
        self.assertIn('Accès non autorisé', response.get_data(as_text=True))

    def test_set_nps_comment_with_wrong_token(self):
        """Try to set the NPS score then comment but with wrong token."""

        response = self.app.post(
            '/api/nps',
            data='{{"userId": "{}", "comment": "My own comment"}}'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})
        self.assertEqual(403, response.status_code)

    def test_set_nps_comment(self):
        """Set the NPS score then comment."""

        self.app.get('/api/nps', query_string={
            'score': '8',
            'token': self.nps_auth_token,
            'user': self.user_id,
        })

        response = self.app.post(
            '/api/nps',
            data='{{"userId": "{}", "comment": "My own comment"}}'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})
        self.assertEqual(200, response.status_code)
        self.assertFalse(response.get_data(as_text=True))

        user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(8, user.get('netPromoterScoreSurveyResponse').get('score'))
        self.assertEqual(
            'My own comment',
            user.get('netPromoterScoreSurveyResponse').get('generalFeedbackComment'))

    # TODO(cyrille): Externalize in own module (or add PR to requests_mock).
    def _match_request_data(self, request):
        self.assertEqual(
            ':mega: [NPS Score: 0] ObjectId("{}")\n> This is a bad comment'.format(self.user_id),
            request.json().get('text', ''))
        return True

    @mock.patch(base_test.server.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    @requests_mock.mock()
    def test_nps_zero_score_and_comment(self, mock_requests):
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
            data='{{"userId": "{}", "comment": "This is a bad comment"}}'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.nps_auth_token})
        self.assertEqual(200, response.status_code)
        self.assertFalse(response.get_data(as_text=True))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
