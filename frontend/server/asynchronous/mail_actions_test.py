# encoding: utf-8
"""Tests for the bob_emploi.frontend.asynchronous.mail_actions module."""
import datetime
import signal
import unittest
from urllib import error

from google.protobuf import json_format
import mock
import mongomock

from bob_emploi.frontend import proto
from bob_emploi.frontend.asynchronous import mail_actions
from bob_emploi.frontend.api import user_pb2

_USER_WITH_UNREAD_ACTION_DICT = {
    'profile': {
        'name': 'Pascal',
        'lastName': 'Corpet',
        'email': 'pascal@bayes.org',
        'emailDays': ['THURSDAY'],
    },
    'projects': [{
        'actions': [{
            'actionId': 'foo-bar-id',
            'status': 'ACTION_UNREAD',
            'title': 'Action Title',
            'shortDescription': 'Short description of the action.',
            }],
        'title': 'Project Title',
    }],
}


@mock.patch(mail_actions.__name__ + '.requests.post')
@mock.patch(mail_actions.__name__ + '.mail')
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    # TODO(pascal): Add more tests for sub functions and corner cases.

    def setUp(self):
        super(MailingTestCase, self).setUp()
        mail_actions.DRY_RUN = False
        self._db = mongomock.MongoClient().database
        self._now = datetime.datetime(2016, 11, 24, 10, 0, 0)

        def _mock_post(url, json):
            self.assertEqual('http://localhost:3000/api/user/refresh-action-plan', url)
            user_id = json.get('userId')
            user_dict = self._db.user.find_one({'_id': mongomock.ObjectId(user_id)})
            user_proto = user_pb2.User()
            proto.parse_from_mongo(user_dict, user_proto)
            response = mock.MagicMock()
            response.status_code = 200
            response.text = json_format.MessageToJson(user_proto)
            return response

        self._mock_post = _mock_post

    def test_main(self, mock_mail, mock_requests_post):
        """Overall test."""
        mock_requests_post.side_effect = self._mock_post
        self._db.user.insert_one({
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal@bayes.org',
                'emailDays': ['MONDAY', 'THURSDAY'],
            },
            'projects': [{
                'actions': [{
                    'actionId': 'foo-bar-id',
                    'status': 'ACTION_UNREAD',
                    'title': 'Action Title',
                    'shortDescription': 'Short description of the action.',
                }],
                'title': 'Project Title',
            }],
        })
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200

        mail_actions.main(self._db.user, 'http://localhost:3000', self._now)
        self.assertTrue(mock_mail.send_template.called)
        template_id, profile, template_vars = mock_mail.send_template.call_args[0]
        self.assertEqual('71275', template_id)
        self.assertEqual('pascal@bayes.org', profile.email)
        self.assertIn('projects', template_vars)
        projects = template_vars.pop('projects')
        self.assertEqual(['Project Title'], [p.get('title') for p in projects])
        self.assertEqual(
            ['foo-bar-id'], [a.get('actionId') for a in projects[0].get('actions', [])])
        self.assertEqual(
            {
                'baseUrl': 'http://localhost:3000',
                'firstName': 'Pascal',
                'frequency': 'deux fois par semaine',
                'nextday': 'lundi',
            },
            template_vars)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_advisor_email(self, mock_mail, mock_requests_post):
        """Do not send to users of the advisor."""
        mock_requests_post.side_effect = self._mock_post
        self._db.user.insert_one({
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal@bayes.org',
                'emailDays': ['MONDAY', 'THURSDAY'],
            },
            'projects': [{
                'actions': [{
                    'actionId': 'foo-bar-id',
                    'status': 'ACTION_UNREAD',
                    'title': 'Action Title',
                    'shortDescription': 'Short description of the action.',
                }],
                'title': 'Project Title',
            }],
            'featuresEnabled': {
                'emailAdvisor': 'ACTIVE',
            },
        })
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200

        mail_actions.main(self._db.user, 'http://localhost:3000', self._now)
        self.assertFalse(mock_mail.send_template.called)

    def test_server_failure(self, mock_mail, mock_requests_post):
        """Test that we catch our own server's failure."""
        mock_requests_post.side_effect = error.HTTPError(
            'server/url', 504, 'timeout', None, mock.Mock(status=504))
        self._db.user.insert_one(_USER_WITH_UNREAD_ACTION_DICT)
        user_id = self._db.user.find_one({})['_id']
        mock_mail.send_template_to_admins.return_value.status_code = 200

        mail_actions.main(self._db.user, 'http://localhost:3000', self._now)
        self.assertFalse(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)
        self.assertEqual(
            ['HTTP Error 504: timeout - %s' % user_id],
            mock_mail.send_template_to_admins.call_args[0][1]['errors'])

    def test_no_dupes(self, mock_mail, mock_requests_post):
        """Test that we do not send duplicate emails if we run the script twice."""
        mock_requests_post.side_effect = self._mock_post
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_one(_USER_WITH_UNREAD_ACTION_DICT)

        mail_actions.main(self._db.user, 'http://localhost:3000', self._now)

        self.assertTrue(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)
        mock_mail.send_template.reset_mock()
        mock_mail.send_template_to_admins.reset_mock()

        # Running the script again 10 minutes later.
        mail_actions.main(
            self._db.user, 'http://localhost:3000', self._now + datetime.timedelta(minutes=10))
        self.assertFalse(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_signal(self, mock_mail, mock_requests_post):
        """Test that the batch send fails gracefully on SIGTERM."""
        mock_requests_post.side_effect = self._mock_post
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_many([
            dict(
                _USER_WITH_UNREAD_ACTION_DICT,
                _id=mongomock.ObjectId('580f4a4271cd4a0007672a%dd' % i))
            for i in range(10)
        ])

        users = list(self._db.user.find({}, {'_id': 1}))

        db_user = mock.MagicMock()
        db_user.find.return_value = _SigtermAfterNItems(users, 3)

        mail_actions.main(db_user, 'http://localhost:3000', self._now)

        self.assertEqual(4, mock_mail.send_template.call_count)
        self.assertEqual(4, db_user.update_one.call_count)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_6_weeks_not_open(self, mock_mail, mock_requests_post):
        """Test that we disable emailing if users does not open their email for 5 days."""
        mock_requests_post.side_effect = self._mock_post
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_one(_USER_WITH_UNREAD_ACTION_DICT)

        # Running the script 5 weeks in a row.
        for week in range(5):
            mock_mail.count_sent_to.return_value = {'DeliveredCount': week, 'OpenedCount': 0}
            mail_actions.main(
                self._db.user, 'http://localhost:3000',
                self._now + datetime.timedelta(hours=24 * 7 * week))

        self.assertEqual(5, mock_mail.send_template.call_count)
        mock_mail.send_template.reset_mock()

        # Running on week 6.
        mock_mail.count_sent_to.return_value = {'DeliveredCount': 5, 'OpenedCount': 0}
        mail_actions.main(
            self._db.user, 'http://localhost:3000',
            self._now + datetime.timedelta(hours=24 * 7 * 6))

        self.assertFalse(mock_mail.send_template.called)
        user_in_db = self._db.user.find_one({})
        self.assertEqual([], user_in_db['profile'].get('emailDays', []))
        self.assertTrue(user_in_db['featuresEnabled'].get('autoStopEmails'))

    def _assert_disable_sending(self, mock_mail, delivered, opened, disabled):
        self._db.user.drop()
        self._db.user.insert_one(dict(
            _USER_WITH_UNREAD_ACTION_DICT,
            lastEmailSentAt=self._now - datetime.timedelta(hours=24)))

        mock_mail.count_sent_to.return_value = {'DeliveredCount': delivered, 'OpenedCount': opened}
        mail_actions.main(self._db.user, 'http://localhost:3000', self._now)

        if disabled:
            self.assertFalse(mock_mail.send_template.called)
            user_in_db = self._db.user.find_one({})
            self.assertEqual([], user_in_db['profile'].get('emailDays', []))
            self.assertTrue(user_in_db['featuresEnabled'].get('autoStopEmails'))
        else:
            self.assertTrue(mock_mail.send_template.called)
        mock_mail.send_template.reset_mock()

    def test_open_but_not_enough(self, mock_mail, mock_requests_post):
        """Test that we disable emailing if users has opened email but received way more."""
        mock_requests_post.side_effect = self._mock_post
        # Do not disable for 1/6 ratio.
        self._assert_disable_sending(mock_mail, delivered=6, opened=1, disabled=False)
        # Disable for 1/11 ratio.
        self._assert_disable_sending(mock_mail, delivered=11, opened=1, disabled=True)
        # Do not disable for 2/11 ratio.
        self._assert_disable_sending(mock_mail, delivered=11, opened=2, disabled=False)
        # Disable for 2/100 ratio.
        self._assert_disable_sending(mock_mail, delivered=100, opened=2, disabled=True)


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


class FrenchTestCase(unittest.TestCase):
    """Unit tests for french realted functions."""

    def test_see_you_tomorrow(self):
        """See you tomorrow."""
        day = mail_actions.see_you_day([user_pb2.MONDAY, user_pb2.TUESDAY], user_pb2.MONDAY)
        self.assertEqual('demain', day)

    def test_see_you_later(self):
        """See you later."""
        day = mail_actions.see_you_day([], user_pb2.MONDAY)
        self.assertEqual('la prochaine', day)

    def test_see_you_other_day(self):
        """Other day of the week."""
        day = mail_actions.see_you_day([user_pb2.MONDAY, user_pb2.THURSDAY], user_pb2.MONDAY)
        self.assertEqual('jeudi', day)

    def test_see_you_other_day_next_week(self):
        """Other day of the next week."""
        day = mail_actions.see_you_day([user_pb2.MONDAY, user_pb2.THURSDAY], user_pb2.THURSDAY)
        self.assertEqual('lundi', day)

    def test_see_you_next_week(self):
        """See you next week."""
        day = mail_actions.see_you_day([user_pb2.MONDAY], user_pb2.MONDAY)
        self.assertEqual('la semaine prochaine', day)

    def test_see_you_other_day_unsorted(self):
        """Unsorted day list."""
        day = mail_actions.see_you_day(
            [user_pb2.MONDAY, user_pb2.SUNDAY, user_pb2.THURSDAY], user_pb2.MONDAY)
        self.assertEqual('jeudi', day)

    def test_frequency_never(self):
        """Frequency is not regular."""
        frequency = mail_actions.frequency([])
        self.assertEqual('de temps à autre', frequency)

    def test_frequency_every_thursday(self):
        """Frequency is weekly."""
        frequency = mail_actions.frequency([user_pb2.THURSDAY])
        self.assertEqual('tous les jeudis', frequency)

    def test_frequency_daily(self):
        """Frequency is daily."""
        frequency = mail_actions.frequency([
            user_pb2.MONDAY, user_pb2.TUESDAY, user_pb2.WEDNESDAY,
            user_pb2.THURSDAY, user_pb2.FRIDAY, user_pb2.SATURDAY,
            user_pb2.SUNDAY, user_pb2.MONDAY])
        self.assertEqual('tous les jours', frequency)

    def test_frequency_three_times_a_week(self):
        """Frequency is 3 times a week."""
        frequency = mail_actions.frequency([
            user_pb2.MONDAY, user_pb2.WEDNESDAY, user_pb2.FRIDAY])
        self.assertEqual('trois fois par semaine', frequency)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
