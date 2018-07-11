"""Unit tests for the mail module."""

import collections
import datetime
import unittest

import mailjet_rest
import requests

from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server.test import mailjetmock


_Recipient = collections.namedtuple('Recipient', ['email', 'name', 'last_name'])


@mailjetmock.patch()
class MailTest(unittest.TestCase):
    """Unit tests for the mail module."""

    def test_get_message(self):
        """get_message basic usage."""

        before = datetime.datetime.now()
        message_id = mailjet_rest.Client(version='v3.1').send.create({'Messages': [{
            'To': [{
                'Email': 'hello@example.com',
            }],
        }]}).json()['Messages'][0]['To'][0]['MessageID']

        message = mail.get_message(message_id)

        self.assertEqual(message_id, message.get('ID'))
        self.assertEqual('sent', message.get('Status'))
        arrived_at_string = message.get('ArrivedAt')
        arrived_at = datetime.datetime.strptime(arrived_at_string, '%Y-%m-%dT%H:%M:%SZ')
        self.assertGreaterEqual(arrived_at, before - datetime.timedelta(seconds=1))
        self.assertLessEqual(arrived_at, datetime.datetime.now() + datetime.timedelta(seconds=1))

    def test_too_many_get_message(self):
        """get_message when server has received too many get API requests already."""

        message_id = mailjet_rest.Client(version='v3.1').send.create({'Messages': [{
            'To': [{
                'Email': 'hello@example.com',
            }],
        }]}).json()['Messages'][0]['To'][0]['MessageID']

        mailjetmock.set_too_many_get_api_requests()

        with self.assertRaises(requests.HTTPError):
            mail.get_message(message_id)

    def test_get_message_unknown(self):
        """get_message for an unknown message."""

        message = mail.get_message('421')

        self.assertEqual(None, message)

    def test_send_template_multiple_recipients(self):
        """Send template to multiple recipients."""

        mail.send_template(
            '12345', _Recipient('1@me.com', 'Primary', 'Recipient'), {'custom': 'var'},
            other_recipients=[
                _Recipient('2@me.com', 'Secondary', 'Recipient'),
                _Recipient('3@me.com', 'Third', 'Recipient'),
            ])

        sent_emails = mailjetmock.get_all_sent_messages()

        self.assertEqual(
            ['1@me.com', '2@me.com', '3@me.com'],
            sorted(m.recipient['Email'] for m in sent_emails))
        self.assertEqual({12345}, {m.properties['TemplateID'] for m in sent_emails})

    def test_send_template_with_null(self):
        """Send null variable should return a 400 error."""

        res = mail.send_template(
            '12345', _Recipient('alice@help.me', 'Alice', 'NeedsHelp'), {'nullVar': None})

        with self.assertRaises(requests.HTTPError):
            res.raise_for_status()


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
