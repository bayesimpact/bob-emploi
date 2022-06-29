"""Tests for the server module."""

import datetime
import json
import os
import typing
from typing import Any, Tuple
import unittest
from unittest import mock
from urllib import parse

import requests_mock

from bob_emploi.common.python import now
from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import auth_token as token
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock

# pylint: disable=too-many-lines

_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')
_EMPTY_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/empty.json')


class OtherEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the other small endpoints."""

    def test_health_check(self) -> None:
        """Basic call to "/"."""

        response = self.app.get('/')
        self.assertEqual(200, response.status_code)

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_english_message(self) -> None:
        """Test translation of server messages"""

        response = self.app.get('/')
        self.assertEqual('Serveur opérationnel', response.get_data(as_text=True))

        response_en = self.app.get('/', headers={'Accept-Language': 'nl,en,fr'})
        self.assertEqual('Up and running', response_en.get_data(as_text=True))

    @mock.patch('logging.exception')
    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _EMPTY_TRANSLATIONS_FILE})
    def test_missing_english_message(self, mock_log_exception: mock.MagicMock) -> None:
        """Test missing translation of server messages"""

        self.app.get('/', headers={'Accept-Language': 'nl,en,fr'})
        mock_log_exception.assert_called_once()
        self.assertIn('Falling back to French', mock_log_exception.call_args[0][0])
        self.assertEqual('Serveur opérationnel', str(mock_log_exception.call_args[0][1]))

    def _create_user_joe_the_cheminot(self) -> Tuple[str, str]:
        """Joe is a special user used to analyse feedback."""

        user_data = {
            'profile': {'name': 'Joe'},
            'projects': [
                {'projectId': 'another-id', 'title': "Cultivateur d'escargots à Lyon"},
                {'projectId': 'pid', 'title': 'Cheminot à Caen', 'seniority': 1},
                {'projectId': 'last-id', 'title': 'Polénisateur à Brest', 'seniority': 2}],
        }
        return self.create_user_with_token(data=user_data, email='foo@bar.fr')

    def test_feedback(self) -> None:
        """Basic call to "/api/feedback"."""

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data=f'{{"userId": "{user_id}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(204, response.status_code)
        self.assertEqual(
            ['Aaaaaaaaaaaaawesome!\nsecond line'],
            [d.get('feedback') for d in self._user_db.feedbacks.find()])

    def test_feedback_no_user(self) -> None:
        """Testing /api/feedback with missing user ID."""

        self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data='{"feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "pid", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(204, response.status_code)

    def test_feedback_wrong_user(self) -> None:
        """Testing /api/feedback with wrong user ID, this should fail."""

        auth_token = self._create_user_joe_the_cheminot()[1]

        response = self.app.post(
            '/api/feedback',
            data='{"userId": "baduserid", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(403, response.status_code)

    def test_feedback_missing_project(self) -> None:
        """Testing /api/feedback with missing project ID but correct user ID."""

        user_id, auth_token = self._create_user_joe_the_cheminot()

        response = self.app.post(
            '/api/feedback',
            data=f'{{"userId": "{user_id}", "feedback": "Aaaaaaaaaaaaawesome!\\nsecond line",'
            '"adviceId": "one-advice", "projectId": "", "source": "ADVICE_FEEDBACK"}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(204, response.status_code)

    def test_send_upskilling_feedback(self) -> None:
        """Test sending user feedback from upskilling."""

        response = self.app.post(
            '/api/feedback',
            data='{"feedback": "Yihaa, Jobflix is great!", "source": "UPSKILLING_FEEDBACK"}',
            content_type='application/json')
        self.assertEqual(204, response.status_code)

    @nowmock.patch()
    def test_usage_stats(self, mock_now: mock.MagicMock) -> None:
        """Testing /api/usage/stats endpoint."""

        self._user_db.user.insert_many([
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2016-11-01T12:00:00Z'},
            {'registeredAt': '2017-06-03T12:00:00Z'},
            {'registeredAt': '2017-06-03T13:00:00Z'},
            {
                'registeredAt': '2017-06-04T12:00:00Z',
                'featuresEnabled': {'excludeFromAnalytics': True},
            },
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 5}}]},
            {'registeredAt': '2017-06-10T11:00:00Z', 'projects': [{'feedback': {'score': 2}}]},
            {
                'registeredAt': '2017-06-10T11:00:00Z',
                'projects': [{'diagnostic': {'categoryId': 'this_cat'}, 'feedback': {'score': 2}}],
                'featuresEnabled': {'excludeFromAnalytics': True},
            },
            {
                'registeredAt': '2017-06-11T11:00:00Z',
                'projects': [{'diagnostic': {'categoryId': 'this_cat'}}],
            },
            {
                'registeredAt': '2017-06-11T11:00:00Z',
                'projects': [{'diagnostic': {'categoryId': 'this_cat'}}],
            },
        ])
        mock_now.return_value = datetime.datetime(
            2017, 6, 10, 12, 30, tzinfo=datetime.timezone.utc)

        response = self.app.get('/api/usage/stats')
        self.assertEqual(
            {
                'mainChallengeCounts': {'this_cat': 2},
                'totalUserCount': 8,
                'weeklyNewUserCount': 3,
            },
            self.json_from_response(response))

    def test_redirect_eterritoire(self) -> None:
        """Check the /api/redirect/eterritoire endpoint."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69123')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr/lyon/69123', response.location)

    def test_redirect_eterritoire_missing(self) -> None:
        """Check the /api/redirect/eterritoire endpoint for missing city."""

        self._db.eterritoire_links.insert_one({
            '_id': '69123',
            'path': '/lyon/69123',
        })

        response = self.app.get('/api/redirect/eterritoire/69006')
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://www.eterritoire.fr', response.location)

    def test_compute_advices_for_missing_project(self) -> None:
        """Check the /api/project/compute-advices endpoint without projects."""

        response = self.app.post(
            '/api/project/compute-advices', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_compute_advices_for_project(self) -> None:
        """Check the /api/project/compute-advices endpoint."""

        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-advices',
            data='{"projects": [{}]}', content_type='application/json')
        advice = self.json_from_response(response)
        self.assertEqual({'advices': [{'adviceId': 'one-ring', 'numStars': 1}]}, advice)

    def test_compute_actions_for_missing_project(self) -> None:
        """Check the /api/project/compute-actions endpoint without projects."""

        response = self.app.post(
            '/api/project/compute-actions', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_compute_actions_for_project(self) -> None:
        """Check the /api/project/compute-actions endpoint."""

        self._db.action_templates.drop()
        self._db.action_templates.insert_one({
            'actionTemplateId': 'one-ring',
            'duration': 'ONE_HOUR',
            'triggerScoringModel': 'constant(1)',
        })
        response = self.app.post(
            '/api/project/compute-actions',
            data='{"projects": [{}]}', content_type='application/json')
        advice = self.json_from_response(response)
        self.assertEqual(
            {'actions': [{
                'actionId': 'one-ring',
                'duration': 'ONE_HOUR',
                'status': 'ACTION_UNREAD',
            }]},
            advice)

    def test_compute_all_for_project(self) -> None:
        """Check the /api/project/compute-all endpoint."""

        self._db.diagnostic_main_challenges.insert_many([
            {
                'categoryId': 'stuck-market',
                'filters': ['for-job-group(A1234)'],
                'order': 1,
            },
            {
                'categoryId': 'bravo',
                'strategiesIntroduction': 'Voici vos stratégies',
                'order': 2,
            },
        ])
        self._db.diagnostic_overall.insert_one({
            'categoryId': 'stuck-market',
            'score': 50,
            'sentenceTemplate': 'Marché bouché',
            'textTemplate': 'Vous devriez réfléchir à votre métier',
        })
        self._db.advice_modules.insert_one({
            'adviceId': 'one-ring',
            'isReadyForProd': True,
            'triggerScoringModel': 'for-departement(31)',
        })
        self._db.strategy_modules.insert_one({
            'categoryIds': ['stuck-market'],
            'strategyId': 'application-method',
            'triggerScoringModel': 'constant(1)',
            'title': 'Un titre',
            'descriptionTemplate': 'Vous êtes fait·e pour cette stratégie',
        })
        self._db.strategy_advice_templates.insert_one({
            'adviceId': 'one-ring',
            'strategyId': 'application-method',
        })
        user = {'projects': [{
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'city': {'departementId': '31'},
        }]}
        response = self.app.post(
            '/api/project/compute-all', data=json.dumps(user), content_type='application/json')
        computed_user = self.json_from_response(response)
        self.assertEqual(1, len(computed_user.get('projects', [])))
        project = computed_user['projects'][0]
        self.assertTrue(project.get('diagnostic'))
        diagnostic = project['diagnostic']
        self.assertEqual('stuck-market', diagnostic.get('categoryId'))
        categories = diagnostic.get('categories', [])
        self.assertEqual(2, len(categories), msg=categories)
        self.assertIn('stuck-market', [c.get('categoryId') for c in categories])
        self.assertTrue(project.get('strategies', []))
        strategy_advice_ids = {
            a.get('adviceId') for a in project['strategies'][0].get('piecesOfAdvice', [])}
        self.assertTrue(strategy_advice_ids)
        all_advice_ids = {
            a.get('adviceId') for a in project.get('advices', [])}
        self.assertFalse(strategy_advice_ids - all_advice_ids)

    def test_generate_tokens(self) -> None:
        """Check the /api/user/.../generate-auth-tokens."""

        user_id, auth_token = self.create_user_with_token(email='pascal@example.com')
        response = self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token})
        tokens = self.json_from_response(response)
        self.assertEqual(
            {
                'auth', 'authUrl', 'employmentStatus', 'employmentStatusUrl', 'nps', 'npsUrl',
                'reset', 'resetUrl', 'settings', 'settingsUrl', 'unsubscribe', 'unsubscribeUrl',
                'user', 'emails', 'ffs', 'ffsUrl',
            }, tokens.keys())
        token.check_token(user_id, tokens['unsubscribe'], role='unsubscribe')
        token.check_token(user_id, tokens['employmentStatus'], role='employment-status')
        token.check_token(user_id, tokens['nps'], role='nps')
        token.check_token(user_id, tokens['ffs'], role='first-followup-survey')
        token.check_token(user_id, tokens['settings'], role='settings')
        token.check_token(user_id, tokens['auth'], role='')
        token.check_token(user_id, tokens['emails'], role='emails')
        self.assertEqual({
            'authToken': tokens['auth'],
            'userId': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['authUrl']).query)))
        self.assertEqual({
            'token': tokens['employmentStatus'],
            'user': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['employmentStatusUrl']).query)))
        self.assertEqual({
            'token': tokens['nps'],
            'user': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['npsUrl']).query)))
        self.assertEqual({
            'token': tokens['ffs'],
            'user': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['ffsUrl']).query)))
        self.assertEqual({
            'auth': tokens['settings'],
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
            'user': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['settingsUrl']).query)))
        self.assertEqual({
            'auth': tokens['unsubscribe'],
            'user': user_id,
        }, dict(parse.parse_qsl(parse.urlparse(tokens['unsubscribeUrl']).query)))
        # Try reset token as auth token.
        response = self.app.post(
            '/api/user/authenticate',
            data=f'{{"email":"pascal@example.com","userId":"{user_id}",'
            f'"authToken":"{tokens["reset"]}","hashedPassword":"dummy"}}')
        self.assertEqual(200, response.status_code)
        self.assertEqual({
            'email': 'pascal@example.com',
            'resetToken': tokens['reset'],
        }, dict(parse.parse_qsl(parse.urlparse(tokens['resetUrl']).query)))
        self.assertEqual(user_id, tokens['user'])

    def test_generate_tokens_facebook(self) -> None:
        """Check the /api/user/.../generate-auth-tokens for a Facebook user."""

        user_id, auth_token = self.create_facebook_user_with_token('pascal@example.com')
        response = self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token})
        tokens = self.json_from_response(response)
        self.assertEqual(
            {
                'auth', 'authUrl', 'employmentStatus', 'employmentStatusUrl', 'nps', 'npsUrl',
                'settings', 'settingsUrl', 'unsubscribe', 'unsubscribeUrl', 'user', 'emails',
                'ffs', 'ffsUrl',
            }, tokens.keys())
        token.check_token(user_id, tokens['unsubscribe'], role='unsubscribe')
        token.check_token(user_id, tokens['employmentStatus'], role='employment-status')
        token.check_token(user_id, tokens['nps'], role='nps')
        token.check_token(user_id, tokens['ffs'], role='first-followup-survey')
        token.check_token(user_id, tokens['settings'], role='settings')
        token.check_token(user_id, tokens['auth'], role='')
        self.assertEqual(user_id, tokens['user'])

    def test_generate_tokens_missing_auth(self) -> None:
        """Check that the /api/user/.../generate-auth-tokens is protected."""

        user_id, unused_auth_token = self.create_user_with_token(email='pascal@example.com')
        self.app.cookie_jar.clear()
        response = self.app.get(f'/api/user/{user_id}/generate-auth-tokens')
        self.assertEqual(401, response.status_code)

    def test_diagnose_missing_project(self) -> None:
        """Check the /api/project/diagnose endpoint without projects."""

        response = self.app.post(
            '/api/project/diagnose', data='{}', content_type='application/json')
        self.assertEqual(422, response.status_code)

    def test_diagnose_for_project(self) -> None:
        """Check the /api/project/diagnose endpoint."""

        self._db.diagnostic_main_challenges.insert_many([
            {
                'categoryId': 'bravo',
                'strategiesIntroduction': 'Voici vos stratégies',
                'order': 2,
            },
        ])
        self._db.diagnostic_overall.insert_one({
            'categoryId': 'bravo',
            'score': 50,
            'sentenceTemplate': 'Manque de précision dans votre recherche',
            'textTemplate': 'Vous devriez réfléchir à vos méthodes',
        })
        response = self.app.post(
            '/api/project/diagnose',
            data='{"projects": [{}]}', content_type='application/json')
        diagnostic = self.json_from_response(response)
        self.assertEqual(
            {'categories', 'categoryId', 'overallScore', 'overallSentence', 'text'},
            set(diagnostic.keys()))

    @nowmock.patch()
    def test_simulate_focus_emails(self, mock_now: mock.MagicMock) -> None:
        """Check the simulate focus emails endpoint."""

        self._db.focus_emails.insert_many([
            {'campaignId': 'galita-1'},
            {'campaignId': 'galita-2'},
            {'campaignId': 'galita-3'},
            {'campaignId': 'focus-body-language'},
            {'campaignId': 'focus-self-develop'},
        ])
        mock_now.return_value = datetime.datetime(2019, 11, 27, 15, 24)
        response = self.app.post(
            '/api/emails/simulate',
            data='{"profile": {"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"],'
            '"name":"Maxime"},"projects":[{"jobSearchStartedAt":"2019-06-25T12:00:00Z"}]}',
            content_type='application/json')
        emails = self.json_from_response(response)
        self.assertEqual({'emailsSent'}, emails.keys())
        self.assertGreaterEqual(len(emails['emailsSent']), 2, msg=emails['emailsSent'])
        self.assertIn(
            'T09:00', emails['emailsSent'][0]['sentAt'], msg='Focus emails should be sent at 9AM')
        self.assertGreater(emails['emailsSent'][0]['sentAt'], '2019-11-29')
        self.assertLess(emails['emailsSent'][0]['sentAt'], '2019-12-10')
        self.assertGreater(emails['emailsSent'][1]['sentAt'], '2019-12-02')
        self.assertLess(emails['emailsSent'][1]['sentAt'], '2019-12-17')
        self.assertIn(emails['emailsSent'][0]['subject'], {
            "Qu'est-ce qui vous donne de l'énergie, Maxime\xa0?",
            "Une petite vidéo que j'aimerais vous partager",
            "Un article qui m'a fait penser à vous",
            '🤔 Arrêtez de vous demander ce que vous voulez faire',
            "💪 L'article qui m'a appris à oser",
        })

    @nowmock.patch()
    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_simulate_focus_emails_i18n(self, mock_now: mock.MagicMock) -> None:
        """Check the simulate focus emails endpoint in a different locale."""

        self._db.focus_emails.insert_many([
            {'campaignId': 'galita-1'},
            {'campaignId': 'galita-2'},
            {'campaignId': 'galita-3'},
            {'campaignId': 'focus-body-language'},
        ])
        mock_now.return_value = datetime.datetime(2019, 11, 27, 15, 24)
        response = self.app.post(
            '/api/emails/simulate',
            data='{"profile": {"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"],'
            '"locale": "fr@tu"}}',
            content_type='application/json')
        emails = self.json_from_response(response)
        self.assertIn(emails['emailsSent'][0]['subject'], {
            "Une petite vidéo que j'aimerais te partager",
            "Un article qui m'a fait penser à toi",
            '🤔 Arrête de te demander ce que tu veux faire',
            "💪 L'article qui m'a appris à oser",
        })

    @requests_mock.mock()
    def test_get_user_email_content(self, mock_requests: requests_mock.Mocker) -> None:
        """Check getting the content of an email for a user."""

        mock_requests.get('https://api.mailjet.com/v3/REST/template/100819/detailcontent', json={
            'Count': 1,
            'Data': [{
                'Html-part': '<html>Content of the NPS email</html>',
                'Text-part': 'Content of the NPS email in full text',
                'Headers': {
                    'SenderEmail': 'pascal@example.com',
                    'Subject': 'This is the NPS',
                },
            }],
        })
        user_id, auth_token = self.create_user_with_token(email='pascal@bayes.org')
        response = self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token})
        emails_token = self.json_from_response(response)['emails']

        response = self.app.get(
            f'/api/user/{user_id}/emails/content/nps?token={emails_token}')
        self.assertEqual(200, response.status_code)
        self.assertEqual('<html>Content of the NPS email</html>', response.get_data(as_text=True))

    def test_get_email_content_not_a_campaign(self) -> None:
        """Getting the content of a campaign that does not exist."""

        user_id, auth_token = self.create_user_with_token(email='pascal@bayes.org')
        response = self.app.get(
            f'/api/user/{user_id}/generate-auth-tokens',
            headers={'Authorization': 'Bearer ' + auth_token})
        emails_token = self.json_from_response(response)['emails']
        response = self.app.get(
            f'/api/user/{user_id}/emails/content/campaign-mispelled?token={emails_token}')
        self.assertEqual(404, response.status_code)
        self.assertIn('Campagne campaign-mispelled inconnue', response.get_data(as_text=True))

    @requests_mock.mock()
    def test_get_email_content(self, mock_requests: requests_mock.Mocker) -> None:
        """Check getting the content of an email."""

        mock_requests.get('https://api.mailjet.com/v3/REST/template/277304/detailcontent', json={
            'Data': [{
                'Html-part': '<html>Content of the NPS email for {{var:firstName}}</html>',
                'Text-part': 'Content of the NPS email in full text',
            }],
        })
        user_data = parse.quote(json.dumps({'profile': {
            'frustrations': ['INTERVIEW'],
            'name': 'Pascal',
        }}))
        response = self.app.get(f'/api/emails/content/focus-body-language?data={user_data}')
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            '<html>Content of the NPS email for Pascal</html>', response.get_data(as_text=True))

    def test_get_email_content_not_availabe(self) -> None:
        """Getting the content of a campaign which is not available for the given user."""

        user_data = parse.quote(json.dumps({'profile': {'frustrations': []}}))
        response = self.app.get(f'/api/emails/content/focus-body-language?data={user_data}')
        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Campagne focus-body-language non disponible', response.get_data(as_text=True))

    @requests_mock.mock()
    def test_get_email_mailjet_failure(self, mock_requests: requests_mock.Mocker) -> None:
        """Getting the content of an email with an error on Mailjet."""

        mock_requests.get(
            'https://api.mailjet.com/v3/REST/template/277304/detailcontent',
            status_code=404)
        user_data = parse.quote(json.dumps({'profile': {'frustrations': ['INTERVIEW']}}))
        response = self.app.get(f'/api/emails/content/focus-body-language?data={user_data}')
        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Campagne focus-body-language non disponible', response.get_data(as_text=True))

    @requests_mock.mock()
    def test_get_email_content_secure_images(self, mock_requests: requests_mock.Mocker) -> None:
        """Check getting the content of an email."""

        mock_requests.get('https://api.mailjet.com/v3/REST/template/277304/detailcontent', json={
            'Data': [{
                'Html-part': '<html>This is <img src="http://r.bob-emploi.fr/image" /></html>',
            }],
        })
        user_data = parse.quote(json.dumps({'profile': {
            'frustrations': ['INTERVIEW'],
            'name': 'Pascal',
        }}))
        response = self.app.get(f'/api/emails/content/focus-body-language?data={user_data}')
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            '<html>This is '
            '<img src="http://localhost/api/image?src=http%3A//r.bob-emploi.fr/image" /></html>',
            response.get_data(as_text=True))


_FAKE_ID_TOKEN = {
    'iss': 'accounts.google.com',
    'email': 'pascal@bayesimpact.org',
    'sub': '12345',
}


@mailjetmock.patch()
@nowmock.patch(new=lambda: datetime.datetime(2019, 11, 27, 15, 24))
@mock.patch('google.oauth2.id_token.verify_oauth2_token', new=lambda *args: _FAKE_ID_TOKEN)
class SendEmailEndpointTest(base_test.ServerTestCase):
    """Unit tests for the send email endpoints."""

    def test_send_email_to_self(self) -> None:
        """Check the send email endpoint to self using Google auth."""

        response = self.app.post(
            '/api/emails/send/focus-body-language',
            data='{"profile": {"email": "pascal@bayesimpact.org",'
            '"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer google-tokens'})

        email_sent = self.json_from_response(response)
        self.assertEqual(
            {
                'sentAt', 'mailjetTemplate', 'campaignId',
                'mailjetMessageId', 'subject', 'isCoaching',
            },
            email_sent.keys())
        self.assertIn(
            '2019-11-27T15:24', email_sent['sentAt'], msg='Email should have been sent right away')

        messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(['pascal@bayesimpact.org'], [m.recipient['Email'] for m in messages])
        self.assertEqual(
            277304, messages[0].properties['TemplateID'],
            msg="mailjet_templates.MAP['focus-body-language']['mailjetTemplate']")

        self.assertFalse(self._eval_db.email_requests.count_documents({}))

    def test_send_email_to_other(self) -> None:
        """Check the send email endpoint to another email address using Google auth."""

        response = self.app.post(
            '/api/emails/send/focus-body-language',
            data='{"profile": {"email": "pascal@corpet.net",'
            '"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer google-tokens'})

        self.json_from_response(response)

        messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(['pascal@corpet.net'], [m.recipient['Email'] for m in messages])

        self.assertEqual(1, self._eval_db.email_requests.count_documents({}))
        email_request = self._eval_db.email_requests.find_one({}, {'_id': 0})
        self.assertEqual({
            'action': 'send',
            'email': 'pascal@corpet.net',
            'registeredAt': '2019-11-27T15:24:00Z',
            'requesterEmail': 'pascal@bayesimpact.org',
        }, email_request)

    def test_send_unknown_campaign(self) -> None:
        """Use the send email endpoint with an unknown campaign."""

        response = self.app.post(
            '/api/emails/send/not-a-campaign',
            data='{"profile": {"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer google-tokens'})

        self.assertEqual(404, response.status_code)
        self.assertIn('Campagne not-a-campaign inconnue', response.get_data(as_text=True))

    def test_send_unavailable_campaign(self) -> None:
        """Use the send email endpoint with a campaign unavailable for the user."""

        response = self.app.post(
            '/api/emails/send/focus-body-language',
            data='{"profile": {"email": "pascal@bayes.org"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer google-tokens'})

        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Campagne focus-body-language non disponible pour cet utilisateur',
            response.get_data(as_text=True))

    def test_send_email_no_address(self) -> None:
        """Check the send email endpoint but forgetting the recipient email address."""

        response = self.app.post(
            '/api/emails/send/focus-body-language',
            data='{"profile": {"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer google-tokens'})

        self.assertEqual(200, response.status_code)

        messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(['pascal@bayesimpact.org'], [m.recipient['Email'] for m in messages])
        self.assertEqual(
            277304, messages[0].properties['TemplateID'],
            msg="mailjet_templates.MAP['focus-body-language']['mailjetTemplate']")

        self.assertFalse(self._eval_db.email_requests.count_documents({}))

    def test_send_not_authorized(self) -> None:
        """Check the send email endpoint."""

        response = self.app.post(
            '/api/emails/send/focus-body-language',
            data='{"profile": {"email": "pascal@bayes.org",'
            '"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json')

        self.assertEqual(401, response.status_code)

    def test_send_to_self(self) -> None:
        """Check the send email endpoint."""

        user_id, auth_token = self.create_user_with_token(email='pascal@bayes.org')

        # Update user.
        self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{'
            '"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"],'
            '"email": "pascal@bayes.org"}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        # Send email.
        response = self.app.post(
            f'/api/user/{user_id}/emails/send/focus-body-language',
            headers={'Authorization': f'Bearer {auth_token}'})

        email_sent = self.json_from_response(response)
        self.assertEqual(
            {
                'sentAt', 'mailjetTemplate', 'campaignId',
                'mailjetMessageId', 'subject', 'isCoaching',
            },
            email_sent.keys())
        self.assertIn(
            '2019-11-27T15:24', email_sent['sentAt'], msg='Email should have been sent right away')

        messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(['pascal@bayes.org'], [m.recipient['Email'] for m in messages])
        self.assertEqual(
            277304, messages[0].properties['TemplateID'],
            msg="mailjet_templates.MAP['focus-body-language']['mailjetTemplate']")

        # Check that the user's proto was updated.
        user_proto = self.json_from_response(
            self.app.get(f'/api/user/{user_id}', headers={'Authorization': f'Bearer {auth_token}'}))

        emails_history = user_proto.get('emailsSent', [])
        self.assertTrue(emails_history)
        last_email = emails_history[-1]
        self.assertEqual('focus-body-language', last_email.get('campaignId'))

    def test_send_to_guest(self) -> None:
        """Check the send email endpoint from a guest user."""

        user_id, auth_token = self.create_guest_user()

        # Update user.
        self.app.post(
            '/api/user',
            data=f'{{"userId": "{user_id}", "profile": {{'
            '"frustrations": ["SELF_CONFIDENCE", "RESUME", "MOTIVATION"]}}',
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})

        # Send email.
        response = self.app.post(
            f'/api/user/{user_id}/emails/send/focus-body-language',
            headers={'Authorization': f'Bearer {auth_token}'})

        self.assertEqual(422, response.status_code)
        self.assertIn('Adresse email manquante', response.get_data(as_text=True))


@mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
class ListEmailEndpointTest(base_test.ServerTestCase):
    """Unit tests for the list email endpoints."""

    def test_list_all_campaigns(self) -> None:
        """Test listing all campaigns."""

        user_id, auth_token = self.create_user_with_token()
        response = self.app.get(
            f'/api/user/{user_id}/emails', headers={'Authorization': f'Bearer {auth_token}'})
        campaigns = self.json_from_response(response).get('campaigns', [])
        self.assertGreaterEqual(len(campaigns), 3, msg=campaigns)
        campaigns_by_id = {c.get('campaignId'): c for c in campaigns}
        self.assertEqual(len(campaigns), len(campaigns_by_id))
        self.assertIn('nps', campaigns_by_id)
        self.assertEqual(
            "J'aimerais votre avis sur Bob\u00a0!", campaigns_by_id['nps'].get('subject'))

    def test_list_all_campaigns_translated(self) -> None:
        """Test that campaign subjects are translated."""

        user_id, auth_token = self.create_user_with_token()
        user_info = self.get_user_info(user_id, auth_token)
        user_info['profile']['locale'] = 'fr@tu'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token}))

        response = self.app.get(
            f'/api/user/{user_id}/emails', headers={'Authorization': f'Bearer {auth_token}'})
        campaigns = self.json_from_response(response).get('campaigns', [])
        campaigns_by_id = {c.get('campaignId'): c for c in campaigns}
        self.assertEqual(
            "J'aimerais ton avis sur Bob\u00A0!", campaigns_by_id['nps'].get('subject'))


class ProjectRequirementsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the requirements endpoints."""

    def setUp(self) -> None:
        super(ProjectRequirementsEndpointTestCase, self).setUp()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'romeId': 'A1234',
            'requirements': {
                'extras': [{'name': 'foo'}],
                'diplomas': [{'name': 'bar'}],
            },
        })

    def test_unknown_job_group(self) -> None:
        """Test with an unknown job group."""

        response = self.app.get('/api/job/requirements/UNKNOWN_JOB_GROUP')
        self.assertEqual(200, response.status_code)
        self.assertEqual('{}', response.get_data(as_text=True))

    def test_job_requirements(self) -> None:
        """Test the endpoint using only the job group ID."""

        response = self.app.get('/api/job/requirements/A1234')
        requirements = self.json_from_response(response)
        self.assertEqual(set(['diplomas', 'extras']), set(requirements))
        # Point check.
        self.assertEqual('bar', requirements['diplomas'][0]['name'])


class JobApplicationModesEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the application modes endpoint."""

    def setUp(self) -> None:
        super(JobApplicationModesEndpointTestCase, self).setUp()
        self._db.job_group_info.insert_one({
            '_id': 'A1234',
            'romeId': 'A1234',
            'applicationModes': {'FAP1': {'modes': [
                {'mode': 'SPONTANEOUS_APPLICATION', 'percentage': 50},
                {'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS', 'percentage': 30},
                {'mode': 'PLACEMENT_AGENCY', 'percentage': 15},
                {'mode': 'OTHER_CHANNELS', 'percentage': 5},
            ]}},
        })

    def test_unknown_job_group(self) -> None:
        """Test with an unknown job group."""

        response = self.app.get('/api/job/application-modes/UNKNOWN_JOB_GROUP')
        self.assertEqual(404, response.status_code)

    def test_job_requirements(self) -> None:
        """Test the endpoint using only the job group ID."""

        response = self.app.get('/api/job/application-modes/A1234')
        job_group_info = self.json_from_response(response)
        # Point check.
        all_modes = job_group_info.get('applicationModes', {}).get('FAP1', {}).get('modes', [])
        self.assertEqual([50, 30, 15, 5], [mode.get('percentage') for mode in all_modes])


class ProjectAdviceTipsTestCase(base_test.ServerTestCase):
    """Unit tests for the /advice/tips endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'other-work-env',
            'isReadyForProd': True,
            'triggerScoringModel': 'constant(3)',
            'tipTemplateIds': ['tip1', 'tip2'],
        })
        self._db.tip_templates.insert_many([
            {
                '_id': 'tip1',
                'actionTemplateId': 'tip1',
                'title': 'First tip',
            },
            {
                '_id': 'tip2',
                'actionTemplateId': 'tip2',
                'title': 'Second tip',
            },
        ])
        self.add_translations([{
            'string': 'First tip_FEMININE',
            'fr': 'First tip for women',
        }])

        patcher = mailjetmock.patch()
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']
        user_info['projects'][0]['advices'][0]['status'] = 'ADVICE_ACCEPTED'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_bad_advice_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/tips/unknown-advice/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn(
            'Conseil &quot;unknown-advice&quot; inconnu.',
            response.get_data(as_text=True))

    def test_get_tips(self) -> None:
        """Test getting tips."""

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)

    @mock.patch('logging.exception')
    def test_tutoie_tips(self, mock_log_exception: mock.MagicMock) -> None:
        """Test getting translated tips as tutoiement."""

        self.add_translations([{
            'string': 'First tip',
            'fr@tu': 'Premier tip',
        }])
        self.app.get('/api/cache/clear')
        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['locale'] = 'fr@tu'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertFalse(mock_log_exception.called)

        self.assertEqual(
            ['Premier tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)

    @mock.patch('logging.exception')
    def test_translated_tips(self, mock_log_exception: mock.MagicMock) -> None:
        """Test getting translated tips."""

        self.add_translations([{
            'string': 'First tip',
            'nl': 'Eerste tip',
        }])
        self.app.get('/api/cache/clear')
        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['locale'] = 'nl'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        mock_log_exception.assert_called_once()
        self.assertIn('Falling back to French', mock_log_exception.call_args[0][0])

        self.assertEqual(
            ['Eerste tip', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)

    def test_feminine_tips(self) -> None:
        """Test getting genderized tips."""

        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['gender'] = 'FEMININE'
        self.json_from_response(self.app.post(
            '/api/user', data=json.dumps(user_info), content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))

        response = self.app.get(
            f'/api/advice/tips/other-work-env/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        advice_tips = self.json_from_response(response)

        self.assertEqual(
            ['First tip for women', 'Second tip'],
            [t.get('title') for t in advice_tips.get('tips', [])], msg=advice_tips)
        self.assertFalse(any([t.get('titleFeminine') for t in advice_tips.get('tips', [])]))


class CacheClearEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the cache/clear endpoint."""

    def _get_requirements(self, job_group_id: str) -> list[str]:
        response = self.app.get(f'/api/job/requirements/{job_group_id}')
        requirements = json.loads(response.get_data(as_text=True))
        return [d['name'] for d in requirements['diplomas']]

    def _update_job_group_db(self, data: list[dict[str, Any]]) -> None:
        self._db.job_group_info.drop()
        self._db.job_group_info.insert_many(data)

    def test_mongo_db_updated(self) -> None:
        """Test access to project/requirements after a MongoDB update."""

        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'diplomas': [
                {'name': '1234'},
                {'name': '1235'},
            ]},
        }])
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Update DB with new data.
        self._update_job_group_db([{
            '_id': 'A1234',
            'requirements': {'diplomas': [{'name': '6789'}]},
        }])

        # DB content is cached, no change.
        self.assertEqual(['1234', '1235'], self._get_requirements('A1234'))

        # Clear cache using the endpoint.
        response = self.app.get('/api/cache/clear')
        self.assertEqual(200, response.status_code)
        self.assertEqual('Cache serveur vidé.', response.get_data(as_text=True))

        # Updated DB content is now served.
        self.assertEqual(['6789'], self._get_requirements('A1234'))


@mailjetmock.patch()
class MigrateAdvisorEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the user/migrate-to-advisor endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_many([
            {
                'adviceId': 'spontaneous-application',
                'isReadyForProd': True,
                'triggerScoringModel': 'constant(3)',
            },
        ])

    def test_migrate_user(self) -> None:
        """Test a simple user migration."""

        user_id, auth_token = self.create_user_with_token([base_test.add_project], advisor=False)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))

    def test_migrate_user_already_in_advisor(self) -> None:
        """Test a user migration for a user already in advisor."""

        user_id, auth_token = self.create_user_with_token(advisor=True)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))

    def test_migrate_user_multiple_projects(self) -> None:
        """Test a migration for a user with multiple projects."""

        user_id, auth_token = self.create_user_with_token(
            [base_test.add_project, base_test.add_project], advisor=True)
        response = self.app.post(
            f'/api/user/{user_id}/migrate-to-advisor',
            headers={'Authorization': 'Bearer ' + auth_token})
        self.assertEqual(200, response.status_code)

        user_info = self.get_user_info(user_id, auth_token)
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisor'))
        self.assertFalse(user_info.get('featuresEnabled', {}).get('advisorEmail'))
        self.assertTrue(user_info.get('featuresEnabled', {}).get('switchedFromMashupToAdvisor'))
        self.assertTrue(user_info['projects'][0].get('advices'))


class JobsEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the jobs endpoint."""

    def test_unknown_job_group(self) -> None:
        """Get jobs for unknown job group."""

        response = self.app.get('/api/jobs/Z1234')
        self.assertEqual(404, response.status_code)

    def test_job_group(self) -> None:
        """Get all jobs info for a job group."""

        self._db.job_group_info.insert_one({
            '_id': 'C1234',
            'romeId': 'C1234',
            'name': 'unusedName',
            'jobs': [
                {'name': 'Pilote', 'codeOgr': '1234'},
                {'name': 'Pompier', 'codeOgr': '5678'},
            ],
            'requirements': {
                'skillsShortText': 'unused short text',
                'specificJobs': [
                    {'percentSuggested': 12, 'codeOgr': '1234'},
                ],
            },
        })
        response = self.app.get('/api/jobs/C1234')
        job_group = self.json_from_response(response)
        self.assertEqual({
            'jobs': [
                {'name': 'Pilote', 'codeOgr': '1234'},
                {'name': 'Pompier', 'codeOgr': '5678'},
            ],
            'requirements': {
                'specificJobs': [
                    {'percentSuggested': 12, 'codeOgr': '1234'},
                ],
            },
        }, job_group)


class EmploymentStatusTestCase(base_test.ServerTestCase):
    """Unit tests for employment-status endpoints."""

    def _add_project_modifier(self, user: dict[str, Any]) -> None:
        """Modifier to add a custom project."""

        user['projects'] = user.get('projects', []) + [{
            'kind': 'FIND_ANOTHER_JOB',
        }]

    def test_employment_status(self) -> None:
        """Test expected use case of employment-survey endpoints."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '1',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        assert response.location
        redirect_args = dict(parse.parse_qsl(parse.urlparse(response.location).query))
        self.assertIn('id', redirect_args)
        self.assertEqual('False', redirect_args['employed'])
        self.assertEqual(survey_token, redirect_args['token'])
        self.assertEqual(user_id, redirect_args['user'])
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STILL_SEEKING')

        survey_response = {
            'situation': 'lalala',
            'bobHasHelped': 'bidulechose'
        }
        response2 = self.app.post(
            f'/api/employment-status/{user_id}',
            data=json.dumps(survey_response),
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(204, response2.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertTrue(len(user['employmentStatus']) == 1)
        status = user['employmentStatus'][0]
        for key, value in survey_response.items():
            self.assertEqual(status[key], value)
        # check other fields have not been lost.
        self.assertEqual(user['profile']['email'], 'foo@bar.com')

    def test_employment_status_at_creation(self) -> None:
        """Test sending info on user employment status at time of RER email sending."""

        user_id, unused_auth_token = self.create_user_with_token(
            email='foo@bar.com', modifiers=[self._add_project_modifier])
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '1',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        assert response.location
        redirect_args = dict(parse.parse_qsl(parse.urlparse(response.location).query))
        self.assertEqual('True', redirect_args['employed'])

    def test_employment_status_stop_seeking(self) -> None:
        """Test expected use case of employment-survey when user click on stop seeking."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': '2',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STOP_SEEKING')

    def test_employment_status_seeking_string(self) -> None:
        """Test passing seeking parameter as string."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(302, response.status_code)
        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(user['employmentStatus'][0]['seeking'], 'STOP_SEEKING')

    def test_employment_status_seeking_wrong_string(self) -> None:
        """Test passing seeking parameter as string."""

        user_id = self.create_user(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'ERRONEOUS',
            'redirect': 'http://www.tutut.org',
        })
        self.assertEqual(422, response.status_code)

    def test_missing_parameters(self) -> None:
        """EmploymentSurvey endpoint expect user and token parameters"""

        user_id = self.create_user(email='foo@bar.com')
        auth_token = token.create_token(user_id, role='employment-survey')
        response = self.app.get('/api/employment-status', query_string={
            'token': auth_token,
            'seeking': '1',
        })
        self.assertEqual(422, response.status_code)
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'seeking': '1',
        })
        self.assertEqual(422, response.status_code)

    def test_employment_status_invalid_token(self) -> None:
        """EmploymentSurvey endpoint should fail if called with an invalid token."""

        user_id = self.create_user(email='foo@bar.com')
        auth_token = token.create_token(user_id, role='invalid-role')
        response = self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': auth_token,
            'seeking': '1',
        })
        self.assertEqual(403, response.status_code)

    def test_update_employment_status(self) -> None:
        """Update the employment status through the POST endpoint."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(204, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(['STILL_SEEKING'], [s.get('seeking') for s in user['employmentStatus']])

    def test_update_existing_employment_status(self) -> None:
        """Update an existing employment status through the POST endpoint."""

        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(204, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])

    @nowmock.patch()
    def test_update_create_new_employment_status(self, mock_now: mock.MagicMock) -> None:
        """Create a new employment status when update is a day later."""

        mock_now.return_value = datetime.datetime.now()
        user_id, auth_token = self.create_user_with_token(email='foo@bar.com')
        survey_token = token.create_token(user_id, role='employment-status')
        self.app.get('/api/employment-status', query_string={
            'user': user_id,
            'token': survey_token,
            'seeking': 'STOP_SEEKING',
            'redirect': 'http://www.tutut.org',
        })
        # Waiting 36 hours before updating the status: we then create a new one.
        mock_now.return_value = datetime.datetime.now() + datetime.timedelta(hours=36)
        response = self.app.post(
            f'/api/employment-status/{user_id}',
            data='{"seeking": "STILL_SEEKING", "bobHasHelped": "YES_A_LOT"}',
            headers={'Authorization': 'Bearer ' + survey_token},
            content_type='application/json')
        self.assertEqual(204, response.status_code)

        user = self.get_user_info(user_id, auth_token)
        self.assertEqual(
            ['STOP_SEEKING', 'STILL_SEEKING'],
            [s.get('seeking') for s in user.get('employmentStatus', [])])

    def test_convert_user_proto(self) -> None:
        """Converts a proto of a user with advice selection from JSON to compressed format."""

        response = self.app.post(
            '/api/proto',
            data='{"userWithAdviceSelection": {"user":{"profile":{"familySituation":'
            '"SINGLE_PARENT_SITUATION","frustrations":['
            '"NO_OFFERS", "SELF_CONFIDENCE", "TIME_MANAGEMENT"],"gender":"FEMININE",'
            '"hasCarDrivingLicense": true,"highestDegree": "NO_DEGREE","lastName": "Dupont",'
            '"name": "Angèle","yearOfBirth": 1999}},"adviceIds":["a","b","c"]}}',
            headers={'Accept': 'application/x-protobuf-base64'},
            content_type='application/json')

        proto_token = response.get_data(as_text=True)
        self.assertLessEqual(len(proto_token), 80, msg=proto_token)

        response_json = self.app.post(
            '/api/proto',
            data=proto_token,
            content_type='application/x-protobuf-base64')
        user_with_advice = self.json_from_response(response_json).get('userWithAdviceSelection', {})

        self.assertEqual(['a', 'b', 'c'], user_with_advice.get('adviceIds'))
        self.assertEqual('Angèle', user_with_advice.get('user', {}).get('profile', {}).get('name'))


class LaborStatsTestCase(base_test.ServerTestCase):
    """Unit tests for compute-labor-stats endpoint."""

    def test_compute_use_case_labor_stats(self) -> None:
        """Test expected use case of compute-labor-stats endpoint."""

        self._db.job_group_info.insert_one({
            '_id': 'A1235',
            'romeId': 'A1235',
            'name': 'The job',
            'jobs': [{
                'codeOgr': 'the-job',
                'name': 'This is the job we are looking for',
                'feminineName': 'Feminine',
                'masculineName': 'Masculine',
            }],
        })

        self._db.local_diagnosis.insert_one({
            '_id': '56:A1235',
            'imt': {
                'yearlyAvgOffersPer10Candidates': 5,
            },
        })

        self._db.user_count.insert_one({
            '_id': '',
            'weeklyApplicationCounts': {
                'A_LOT': 10,
                'SOME': 5,
            },
        })

        response = self.app.post(
            '/api/compute-labor-stats',
            data='{"projects": [{\
                "city": {"departementId": "56"},\
                "targetJob": {"jobGroup": {"romeId": "A1235"}}}\
            ]}',
            headers={'Authorization': 'Bearer blabla'})
        labor_stats = self.json_from_response(response)
        self.assertEqual(
            {'jobGroupInfo', 'localStats', 'userCounts'}, labor_stats.keys())

        imt = labor_stats.get('localStats', {}).get('imt', {})
        self.assertEqual(5, imt.get('yearlyAvgOffersPer10Candidates'))

        self.assertEqual('The job', labor_stats.get('jobGroupInfo', {}).get('name'))

        self.assertEqual(
            10, labor_stats.get('userCounts', {}).get('weeklyApplicationCounts', {}).get('A_LOT'))


class SupportTestCase(base_test.ServerTestCase):
    """Tests for the support endpoint."""

    def test_create_support_ticket(self) -> None:
        """A user is assigned a support ID if requested."""

        user_id, auth_token = self.create_user_with_token()

        response = self.app.post(
            f'/api/support/{user_id}',
            headers={'Authorization': 'Bearer ' + auth_token},
            content_type='application/json')
        ticket = self.json_from_response(response)
        self.assertTrue(ticket.get('ticketId'))
        delete_after = ticket.get('deleteAfter')
        do_not_delete_before = proto.datetime_to_json_string(now.get() + datetime.timedelta(days=1))
        delete_before = proto.datetime_to_json_string(now.get() + datetime.timedelta(days=30))
        self.assertGreater(delete_after, do_not_delete_before)
        self.assertLess(delete_after, delete_before)
        user_data = self.get_user_info(user_id, auth_token)
        last_saved_ticket = typing.cast(dict[str, str], user_data.get('supportTickets', [])[-1])
        self.assertEqual(ticket, last_saved_ticket)

    def test_create_specific_support_ticket(self) -> None:
        """A user can create a support ticket with a declared ID."""

        user_id, auth_token = self.create_user_with_token()

        response = self.app.post(
            f'/api/support/{user_id}/support-id',
            headers={'Authorization': 'Bearer ' + auth_token},
            content_type='application/json')
        ticket = self.json_from_response(response)
        self.assertEqual('support-id', ticket.get('ticketId'))

    def test_create_two_tickets(self) -> None:
        """Calling the route twice creates two tickets in order."""

        user_id, auth_token = self.create_user_with_token()
        response = self.app.post(
            f'/api/support/{user_id}',
            headers={'Authorization': 'Bearer ' + auth_token},
            content_type='application/json')
        ticket_id1 = self.json_from_response(response).get('ticketId')
        response = self.app.post(
            f'/api/support/{user_id}',
            headers={'Authorization': 'Bearer ' + auth_token},
            content_type='application/json')
        ticket_id2 = self.json_from_response(response).get('ticketId')
        user_data = self.get_user_info(user_id, auth_token)
        saved_ticket_ids = [
            ticket.get('ticketId') for ticket in user_data.get('supportTickets', [])]
        self.assertEqual(
            [ticket_id1, ticket_id2], saved_ticket_ids)


class DiagnosticDataEndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the diagnostic data endpoint.s"""

    def setUp(self) -> None:
        super(DiagnosticDataEndpointTestCase, self).setUp()
        self._db.diagnostic_main_challenges.insert_many([
            {
                'categoryId': 'one',
                'order': 1,
                'description': 'First blocker',
            },
            {
                'categoryId': 'two',
                'order': 3,
                'description': 'Second blocker',
            },
            {
                'categoryId': 'alpha',
                'order': 2,
                'areStrategiesForAlphaOnly': True,
                'description': 'Alpha blocker',
            },
        ])
        self.add_translations([
            {'string': 'First blocker', 'en': 'First English blocker'},
            {'string': 'diagnosticMainChallenges:two:metric_not_reached', 'en': 'Not reached Joe'},
        ])

    def test_list_main_challenges(self) -> None:
        """Test with an empty user."""

        response = self.json_from_response(self.app.post(
            '/api/diagnostic/main-challenges',
            content_type='application/json',
            data='{}'))
        self.assertEqual({'categories': [
            {'categoryId': 'one', 'order': 1, 'description': 'First blocker'},
            {'categoryId': 'two', 'order': 3, 'description': 'Second blocker'},
        ], 'isSorted': 'TRUE'}, response)

    def test_list_translated_cagetories(self) -> None:
        """Test with a different locale."""

        response = self.json_from_response(self.app.post(
            '/api/diagnostic/main-challenges',
            content_type='application/json',
            data='{"profile": {"locale": "en"}}'))
        self.assertEqual({'categories': [
            {'categoryId': 'one', 'order': 1, 'description': 'First English blocker'},
            {
                'categoryId': 'two',
                'order': 3,
                'description': 'Second blocker',
                'metricNotReached': 'Not reached Joe',
            },
        ], 'isSorted': 'TRUE'}, response)

    def test_list_alpha_main_challenges(self) -> None:
        """Test with alpha user."""

        response = self.json_from_response(self.app.post(
            '/api/diagnostic/main-challenges',
            content_type='application/json',
            data='{"featuresEnabled": {"alpha": true}}'))
        self.assertEqual({'categories': [
            {'categoryId': 'one', 'order': 1, 'description': 'First blocker'},
            {
                'categoryId': 'alpha',
                'order': 2,
                'areStrategiesForAlphaOnly': True,
                'description': 'Alpha blocker',
            },
            {'categoryId': 'two', 'order': 3, 'description': 'Second blocker'},
        ], 'isSorted': 'TRUE'}, response)


class MonitoringTestCase(base_test.ServerTestCase):
    """Unit tests for the monitoring endpoint."""

    def test_monitoring(self) -> None:
        """Basic call to "/monitoring"."""

        self._db.focus_emails.insert_many([
            {'campaignId': 'focus-network'},
            {'campaignId': 'focus-spontaneous'},
        ])
        self._db.meta.insert_many([
            {'_id': 'job_group_info', 'updated_at': datetime.datetime(2021, 8, 31, 12, 0, 0)},
            {'_id': 'local_diagnosis', 'updated_at': datetime.datetime(2021, 9, 1)},
        ])
        self._eval_db.sent_emails.insert_many([
            {
                '_id': 'focus-network',
                'lastSent': '2021-08-31T12:00:00Z',
            },
            {
                '_id': 'focus-resume',
                'lastSent': '2021-08-31T12:00:00Z',
            },
        ])

        response = self.app.get('/api/monitoring')
        self.assertEqual(200, response.status_code)
        monitoring = self.json_from_response(response)
        self.assertIn('serverVersion', monitoring)
        self.assertIn('lastSentEmail', monitoring)
        self.assertEqual({
            'focus-network': '2021-08-31T12:00:00Z',
            'focus-spontaneous': '1970-01-01T00:00:00Z',
        }, monitoring['lastSentEmail'])
        self.assertEqual({
            'job_group_info': '2021-08-31T12:00:00Z',
            'local_diagnosis': '2021-09-01T00:00:00Z',
        }, monitoring['lastTableImport'])


@requests_mock.mock()
class ProxyImageTests(base_test.ServerTestCase):
    """Unit tests for the image proxy endpoint."""

    def test_proxy(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic call to "/image"."""

        mock_requests.get(
            'http://r.bob-emploi.fr/tplimg/6u2u/b/xm3lh/vu0pj.png',
            headers={'Content-type': 'image/png'},
            text='abcdef')
        response = self.app.get(
            '/api/image?src=http%3A%2F%2Fr.bob-emploi.fr%2Ftplimg%2F6u2u%2Fb%2Fxm3lh%2Fvu0pj.png')
        self.assertEqual(200, response.status_code)
        self.assertEqual('abcdef', response.get_data(as_text=True))
        self.assertEqual('image/png', response.headers['content-type'])

    def test_no_src(self, unused_mock_requests: requests_mock.Mocker) -> None:
        """Basic call to "/image" without a src param."""

        response = self.app.get('/api/image')
        self.assertEqual(404, response.status_code)

    def test_src_https(self, unused_mock_requests: requests_mock.Mocker) -> None:
        """Basic call to "/image" trying to proxy an HTTPS image."""

        response = self.app.get(
            '/api/image?src=https%3A%2F%2Fr.bob-emploi.fr%2Ftplimg%2F6u2u%2Fb%2Fxm3lh%2Fvu0pj.png')
        self.assertEqual(401, response.status_code)

    def test_src_query(self, unused_mock_requests: requests_mock.Mocker) -> None:
        """Basic call to "/image" trying to proxy an image using a query string."""

        response = self.app.get(
            '/api/image?src=https%3A%2F%2Fr.bob-emploi.fr%2Fvu0pj.png%3Fhack%3Devil')
        self.assertEqual(401, response.status_code)

    def test_headers(self, mock_requests: requests_mock.Mocker) -> None:
        """Proxied server gives unwanted transfer headers."""

        mock_requests.get(
            'http://r.bob-emploi.fr/tplimg/6u2u/b/xm3lh/vu0pj.png',
            headers={
                'Content-type': 'image/png',
                'Transfer-Encoding': 'chunked',
            },
            text='abcdef')
        response = self.app.get(
            '/api/image?src=http%3A%2F%2Fr.bob-emploi.fr%2Ftplimg%2F6u2u%2Fb%2Fxm3lh%2Fvu0pj.png')
        self.assertEqual(200, response.status_code)
        self.assertEqual('abcdef', response.get_data(as_text=True))
        self.assertEqual('image/png', response.headers['content-type'])
        self.assertFalse(response.headers.get('Transfer-Encoding'))


if __name__ == '__main__':
    unittest.main()
