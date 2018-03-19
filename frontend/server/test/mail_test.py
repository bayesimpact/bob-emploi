"""Unit tests for the mail module."""

import unittest

import mock

from bob_emploi.frontend.server import mail


def _mock_response(json_data):
    response = mock.Mock()
    response.json.return_value = json_data
    return response


@mock.patch(mail.mailjet_rest.__name__ + '.Client')
class MailTestCase(unittest.TestCase):
    """Unit tests for the mail module."""

    def test_get_message(self, mock_mail_client):
        """get_message basic usage."""

        mock_mail_client().message.get.return_value.json.return_value = {
            'Count': 1,
            'Data': [{
                'ID': '421',
                'Status': 'sent',
            }],
        }

        message = mail.get_message('421')

        self.assertEqual({'ID': '421', 'Status': 'sent'}, message)
        mock_mail_client().message.get.assert_called_once_with('421')

    def test_get_message_unknown(self, mock_mail_client):
        """get_message for an unknown message."""

        mock_mail_client().message.get.return_value.json.return_value = {'Count': 0}

        message = mail.get_message('421')

        self.assertEqual(None, message)
        mock_mail_client().message.get.assert_called_once_with('421')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
