"""Modules to test the A-Li endpoints."""

import unittest

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock


class UserEndpointTestCase(base_test.ServerTestCase):
    """Test suite for the user saving endpoint."""

    def test_send_email_without_email(self) -> None:
        """Cannot send data to a user without email."""

        response = self.app.post(
            '/api/ali/user', data='{"counselor_name": "thing"}',
            content_type='application/json')
        self.assertEqual(400, response.status_code)

    @mailjetmock.patch()
    def test_send_email_to_user_only(self) -> None:
        """Send data to user only when having not enough info for counselor."""

        self.assertFalse(mailjetmock.get_all_sent_messages())
        response = self.app.post(
            '/api/ali/user',
            data=('{"user_email": "foo@bar.fr", "counselor_name": "Bobbie",'
                  '"results_url": "http://www.foo.bar"}'),
            content_type='application/json')
        post_response = self.json_from_response(response)
        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(mails_sent), msg=mails_sent)
        self.assertEqual({'hasUserEmail': True}, post_response)
        self.assertEqual('foo@bar.fr', mails_sent[0].recipient['Email'])
        data = mails_sent[0].properties['Variables']
        self.assertEqual('foo@bar.fr', data['userEmail'])
        self.assertEqual('Bobbie', data['counselorName'])
        self.assertIn('http://www.foo.bar', data['directLink'])

    @mailjetmock.patch()
    def test_send_email_to_everyone(self) -> None:
        """Send data to counselor and user when having both email adresses."""

        self.assertFalse(mailjetmock.get_all_sent_messages())
        response = self.app.post(
            '/api/ali/user',
            data=('{"user_email": "foo@bar.fr", "counselor_name": "Bobbie",'
                  '"counselor_email": "bob@bob.fr", "results_url": "http://www.foo.bar"}'),
            content_type='application/json')

        post_response = self.json_from_response(response)
        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(2, len(mails_sent), msg=mails_sent)
        self.assertEqual({'hasCounselorEmail': True, 'hasUserEmail': True}, post_response)
        self.assertEqual('foo@bar.fr', mails_sent[0].recipient['Email'])
        self.assertEqual('bob@bob.fr', mails_sent[1].recipient['Email'])
        data = mails_sent[0].properties['Variables']
        self.assertEqual('foo@bar.fr', data['userEmail'])
        self.assertEqual('bob@bob.fr', data['counselorEmail'])
        self.assertEqual('Bobbie', data['counselorName'])
        self.assertIn('http://www.foo.bar', data['directLink'])


if __name__ == '__main__':
    unittest.main()
