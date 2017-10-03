"""Unit tests for the seasonal_relocate module."""
import datetime
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.test import scoring_test


class AdviceSeasonalRelocateTestCase(scoring_test.ScoringModelTestBase('advice-seasonal-relocate')):
    """Unit tests for the "Advice Seasonal Relocate" advice."""

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(AdviceSeasonalRelocateTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.now = datetime.datetime(2016, 2, 27)
        self.database.seasonal_jobbing.insert_one(
            {
                '_id': 2,
                'departementStats': [
                    {
                        'departementId': '06',
                        'departementSeasonalOffers': 800,
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


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
