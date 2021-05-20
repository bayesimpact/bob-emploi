"""Tests for the NPS email."""

import datetime
import os
import unittest
from unittest import mock
from urllib import parse

import mongomock
import pymongo
import requests_mock

from bob_emploi.common.python import now
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import mail_blast
from bob_emploi.frontend.server.test import mailjetmock

_USER_PENDING_NPS_DICT = {
    'profile': {
        'name': 'Pascal',
        'lastName': 'Corpet',
        'email': 'pascal@bayes.org',
    },
    'registeredAt': '2018-01-22T10:00:00Z',
    'projects': [{
        'title': 'Project Title',
    }],
}


# TODO(sil): Add tests for slack report.
@requests_mock.mock()
@mock.patch(report.__name__ + '._SLACK_WEBHOOK_URL', 'https://slack.example.com/webhook')
@mock.patch(campaign.__name__ + '.BASE_URL', 'http://localhost:3000')
@mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
@mailjetmock.patch()
@mock.patch.dict(os.environ, {
    'USERS_MONGO_URL': 'mongodb://my-db/db',
    'MONGO_URL': 'mongodb://my-db/db',
    'NODRY_RUN': '1',
})
@mongomock.patch('mongodb://my-db')
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    def setUp(self) -> None:
        super().setUp()
        self._now = datetime.datetime(2018, 1, 24, 10, 0, 0)
        self.addCleanup(mongo.cache.clear)

    def _call_main(self, days_before_sending: str) -> None:
        with mock.patch(now.__name__ + '.get', return_value=self._now):
            mail_blast.main([
                'nps', 'send',
                '--disable-sentry',
                '--days-since-any-email', '0',
                '--registered-to-days-ago', days_before_sending,
            ])

    def test_main(self, mock_requests: requests_mock.Mocker) -> None:
        """Overall test."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one({
            '_id': mongomock.ObjectId('5daf2298484ae6c93351b822'),
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
                'locale': 'fr',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('1')

        sent_messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(['pascal+test@bayes.org'], [m.recipient['Email'] for m in sent_messages])
        self.assertEqual(100819, sent_messages[0].properties['TemplateID'])
        template_vars = sent_messages[0].properties['Variables']
        nps_form_urlstring = template_vars.pop('npsFormUrl')
        self.assertEqual(
            {
                'baseUrl': 'http://localhost:3000',
                'firstName': 'Pascal',
            },
            template_vars)
        nps_form_url = parse.urlparse(nps_form_urlstring)
        self.assertEqual(
            'http://localhost:3000/api/nps',
            parse.urlunparse(nps_form_url[:4] + ('',) + nps_form_url[5:]))
        nps_form_args = parse.parse_qs(nps_form_url.query)
        self.assertEqual({'user', 'token', 'redirect'}, nps_form_args.keys())
        self.assertEqual(['5daf2298484ae6c93351b822'], nps_form_args['user'])
        auth.check_token('5daf2298484ae6c93351b822', nps_form_args['token'][0], role='nps')
        self.assertEqual(['http://localhost:3000/retours?hl=fr'], nps_form_args['redirect'])
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 1 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )

        modified_user = user_pb2.User()
        proto.parse_from_mongo(_db.user.find_one(), modified_user)
        self.assertEqual(
            [sent_messages[0].message_id],
            [m.mailjet_message_id for m in modified_user.emails_sent])
        self.assertEqual('nps', modified_user.emails_sent[0].campaign_id)

    def test_too_soon(self, mock_requests: requests_mock.Mocker) -> None:
        """Test that we do not send the NPS email if the user registered recently."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one(
            dict(
                _USER_PENDING_NPS_DICT,
                registeredAt=(self._now - datetime.timedelta(hours=6)).isoformat() + 'Z'))

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('0')

        self.assertFalse(mailjetmock.get_all_sent_messages())
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 0 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )

    def test_no_incomplete(self, mock_requests: requests_mock.Mocker) -> None:
        """Do not send if project is not complete."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one({
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
                'isIncomplete': True,
            }],
        })

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 0 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )

    def test_no_missing_email(self, mock_requests: requests_mock.Mocker) -> None:
        """Do not send if there's no email address."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one({
            '_id': '5daf2298484ae6c93351b822',
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 0 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )

    def test_no_email_if_address_error(self, mock_requests: requests_mock.Mocker) -> None:
        """Do not send if there's no email address."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one({
            '_id': '5daf2298484ae6c93351b822',
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal@ corpet.net',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 0 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )

    def test_no_dupes(self, mock_requests: requests_mock.Mocker) -> None:
        """Test that we do not send duplicate emails if we run the script twice."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one(_USER_PENDING_NPS_DICT)

        mock_requests.post('https://slack.example.com/webhook')

        self._call_main('1')

        self.assertTrue(mailjetmock.get_all_sent_messages())
        mailjetmock.clear_sent_messages()

        # Running the script again 10 minutes later.
        self._now += datetime.timedelta(minutes=10)
        self._call_main('1')
        self.assertFalse(mailjetmock.get_all_sent_messages())

        self.assertEqual(2, mock_requests.call_count)
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 1 emails (and got 0 errors)."
            },
            mock_requests.request_history[0].json(),
        )
        self.assertEqual(
            {
                'text': "Report for nps blast: I've sent 0 emails (and got 0 errors)."
            },
            mock_requests.request_history[1].json(),
        )


if __name__ == '__main__':
    unittest.main()
