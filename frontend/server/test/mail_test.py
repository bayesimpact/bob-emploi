"""Unit tests for the mail module."""

import datetime
import typing
import unittest
from unittest import mock

import mailjet_rest
import requests

from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail.templates import mailjet_templates
from bob_emploi.frontend.server.test import mailjetmock


class _Recipient(typing.NamedTuple):
    email: str
    name: str
    last_name: str
    locale: str


@mailjetmock.patch()
@mock.patch.dict(mailjet_templates.MAP, {'imt': {'mailjetTemplate': 12345, 'i18n': {'en': 98765}}})
class MailTest(unittest.TestCase):
    """Unit tests for the mail module."""

    def test_get_message(self) -> None:
        """get_message basic usage."""

        before = datetime.datetime.now()
        message_id = mailjet_rest.Client(version='v3.1').send.create({'Messages': [{
            'To': [{
                'Email': 'hello@example.com',
            }],
            'TemplateID': 123456,
        }]}).json()['Messages'][0]['To'][0]['MessageID']

        message = mail_send.get_message(message_id)

        assert message
        self.assertEqual(message_id, message.get('ID'))
        self.assertEqual('sent', message.get('Status'))
        arrived_at_string = message.get('ArrivedAt')
        assert isinstance(arrived_at_string, str)
        arrived_at = datetime.datetime.strptime(arrived_at_string, '%Y-%m-%dT%H:%M:%SZ')
        self.assertGreaterEqual(arrived_at, before - datetime.timedelta(seconds=1))
        self.assertLessEqual(arrived_at, datetime.datetime.now() + datetime.timedelta(seconds=1))

    def test_too_many_get_message(self) -> None:
        """get_message when server has received too many get API requests already."""

        message_id = mailjet_rest.Client(version='v3.1').send.create({'Messages': [{
            'To': [{
                'Email': 'hello@example.com',
            }],
            'TemplateID': 123456,
        }]}).json()['Messages'][0]['To'][0]['MessageID']

        mailjetmock.set_too_many_get_api_requests()

        with self.assertRaises(requests.HTTPError):
            mail_send.get_message(message_id)

    def test_get_message_unknown(self) -> None:
        """get_message for an unknown message."""

        message = mail_send.get_message(421)

        self.assertEqual(None, message)

    def test_send_template_not_to_example(self) -> None:
        """Do not send template to test addresses."""

        mail_send.send_template(
            'imt', _Recipient('REDACTED', 'Primary', 'Recipient', ''), {'custom': 'var'})

        sent_emails = mailjetmock.get_all_sent_messages()

        self.assertEqual([], sorted(m.recipient['Email'] for m in sent_emails))

        mail_send.send_template(
            'imt', _Recipient('pascal@example.com', 'Primary', 'Recipient', ''), {'custom': 'var'})

        sent_emails = mailjetmock.get_all_sent_messages()

        self.assertEqual([], sorted(m.recipient['Email'] for m in sent_emails))

    def test_send_template_to_english(self) -> None:
        """Choose the relevant mailjet template for other locales."""

        mail_send.send_template(
            'imt', _Recipient('1@me.com', 'Primary', 'Recipient', 'en'), {'custom': 'var'})

        sent_emails = mailjetmock.get_all_sent_messages()

        self.assertEqual(['1@me.com'], [m.recipient['Email'] for m in sent_emails])
        self.assertEqual({98765}, {m.properties['TemplateID'] for m in sent_emails})

    def test_send_template_multiple_recipients(self) -> None:
        """Send template to multiple recipients."""

        mail_send.send_template(
            'imt', _Recipient('1@me.com', 'Primary', 'Recipient', ''), {'custom': 'var'},
            other_recipients=[
                _Recipient('2@me.com', 'Secondary', 'Recipient', ''),
                _Recipient('3@me.com', 'Third', 'Recipient', ''),
            ])

        sent_emails = mailjetmock.get_all_sent_messages()

        self.assertEqual(
            ['1@me.com', '2@me.com', '3@me.com'],
            sorted(m.recipient['Email'] for m in sent_emails))
        self.assertEqual({12345}, {m.properties['TemplateID'] for m in sent_emails})

    def test_send_template_with_null(self) -> None:
        """Send null variable should return an error."""

        with self.assertRaises(ValueError):
            mail_send.send_template(
                'imt', _Recipient('alice@help.me', 'Alice', 'NeedsHelp', ''), {'nullVar': None})

    def test_dry_run(self) -> None:
        """Test the create_email_sent_protos function."""

        res = mail_send.send_template(
            'imt', _Recipient('alice@help.me', 'Alice', 'NeedsHelp', ''), {}, dry_run=True)

        self.assertEqual(200, res.status_code)
        res.raise_for_status()
        self.assertFalse(mail_send.create_email_sent_proto(res))

    def test_create_email_sent_protos(self) -> None:
        """Test the create_email_sent_protos function."""

        res = mail_send.send_template(
            'imt', _Recipient('1@me.com', 'Primary', 'Recipient', ''), {'custom': 'var'},
            other_recipients=[
                _Recipient('2@me.com', 'Secondary', 'Recipient', ''),
                _Recipient('3@me.com', 'Third', 'Recipient', ''),
            ])

        with mock.patch(mail_send.now.__name__ + '.get') as mock_now:
            mock_now.return_value = datetime.datetime(2018, 11, 28, 17, 10)
            protos = list(mail_send.create_email_sent_protos(res))

        self.assertEqual(3, len(protos), msg=protos)
        self.assertEqual(3, len({p.mailjet_message_id for p in protos}), msg=protos)
        self.assertEqual(
            {datetime.datetime(2018, 11, 28, 17, 10)},
            {p.sent_at.ToDatetime() for p in protos},
            msg=protos)


if __name__ == '__main__':
    unittest.main()
