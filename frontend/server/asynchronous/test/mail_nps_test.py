"""Tests for the bob_emploi.frontend.asynchronous.mail_nps module."""

import datetime
import inspect
import os
import signal
import typing
from typing import Callable, Iterator, List
import unittest
from unittest import mock
from urllib import parse

import mongomock
import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import mail_nps
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.asynchronous.mail import campaign
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
@mock.patch(report.__name__ + '.requests.post')
@mock.patch(report.__name__ + '._SLACK_WEBHOOK_URL', 'https://slack.example.com/webhook')
@mock.patch(campaign.__name__ + '.BASE_URL', 'http://localhost:3000')
@mailjetmock.patch()
@mock.patch.dict(
    os.environ, {'USERS_MONGO_URL': 'mongodb://my-db/db', 'MONGO_URL': 'mongodb://my-db/db'})
@mongomock.patch('mongodb://my-db')
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    def setUp(self) -> None:
        super().setUp()
        mail_nps.DRY_RUN = False
        self._now = datetime.datetime(2018, 1, 24, 10, 0, 0)

    def test_main(self, mock_post: mock.MagicMock) -> None:
        """Overall test."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one({
            '_id': mongomock.ObjectId('5daf2298484ae6c93351b822'),
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
                'locale': 'en',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mail_nps.main(self._now, '1')

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
        self.assertEqual(['http://localhost:3000/retours?hl=en'], nps_form_args['redirect'])
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text': "Report for NPS blast: I've sent 1 emails (with 0 errors)."
            },
        )

        modified_user = user_pb2.User()
        proto.parse_from_mongo(_db.user.find_one(), modified_user)
        self.assertEqual(
            [sent_messages[0].message_id],
            [m.mailjet_message_id for m in modified_user.emails_sent])
        self.assertEqual('nps', modified_user.emails_sent[0].campaign_id)

    def test_too_soon(self, mock_post: mock.MagicMock) -> None:
        """Test that we do not send the NPS email if the user registered recently."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one(
            dict(
                _USER_PENDING_NPS_DICT,
                registeredAt=(self._now - datetime.timedelta(hours=6)).isoformat() + 'Z'))

        mail_nps.main(self._now, '0')

        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_incomplete(self, mock_post: mock.MagicMock) -> None:
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

        mail_nps.main(self._now, '1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_missing_email(self, mock_post: mock.MagicMock) -> None:
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

        mail_nps.main(self._now, '1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_dupes(self, mock_post: mock.MagicMock) -> None:
        """Test that we do not send duplicate emails if we run the script twice."""

        _db = pymongo.MongoClient('mongodb://my-db/db').db
        _db.user.drop()
        _db.user.insert_one(_USER_PENDING_NPS_DICT)

        mail_nps.main(self._now, '1')

        self.assertTrue(mailjetmock.get_all_sent_messages())
        mailjetmock.clear_sent_messages()

        # Running the script again 10 minutes later.
        mail_nps.main(self._now + datetime.timedelta(minutes=10), '1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        calls = [
            mock.call(
                'https://slack.example.com/webhook',
                json={
                    'text':
                        "Report for NPS blast: I've sent 1 emails (with 0 errors)."
                },),
            mock.call(
                'https://slack.example.com/webhook',
                json={
                    'text':
                        "Report for NPS blast: I've sent 0 emails (with 0 errors)."
                },)
        ]
        self.assertEqual(calls, mock_post.mock_calls)


_T = typing.TypeVar('_T')


class _SigtermAfterNItems(typing.Generic[_T]):
    """Wrapper to iterate on a list but raise a SIGTERM after n items have been iterated."""

    def __init__(self, items: List[_T], sigterm_after_n: int):
        self._items = items
        self._sigterm_after_n = sigterm_after_n

    def __iter__(self) -> Iterator[_T]:
        return _SigtermAfterNItems(self._items, self._sigterm_after_n)

    def __next__(self) -> _T:
        if not self._items:
            raise StopIteration
        if not self._sigterm_after_n:
            typing.cast(Callable[..., None], signal.getsignal(signal.SIGTERM))(
                signal.SIGTERM, inspect.currentframe())
        self._sigterm_after_n -= 1
        return self._items.pop()


if __name__ == '__main__':
    unittest.main()
