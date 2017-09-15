"""Unit tests for the bob_emploi.frontend.asynchronous.focus_email module."""
import datetime
import re
import unittest

import mock
import mongomock

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.asynchronous import focus_email


class NetworkVarsTestCase(unittest.TestCase):
    """Unit tests for the network_vars method."""

    domains = {
        'A': 'dans la pub',
        'B12': 'dans la vie',
    }

    @mock.patch(focus_email.__name__ + '._DOMAINS', domains)
    def test_basic(self):
        """Test basic usage."""
        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.frustrations.append(user_pb2.MOTIVATION)
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'B1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'

        network_vars = focus_email.network_vars(user)

        # Verify variable var.
        unsubscribe_link = network_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^%s&auth=\d+\.[a-f0-9]+$' %
            re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org'))

        self.assertEqual(
            {
                'gender': 'MASCULINE',
                'firstName': 'Patrick',
                'registeredMonthsAgo': 'trois',
                'inTargetDomain': 'dans la vie',
                'frustration': 'MOTIVATION',
                'otherJobInCity': 'coiffeur à Marseille',
                'jobInCity': 'juriste à Lyon',
                'emailInUrl': 'patrick%40bayes.org',
            },
            network_vars)


class FocusEmailTestCase(unittest.TestCase):
    """Tests for the main function."""

    @mock.patch(focus_email.mail.__name__ + '.send_template')
    @mock.patch(
        focus_email.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(focus_email.__name__ + '._DOMAINS', new={'A': 'dans la vie'})
    def test_main(self, mock_db, mock_mail):
        """Basic test."""
        mock_mail().status_code = 200
        mock_mail.reset_mock()
        mock_db.user.insert_many([
            {
                '_id': '%d' % month,
                'registeredAt': '2017-%02d-15T00:00:00Z' % month,
                'profile': {
                    'name': '%d user' % month,
                },
                'projects': [
                    {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
                ],
            }
            for month in range(2, 9)
        ])
        mock_db.user.insert_one({
            'registeredAt': '2017-05-15T00:00:00Z',
            'profile': {
                'name': 'Already sent',
            },
            'projects': [
                {'networkEstimate': 1, 'targetJob': {'jobGroup': {'romeId': 'A1234'}}},
            ],
            'emailsSent': [{'campaignId': 'focus-network'}],
        })
        focus_email.main()

        self.assertEqual(
            3, mock_mail.call_count, msg='3 emails expected: one per month from April to June')
        february_user = mock_db.user.find_one({'_id': '2'})
        self.assertFalse(february_user.get('emailsSent'))

        april_user = mock_db.user.find_one({'_id': '4'})
        self.assertEqual(
            [{'sentAt', 'mailjetTemplate', 'campaignId'}],
            [e.keys() for e in april_user.get('emailsSent', [])])
        self.assertEqual('focus-network', april_user['emailsSent'][0]['campaignId'])


class StripDistrictTestCase(unittest.TestCase):
    """Unit tests for the strip_district method."""

    def test_with_district(self):
        """Test district stripping when city has a district."""
        self.assertEqual(
            'Lyon',
            focus_email.strip_district('Lyon 8e  Arrondissement'))

    def test_with_first_district(self):
        """Test stripping for the first (i.e 1er) district."""
        self.assertEqual(
            'Paris',
            focus_email.strip_district('Paris 1er Arrondissement'))

    def test_without_district(self):
        """Test no stripping when city does not have a district."""
        self.assertEqual(
            'Le Mans',
            focus_email.strip_district('Le Mans'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
