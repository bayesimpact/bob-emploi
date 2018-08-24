"""Tests for the bob_emploi.frontend.asynchronous.mail_nps module."""

import datetime
import signal
import unittest
from urllib import parse

import mock
import mongomock

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import mail_nps
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


# TODO(marielaure): Add tests for slack report.
@mock.patch(mail_nps.report.__name__ + '.requests.post')
@mock.patch(mail_nps.report.__name__ + '._SLACK_WEBHOOK_URL', 'https://slack.example.com/webhook')
@mailjetmock.patch()
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    def setUp(self):
        super(MailingTestCase, self).setUp()
        mail_nps.DRY_RUN = False
        self._db = mongomock.MongoClient().database
        self._now = datetime.datetime(2018, 1, 24, 10, 0, 0)

    def test_main(self, mock_post):
        """Overall test."""

        self._db.user.insert_one({
            '_id': 'my-own-user-id',
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')

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
        self.assertEqual(['my-own-user-id'], nps_form_args['user'])
        auth.check_token('my-own-user-id', nps_form_args['token'][0], role='nps')
        self.assertEqual(['http://localhost:3000/retours'], nps_form_args['redirect'])
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text': "Report for NPS blast: I've sent 1 emails (with 0 errors)."
            },
        )

        modified_user = user_pb2.User()
        proto.parse_from_mongo(self._db.user.find_one(), modified_user)
        self.assertEqual(
            sent_messages[0].message_id,
            modified_user.emails_sent[0].mailjet_message_id)
        self.assertEqual('nps', modified_user.emails_sent[0].campaign_id)

    def test_too_soon(self, mock_post):
        """Test that we do not send the NPS email if the user registered recently."""

        self._db.user.insert_one(
            dict(
                _USER_PENDING_NPS_DICT,
                registeredAt=(self._now - datetime.timedelta(hours=6)).isoformat() + 'Z'))

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '0')

        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_incomplete(self, mock_post):
        """Do not send if project is not complete."""

        self._db.user.insert_one({
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

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_missing_email(self, mock_post):
        """Do not send if there's no email address."""

        self._db.user.insert_one({
            '_id': 'my-own-user-id',
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
            },
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')
        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 0 emails (with 0 errors)."
            },
        )

    def test_no_dupes(self, mock_post):
        """Test that we do not send duplicate emails if we run the script twice."""

        self._db.user.insert_one(_USER_PENDING_NPS_DICT)

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')

        self.assertTrue(mailjetmock.get_all_sent_messages())
        mailjetmock.clear_sent_messages()

        # Running the script again 10 minutes later.
        mail_nps.main(
            self._db.user, 'http://localhost:3000', self._now + datetime.timedelta(minutes=10), '1')
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

    def test_signal(self, mock_post):
        """Test that the batch send fails gracefully on SIGTERM."""

        self._db.user.insert_many([
            dict(
                _USER_PENDING_NPS_DICT,
                _id=mongomock.ObjectId('580f4a4271cd4a0007672a%dd' % i))
            for i in range(10)
        ])

        users = list(self._db.user.find({}))

        db_user = mock.MagicMock()
        db_user.find.return_value = _SigtermAfterNItems(users, 3)

        mail_nps.main(db_user, 'http://localhost:3000', self._now, '1')

        sent_messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(4, len(sent_messages), msg=sent_messages)
        self.assertEqual(4, db_user.update_one.call_count)
        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'text':
                    "Report for NPS blast: I've sent 4 emails (with 0 errors)."
            },
        )


class _SigtermAfterNItems(object):
    """Wrapper to iterate on a list but raise a SIGTERM after n items have been iterated."""

    def __init__(self, items, sigterm_after_n):
        self._items = items
        self._sigterm_after_n = sigterm_after_n

    def __iter__(self):
        return _SigtermAfterNItems(self._items, self._sigterm_after_n)

    def __next__(self):
        if not self._items:
            raise StopIteration
        if not self._sigterm_after_n:
            signal.getsignal(signal.SIGTERM)(signal.SIGTERM, None)
        self._sigterm_after_n -= 1
        return self._items.pop()


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
