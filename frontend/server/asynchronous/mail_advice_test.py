# encoding: utf-8
"""Tests for the bob_emploi.frontend.asynchronous.mail_advice module."""
import datetime
import signal
import unittest

import mock
import mongomock

from bob_emploi.frontend import advisor
from bob_emploi.frontend.asynchronous import mail_advice
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_USER_READY_FOR_EMAIL = {
    'featuresEnabled': {'advisorEmail': 'ACTIVE'},
    'profile': {
        'name': 'Pascal',
        'lastName': 'Corpet',
        'email': 'pascal@bayes.org',
        'emailDays': ['THURSDAY'],
    },
    'projects': [{'title': 'Project Title'}],
}


@mock.patch(mail_advice.__name__ + '.mail')
@mock.patch(advisor.__name__ + '.select_tips_for_email')
@mock.patch(advisor.__name__ + '.select_advice_for_email')
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    # TODO(pascal): Add more tests for sub functions and corner cases.

    def setUp(self):
        super(MailingTestCase, self).setUp()
        mail_advice.DRY_RUN = False
        self._db = mongomock.MongoClient().database
        self._db.advice_modules.insert_one({
            'adviceId': 'advice-to-send',
            'emailFacts': ['Inbox 0 is awesome'],
            'emailSubject': 'Advice Email Subject',
            'emailSuggestionSentence': 'check your inbox',
            'emailTitle': 'Advice Email Title',
        })
        self._now = datetime.datetime(2016, 11, 24, 10, 0, 0)

    def test_main(self, mock_select_advice, mock_select_tips, mock_mail):
        """Overall test."""
        mock_select_advice.return_value = project_pb2.Advice(
            advice_id='advice-to-send',
            num_stars=2,
        )
        mock_select_tips.return_value = [
            action_pb2.Action(title='First tip'),
            action_pb2.Action(title='Second tip'),
            action_pb2.Action(title='Third tip'),
        ]
        self._db.user.insert_one({
            'featuresEnabled': {'advisorEmail': 'ACTIVE'},
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal@bayes.org',
                'emailDays': ['MONDAY', 'THURSDAY'],
            },
            'projects': [{
                'advices': [{'adviceId': 'a'}, {'adviceId': 'b'}],
                'projectId': 'project-id-123',
                'title': 'Project Title',
            }],
        })
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        mock_mail.count_sent_to.return_value = {'DeliveredCount': 0, 'OpenedCount': 0}

        mail_advice.main(self._db, 'http://localhost:3000', self._now)
        self.assertTrue(mock_mail.send_template.called)
        template_id, profile, template_vars = mock_mail.send_template.call_args[0]
        self.assertEqual('132388', template_id)
        self.assertEqual('pascal@bayes.org', profile.email)
        self.assertEqual(
            {
                'advices': [{'adviceId': 'a'}, {'adviceId': 'b'}],
                'baseUrl': 'http://localhost:3000',
                'fact': 'Inbox 0 is awesome',
                'firstName': 'Pascal',
                'frequency': 'deux fois par semaine',
                'nextday': 'lundi',
                'numStars': 2,
                'projectId': 'project-id-123',
                'subject': 'Advice Email Subject',
                'suggestionSentence': 'check your inbox',
                'tips_0_title': 'First tip',
                'tips_1_title': 'Second tip',
                'tips_2_title': 'Third tip',
                'title': 'Advice Email Title',
            },
            template_vars)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_no_dupes(self, mock_select_advice, unused_mock_select_tips, mock_mail):
        """Test that we do not send duplicate emails if we run the script twice."""
        mock_select_advice.return_value = project_pb2.Advice(
            advice_id='advice-to-send',
            num_stars=2,
        )
        self._db.user.insert_one(_USER_READY_FOR_EMAIL)
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        mock_mail.count_sent_to.return_value = {'DeliveredCount': 0, 'OpenedCount': 0}

        mail_advice.main(self._db, 'http://localhost:3000', self._now)

        self.assertTrue(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)
        mock_mail.send_template.reset_mock()
        mock_mail.send_template_to_admins.reset_mock()

        # Running the script again 10 minutes later.
        mock_select_advice.return_value = project_pb2.Advice(
            advice_id='other-advice-to-send',
            num_stars=1,
        )
        mail_advice.main(
            self._db, 'http://localhost:3000', self._now + datetime.timedelta(minutes=10))
        self.assertFalse(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_signal(self, mock_select_advice, unused_mock_select_tips, mock_mail):
        """Test that the batch send fails gracefully on SIGTERM."""
        mock_select_advice.return_value = project_pb2.Advice(
            advice_id='advice-to-send',
            num_stars=2,
        )

        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        mock_mail.count_sent_to.return_value = {'DeliveredCount': 0, 'OpenedCount': 0}
        self._db.user.insert_many([
            dict(
                _USER_READY_FOR_EMAIL,
                _id=mongomock.ObjectId('580f4a4271cd4a0007672a%dd' % i))
            for i in range(10)
        ])

        users = list(self._db.user.find({}))

        db_user = mock.MagicMock()
        db_user.find.return_value = _SigtermAfterNItems(users, 3)
        self._db.user = db_user

        mail_advice.main(self._db, 'http://localhost:3000', self._now)

        self.assertEqual(4, mock_mail.send_template.call_count)
        self.assertEqual(4, db_user.update_one.call_count)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_6_weeks_not_open(self, mock_select_advice, unused_mock_select_tips, mock_mail):
        """Test that we disable emailing if users does not open their email for 5 days."""
        mock_select_advice.return_value = project_pb2.Advice(
            advice_id='advice-to-send',
            num_stars=2,
        )

        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_one(_USER_READY_FOR_EMAIL)

        # Running the script 5 weeks in a row.
        for week in range(5):
            mock_mail.count_sent_to.return_value = {'DeliveredCount': week, 'OpenedCount': 0}
            mail_advice.main(
                self._db, 'http://localhost:3000',
                self._now + datetime.timedelta(hours=24 * 7 * week))

        self.assertEqual(5, mock_mail.send_template.call_count)
        mock_mail.send_template.reset_mock()

        # Running on week 6.
        mock_mail.count_sent_to.return_value = {'DeliveredCount': 5, 'OpenedCount': 0}
        mail_advice.main(
            self._db, 'http://localhost:3000',
            self._now + datetime.timedelta(hours=24 * 7 * 6))

        self.assertFalse(mock_mail.send_template.called)
        user_in_db = self._db.user.find_one({})
        self.assertEqual([], user_in_db['profile'].get('emailDays', []))
        self.assertTrue(user_in_db['featuresEnabled'].get('autoStopEmails'))


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
        day = mail_advice.see_you_day([user_pb2.MONDAY, user_pb2.TUESDAY], user_pb2.MONDAY)
        self.assertEqual('demain', day)

    def test_see_you_later(self):
        """See you later."""
        day = mail_advice.see_you_day([], user_pb2.MONDAY)
        self.assertEqual('la prochaine', day)

    def test_see_you_other_day(self):
        """Other day of the week."""
        day = mail_advice.see_you_day([user_pb2.MONDAY, user_pb2.THURSDAY], user_pb2.MONDAY)
        self.assertEqual('jeudi', day)

    def test_see_you_other_day_next_week(self):
        """Other day of the next week."""
        day = mail_advice.see_you_day([user_pb2.MONDAY, user_pb2.THURSDAY], user_pb2.THURSDAY)
        self.assertEqual('lundi', day)

    def test_see_you_next_week(self):
        """See you next week."""
        day = mail_advice.see_you_day([user_pb2.MONDAY], user_pb2.MONDAY)
        self.assertEqual('la semaine prochaine', day)

    def test_see_you_other_day_unsorted(self):
        """Unsorted day list."""
        day = mail_advice.see_you_day(
            [user_pb2.MONDAY, user_pb2.SUNDAY, user_pb2.THURSDAY], user_pb2.MONDAY)
        self.assertEqual('jeudi', day)

    def test_frequency_never(self):
        """Frequency is not regular."""
        frequency = mail_advice.frequency([])
        self.assertEqual('de temps à autre', frequency)

    def test_frequency_every_thursday(self):
        """Frequency is weekly."""
        frequency = mail_advice.frequency([user_pb2.THURSDAY])
        self.assertEqual('tous les jeudis', frequency)

    def test_frequency_daily(self):
        """Frequency is daily."""
        frequency = mail_advice.frequency([
            user_pb2.MONDAY, user_pb2.TUESDAY, user_pb2.WEDNESDAY,
            user_pb2.THURSDAY, user_pb2.FRIDAY, user_pb2.SATURDAY,
            user_pb2.SUNDAY, user_pb2.MONDAY])
        self.assertEqual('tous les jours', frequency)

    def test_frequency_three_times_a_week(self):
        """Frequency is 3 times a week."""
        frequency = mail_advice.frequency([
            user_pb2.MONDAY, user_pb2.WEDNESDAY, user_pb2.FRIDAY])
        self.assertEqual('trois fois par semaine', frequency)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
