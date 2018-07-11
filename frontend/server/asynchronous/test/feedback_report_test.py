"""Unit tests for the feedback_report module."""

import io
import unittest

import mock
import mongomock
import requests

from bob_emploi.frontend.server.asynchronous import feedback_report
from bob_emploi.frontend.server.asynchronous import report


@mock.patch(requests.__name__ + '.post')
@mock.patch(report.__name__ + '.setup_sentry_logging')
class FeedbackReportTestCase(unittest.TestCase):
    """Unit tests for the module."""

    _mongomock_count_documents_patched = False

    def setUp(self):
        super(FeedbackReportTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(feedback_report.__name__ + '._USER_DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)
        if not self._mongomock_count_documents_patched:
            # TODO(pascal): Remove when mongomock handles the count_documents method.
            self.assertFalse(
                hasattr(self._db.user.__class__, 'count_documents'),
                'mongomock has been upgraded, drop the patch')
            self._db.user.__class__.count_documents = \
                lambda self, filters, **kwargs: self.find(filters).count(**kwargs)
            cls = self.__class__
            cls._mongomock_count_documents_patched = True  # pylint: disable=protected-access

        feedback_report.os.environ['SENTRY_DSN'] = 'https://42:42@sentry.io/42'

    def tearDown(self):
        del feedback_report.os.environ['SENTRY_DSN']
        super(FeedbackReportTestCase, self).tearDown()

    def test_send_report(self, mock_sentry_logging, mock_post):
        """Test sending the report for real."""

        output = io.StringIO()
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], output)
        self.assertFalse(output.getvalue())
        self.assertTrue(mock_post.called)
        slack_json = mock_post.call_args[1]['json']
        self.assertEqual(
            ':bar_chart: NPS Report from 2017-10-30 to 2017-11-07',
            slack_json['attachments'][0]['title'])
        self.assertIn('0 users answered the NPS survey', slack_json['attachments'][0]['text'])
        mock_sentry_logging.assert_called_once_with('https://42:42@sentry.io/42')

    def test_dry_run(self, mock_sentry_logging, mock_post):
        """Test sending the report using dry run."""

        output = io.StringIO()
        feedback_report.main(['nps', '--from', '2017-10-30', '--to', '2017-11-07'], output)
        self.assertFalse(mock_post.called)
        self.assertFalse(mock_sentry_logging.called)
        self.assertIn('0 users answered the NPS survey', output.getvalue())

    def test_compute_nps_report(self, unused_mock_sentry_logging, mock_post):
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
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_post.call_args[1]['json']
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

    def test_compute_nps_report_no_comments(self, unused_mock_sentry_logging, mock_post):
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
        feedback_report.main(
            ['nps', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_post.call_args[1]['json']
        self.assertEqual(
            '4 users answered the NPS survey (out of 4 - 100% answer rate) '
            'for a global NPS of *25.0%*\n'
            '*9*: 2 users\n'
            '*6*: 1 user\n'
            '*0*: 1 user\n'
            'There are no individual comments.',
            slack_json['attachments'][0]['text'])

    def test_compute_stars_report(self, unused_mock_sentry_logging, mock_post):
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
        feedback_report.main(
            ['stars', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_post.call_args[1]['json']
        self.assertEqual(
            '3 projects were scored in the app (out of 4 - 75% answer rate) '
            'for a global average of *3.0 :star:*\n'
            ':star::star::star::star::star:: 1 project\n'
            ':star::star:: 2 projects\n'
            'And here is the individual comment:\n'
            '[:star::star:]\n'
            '> Well well',
            slack_json['attachments'][0]['text'])

    def test_compute_rer_report(self, unused_mock_sentry_logging, mock_post):
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
        feedback_report.main(
            ['rer', '--from', '2017-10-30', '--to', '2017-11-07', '--no-dry-run'], io.StringIO())
        slack_json = mock_post.call_args[1]['json']
        self.assertEqual(
            '4 users have answered the survey, *25.0%* have stopped seeking:\n'
            '*STILL_SEEKING*: 3 users (50.0% said Bob helped - excluding N/A)\n'
            '*STOP_SEEKING*: 1 user (0.0% said Bob helped - excluding N/A)',
            slack_json['attachments'][0]['text'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
