"""Unit tests for the seasonal_relocate module."""

import datetime
import typing
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import scoring_test


class AdviceSeasonalRelocateTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Advice Seasonal Relocate" advice."""

    model_id = 'advice-seasonal-relocate'

    def setUp(self) -> None:
        super().setUp()
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

    def test_funky_departement(self) -> None:
        """Do not trigger if the departement is unknown."""

        self.persona.project.area_type = geo_pb2.COUNTRY
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
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_older(self) -> None:
        """Do not trigger for older people."""

        if self.persona.user_profile.year_of_birth > datetime.date.today().year - 36:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 36
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_region(self) -> None:
        """Do not trigger for people who's mobility is below "COUNTRY"."""

        self.persona = self._random_persona().clone()
        if self.persona.project.area_type >= geo_pb2.COUNTRY:
            self.persona.project.area_type = geo_pb2.REGION
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_children(self) -> None:
        """Do not trigger for people who have children."""

        self.persona.user_profile.family_situation = user_pb2.FAMILY_WITH_KIDS
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_diplomas(self) -> None:
        """Do not trigger for people who have diplomas."""

        if self.persona.user_profile.highest_degree <= job_pb2.BTS_DUT_DEUG:
            self.persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg=f'Failed for "{self.persona.name}"')

    def test_no_diploma(self) -> None:
        """Young mobile single people without advanced diplomas should trigger."""

        self.persona.project.area_type = geo_pb2.COUNTRY
        if self.persona.user_profile.year_of_birth < datetime.date.today().year - 28:
            self.persona.user_profile.year_of_birth = datetime.date.today().year - 28
        if self.persona.user_profile.highest_degree > job_pb2.BAC_BACPRO:
            self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        self.persona.user_profile.family_situation = user_pb2.SINGLE
        if self.persona.project.employment_types == [job_pb2.CDI]:
            self.persona.project.employment_types.append(job_pb2.CDD_LESS_EQUAL_3_MONTHS)

        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Failed for "{self.persona.name}"')

    def test_seasonal_expanded_card_data(self) -> None:
        """Test that the advisor computes extra data for the seasonal-relocate advice."""

        self.now = datetime.datetime(2017, 2, 15)
        self.persona.user_profile.year_of_birth = datetime.date.today().year - 28
        self.persona.user_profile.highest_degree = job_pb2.BAC_BACPRO
        self.persona.user_profile.family_situation = user_pb2.SINGLE
        self.persona.project.area_type = geo_pb2.COUNTRY
        self._enforce_search_length_duration(self.persona.project, exact_months=7)
        self.persona.project.employment_types.append(job_pb2.CDD_LESS_EQUAL_3_MONTHS)

        expanded_data = typing.cast(
            seasonal_jobbing_pb2.MonthlySeasonalJobbingStats, self.model.get_expanded_card_data(
                self.persona.scoring_project(self.database, now=self.now)))
        self.assertEqual(2, len(expanded_data.departement_stats))
        first_dep = expanded_data.departement_stats[0]
        self.assertEqual('06', first_dep.departement_id)
        self.assertEqual(800, first_dep.departement_seasonal_offers)
        self.assertEqual(2, len(first_dep.job_groups))
        first_job_group = first_dep.job_groups[0]
        self.assertEqual('I1202', first_job_group.rome_id)
        self.assertEqual('Professeur de piano', first_job_group.name)
        self.assertEqual(123, first_job_group.offers)


if __name__ == '__main__':
    unittest.main()
