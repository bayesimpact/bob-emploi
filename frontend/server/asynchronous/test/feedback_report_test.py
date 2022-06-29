"""Unit tests for the feedback_report module."""

import io
import os
import unittest
from unittest import mock

import mongomock
import requests_mock
import sentry_sdk

from bob_emploi.frontend.server.asynchronous import feedback_report
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


@requests_mock.mock()
@mock.patch(sentry_sdk.__name__ + '.init')
@mock.patch(feedback_report.__name__ + '._SLACK_FEEDBACK_URL', 'https://slack/')
@mock.patch.dict(os.environ, {'SENTRY_DSN': 'https://42:42@sentry.io/42'})
class FeedbackReportTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = self._user_db

    def test_send_report(
            self, mock_requests: requests_mock.Mocker, mock_sentry_init: mock.MagicMock) -> None:
        """Test sending the report for real."""

        mock_requests.post('https://slack/')
        output = io.StringIO()
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], output)
        self.assertFalse(output.getvalue())
        self.assertTrue(mock_requests.called)
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            ':bar_chart: NPS Report from 2017-10-30 to 2017-11-07',
            slack_json['attachments'][0]['title'])
        self.assertIn('0 users answered the NPS survey', slack_json['attachments'][0]['text'])
        mock_sentry_init.assert_called_once()
        self.assertEqual('https://42:42@sentry.io/42', mock_sentry_init.call_args[1]['dsn'])

    def test_dry_run(
            self, mock_requests: requests_mock.Mocker, mock_sentry_init: mock.MagicMock) -> None:
        """Test sending the report using dry run."""

        mock_requests.post('https://slack/')
        output = io.StringIO()
        feedback_report.main(['nps', '--from', '2017-10-30', '--to', '2017-11-07'], output)
        self.assertFalse(mock_requests.called)
        self.assertFalse(mock_sentry_init.called)
        self.assertIn('0 users answered the NPS survey', output.getvalue())

    def test_exclude_alpha_users(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the NPS report on alpha user."""

        self._db.user.insert_one({
            '_id': mongomock.ObjectId('123400000012340000001234'),
            'registeredAt': '2017-11-01T12:00:00Z',
            'featuresEnabled': {
                'excludeFromAnalytics': True,
            },
            'profile': {'email': 'pascal@example.com'},
            'netPromoterScoreSurveyResponse': {
                'respondedAt': '2017-11-01T16:00:00Z',
                'score': 0,
                'generalFeedbackComment': 'The app was blocked for me :-(',
            },
            'emailsSent': [{
                'campaignId': 'nps',
                'sentAt': '2017-11-01T13:00:00Z',
            }],
        })
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '0 users answered the NPS survey (out of 0 - 0% answer rate) '
            'for a global NPS of *0%*\n\n'
            'There are no individual comments.',
            slack_json['attachments'][0]['text'])

    def test_compute_nps_report(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the NPS report on multiple user feedback."""

        self._db.user.insert_many([
            {
                '_id': mongomock.ObjectId('123400000012340000001234'),
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 0,
                    'generalFeedbackComment': 'The app was blocked for me :-(',
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 9,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 6,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                '_id': mongomock.ObjectId('000056780000005678000000'),
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 9,
                    'generalFeedbackComment': 'You rock!',
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            # User registered and answered the NPS after the to_date.
            {
                'registeredAt': '2017-11-11T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-11T16:00:00Z',
                    'score': 0,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-11T13:00:00Z',
                }],
            },
            # User registered but did not answer the NPS.
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
        ])
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '4 users answered the NPS survey (out of 5 - 80% answer rate) '
            'for a global NPS of *25.0%*\n'
            '*9*: 2 users\n'
            '*6*: 1 user\n'
            '*0*: 1 user\n'
            'And here are the individual comments:\n'
            '[Score: 9] ObjectId("000056780000005678000000")\n'
            '> You rock!\n'
            '[Score: 0] ObjectId("123400000012340000001234")\n'
            '> The app was blocked for me :-(',
            slack_json['attachments'][0]['text'])

    def test_compute_nps_report_no_comments(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the NPS report on multiple user feedback."""

        self._db.user.insert_many([
            {
                '_id': mongomock.ObjectId('123400000012340000001234'),
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 0,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 9,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 6,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
            {
                '_id': mongomock.ObjectId('000056780000005678000000'),
                'registeredAt': '2017-11-01T12:00:00Z',
                'netPromoterScoreSurveyResponse': {
                    'respondedAt': '2017-11-01T16:00:00Z',
                    'score': 9,
                },
                'emailsSent': [{
                    'campaignId': 'nps',
                    'sentAt': '2017-11-01T13:00:00Z',
                }],
            },
        ])
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '4 users answered the NPS survey (out of 4 - 100% answer rate) '
            'for a global NPS of *25.0%*\n'
            '*9*: 2 users\n'
            '*6*: 1 user\n'
            '*0*: 1 user\n'
            'There are no individual comments.',
            slack_json['attachments'][0]['text'])

    def test_compute_stars_report(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the stars report on multiple user feedback."""

        self._db.user.insert_many([
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'score': 2,
                        'text': 'Well well',
                    },
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'score': 5,
                    },
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'score': 2,
                    },
                }],
            },
            # User did not answer the feedback.
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                }],
            },
            # User registered and answered the NPS after the to_date.
            {
                'registeredAt': '2017-11-11T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-11T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'score': 2,
                    },
                }],
            },
        ])
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['stars', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '3 projects were scored in the app (out of 4 - 75% answer rate) '
            'for a global average of *3.0 :star:*\n'
            ':star::star::star::star::star:: 1 project\n'
            ':star::star:: 2 projects\n'
            'And here is the individual comment:\n'
            '[:star::star:]\n'
            '> Well well',
            slack_json['attachments'][0]['text'])

    def test_compute_agreement_report(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the agreement report on multiple user feedback."""

        self._db.user.insert_many([
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'challengeAgreementScore': 2,
                    },
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'challengeAgreementScore': 5,
                    },
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'challengeAgreementScore': 2,
                    },
                }],
            },
            # User did not answer the feedback.
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'diagnostic': {},
                }],
            },
            # User registered and answered the feeback after the to_date.
            {
                'registeredAt': '2017-11-11T12:00:00Z',
                'projects': [{
                    'createdAt': '2017-11-11T13:00:00Z',
                    'diagnostic': {},
                    'feedback': {
                        'challengeAgreementScore': 2,
                    },
                }],
            },
        ])
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['agreement', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'],
            io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '3 project challenges were evaluated in the app (out of 4 - 75% answer rate) '
            'for a global average agreement of *2.0/4*\n'
            '4/4: 1 project\n'
            '1/4: 2 projects',
            slack_json['attachments'][0]['text'])
        self.assertIn(':ok_hand: Agreement Report', slack_json['attachments'][0]['title'])

    def test_compute_rer_report(
            self, mock_requests: requests_mock.Mocker,
            unused_mock_sentry_init: mock.MagicMock) -> None:
        """Test computing the RER report on multiple user feedback."""

        self._db.user.insert_many([
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'employmentStatus': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'seeking': 'STILL_SEEKING',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'employmentStatus': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'seeking': 'STILL_SEEKING',
                    'bobHasHelped': 'NOT_AT_ALL',
                }],
            },
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'employmentStatus': [{
                    'createdAt': '2017-11-01T13:00:00Z',
                    'seeking': 'STILL_SEEKING',
                    'bobHasHelped': 'YES_SOMEHOW',
                }],
            },
            {
                'registeredAt': '2017-06-01T12:00:00Z',
                'employmentStatus': [
                    # Only the 3rd status is within range.
                    {
                        'createdAt': '2017-09-01T13:00:00Z',
                        'seeking': 'STILL_SEEKING',
                    },
                    {
                        'createdAt': '2017-10-01T13:00:00Z',
                        'seeking': 'STILL_SEEKING',
                    },
                    {
                        'createdAt': '2017-11-01T13:00:00Z',
                        'seeking': 'STOP_SEEKING',
                    },
                    {
                        'createdAt': '2017-12-01T13:00:00Z',
                        'seeking': 'STILL_SEEKING',
                    },
                ],
            },
            # User answered before and then after the date.
            {
                'registeredAt': '2017-06-01T12:00:00Z',
                'employmentStatus': [
                    {
                        'createdAt': '2017-09-01T13:00:00Z',
                        'seeking': 'STILL_SEEKING',
                    },
                    {
                        'createdAt': '2017-12-01T13:00:00Z',
                        'seeking': 'STILL_SEEKING',
                    },
                ],
            },
            # User answered the RER after the to_date.
            {
                'registeredAt': '2017-11-01T12:00:00Z',
                'employmentStatus': [{
                    'createdAt': '2017-11-09T13:00:00Z',
                    'seeking': 'STILL_SEEKING',
                }],
            },
        ])
        mock_requests.post('https://slack/')
        feedback_report.main(
            ['rer', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_requests.request_history[0].json()
        self.assertEqual(
            '4 users have answered the survey, *25.0%* have stopped seeking:\n'
            '*STILL_SEEKING*: 3 users (50.0% said Bob helped - excluding N/A)\n'
            '*STOP_SEEKING*: 1 user (0.0% said Bob helped - excluding N/A)',
            slack_json['attachments'][0]['text'])


if __name__ == '__main__':
    unittest.main()
