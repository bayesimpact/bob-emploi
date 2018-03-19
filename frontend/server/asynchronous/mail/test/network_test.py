"""Unit tests for the network mail module."""

import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import network
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class StripDistrictTestCase(unittest.TestCase):
    """Unit tests for the strip_district method."""

    def test_with_district(self):
        """Test district stripping when city has a district."""

        self.assertEqual(
            'Lyon',
            network.strip_district('Lyon 8e  Arrondissement'))

    def test_with_first_district(self):
        """Test stripping for the first (i.e 1er) district."""

        self.assertEqual(
            'Paris',
            network.strip_district('Paris 1er Arrondissement'))

    def test_without_district(self):
        """Test no stripping when city does not have a district."""

        self.assertEqual(
            'Le Mans',
            network.strip_district('Le Mans'))


class NetworkVarsTestCase(mail_blast_test.CampaignTestBase('focus-network')):
    """Unit tests for the network_vars method."""

    def test_basic(self):
        """Test basic usage."""

        self.database.job_group_info.insert_one({
            '_id': 'B1234',
            'inDomain': 'dans la vie',
        })

        self.user.profile.name = 'Patrick'
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.network_estimate = 1
        self.project.mobility.city.name = 'Lyon'
        self.project.mobility.city.departement_id = '69'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_status_update_link(field='statusUpdateUrl')
        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'registeredMonthsAgo': 'trois',
            'inTargetDomain': 'dans la vie',
            'frustration': 'MOTIVATION',
            'otherJobInCity': 'coiffeur à Marseille',
            'jobInCity': 'juriste à Lyon',
            'emailInUrl': 'patrick%40bayes.org',
        })


class NetworkPlusTestCase(mail_blast_test.CampaignTestBase('network-plus')):
    """Test for the new_year_vars function."""

    def test_basic(self):
        """Basic usage."""

        self.database.job_group_info.insert_one({
            '_id': 'B1234',
            'inDomain': 'dans le juridique',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                    ],
                },
                'R4Z91': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                    ],
                },
            },
        })

        self.database.departements.insert_one({
            '_id': '69',
            'name': 'Rhône',
            'prefix': 'dans le ',
        })

        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.user.profile.frustrations.append(user_pb2.SELF_CONFIDENCE)
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.family_situation = user_pb2.SINGLE_PARENT_SITUATION
        self.user.profile.year_of_birth = 1990

        self.project.kind = project_pb2.FIND_ANOTHER_JOB
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.target_job.job_group.name = 'Aide et médiation judiciaire'
        self.project.network_estimate = 3
        self.project.mobility.city.departement_id = '69'
        self.project.mobility.city.departement_name = 'Rhône'
        self.project.mobility.city.departement_prefix = 'dans le'
        self.project.mobility.city.name = 'Lyon'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'frustration': 'SELF_CONFIDENCE',
            'gender': 'MASCULINE',
            'hasChildren': 'True',
            'hasHandicap': '',
            'hasHighSchoolDegree': '',
            'hasLargeNetwork': 'True',
            'hasWorkedBefore': 'True',
            'inTargetDomain': 'dans le juridique',
            'isYoung': 'True',
            'inCity': 'à Lyon',
            'jobGroupInDepartement': 'aide et médiation judiciaire dans le Rhône',
            'networkApplicationPercentage': "qu'un tiers",
        })


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
