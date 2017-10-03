"""Unit tests for the bob_emploi.frontend.asynchronous.focus_email module."""
import datetime
import re
import unittest

import mock
import mongomock

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.asynchronous import focus_email


class NetworkVarsTestCase(unittest.TestCase):
    """Unit tests for the network_vars method."""

    @mock.patch(
        focus_email.__name__ + '._ROME_INFO',
        new=focus_email.RomePrefixInfo([
            {'rome_prefix': 'A', 'domain': 'dans la pub'},
            {'rome_prefix': 'B12', 'domain': 'dans la vie'},
        ]))
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


class SpontaneousVarsTestCase(unittest.TestCase):
    """Test for the spontaneous_vars function."""

    @mock.patch(
        focus_email.__name__ + '._ROME_INFO',
        new=focus_email.RomePrefixInfo([{
            'rome_prefix': 'A',
            'contact_mode': 'BY_EMAIL',
            'to_the_workplace': 'au cabinet',
            'some_companies': 'des cabinets juridiques',
            'in_a_workplace': 'dans un cabinet',
            'like_your_workplace': 'comme le vôtre',
            'various_companies': 'Auchan, Carrefour ou Lidl',
            'what_i_love_about': 'where I can belong',
            'why_specific_company': 'different business styles',
        }]))
    @mock.patch(
        focus_email.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    def test_basic(self, mock_database):
        """Basic usage."""
        mock_database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
            'applicationModes': {
                'juriste': {
                    'modes': [{'mode': 'SPONTANEOUS_APPLICATION', 'percentage': 100}],
                },
            },
        })
        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.weekly_applications_estimate = project_pb2.A_LOT

        spontaneous_vars = focus_email.spontaneous_vars(user, 'focus-email')

        # Verify variable var.
        unsubscribe_link = spontaneous_vars.pop('unsubscribeLink')
        self.assertRegex(
            unsubscribe_link,
            r'^%s&auth=\d+\.[a-f0-9]+$' %
            re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org'))

        self.assertEqual(
            {
                'applicationComplexity': 'SIMPLE_APPLICATION_PROCESS',
                'contactMode': 'BY_EMAIL',
                'deepLinkLBB':
                    'https://labonneboite.pole-emploi.fr/entreprises/commune/69123/'
                    'rome/A1234?utm_medium=web&utm_source=bob&utm_campaign=bob-email',
                'experienceAsText': 'plus de 6 ans',
                'gender': 'MASCULINE',
                'hasReadPreviousEmail': '',
                'firstName': 'Patrick',
                'lastName': 'Benguigui',
                'jobName': 'juriste',
                'registeredMonthsAgo': 'trois',
                'inWorkPlace': 'dans un cabinet',
                'toTheWorkPlace': 'au cabinet',
                'likeYourWorkplace': 'comme le vôtre',
                'someCompanies': 'des cabinets juridiques',
                'weeklyApplicationOptions': '15',
                'emailInUrl': 'patrick%40bayes.org',
                'variousCompanies': 'Auchan, Carrefour ou Lidl',
                'whatILoveAbout': 'where I can belong',
                'whySpecificCompany': 'different business styles',
            },
            spontaneous_vars)


class EmploymentVarsTestCase(unittest.TestCase):
    """Test for the employment_vars function."""

    def test_basic(self):
        """Basic usage."""
        user = user_pb2.User()
        user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=90))
        user.profile.gender = user_pb2.MASCULINE
        user.profile.name = 'Patrick'
        user.profile.last_name = 'Benguigui'
        user.profile.email = 'patrick@bayes.org'
        project = user.projects.add()
        project.target_job.masculine_name = 'Juriste'
        project.target_job.job_group.rome_id = 'A1234'
        project.mobility.city.name = 'Lyon'
        project.mobility.city.departement_id = '69'
        project.mobility.city.city_id = '69123'
        project.seniority = project_pb2.SENIOR
        project.weekly_applications_estimate = project_pb2.A_LOT

        employment_vars = focus_email.employment_vars(user)

        self.assertRegex(
            employment_vars.pop('unsubscribeLink'),
            r'^{}&auth=\d+\.[a-f0-9]+$'.format(
                re.escape('https://www.bob-emploi.fr/unsubscribe.html?email=patrick%40bayes.org')))
        self.assertEqual(employment_vars['firstName'], 'Patrick')
        self.assertEqual(employment_vars['registeredMonthsAgo'], 'trois')
        self.assertRegex(
            employment_vars['seekingUrl'],
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$'
        )
        self.assertRegex(
            employment_vars['stopSeekingUrl'],
            r'^.*/api/employment-status?.*&token=\d+\.[a-f0-9]+.*$'
        )


@mock.patch(focus_email.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
class FocusEmailTestCase(unittest.TestCase):
    """Tests for the blast_campaign function."""

    @mock.patch(focus_email.mail.__name__ + '.send_template')
    @mock.patch(
        focus_email.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        focus_email.__name__ + '._ROME_INFO',
        new=focus_email.RomePrefixInfo([{'rome_prefix': 'A', 'domain': 'dans la vie'}]))
    def test_blast_campaign(self, mock_db, mock_mail):
        """Basic test."""
        mock_mail().status_code = 200
        mock_mail().json.return_value = {'Sent': [{'MessageID': 18014679230180635}]}
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
        focus_email.blast_campaign('focus-network', 'send', '2017-04-01', '2017-07-10')

        self.assertEqual(
            3, mock_mail.call_count,
            msg='3 emails expected: one per month from April to June\n%s' %
            mock_mail.call_args_list)
        february_user = mock_db.user.find_one({'_id': '2'})
        self.assertFalse(february_user.get('emailsSent'))

        april_user = mock_db.user.find_one({'_id': '4'})
        self.assertEqual(
            [{'sentAt', 'mailjetTemplate', 'campaignId', 'mailjetMessageId'}],
            [e.keys() for e in april_user.get('emailsSent', [])])
        self.assertEqual('focus-network', april_user['emailsSent'][0]['campaignId'])
        self.assertEqual(18014679230180635, int(april_user['emailsSent'][0]['mailjetMessageId']))


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
