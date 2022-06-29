"""Unit tests for the imt mail variables."""

import os
import re
import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail import imt
from bob_emploi.frontend.server.mail.test import campaign_helper

_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


class ImtVarsTestCase(campaign_helper.CampaignTestBase):
    """Unit tests for the imt_vars method."""

    campaign_id = 'imt'

    def setUp(self) -> None:
        super().setUp()

        imt.proto.cache.clear()

        self.database.departements.insert_one({
            '_id': '69',
            'name': 'Rhône',
            'prefix': 'dans le ',
        })

        self.database.local_diagnosis.insert_one({
            '_id': '69:B1234',
            'imt': {
                'employmentTypePercentages': [
                    {
                        'employmentType': 'CDI',
                        'percentage': 47.06,
                    },
                    {
                        'employmentType': 'CDD',
                        'percentage': 29.41,
                    },
                    {
                        'employmentType': 'CDD_LESS_EQUAL_3_MONTHS',
                        'percentage': 23.53,
                    },
                ],
                'yearlyAvgOffersPer10Candidates': 3,
            },
        })

        self.database.job_group_info.insert_one({
            '_id': 'B1234',
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS',
                            'percentage': 42.57,
                        },
                        {
                            'mode': 'SPONTANEOUS_APPLICATION',
                            'percentage': 21.15,
                        },
                        {
                            'mode': 'PLACEMENT_AGENCY',
                            'percentage': 18.62,
                        },
                        {
                            'mode': 'UNDEFINED_APPLICATION_MODE',
                            'percentage': 17.66,
                        },
                    ],
                },
            },
        })

        self.user.profile.frustrations.append(user_profile_pb2.MOTIVATION)
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'patrick'
        self.user.profile.email = 'patrick@bayes.org'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_MAXIMUM
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.target_job.code_ogr = '123123'
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'

    def test_basic(self) -> None:
        """Test basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_has_status_update_link(field='statusUpdateUrl')

        base_url = 'https://www.bob-emploi.fr?'
        self._assert_regex_field(
            'loginUrl',
            rf'{re.escape(base_url)}authToken=\d+\.[a-f0-9]+&userId={self.user.user_id}$')

        self._assert_remaining_variables({
            'applicationModes': {
                'showSection': 'True',
                'link': '',
                'title': 'Le Réseau',
                'name': 'leur réseau personnel ou professionnel',
                'percent': '43'
            },
            'departements': {'showSection': ''},
            'employmentType': {
                'showSection': 'True',
                'name': 'CDI',
                'percent': '47',
                'ratio': 2,
                'title': 'CDI'
            },
            'imtLink': 'https://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
                       'codeMetier=123123&codeZoneGeographique=69&typeZoneGeographique=DEPARTEMENT',
            'inCity': 'à Lyon',
            'jobNameInDepartement': 'juriste dans le Rhône',
            'marketStress': {
                'showSection': 'True',
                'candidates': '3',
                'offers': '1'
            },
            'months': {'showSection': ''},
            'ofJobNameInDepartement': 'de juriste dans le Rhône',
            'ofJobName': 'de juriste',
        })

    def test_twice(self) -> None:
        """Test sending the email twice (using module's cache)."""

        self._assert_user_receives_campaign()
        self._user_database.user.drop()
        self._assert_user_receives_campaign()

    def test_focus(self) -> None:
        """Test sending a focus email."""

        self._assert_user_receives_focus()

    def test_no_project(self) -> None:
        """No project, no email."""

        del self.user.projects[:]
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_incomplete_project(self) -> None:
        """Incomplete project, no email."""

        self.project.is_incomplete = True
        self._assert_user_receives_focus(should_be_sent=False)
        self._user_database.user.drop()
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_market(self) -> None:
        """No Market, no email."""

        self.database.local_diagnosis.delete_one({'_id': '69:B1234'})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_imt(self) -> None:
        """No IMT, no email."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$unset': {'imt': 1}})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_departements(self) -> None:
        """Show section about other departements."""

        self.database.departements.insert_many([
            {
                '_id': '75',
                'name': 'Paris',
                'prefix': 'à ',
            },
            {
                '_id': '31',
                'name': 'Haute-Garonne',
                'prefix': 'en ',
            },
        ])
        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'bestDepartements': [
                {
                    'departementId': '75',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
                {
                    'departementId': '31',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
            ],
        }})
        self.project.area_type = geo_pb2.COUNTRY
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'count': '2',
                'isInBest': '',
                'sentence': 'à Paris et en Haute-Garonne',
                'showSection': 'True',
                'title': 'Paris<br />Haute-Garonne',
            },
            self._variables.pop('departements'))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_usa_deployment_departements(self) -> None:
        """Show section about other departements for the USA."""

        patcher = mock.patch(imt.__name__ + '._BOB_DEPLOYMENT', new='usa')
        patcher.start()

        self.user.profile.locale = 'en'

        self.database.departements.insert_many([
            {
                '_id': 'NJ',
                'name': 'New Jersey',
                'prefix': 'in ',
            },
            {
                '_id': 'CA',
                'name': 'California',
                'prefix': 'in ',
            },
        ])
        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'bestDepartements': [
                {
                    'departementId': 'NJ',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
                {
                    'departementId': 'CA',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
            ],
        }})
        self.project.area_type = geo_pb2.COUNTRY

        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'count': '2',
                'isInBest': '',
                'sentence': 'in New Jersey and in California',
                'showSection': 'True',
                'title': 'New Jersey<br />California',
            },
            self._variables.pop('departements'))

    def test_departements_when_best(self) -> None:
        """Show section about other departements when mine is best."""

        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'bestDepartements': [
                {
                    'departementId': '69',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
                {
                    'departementId': '31',
                    'local_stats': {'imt': {'yearlyAvgOffersPer10Candidates': 7}},
                },
            ],
        }})
        self.project.area_type = geo_pb2.COUNTRY
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'count': '1',
                'isInBest': 'True',
                'sentence': 'en Haute-Garonne',
                'showSection': 'True',
                'title': 'Rhône<br />Haute-Garonne',
            },
            self._variables.pop('departements'))

    def test_months(self) -> None:
        """Show section about months."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$set': {
            'imt.activeMonths': ['JUNE', 'JULY', 'AUGUST', 'SEPTEMBER'],
        }})
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'activeMonths': 'Juin - Juillet - Août - Septembre',
                'onlyOneMonth': '',
                'showSection': 'True',
            },
            self._variables.pop('months'))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_english_months(self) -> None:
        """Show section about months."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$set': {
            'imt.activeMonths': ['JUNE'],
        }})
        self.user.profile.locale = 'en'
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'activeMonths': 'June',
                'onlyOneMonth': 'True',
                'showSection': 'True',
            },
            self._variables.pop('months'))

    def test_not_enough_sections(self) -> None:
        """Not enough sections, no email."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$unset': {
            'imt.employmentTypePercentages': 1,
        }})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_employment_type_not_complete(self) -> None:
        """Employment type error, no email."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$set': {
            'imt.employmentTypePercentages': [
                {
                    'percentage': 47.06,
                },
                {
                    'employmentType': 'CDD',
                    'percentage': 29.41,
                },
                {
                    'employmentType': 'CDI',
                    'percentage': 23.53,
                },
            ],
        }})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_employment_type_only_one(self) -> None:
        """Only one employment type, fallback."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {'$set': {
            'imt.employmentTypePercentages': [{
                'employmentType': 'CDD_OVER_3_MONTHS',
                'percentage': 23.53,
            }],
        }})
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'name': 'CDD de plus de 3 mois',
                'percent': '24',
                'ratio': 0,
                'showSection': 'True',
                'title': 'CDD long',
            },
            self._variables.pop('employmentType'))

    def test_no_application_mode(self) -> None:
        """Not enough sections (no application modes), no email."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {
            '$unset': {'applicationModes': 1},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_bad_application_mode(self) -> None:
        """Application modes data is broken, no email."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'percentage': 42.57,
                        },
                        {
                            'percentage': 21.15,
                        },
                        {
                            'percentage': 18.62,
                        },
                        {
                            'percentage': 17.66,
                        },
                    ],
                },
            },
        }})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_best_application_mode_is_spontaneous(self) -> None:
        """Best application mode is spontaneous."""

        self.project.advices.add(advice_id='spontaneous-application')
        self.project.advices.add(advice_id='network-test')
        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'mode': 'SPONTANEOUS_APPLICATION',
                            'percentage': 95,
                        },
                        {
                            'percentage': 5,
                        },
                    ],
                },
            },
        }})
        self._assert_user_receives_campaign(should_be_sent=True)
        self.assertIn(
            'https://www.bob-emploi.fr/projet/0/methode/spontaneous-application?',
            self._variables.pop('applicationModes')['link'])

    def test_best_application_mode_is_network(self) -> None:
        """Best application mode is spontaneous."""

        self.project.advices.add(advice_id='spontaneous-application')
        self.project.advices.add(advice_id='network-test')
        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS',
                            'percentage': 95,
                        },
                        {
                            'percentage': 5,
                        },
                    ],
                },
            },
        }})
        self._assert_user_receives_campaign(should_be_sent=True)
        self.assertIn(
            'https://www.bob-emploi.fr/projet/0/methode/network-test?',
            self._variables.pop('applicationModes')['link'])

    def test_best_application_mode_is_other(self) -> None:
        """Best application mode is other channels."""

        self.database.job_group_info.update_one({'_id': 'B1234'}, {'$set': {
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'mode': 'OTHER_CHANNELS',
                            'percentage': 95,
                        },
                        {
                            'percentage': 5,
                        },
                    ],
                },
            },
        }})
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_market_stress(self) -> None:
        """Not enough sections (no market stress), no email."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {
            '$unset': {'imt.yearlyAvgOffersPer10Candidates': 1},
        })
        self._assert_user_receives_campaign(should_be_sent=False)

    def test_very_low_market_stress(self) -> None:
        """Very low market stress, changes the logic."""

        self.database.local_diagnosis.update_one({'_id': '69:B1234'}, {
            '$set': {'imt.yearlyAvgOffersPer10Candidates': 20},
        })
        self._assert_user_receives_campaign()
        self.assertEqual(
            {
                'candidates': '1',
                'offers': '2',
                'showSection': 'True',
            },
            self._variables.pop('marketStress'),
        )

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_usa_basic(self) -> None:
        """Test basic usage for US users."""

        patcher = mock.patch(imt.__name__ + '._BOB_DEPLOYMENT', new='usa')
        patcher.start()

        self.database.departements.insert_one({
            '_id': 'FL',
            'name': 'Florida',
            'prefix': 'in ',
        })
        self.database.local_diagnosis.insert_one({
            '_id': 'FL:11-1011',
            'imt': {
                'employmentTypePercentages': [
                    {
                        'employmentType': 'CDI',
                        'percentage': 47.06,
                    },
                    {
                        'employmentType': 'CDD',
                        'percentage': 29.41,
                    },
                    {
                        'employmentType': 'CDD_LESS_EQUAL_3_MONTHS',
                        'percentage': 23.53,
                    },
                ],
                'yearlyAvgOffersPer10Candidates': 3,
            },
        })

        self.database.job_group_info.insert_one({
            '_id': '11-1011',
            'applicationModes': {
                'A0Z42': {
                    'modes': [
                        {
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS',
                            'percentage': 42.57,
                        },
                        {
                            'mode': 'SPONTANEOUS_APPLICATION',
                            'percentage': 21.15,
                        },
                        {
                            'mode': 'PLACEMENT_AGENCY',
                            'percentage': 18.62,
                        },
                        {
                            'mode': 'UNDEFINED_APPLICATION_MODE',
                            'percentage': 17.66,
                        },
                    ],
                },
            },
        })

        self.project.target_job.masculine_name = 'VIP Steward'
        self.project.target_job.job_group.rome_id = '11-1011'
        self.project.city.name = 'Miami'
        self.project.city.city_id = '33133'
        self.project.city.departement_prefix = 'in '
        self.project.city.departement_name = 'Florida'
        self.project.city.departement_id = 'FL'
        self.user.profile.locale = 'en'

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_MAXIMUM',
        })

        self._assert_has_status_update_link(field='statusUpdateUrl')

        base_url = 'https://www.bob-emploi.fr?'
        self._assert_regex_field(
            'loginUrl',
            rf'{re.escape(base_url)}authToken=\d+\.[a-f0-9]+&userId={self.user.user_id}$')

        self._assert_remaining_variables({
            'applicationModes': {
                'showSection': 'True',
                'link': '',
                'title': 'The Network',
                'name': 'their personal or professional network',
                'percent': '43'
            },
            'departements': {'showSection': ''},
            'employmentType': {
                'showSection': 'True',
                'name': 'a long-term contract',
                'percent': '47',
                'ratio': 2,
                'title': 'a long-term contract'
            },
            'imtLink': 'https://www.bls.gov/oes/current/oes111011.htm',
            'inCity': 'in Miami',
            'jobNameInDepartement': 'VIP Steward in Florida',
            'marketStress': {
                'showSection': 'True',
                'candidates': '3',
                'offers': '1'
            },
            'months': {'showSection': ''},
            'ofJobNameInDepartement': 'of VIP Steward in Florida',
            'ofJobName': 'of VIP Steward',
        })


if __name__ == '__main__':
    unittest.main()
