"""Tests for the coffee matching emails."""

import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous.mail import match_coffee
from bob_emploi.frontend.server.test import mailjetmock


# TODO(cyrille): Test more extensively.
@mailjetmock.patch()
@mock.patch(match_coffee.logging.__name__ + '.info')
@mock.patch(
    match_coffee.__name__ + '._USER_DB',
    new_callable=lambda: mongomock.MongoClient().user_test)
@mock.patch(
    match_coffee.__name__ + '._DB',
    new_callable=lambda: mongomock.MongoClient().test)
class MatchCoffeeTestCase(unittest.TestCase):
    """Tests for the blast_campaign function."""

    def test_blast_matches(self, mock_db, mock_user_db, mock_logging):
        """Basic test."""

        mock_db.job_group_info.insert_many([
            {
                '_id': 'M1203',
                'inDomain': 'dans la vie',
            },
            {
                '_id': 'K1903',
                'inDomain': 'dans le charbon',
            },
        ])
        mock_db.cities.insert_many([
            {
                '_id': '75056',
                'latitude': 48.86,
                'longitude': 2.34445,
            },
            {
                '_id': '76351',
                'latitude': 49.5,
                'longitude': 0.133333,
            },
        ])
        mock_user_db.user.insert_many([
            {
                'profile': {
                    'gender': 'MASCULINE',
                    'email': 'user1@example.com',
                    'name': 'Paul',
                    'lastName': 'Ochon',
                },
                'projects': [{
                    'targetJob': {'jobGroup': {'romeId': 'M1203'}},
                    'mobility': {
                        'city': {
                            'cityId': '75056',
                            'name': 'Paris 10e  Arrondissement',
                        },
                        'areaType': 'REGION',
                    },
                    'kind': 'REORIENTATION',
                }],
                'mayday': {'hasAcceptedCoffee': 'TRUE'},
            },
            {
                'profile': {
                    'gender': 'FEMININE',
                    'email': 'user2@example.com',
                    'name': 'Marie',
                    'lastName': 'Juana',
                },
                'projects': [{
                    'targetJob': {'jobGroup': {'romeId': 'K1903'}},
                    'mobility': {
                        'city': {
                            'cityId': '75056',
                            'name': 'Paris 1er Arrondissement',
                        },
                        'areaType': 'COUNTRY',
                    },
                    'kind': 'FIND_A_NEW_JOB',
                    'seniority': 'EXPERT',
                }],
                'mayday': {'hasAcceptedCoffee': 'TRUE'},
            }
        ])
        mock_user_db.helper.insert_many([
            {
                'email': 'helper1@example.com',
                'promises': [{'kind': 'HELP_COFFEE'}],
                'emailConfirmed': True,
                'cities': [{
                    'cityId': '75056',
                    'name': 'Paris 14e Arrondissement',
                }],
                'domains': ['M'],
                'isAvailableRemotely': True,
            },
            {
                'email': 'helper2@example.com',
                'promises': [
                    {'kind': 'HELP_COFFEE'},
                    {'kind': 'HELP_RESUME'}
                ],
                'emailConfirmed': True,
                'cities': [{
                    'cityId': '76351',
                    'name': 'Le Havre',
                }],
                'domains': ['K11,K12,K13,K14,K15,K19,K26'],
            }])
        match_coffee.main(['send', '--disable-sentry'])

        mails_sent = mailjetmock.get_all_sent_messages()
        self.assertEqual(
            ['helper1@example.com', 'user1@example.com'],
            sorted(m.recipient['Email'] for m in mails_sent),
            msg='2 emails expected: one for each in the first match\n{}'.format(mails_sent))
        self.assertEqual(
            {'pascal@bob-emploi.fr'},
            {m.properties['From']['Email'] for m in mails_sent})
        helper_1 = mock_user_db.helper.find_one({'email': 'helper1@example.com'})
        helper_2 = mock_user_db.helper.find_one({'email': 'helper2@example.com'})
        self.assertTrue(helper_1.get('emailsSent'))
        self.assertTrue(helper_1.get('promises', [{}])[0].get('isFulfilled'))
        self.assertFalse(helper_2.get('emailsSent'))
        self.assertFalse(helper_2.get('promises', [{}])[0].get('isFulfilled'))

        paul_ochon = mock_user_db.user.find_one({'profile.email': 'user1@example.com'})
        self.assertTrue(paul_ochon.get('emailsSent'))
        self.assertEqual(str(helper_1['_id']), paul_ochon.get('mayday', {}).get('coffeeHelperId'))

        mock_logging.assert_called_with('%d emails sent.', 1)

    def test_match_email(self, mock_db, mock_user_db, mock_logging):
        """Avoid matching a user with themselves, based on email."""

        mock_db.job_group_info.insert_one({
            '_id': 'A1234',
            'inDomain': 'dans la vie',
        })

        mock_user_db.user.insert_one({
            'profile': {'email': 'c.corpet@gmail.com'},
            'projects': [{'targetJob': {'jobGroup': {'romeId': 'A1234'}}}],
            'mayday': {'hasAcceptedCoffee': 'TRUE'},
        })
        mock_user_db.helper.insert_one({
            'email': 'ccorpet@gmail.com',
            'emailConfirmed': True,
            'promises': [{'kind': 'HELP_COFFEE'}],
            'isAvailableRemotely': True,
            'domains': ['A'],
        })

        match_coffee.main(['send', '--disable-sentry'])
        self.assertFalse(mailjetmock.get_all_sent_messages())
        mock_logging.assert_called_with('%d emails sent.', 0)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
