"""Tests for the mayday endpoints of the server module."""

import datetime
import json
import unittest
from urllib import parse

from bson import objectid
import mock
import requests_mock

from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mayday
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous.mail import bob_actions_help
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock


class MaydayEndpointTestCase(base_test.ServerTestCase):
    """Unit test for the mayday app endpoints."""

    def setUp(self):
        super(MaydayEndpointTestCase, self).setUp()
        mayday.clear_helper_count_cache()

    @requests_mock.mock()
    @mailjetmock.patch()
    @mock.patch(mayday.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    def test_create_user(self, mock_requests):
        """The user should be saved and email sent."""

        user_data = {
            'email': 'helper@bayes.org',
            'lastName': 'bob',
            'name': 'helper',
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
        }

        mock_requests.post('slack://bob-bots', json={
            'text': ':tada: A new helper for HELP_COFFEE',
        })

        response = self.app.post('/api/mayday/user', data=json.dumps(user_data))
        self.assertEqual(200, response.status_code)
        user_created = self._user_db.helper.find_one({'name': 'helper'})
        user_id = str(user_created['_id'])
        self.assertTrue(user_created)
        self.assertTrue(user_created.get('registeredAt'))
        self.assertEqual('helper@bayes.org', user_created.get('email'))
        self.assertEqual('bob', user_created.get('lastName'))
        promises = user_created.get('promises', [])
        promise = promises.pop()
        self.assertFalse(promises)
        self.assertEqual('HELP_COFFEE', promise.get('kind'))
        self.assertIn('promiseId', promise)
        self.assertEqual(user_created.get('registeredAt'), promise.get('registeredAt'))
        email_sent = next(iter(user_created.get('emailsSent', [])))
        self.assertTrue(email_sent)
        self.assertEqual('370931', email_sent.get('mailjetTemplate'))
        self.assertEqual('mayday-confirmation', email_sent.get('campaignId'))

        messages_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(messages_sent))
        self.assertEqual(370931, messages_sent[0].properties['TemplateID'])
        template_vars = messages_sent[0].properties['Variables']
        self.assertEqual(
            {
                'confirmUrl':
                    'http://localhost/api/mayday/confirm?userId={}&redirect={}'.format(
                        user_id, 'http%3A//localhost/BobAction/HELP_COFFEE%23merci'),
                'unsubscribeUrl':
                    'http://localhost/api/mayday/unsubscribe?userId={}'.format(user_id),
            },
            template_vars)
        self.assertEqual(200, response.status_code)

    @mailjetmock.patch()
    def test_update_user(self):
        """The user should be saved and an email sent."""

        self.app.post('/api/mayday/user', data=json.dumps({
            'email': 'helper@bayes.org',
            'lastName': 'bob',
            'name': 'helper',
            'promises': [{'kind': 'HELP_COFFEE'}],
        }))

        mailjetmock.clear_sent_messages()

        user_data = {
            'email': 'helper@bayes.org',
            'name': 'Marie Laure',
            'promises': [{
                'kind': 'HELP_COVER_LETTER',
            }],
        }

        response = self.app.post('/api/mayday/user', data=json.dumps(user_data))
        self.assertEqual(200, response.status_code)
        user_updated = self._user_db.helper.find_one({'name': 'helper'})
        self.assertTrue(user_updated)
        self.assertEqual('helper@bayes.org', user_updated.get('email'))
        self.assertEqual('bob', user_updated.get('lastName'))
        promises = [
            promise.get('kind')
            for promise in user_updated.get('promises', [])
        ]
        self.assertIn('HELP_COFFEE', promises)
        self.assertIn('HELP_COVER_LETTER', promises)
        self.assertEqual(2, len(promises))

        # Mail is not called at user update.
        self.assertFalse(mailjetmock.get_all_sent_messages())
        self.assertEqual(200, response.status_code)

    @mailjetmock.patch()
    def test_update_user_by_user_id(self):
        """The user should be updated, but promises should be kept."""

        self.app.post('/api/mayday/user', data=json.dumps({
            'email': 'helper@bayes.org',
            'lastName': 'bob',
            'name': 'helper',
            'promises': [{'kind': 'HELP_COFFEE'}],
        }))

        mailjetmock.clear_sent_messages()

        helper_id = str(self._user_db.helper.find_one({'name': 'helper'})['_id'])

        user_data = {
            'email': 'helper@bayes.org',
            'name': 'Marie Laure',
            'domains': ['E', 'K'],
            'userId': helper_id,
        }

        response = self.app.post('/api/mayday/user', data=json.dumps(user_data))
        self.assertEqual(200, response.status_code)

        user_updated = self._user_db.helper.find_one()
        self.assertTrue(user_updated)
        self.assertEqual('helper@bayes.org', user_updated.get('email'))
        self.assertEqual(
            ['HELP_COFFEE'],
            [
                promise.get('kind')
                for promise in user_updated.get('promises', [])
            ])
        self.assertEqual(['E', 'K'], user_updated.get('domains'))
        self.assertEqual('Marie Laure', user_updated.get('name'))

        # Mail is not called at user update.
        self.assertFalse(mailjetmock.get_all_sent_messages())

    @mock.patch(mayday.logging.__name__ + '.warning')
    @mock.patch(mayday.mail.__name__ + '.send_template')
    def test_mail_not_sent(self, mock_mail, mock_logging):
        """The user should be saved but email has not been sent."""

        user_data = {
            'email': 'helper@bayes.org',
            'lastName': 'bob',
            'name': 'helper',
            'promises': [{
                'kind': 'HELP_COVER_LETTER',
            }],
        }
        mock_mail().status_code = 400
        mock_logging.reset_mock()

        response = self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_created = self._user_db.helper.find_one({'name': 'helper'})
        self.assertTrue(user_created)
        self.assertEqual(200, response.status_code)
        mock_logging.assert_called_once()

    @mock.patch(mayday.now.__name__ + '.get')
    def test_count_real_users(self, mock_now):
        """A real total count of users should be returned."""

        mock_now.return_value = datetime.datetime(2018, 4, 26)
        for user_id in range(0, 600):
            self.app.post('/api/mayday/user', data=json.dumps({
                'email': 'helper@bayes.org{}'.format(user_id),
                'promises': [{'kind': 'HELP_COFFEE'}],
            }))
        response = self.app.get('/api/mayday/count')
        self.assertEqual(600, self.json_from_response(response)['totalHelperCount'])

    @mock.patch(mayday.now.__name__ + '.get')
    @mailjetmock.patch()
    def test_no_count_test_users(self, mock_now):
        """Test users should not be counted."""

        mock_now.return_value = datetime.datetime(2018, 4, 26)
        for nth in range(400):
            self.app.post('/api/mayday/user', data=json.dumps({
                'email': 'helper{}@help.me'.format(nth),
                'lastName': 'bob',
                'name': 'helper',
                'promises': [{'kind': 'HELP_COFFEE'}],
            }))
        self.app.post('/api/mayday/user', data=json.dumps({
            'email': 'helper@example.com',
            'lastName': 'bob',
            'name': 'test helper',
            'promises': [{'kind': 'HELP_COFFEE'}],
        }))
        response = self.app.get('/api/mayday/count')
        self.assertEqual(
            {
                'totalHelperCount': 400,
                'actionHelperCount': {
                    'HELP_COFFEE': 400,
                },
            },
            self.json_from_response(response))

    @mailjetmock.patch()
    def test_not_whitelisted_for_email_confirmation(self):
        """The user should be saved but email not sent."""

        user_data = {
            'email': 'helper@help.me',
            'lastName': 'bob',
            'name': 'helper',
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
        }

        response = self.app.post('/api/mayday/user', data=json.dumps(user_data))
        self.assertEqual(200, response.status_code)
        user_created = self._user_db.helper.find_one({'name': 'helper'})
        self.assertEqual('helper@help.me', user_created.get('email'))

        self.assertFalse(len(mailjetmock.get_all_sent_messages()))

    def test_confirm_email(self):
        """Confirming a user's email."""

        # Create a user.
        user_data = {
            'email': 'helper@example.com',
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
        }
        self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_id = str(self._user_db.helper.find_one({}).get('_id'))
        response = self.app.get(
            '/api/mayday/confirm?userId={}&redirect=http:%2F%2Fbob'.format(user_id))
        self.assertEqual(302, response.status_code)
        self.assertEqual('http://bob', response.location)

        helper_data = self._user_db.helper.find_one({})
        self.assertEqual('helper@example.com', helper_data.get('email'))
        self.assertTrue(helper_data.get('emailConfirmed'))

    def test_unsubscribe(self):
        """Unsubscribe a helper."""

        # Create a user.
        user_data = {
            'email': 'helper@example.com',
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
        }
        self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_id = str(self._user_db.helper.find_one({}).get('_id'))
        response = self.app.get('/api/mayday/unsubscribe?userId={}'.format(user_id))
        self.assertEqual(200, response.status_code)
        self.assertEqual('Votre compte a été supprimé.', response.get_data(as_text=True))

        helper_data = self._user_db.helper.find_one({})
        self.assertEqual(user_id, str(helper_data.get('_id')))
        self.assertEqual('REDACTED', helper_data.get('email'))
        self.assertEqual(
            ['HELP_COFFEE'],
            [p.get('kind') for p in helper_data.get('promises', [])])
        self.assertTrue(helper_data.get('deletedAt'))

    @requests_mock.mock()
    @mailjetmock.patch()
    @mock.patch(mayday.auth.__name__ + '.client.verify_id_token')
    @mock.patch(mayday.auth.__name__ + '._ADMIN_AUTH_TOKEN', 'admin-secret-token')
    @mock.patch(mayday.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    def test_confirm_review_done_by_margaux(self, mock_requests, mock_verify_id_token):
        """Margaux (@bayesimpact.org but not admin) confirms that a review was done."""

        self._user_db.helper.insert_one({
            '_id': objectid.ObjectId('186a7a18faed68d018e16471'),
            'email': 'helper@gmail.com',
            'promises': [{
                'kind': 'HELP_RESUME',
                'documentsByOwnerName': {
                    'bob': '5ae7156cba168b00135fe300',
                    'alice': '5ae7156cba168b00135fe301',
                    'eve': '5ae7156cba168b00135fe302',
                },
            }],
        })
        self._user_db.cvs_and_cover_letters.insert_many([
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe300'),
                'name': 'Bob',
                'ownerEmail': 'bob@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe301'),
                'name': 'Alice',
                'ownerEmail': 'alice@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe302'),
                'name': 'Eve',
                'ownerEmail': 'eve@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
        ])

        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'margaux@bayesimpact.org',
            'sub': '12345',
        }

        mock_requests.post('slack://bob-bots', json={
            'text': ':tada: A #BobAction promise was fulfilled for HELP_RESUME',
        })

        result = self.app.post(
            '/api/mayday/review/done',
            data=json.dumps({
                'reviewerEmail': 'helper@gmail.com',
                'documentOwnerName': 'alice',
                'customerSupportText': 'Yay',
                'reviewContent': 'Congrats Alice\nAwesome CV <3',
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer google-auth-token'})
        self.assertEqual(200, result.status_code, msg=result.get_data(as_text=True))

        sent_emails = mailjetmock.get_all_sent_messages()
        self.assertEqual(
            ['alice@helpme.com', 'helper@gmail.com'],
            sorted(m.recipient['Email'] for m in sent_emails))
        mail_to_alice = next(m for m in sent_emails if m.recipient['Email'] == 'alice@helpme.com')
        self.assertEqual(
            {'name': 'Alice', 'review': 'Congrats Alice<br/>\nAwesome CV &lt;3'},
            mail_to_alice.properties['Variables'],
        )

    @mailjetmock.patch()
    @mock.patch(mayday.now.__name__ + '.get')
    @mock.patch(mayday.auth.__name__ + '._ADMIN_AUTH_TOKEN', 'admin-secret-token')
    def test_confirm_review_done(self, mock_now):
        """Confirm that a review was done."""

        self._user_db.helper.insert_one({
            '_id': objectid.ObjectId('186a7a18faed68d018e16471'),
            'email': 'helper@gmail.com',
            'promises': [{
                'kind': 'HELP_RESUME',
                'documentsByOwnerName': {
                    'bob': '5ae7156cba168b00135fe300',
                    'alice': '5ae7156cba168b00135fe301',
                    'eve': '5ae7156cba168b00135fe302',
                },
            }],
        })
        self._user_db.cvs_and_cover_letters.insert_many([
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe300'),
                'name': 'Bob',
                'ownerEmail': 'bob@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe301'),
                'name': 'Alice',
                'ownerEmail': 'alice@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe302'),
                'name': 'Eve',
                'ownerEmail': 'eve@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_SENT',
                }],
                'numPendingReviews': 1,
            },
        ])

        mock_now.return_value = datetime.datetime(2018, 5, 3, 17, 32)

        result = self.app.post(
            '/api/mayday/review/done',
            data='{"reviewerEmail": "helper@gmail.com", "documentOwnerName": "alice", '
            '"customerSupportText": "Yay"}',
            content_type='application/json',
            headers={'Authorization': 'admin-secret-token'})
        response = self.json_from_response(result)
        self.assertEqual({'ownerEmail': 'alice@helpme.com'}, response)

        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))
        helper = self._user_db.helper.find_one()
        self.assertEqual(
            {
                'kind': 'HELP_RESUME',
                'documentsByOwnerName': {
                    'bob': '5ae7156cba168b00135fe300',
                    'alice': '5ae7156cba168b00135fe301',
                    'eve': '5ae7156cba168b00135fe302',
                },
                'fulfilledAt': '2018-05-03T17:32:00Z',
                'isFulfilled': True,
            },
            helper['promises'][0])

        document = self._user_db.cvs_and_cover_letters.find_one(
            {'_id': objectid.ObjectId('5ae7156cba168b00135fe301')})
        del document['_id']
        self.assertEqual(
            {
                'name': 'Alice',
                'ownerEmail': 'alice@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_DONE',
                }],
                'numPendingReviews': 0,
                'numDoneReviews': 1,
            },
            document)

    @mailjetmock.patch()
    @mock.patch(mayday.now.__name__ + '.get')
    @mock.patch(mayday.auth.__name__ + '._ADMIN_AUTH_TOKEN', 'admin-secret-token')
    def test_confirm_timeout_review_done(self, mock_now):
        """Confirm that a timed out review was done."""

        self._user_db.helper.insert_one({
            '_id': objectid.ObjectId('186a7a18faed68d018e16471'),
            'email': 'helper@gmail.com',
            'promises': [{
                'kind': 'HELP_RESUME',
                'documentsByOwnerName': {
                    'bob': '5ae7156cba168b00135fe300',
                    'alice': '5ae7156cba168b00135fe301',
                    'eve': '5ae7156cba168b00135fe302',
                },
            }],
        })
        self._user_db.cvs_and_cover_letters.insert_many([
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe300'),
                'name': 'Bob',
                'ownerEmail': 'bob@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_TIME_OUT',
                }],
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe301'),
                'name': 'Alice',
                'ownerEmail': 'alice@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_TIME_OUT',
                }],
            },
            {
                '_id': objectid.ObjectId('5ae7156cba168b00135fe302'),
                'name': 'Eve',
                'ownerEmail': 'eve@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_TIME_OUT',
                }],
            },
        ])

        mock_now.return_value = datetime.datetime(2018, 5, 3, 17, 32)

        result = self.app.post(
            '/api/mayday/review/done',
            data='{"reviewerEmail": "helper@gmail.com", "documentOwnerName": "alice", '
            '"customerSupportText": "Yay"}',
            content_type='application/json',
            headers={'Authorization': 'admin-secret-token'})
        response = self.json_from_response(result)
        self.assertEqual({'ownerEmail': 'alice@helpme.com'}, response)

        self.assertEqual(1, len(mailjetmock.get_all_sent_messages()))
        helper = self._user_db.helper.find_one()
        self.assertEqual(
            {
                'kind': 'HELP_RESUME',
                'documentsByOwnerName': {
                    'bob': '5ae7156cba168b00135fe300',
                    'alice': '5ae7156cba168b00135fe301',
                    'eve': '5ae7156cba168b00135fe302',
                },
                'fulfilledAt': '2018-05-03T17:32:00Z',
                'isFulfilled': True,
            },
            helper['promises'][0])

        document = self._user_db.cvs_and_cover_letters.find_one(
            {'_id': objectid.ObjectId('5ae7156cba168b00135fe301')})
        del document['_id']
        self.assertEqual(
            {
                'name': 'Alice',
                'ownerEmail': 'alice@helpme.com',
                'reviews': [{
                    'reviewerId': '186a7a18faed68d018e16471',
                    'status': 'REVIEW_DONE',
                }],
                'numDoneReviews': 1,
            },
            document)

    @requests_mock.mock()
    @mailjetmock.patch()
    @mock.patch(mayday.auth.__name__ + '.client.verify_id_token')
    @mock.patch(mayday.auth.__name__ + '._ADMIN_AUTH_TOKEN', 'admin-secret-token')
    @mock.patch(mayday.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    def test_confirm_bob_review_done(self, mock_requests, mock_verify_id_token):
        """Review is done by a Bob team member, without a previous promise."""

        self._user_db.cvs_and_cover_letters.insert_one({
            '_id': objectid.ObjectId('5ae7156cba168b00135fe300'),
            'kind': 'DOCUMENT_RESUME',
            'name': 'Alice',
            'ownerEmail': 'alice@helpme.com',
        })
        mock_verify_id_token.return_value = {
            'iss': 'accounts.google.com',
            'email': 'margaux@bayesimpact.org',
            'sub': '12345',
        }

        mock_requests.post('slack://bob-bots', json={
            'text': ':tada: A DOCUMENT_RESUME was reviewed by a team member',
        })

        result = self.app.post(
            '/api/mayday/review/done',
            data=json.dumps({
                'reviewerEmail': 'margaux@bayesimpact.org',
                'customerSupportText': 'Yay',
                'documentId': '5ae7156cba168b00135fe300',
                'reviewContent': 'Congrats Alice\nAwesome CV <3',
            }),
            content_type='application/json',
            headers={'Authorization': 'Bearer google-auth-token'})
        self.assertEqual(200, result.status_code, msg=result.get_data(as_text=True))

        sent_emails = mailjetmock.get_all_sent_messages()
        self.assertEqual(
            ['alice@helpme.com'],
            list(m.recipient['Email'] for m in sent_emails))
        mail_to_alice = sent_emails.pop()
        self.assertEqual(
            {'name': 'Alice', 'review': 'Congrats Alice<br/>\nAwesome CV &lt;3'},
            mail_to_alice.properties['Variables'],
        )
        document = self._user_db.cvs_and_cover_letters.find_one()
        self.assertTrue(document and document.get('numDoneReviews'))

    @requests_mock.mock()
    @mock.patch(mayday.__name__ + '._SLACK_WEBHOOK_URL', 'slack://bob-bots')
    def test_fulfill_promise(self, mock_requests):
        """Fulfill a promise."""

        # Create a user.
        user_data = {
            'email': 'helper@example.com',
            'promises': [
                {'kind': 'HELP_COFFEE'},
                {'kind': 'HELP_RESUME'},
            ],
        }
        mock_requests.post('slack://bob-bots')
        self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_json = self._user_db.helper.find_one({})
        user_id = user_json.pop('_id')
        user = proto.create_from_mongo(user_json, helper_pb2.Helper)
        promise_id = bob_actions_help.get_first_unfulfilled_promise(
            user, helper_pb2.HELP_COFFEE)

        mock_requests.post('slack://bob-bots', json={
            'text': ':tada: A #BobAction promise was fulfilled',
        })

        response = self.app.get('/api/mayday/fulfill?userId={}&promiseId={}'.format(
            user_id, promise_id))
        self.assertEqual(200, response.status_code)
        self.assertEqual('Vous avez tenu votre promesse !', response.get_data(as_text=True))

        helper_data = self._user_db.helper.find_one({})
        fulfilled_promise = next(promise for promise in helper_data.get('promises', []))
        self.assertTrue(fulfilled_promise.get('isFulfilled'))

    def test_fulfill_promise_redirect(self):
        """Fulfill a promise and redirect."""

        # Create a user.
        user_data = {
            'email': 'helper@example.com',
            'promises': [
                {'kind': 'HELP_COFFEE'},
                {'kind': 'HELP_RESUME'},
            ],
        }
        self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_json = self._user_db.helper.find_one({})
        user_id = user_json.pop('_id')
        user = proto.create_from_mongo(user_json, helper_pb2.Helper)
        promise_id = bob_actions_help.get_first_unfulfilled_promise(
            user, helper_pb2.HELP_COFFEE)

        response = self.app.get('/api/mayday/fulfill?userId={}&promiseId={}&redirect={}'.format(
            user_id, promise_id, parse.quote('https://www.google.fr')))
        self.assertEqual(302, response.status_code)
        self.assertEqual('https://www.google.fr', response.headers.get('Location'))

        helper_data = self._user_db.helper.find_one({})
        fulfilled_promise = next(promise for promise in helper_data.get('promises', []))
        self.assertTrue(fulfilled_promise.get('isFulfilled'))

    def test_add_promise(self):
        """Add a promise to a helper."""

        # Create a user.
        user_data = {
            'email': 'helper@example.com',
            'promises': [
                {'kind': 'HELP_COFFEE'},
                {'kind': 'HELP_RESUME'},
            ],
        }
        self.app.post('/api/mayday/user', data=json.dumps(user_data))
        user_json = self._user_db.helper.find_one({})
        user_id = user_json.pop('_id')

        response = self.app.get('/api/mayday/promise?user={}&kind={}&redirect={}'.format(
            user_id, 'HELP_COFFEE', parse.quote('https://www.google.fr')))
        self.assertEqual(302, response.status_code)
        self.assertEqual('https://www.google.fr', response.headers.get('Location'))

        helper_data = self._user_db.helper.find_one({})
        promises = helper_data.get('promises', [])
        self.assertEqual(3, len(promises))
        self.assertEqual(
            ['HELP_COFFEE', 'HELP_RESUME', 'HELP_COFFEE'],
            list(promise.get('kind') for promise in promises))

    def test_confirm_coffee(self):
        """Confirm whether a user is OK to have coffee."""

        user_id, unused_auth_token = self.create_user_with_token()
        coffee_token = auth.create_token(user_id, 'coffee')

        response = self.app.get(
            '/api/mayday/coffee/accept?user={}&token={}'.format(user_id, coffee_token),
        )

        response_text = response.get_data(as_text=True)
        self.assertEqual(200, response.status_code, msg=response_text)
        self.assertEqual(
            'Merci pour votre réponse. Nous vous recontacterons par email avec '
            'le contact de la personne volontaire.',
            response_text)

        user_data = self._user_db.user.find_one({})
        user = proto.create_from_mongo(user_data, user_pb2.User)
        self.assertEqual(user_pb2.TRUE, user.mayday.has_accepted_coffee)

    def test_decline_coffee(self):
        """Mark a user not OK to have coffee."""

        user_id, unused_auth_token = self.create_user_with_token()
        coffee_token = auth.create_token(user_id, 'coffee')

        response = self.app.get(
            '/api/mayday/coffee/decline?user={}&token={}'.format(user_id, coffee_token),
        )

        response_text = response.get_data(as_text=True)
        self.assertEqual(200, response.status_code, msg=response_text)
        self.assertEqual('Merci pour votre réponse. Bonne journée.', response_text)

        user_data = self._user_db.user.find_one({})
        user = proto.create_from_mongo(user_data, user_pb2.User)
        self.assertEqual(user_pb2.FALSE, user.mayday.has_accepted_coffee)

    def test_unknown_answer_for_coffee(self):
        """A user answers weirdly to the question for coffee."""

        user_id, unused_auth_token = self.create_user_with_token()
        coffee_token = auth.create_token(user_id, 'coffee')

        response = self.app.get(
            '/api/mayday/coffee/whatever?user={}&token={}'.format(user_id, coffee_token),
        )

        response_text = response.get_data(as_text=True)
        self.assertEqual(422, response.status_code, msg=response_text)

        user_data = self._user_db.user.find_one({})
        user = proto.create_from_mongo(user_data, user_pb2.User)
        self.assertFalse(user.mayday.has_accepted_coffee)

    def test_interested(self):
        """A helper said they were interested in future Bayes campaigns."""

        self._user_db.helper.insert_one({
            '_id': objectid.ObjectId('123456789012345678901234'),
            'email': 'i.wanna@help.you',
        })

        response = self.app.get('/api/mayday/interested?user={}&redirect={}'.format(
            '123456789012345678901234', parse.quote('https://www.google.fr')))
        self.assertEqual(302, response.status_code)
        volunteer = self._user_db.volunteer.find_one()
        self.assertEqual('i.wanna@help.you', volunteer.get('email'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
