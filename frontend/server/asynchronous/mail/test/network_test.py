"""Unit tests for the network mail module."""

import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import network
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class StripDistrictTestCase(unittest.TestCase):
    """Unit tests for the strip_district method."""

    def test_with_district(self) -> None:
        """Test district stripping when city has a district."""

        self.assertEqual(
            'Lyon',
            network.strip_district('Lyon 8e  Arrondissement'))

    def test_with_first_district(self) -> None:
        """Test stripping for the first (i.e 1er) district."""

        self.assertEqual(
            'Paris',
            network.strip_district('Paris 1er Arrondissement'))

    def test_without_district(self) -> None:
        """Test no stripping when city does not have a district."""

        self.assertEqual(
            'Le Mans',
            network.strip_district('Le Mans'))


class NetworkVarsTestCase(mail_blast_test.CampaignTestBase):
    """Unit tests for the network_vars method."""

    campaign_id = 'focus-network'

    def setUp(self) -> None:
        super(NetworkVarsTestCase, self).setUp()

        self.database.job_group_info.insert_one({
            '_id': 'B1234',
            'inDomain': 'dans la vie',
        })

        self.user.profile.name = 'Patrick'
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.network_estimate = 1
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'

    def test_basic(self) -> None:
        """Test basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')
        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'inTargetDomain': 'dans la vie',
            'frustration': 'MOTIVATION',
            'otherJobInCity': 'coiffeur à Marseille',
            'jobInCity': 'juriste à Lyon',
            'emailInUrl': 'patrick%40bayes.org',
        })

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project."""

        self.project.is_incomplete = True

        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_unknown_network(self) -> None:
        """Network is not known, no email."""

        self.project.network_estimate = 0

        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_job_group_info(self) -> None:
        """Missing job group info."""

        self.database.job_group_info.drop()

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_target_domain(self) -> None:
        """Missing target domain."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$unset': {'inDomain': 1}})

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_other_job_example(self) -> None:
        """Which other job when hairdresser in Marseille."""

        self.project.city.departement_id = '13'
        self.project.target_job.job_group.rome_id = 'D1234'
        self.database.job_group_info.insert_one(
            dict(self.database.job_group_info.find_one({}), _id='D1234'))

        self._assert_user_receives_campaign()

        self.assertEqual('secrétaire à Lyon', self._variables['otherJobInCity'])


class NetworkPlusTestCase(mail_blast_test.CampaignTestBase):
    """Test for the new_year_vars function."""

    campaign_id = 'network-plus'

    def setUp(self) -> None:
        super(NetworkPlusTestCase, self).setUp()

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

        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH
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
        self.project.city.departement_id = '69'
        self.project.city.departement_name = 'Rhône'
        self.project.city.departement_prefix = 'dans le'
        self.project.city.name = 'Lyon'

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

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

    def test_empty_departement(self) -> None:
        """Empty departement."""

        self.project.city.departement_id = ''

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_job_group_info(self) -> None:
        """Missing job group info."""

        self.database.job_group_info.drop()

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_target_domain(self) -> None:
        """Missing target domain."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$unset': {'inDomain': 1}})

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_application_modes(self) -> None:
        """Missing application modes."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$unset': {
            'applicationModes.R4Z92.modes': 1,
            'applicationModes.R4Z91.modes': 1,
        }})

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_missing_network_application_mode(self) -> None:
        """Missing network application mode."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes.R4Z92.modes': [{
                'percentage': 100,
                'mode': 'SPONTANEOUS_APPLICATION'
            }],
            'applicationModes.R4Z91.modes': [{
                'percentage': 100,
                'mode': 'SPONTANEOUS_APPLICATION'
            }],
        }})

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_not_enough_network_application_mode(self) -> None:
        """Missing network application mode."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes.R4Z92.modes': [{
                'percentage': 20,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
            'applicationModes.R4Z91.modes': [{
                'percentage': 20,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
        }})

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_network_application_mode_is_80_percent(self) -> None:
        """Network application mode is for 80% of recruitements."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes.R4Z92.modes': [{
                'percentage': 80,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
            'applicationModes.R4Z91.modes': [{
                'percentage': 80,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
        }})

        self._assert_user_receives_campaign()

        self.assertEqual('que la majorité', self._variables['networkApplicationPercentage'])

    def test_network_application_mode_is_50_percent(self) -> None:
        """Network application mode is for 50% of recruitements."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes.R4Z92.modes': [{
                'percentage': 50,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
            'applicationModes.R4Z91.modes': [{
                'percentage': 50,
                'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
            }],
        }})

        self._assert_user_receives_campaign()

        self.assertEqual('que la moitié', self._variables['networkApplicationPercentage'])

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project."""

        self.project.is_incomplete = True

        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
