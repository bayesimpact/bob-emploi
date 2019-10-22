"""Unit tests for the application_tips module."""

import datetime
import typing
import unittest
from unittest import mock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server.test import filters_test
from bob_emploi.frontend.server.test import scoring_test


class SpontaneousApplicationScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Send spontaneous applications" advice."""

    model_id = 'advice-spontaneous-application'

    def test_best_channel(self) -> None:
        """User is in a market where spontaneous application is the best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.city.departement_id = '69'
        persona.project.job_search_length_months = 2
        persona.project.job_search_started_at.FromDatetime(
            persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })
        score = self._score_persona(persona)

        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_second_best_channel(self) -> None:
        """User is in a market where spontaneous application is the second best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.city.departement_id = '69'
        persona.project.job_search_length_months = 2
        persona.project.job_search_started_at.FromDatetime(
            persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z91': {
                    'modes': [
                        {
                            'percentage': 100,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                    ],
                },
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
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
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_not_best_channel(self) -> None:
        """User is in a market where spontaneous application is not the best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.city.departement_id = '69'
        persona.project.job_search_length_months = 2
        persona.project.job_search_started_at.FromDatetime(
            persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        persona.project.diagnostic.ClearField('category_id')
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_not_best_channel_but_alternance(self) -> None:
        """User is missing a diploma and will need alternance company ideas."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.city.departement_id = '69'
        persona.project.diagnostic.category_id = 'missing-diploma'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_bravo_frustrated(self) -> None:
        """User is in the bravo category, and is frustrated about offers."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'bravo'
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')


@mock.patch(companies.__name__ + '.get_lbb_companies')
class ExtraDataTestCase(scoring_test.AdviceScoringModelTestBase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    model_id = 'advice-spontaneous-application'

    def test_alternance_extra_data(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Get also companies for alternance."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'R4Z92': {'modes': [
                {
                    'percentage': 36.38,
                    'mode': 'SPONTANEOUS_APPLICATION'
                },
            ]}},
        })
        mock_get_lbb_companies.side_effect = [
            [{'name': 'Carrefour'}, {'name': 'Leclerc'}],
            [{'name': f'Company {i}'} for i in range(10)],
        ]

        persona = self._random_persona().clone()
        del persona.project.employment_types[:]
        persona.project.employment_types.extend([job_pb2.ALTERNANCE, job_pb2.CDI])
        persona.project.target_job.job_group.rome_id = 'A1234'

        extra_data = typing.cast(
            project_pb2.SpontaneousApplicationData, self._compute_expanded_card_data(persona))

        self.assertEqual(['Carrefour', 'Leclerc'], [c.name for c in extra_data.companies])
        self.assertEqual(
            ['Company 0', 'Company 1', 'Company 2', 'Company 3', 'Company 4'],
            [c.name for c in extra_data.alternance_companies])

        self.assertEqual(
            [None, 'alternance'],
            [kwarg.get('contract') for arg, kwarg in mock_get_lbb_companies.call_args_list])

    def test_only_alternance_extra_data(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Get only companies for alternance."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'R4Z92': {'modes': [
                {
                    'percentage': 36.38,
                    'mode': 'SPONTANEOUS_APPLICATION'
                },
            ]}},
        })
        mock_get_lbb_companies.side_effect = [
            [{'name': 'Carrefour'}, {'name': 'Leclerc'}],
            [{'name': f'Company {i}'} for i in range(10)],
        ]

        persona = self._random_persona().clone()
        del persona.project.employment_types[:]
        persona.project.employment_types.append(job_pb2.ALTERNANCE)
        persona.project.target_job.job_group.rome_id = 'A1234'

        extra_data = typing.cast(
            project_pb2.SpontaneousApplicationData, self._compute_expanded_card_data(persona))
        self.assertFalse(extra_data.companies)
        self.assertEqual(
            ['Carrefour', 'Leclerc'], [c.name for c in extra_data.alternance_companies])

        self.assertEqual(
            ['alternance'],
            [kwarg.get('contract') for arg, kwarg in mock_get_lbb_companies.call_args_list])

    def test_advice_spontaneous_application_extra_data(
            self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Test that the advisor computes extra data for the "Spontaneous Application" advice."""

        persona = self._random_persona().clone()
        persona.project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')),
            job_search_length_months=7,
            weekly_applications_estimate=project_pb2.A_LOT,
            employment_types=[job_pb2.CDI],
            total_interview_count=1,
        )
        persona.project.city.departement_id = '14'

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
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
                        }
                    ],
                }
            },
        })
        mock_get_lbb_companies.return_value = iter([
            {'name': 'EX NIHILO'},
            {'name': 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'},
        ])

        extra_data = typing.cast(
            project_pb2.SpontaneousApplicationData, self._compute_expanded_card_data(persona))
        self.assertEqual(
            ['EX NIHILO', 'M.F.P MULTIMEDIA FRANCE PRODUCTIONS'],
            [c.name for c in extra_data.companies])
        self.assertEqual(10, extra_data.max_distance_to_companies_km)

    def test_all_data_for_missing_diploma(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Get companies for alternance and others when in missing diploma category."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'R4Z92': {'modes': [
                {
                    'percentage': 36.38,
                    'mode': 'SPONTANEOUS_APPLICATION'
                },
            ]}},
        })
        mock_get_lbb_companies.side_effect = [
            [{'name': 'Carrefour'}, {'name': 'Leclerc'}],
            [{'name': f'Company {i}'} for i in range(2)],
        ]

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'missing-diploma'
        persona.project.target_job.job_group.rome_id = 'A1234'

        extra_data = typing.cast(
            project_pb2.SpontaneousApplicationData, self._compute_expanded_card_data(persona))
        self.assertEqual(
            ['Carrefour', 'Leclerc'], [c.name for c in extra_data.companies])
        self.assertEqual(
            ['Company 0', 'Company 1'], [c.name for c in extra_data.alternance_companies])

        self.assertEqual(
            [None, 'alternance'],
            [kwarg.get('contract') for arg, kwarg in mock_get_lbb_companies.call_args_list])

    def test_no_companies(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """No companies found in the near area."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'R4Z92': {'modes': [
                {
                    'percentage': 36.38,
                    'mode': 'SPONTANEOUS_APPLICATION'
                },
            ]}},
        })
        mock_get_lbb_companies.side_effect = [
            [],
            [{'name': 'Carrefour'}, {'name': 'Leclerc'}],
            [],
            [],
            [],
        ]

        persona = self._random_persona().clone()
        del persona.project.employment_types[:]
        persona.project.employment_types.extend([job_pb2.ALTERNANCE, job_pb2.CDI])
        persona.project.target_job.job_group.rome_id = 'A1234'

        extra_data = typing.cast(
            project_pb2.SpontaneousApplicationData, self._compute_expanded_card_data(persona))

        self.assertEqual(['Carrefour', 'Leclerc'], [c.name for c in extra_data.companies])
        self.assertEqual(50, extra_data.max_distance_to_companies_km)
        self.assertEqual([], [c.name for c in extra_data.alternance_companies])

        self.assertEqual(
            [(None, 10), (None, 50), ('alternance', 10), ('alternance', 50), ('alternance', 3000)],
            [
                (kwarg.get('contract'), kwarg.get('distance_km'))
                for arg, kwarg in mock_get_lbb_companies.call_args_list
            ])


class MainlySpontaneousFilterTestCase(filters_test.FilterTestBase):
    """Unit tests for the filter on good IMT data on spontaneous."""

    model_id = 'for-mainly-hiring-through-spontaneous(±15%)'

    def test_best_application_mode(self) -> None:
        """User is in a market where spontaneous application is the best channel."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })
        self._assert_pass_filter()

    def test_second_best_channel(self) -> None:
        """Spontaneous application is the second best channel by a small margin."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z91': {
                    'modes': [
                        {
                            'percentage': 100,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                    ],
                },
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
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
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })
        self._assert_pass_filter()

    def test_second_best_channel_by_far(self) -> None:
        """Spontaneous application is the second best channel by a large margin."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z91': {
                    'modes': [
                        {
                            'percentage': 100,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                    ],
                },
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 53.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 11.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 5.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                    ],
                },
            },
        })
        self._assert_fail_filter()

    def test_not_best_channel(self) -> None:
        """User is in a market where spontaneous application is not a great channel."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        }
                    ],
                }
            },
        })
        self._assert_fail_filter()


if __name__ == '__main__':
    unittest.main()
