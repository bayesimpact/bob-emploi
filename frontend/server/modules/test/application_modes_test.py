"""Unit tests for the application_tips module."""

import datetime
import json
import unittest

import mock

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import filters_test
from bob_emploi.frontend.server.test import scoring_test


class SpontaneousApplicationScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Send spontaneous applications" advice."""

    model_id = 'advice-spontaneous-application'

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


@mock.patch(companies.__name__ + '.get_lbb_companies')
class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(ExtraDataTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-spontaneous-application',
            'extraDataFieldName': 'spontaneous_application_data',
            'isReadyForProd': True,
        })

    def test_alternance_extra_data(self, mock_get_lbb_companies):
        """Get also companies for alternance."""

        self._db.job_group_info.drop()
        self._db.job_group_info.insert_one({
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
            [{'name': 'Company {}'.format(i)} for i in range(10)],
        ]

        project = {
            'employmentTypes': ['ALTERNANCE', 'CDI'],
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
        }

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')
        extra_data = advice.get('spontaneousApplicationData')
        self.assertEqual({'companies', 'alternanceCompanies'}, extra_data.keys())
        self.assertEqual(['Carrefour', 'Leclerc'], [c.get('name') for c in extra_data['companies']])
        self.assertEqual(
            ['Company 0', 'Company 1', 'Company 2', 'Company 3', 'Company 4'],
            [c.get('name') for c in extra_data['alternanceCompanies']])

        self.assertEqual(
            [None, 'alternance'],
            [kwarg.get('contract') for arg, kwarg in mock_get_lbb_companies.call_args_list])

    def test_only_alternance_extra_data(self, mock_get_lbb_companies):
        """Get only companies for alternance."""

        self._db.job_group_info.drop()
        self._db.job_group_info.insert_one({
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
            [{'name': 'Company {}'.format(i)} for i in range(10)],
        ]

        project = {
            'employmentTypes': ['ALTERNANCE'],
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
        }

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')
        extra_data = advice.get('spontaneousApplicationData')
        self.assertEqual({'alternanceCompanies'}, extra_data.keys())
        self.assertEqual(
            ['Carrefour', 'Leclerc'], [c.get('name') for c in extra_data['alternanceCompanies']])

        self.assertEqual(
            ['alternance'],
            [kwarg.get('contract') for arg, kwarg in mock_get_lbb_companies.call_args_list])


class MainlySpontaneousFilterTestCase(filters_test.FilterTestBase):
    """Unit tests for the filter on good IMT data on spontaneous."""

    model_id = 'for-mainly-hiring-through-spontaneous(±15%)'

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
