# encoding: utf-8
"""Tests for the bob_emploi.frontend.asynchronous.mail_nps module."""
import datetime
import signal
import unittest

import mock
import mongomock

from bob_emploi.frontend.asynchronous import mail_nps

_USER_PENDING_NPS_DICT = {
    'profile': {
        'name': 'Pascal',
        'lastName': 'Corpet',
        'email': 'pascal@bayes.org',
    },
    'featuresEnabled': {
        'netPromoterScoreEmail': 'NPS_EMAIL_PENDING',
    },
    'registeredAt': '2016-11-22T10:00:00Z',
    'projects': [{
        'title': 'Project Title',
    }],
}


@mock.patch(mail_nps.__name__ + '.mail')
class MailingTestCase(unittest.TestCase):
    """Unit tests."""

    def setUp(self):
        super(MailingTestCase, self).setUp()
        mail_nps.DRY_RUN = False
        self._db = mongomock.MongoClient().database
        self._now = datetime.datetime(2016, 11, 24, 10, 0, 0)

    def test_main(self, mock_mail):
        """Overall test."""
        self._db.user.insert_one({
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
            },
            'featuresEnabled': {
                'netPromoterScoreEmail': 'NPS_EMAIL_PENDING',
            },
            'registeredAt': datetime.datetime(2016, 11, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
            }],
        })
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')
        self.assertTrue(mock_mail.send_template.called)
        template_id, profile, template_vars = mock_mail.send_template.call_args[0]
        self.assertEqual('100819', template_id)
        self.assertEqual('pascal+test@bayes.org', profile.email)
        self.assertEqual(
            {
                'baseUrl': 'http://localhost:3000',
                'emailInUrl': 'pascal%2Btest%40bayes.org',
                'firstName': 'Pascal',
                'dateInUrl': '2016-11-24',
            },
            template_vars)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_too_soon(self, mock_mail):
        """Test that we do not send the NPS email if the user registered recently."""
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_one(
            dict(
                _USER_PENDING_NPS_DICT,
                registeredAt=(self._now - datetime.timedelta(hours=6)).isoformat() + 'Z'))

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '0')

        self.assertFalse(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_no_incomplete(self, mock_mail):
        """Do not send if project is not complete."""
        self._db.user.insert_one({
            'profile': {
                'name': 'Pascal',
                'lastName': 'Corpet',
                'email': 'pascal+test@bayes.org',
            },
            'featuresEnabled': {
                'netPromoterScoreEmail': 'NPS_EMAIL_PENDING',
            },
            'registeredAt': datetime.datetime(2016, 11, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
                'isIncomplete': True,
            }],
        })
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')
        self.assertFalse(mock_mail.send_template.called)

    def test_no_dupes(self, mock_mail):
        """Test that we do not send duplicate emails if we run the script twice."""
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
        self._db.user.insert_one(_USER_PENDING_NPS_DICT)

        mail_nps.main(self._db.user, 'http://localhost:3000', self._now, '1')

        self.assertTrue(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)
        mock_mail.send_template.reset_mock()
        mock_mail.send_template_to_admins.reset_mock()

        # Running the script again 10 minutes later.
        mail_nps.main(
            self._db.user, 'http://localhost:3000', self._now + datetime.timedelta(minutes=10), '1')
        self.assertFalse(mock_mail.send_template.called)
        self.assertTrue(mock_mail.send_template_to_admins.called)

    def test_signal(self, mock_mail):
        """Test that the batch send fails gracefully on SIGTERM."""
        mock_mail.send_template.return_value.status_code = 200
        mock_mail.send_template_to_admins.return_value.status_code = 200
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

        self.assertEqual(4, mock_mail.send_template.call_count)
        self.assertEqual(4, db_user.update_one.call_count)
        self.assertTrue(mock_mail.send_template_to_admins.called)


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
