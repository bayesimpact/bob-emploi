"""Unit tests for the seasonal_relocate module."""

import datetime
import json
import unittest

import mock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceSeasonalRelocateTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Advice Seasonal Relocate" advice."""

    model_id = 'advice-seasonal-relocate'

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(AdviceSeasonalRelocateTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.now = datetime.datetime(2016, 2, 27)
        self.database.departements.insert_many([
            {
                '_id': '2A',
                'name': 'Corse du Sud',
            },
            {
                '_id': '06',
                'name': 'Alpes de Haute-Provence',
            },
        ])
        self.database.seasonal_jobbing.insert_one(
            {
                '_id': 2,
                'departementStats': [
                    {
                        'departementId': '06',
                        'departementSeasonalOffers': 800,
                        'jobGroups': [
                            {
                                'romeId': 'I1202',
                                'name': 'Professeur de piano',
                                'offers': 123,
                            },
                            {
                                'romeId': 'I1203',
                                'name': 'Professeur de guitarre',
                                'offers': 120,
                            },
                        ],
                    },
                    {
                        'departementId': '2A',
                        'departementSeasonalOffers': 800,
                        'jobGroups': [
                            {
                                'romeId': 'I1202',
                                'name': 'Professeur de piano',
                                'offers': 123,
                            },
                            {
                                'romeId': 'I1203',
                                'name': 'Professeur de guitarre',
                                'offers': 120,
                            },
                        ],
                    },
                ],
            }
        )

    def test_funky_departement(self):
        """Do not trigger if the departement is unknown."""

        self.persona.project.mobility.area_type = geo_pb2.COUNTRY
        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 28:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 28
        if self.persona.user_profile.year_of_birth > datetime.date.today().year - 25:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 25
        if self.persona.user_profile.highest_degree > job_pb2.BAC_BACPRO:
            self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        self.persona.user_profile.family_situation = user_pb2.SINGLE
        if self.persona.project.employment_types == [job_pb2.CDI]:
            self.persona.project.employment_types.append(job_pb2.CDD_LESS_EQUAL_3_MONTHS)
        self.database.seasonal_jobbing.insert_one(
            {
                '_id': 3,
                'departementStats': [
                    {
                        'departementId': '31415926',
                        'departementSeasonalOffers': 800,
                        'jobGroups': [
                            {
                                'romeId': 'I1202',
                                'name': 'Professeur de piano',
                                'offers': 123,
                            },
                            {
                                'romeId': 'I1203',
                                'name': 'Professeur de guitarre',
                                'offers': 120,
                            },
                        ],
                    },
                    {
                        'departementId': '2A',
                        'departementSeasonalOffers': 800,
                        'jobGroups': [
                            {
                                'romeId': 'I1202',
                                'name': 'Professeur de piano',
                                'offers': 123,
                            },
                            {
                                'romeId': 'I1203',
                                'name': 'Professeur de guitarre',
                                'offers': 120,
                            },
                        ],
                    },
                ],
            }
        )
        self.now = datetime.datetime(2016, 3, 27)
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(self.persona.name))

    def test_older(self):
        """Do not trigger for older people."""

        if self.persona.user_profile.year_of_birth > datetime.date.today().year - 36:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 36
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(self.persona.name))

    def test_region(self):
        """Do not trigger for people who's mobility is below "COUNTRY"."""

        self.persona = self._random_persona().clone()
        if self.persona.project.mobility.area_type >= geo_pb2.COUNTRY:
            self.persona.project.mobility.area_type = geo_pb2.REGION
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(self.persona.name))

    def test_children(self):
        """Do not trigger for people who have children."""

        self.persona.user_profile.family_situation = user_pb2.FAMILY_WITH_KIDS
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(self.persona.name))

    def test_diplomas(self):
        """Do not trigger for people who have diplomas."""

        if self.persona.user_profile.highest_degree <= job_pb2.BTS_DUT_DEUG:
            self.persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(self.persona.name))

    def test_no_diploma(self):
        """Young mobile single people without advanced diplomas should trigger."""

        self.persona.project.mobility.area_type = geo_pb2.COUNTRY
        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 28:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 28
        if self.persona.user_profile.highest_degree > job_pb2.BAC_BACPRO:
            self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        self.persona.user_profile.family_situation = user_pb2.SINGLE
        if self.persona.project.employment_types == [job_pb2.CDI]:
            self.persona.project.employment_types.append(job_pb2.CDD_LESS_EQUAL_3_MONTHS)

        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg='Failed for "{}":'.format(self.persona.name))


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    @mock.patch(now.__name__ + '.get')
    def test_seasonal_extra_data(self, mock_now):
        """Test that the advisor computes extra data for the seasonal-relocate advice."""

        mock_now.return_value = datetime.datetime(2017, 2, 15)

        user = {
            'profile': {
                'yearOfBirth': datetime.date.today().year - 28,
                'highestDegree': 'BAC_BACPRO',
                'familySituation': 'SINGLE',
            },
            'projects': [{
                'mobility': {'areaType': 'COUNTRY'},
                'jobSearchLengthMonths': 7,
                'employmentTypes': ['INTERIM', 'CDD_LESS_EQUAL_3_MONTHS'],
            }],
        }
        self._db.advice_modules.insert_one({
            'adviceId': 'seasonal-relocate',
            'triggerScoringModel': 'advice-seasonal-relocate',
            'extraDataFieldName': 'seasonal_data',
            'isReadyForProd': True,
        })
        self._db.departements.insert_many([
            {
                '_id': '2A',
                'name': 'Corse du Sud',
            },
            {
                '_id': '06',
                'name': 'Alpes de Haute-Provence',
            },
        ])
        self._db.seasonal_jobbing.insert_one(
            {
                '_id': 2,
                'departementStats': [
                    {
                        'departementId': '06',
                        'departementSeasonalOffers': 900,
                        'jobGroups': [{
                            'romeId': 'I1202',
                            'name': 'Professeur de piano',
                            'offers': 123,
                        }, {
                            'romeId': 'I1203',
                            'name': 'Professeur de guitarre',
                            'offers': 120,
                        }, ],
                    }, {
                        'departementId': '2A',
                        'departementSeasonalOffers': 800,
                        'jobGroups': [
                            {
                                'romeId': 'I1202',
                                'name': 'Professeur de piano',
                                'offers': 123,
                            }, {
                                'romeId': 'I1203',
                                'name': 'Professeur de guitarre',
                                'offers': 120,
                            },
                        ],
                    },
                ],
            }
        )

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps(user),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'seasonal-relocate')

        self.assertEqual(2, len(advice.get('seasonalData', {}).get('departementStats')))
        first_dep = advice.get('seasonalData').get('departementStats')[0]
        self.assertEqual('06', first_dep.get('departementId'))
        self.assertEqual(900, first_dep.get('departementSeasonalOffers'))
        self.assertEqual(2, len(first_dep.get('jobGroups')))
        self.assertEqual('I1202', first_dep.get('jobGroups')[0].get('romeId'))
        self.assertEqual('Professeur de piano', first_dep.get('jobGroups')[0].get('name'))
        self.assertEqual(123, first_dep.get('jobGroups')[0].get('offers'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
