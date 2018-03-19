"""Unit tests for the application_tips module."""

import datetime
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import scoring_test
from bob_emploi.frontend.server.test import filters_test


class SpontaneousApplicationScoringModelTestCase(
        scoring_test.ScoringModelTestBase('advice-spontaneous-application')):
    """Unit tests for the "Send spontaneous applications" advice."""

    def test_best_channel(self):
        """User is in a market where spontaneous application is the best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.departement_id = '69'
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

        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_second_best_channel(self):
        """User is in a market where spontaneous application is the second best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.departement_id = '69'
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

        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_not_best_channel(self):
        """User is in a market where spontaneous application is not the best channel."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.departement_id = '69'
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

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class MainlySpontaneousFilterTestCase(
        filters_test.FilterTestBase('for-mainly-hiring-through-spontaneous(±15%)')):
    """Unit tests for the filter on good IMT data on spontaneous."""

    def test_best_application_mode(self):
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

    def test_second_best_channel(self):
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

    def test_second_best_channel_by_far(self):
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

    def test_not_best_channel(self):
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
    unittest.main()  # pragma: no cover
