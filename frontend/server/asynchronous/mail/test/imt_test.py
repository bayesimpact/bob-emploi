"""Unit tests for the imt mail variables."""

import re
import unittest

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class ImtVarsTestCase(mail_blast_test.CampaignTestBase('imt')):
    """Unit tests for the imt_vars method."""

    def test_basic(self):
        """Test basic usage."""

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
                        'employmentType': 'CDD_LESS_EQUAL_3_MONTHS',
                        'percentage': 23.53,
                    },
                    {
                        'employmentType': 'CDD',
                        'percentage': 29.41,
                    },
                    {
                        'employmentType': 'CDI',
                        'percentage': 47.06,
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

        self.user.profile.frustrations.append(user_pb2.MOTIVATION)
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'patrick'
        self.user.profile.email = 'patrick@bayes.org'
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.target_job.code_ogr = '123123'
        self.project.mobility.city.name = 'Lyon'
        self.project.mobility.city.departement_id = '69'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_regex_field('loginUrl', r'{}&authToken=\d+\.[a-f0-9]+$'.format(re.escape(
            'https://www.bob-emploi.fr?user={}'.format(self.user.user_id))))

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
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
            'imtLink': 'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
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
            'showPs': ''
        })


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
