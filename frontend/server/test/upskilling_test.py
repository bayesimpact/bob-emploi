"""Tests for the upskilling endpoints."""

import json
import os
import unittest
from unittest import mock

from bob_emploi.frontend.server.test import base_test

_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


class UpskillingSectionsTests(base_test.ServerTestCase):
    """Unit tests for upskilling sections endpoints."""

    def setUp(self) -> None:
        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token(
            data={'projects': [{'city': {'departementId': '31'}}]})
        self._db.job_group_info.insert_many([
            {
                '_id': 'A1234',
                # Job rarely requiring anything.
                'requirements': {'diplomas': [
                    {'percentRequired': 5, 'diploma': {'level': 'LICENCE_MAITRISE'}},
                ]},
            },
            {
                '_id': 'B4242',
                # Job rarely requiring anything.
                'requirements': {'diplomas': [
                    {'percentRequired': 5, 'diploma': {'level': 'LICENCE_MAITRISE'}},
                ]},
            },
            {'_id': 'C0000'},
            {
                '_id': 'D9999',
                'automationRisk': 20,
                # Job requiring a PHD
                'requirements': {'diplomas': [
                    {'percentRequired': 60, 'diploma': {'level': 'DEA_DESS_MASTER_PHD'}},
                ]},
            },
            {'_id': 'E1234', 'automationRisk': 90},
        ])
        self._db.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self._db.best_jobs_in_area.insert_many([
            {
                '_id': '31',
                'bestSalariesJobs': [
                    {'jobGroup': {'romeId': 'D9999'}, 'localStats': {'imt': {
                        'juniorSalary': {'shortText': 'about 20k€ per year'}
                    }}},
                    {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                    {'jobGroup': {'romeId': 'B4242'}, 'localStats': {'imt': {
                        'juniorSalary': {'shortText': '2k€ per month'}
                    }}},
                    {'jobGroup': {'romeId': 'A1234'}, 'localStats': {'imt': {
                        'juniorSalary': {'shortText': '1.5k€ per month'}
                    }}},
                ],
                'bestLocalMarketScoreJobs': [
                    {'jobGroup': {'romeId': 'C0000'}},
                    {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                    {'jobGroup': {'romeId': 'A1234'}},
                ],
                'bestRelativeScoreJobs': [
                    {'jobGroup': {'romeId': 'B4242'}},
                    {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                    {'jobGroup': {'romeId': 'A1234'}},
                ],
                'sectors': [
                    {
                        'sectorId': '17034',
                        'description': 'Des métiers auprès des enfants '
                        'avec peu de concurrence',
                        'bestLocalMarketScoreJobs': [
                            {'jobGroup': {'romeId': 'C0000'}},
                            {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                            {'jobGroup': {'romeId': 'A1234'}},
                        ],
                    },
                    {
                        'sectorId': '17036',
                        'description': 'Des métiers auprès des parents '
                        'avec peu de concurrence',
                        'bestLocalMarketScoreJobs': [
                            {'jobGroup': {'romeId': 'A1234'}},
                            {'jobGroup': {'romeId': 'C0000'}},
                        ],
                    },
                    {
                        'sectorId': '17039',
                        'description': 'Des métiers qui ne nécessitent pas de qualification',
                        'bestLocalMarketScoreJobs': [
                            {'jobGroup': {'romeId': 'C0000'}},
                            {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                            {'jobGroup': {'romeId': 'A1234'}},
                        ],
                    }
                ],
            },
            {
                '_id': '32',
                'bestLocalMarketScoreJobs': [
                    {'jobGroup': {'romeId': 'A1234'}},
                ],
                'sectors': [{
                    'sectorId': str(sector_id),
                    'description': f'Des métiers du secteur {sector_id:d}',
                    'bestLocalMarketScoreJobs': [
                        {'jobGroup': {'romeId': 'C0000'}},
                        {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                        {'jobGroup': {'romeId': 'A1234'}},
                    ]} for sector_id in range(10)],
            },
        ])

    @mock.patch('random.shuffle', lambda items: items.reverse())
    def test_basic(self) -> None:
        """Basic call to "/sections"."""

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(
            [
                'best-relative-local-score', 'best-local-market-score', 'best-salaries',
                'sector-17036', 'best-salaries-no-qualifications',
                'best-salaries-low-qualifications', 'sector-17034', 'serendipity',
            ],
            [s.get('id') for s in response['sections']])

        section = response['sections'][0]
        self.assertEqual('Des métiers qui recrutent bien', section.get('name'))
        self.assertCountEqual(
            ['B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])

        section = response['sections'][1]
        self.assertCountEqual(
            ['C0000', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])

        section = response['sections'][2]
        self.assertEqual('Des métiers avec un bon salaire', section.get('name'))
        self.assertCountEqual(
            ['D9999', 'B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])
        self.assertIn('about 20k€ per year', [j.get('shownMetric') for j in section['jobs']])

        section = response['sections'][3]
        self.assertEqual(
            section.get('name'),
            'Des métiers auprès des parents avec peu de concurrence')
        self.assertEqual(2, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'C0000', 'A1234'})

        section = response['sections'][4]
        self.assertEqual(
            'Des métiers avec un bon salaire accessibles sans diplôme',
            section.get('name'))
        self.assertEqual(2, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'B4242', 'A1234'})

        section = response['sections'][5]
        self.assertEqual(
            'Des métiers avec un bon salaire accessibles avec un Bac+2 ou moins',
            section.get('name'))
        self.assertCountEqual(
            ['B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])
        self.assertIn('2k€ per month', [j.get('shownMetric') for j in section['jobs']])

        section = response['sections'][7]
        self.assertEqual('Des métiers au hasard', section.get('name'))
        self.assertEqual(4, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'A1234', 'B4242', 'C0000', 'D9999'})

    def test_no_empty_section(self) -> None:
        """Do not return empty sections."""

        self._db.best_jobs_in_area.replace_one({'_id': '31'}, {
            '_id': '31',
            'sectors': [
                {
                    'sectorId': '17034',
                    'description':
                    'Des métiers auprès des enfants avec peu de concurrence',
                    'bestLocalMarketScoreJobs': [
                        {'jobGroup': {'romeId': 'E1234'}},  # high automation risk.
                    ],
                },
            ],
        })
        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(['serendipity'], [s.get('id') for s in response['sections']])

    def test_many_sections(self) -> None:
        """There are several relevant sectors in the user's departement."""

        user_info = {'projects': [{'city': {'departementId': '32'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        sectors = [
            section for section in response['sections'] if section.get('id').startswith('sector-')]
        self.assertEqual(3, len(sectors), msg=sectors)

    def test_sections_no_data_for_departement(self) -> None:
        """Get sections in a département where there's no data."""

        user_info = {'projects': [{'city': {'departementId': 'does-not-exist'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(
            ['serendipity'],
            [s.get('id') for s in response['sections']])

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    @mock.patch('random.shuffle', lambda unused_list: None)
    def test_i18n(self) -> None:
        """Generate sections in English."""

        user_info = {'profile': {'locale': 'en'}, 'projects': [{'city': {'departementId': '31'}}]}

        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(
            [
                'Jobs that hire well',
                'Jobs with low competition',
                'Jobs with a good salary',
                'Des métiers auprès des enfants avec peu de concurrence',
                'Jobs with good pay accessible without diplomas',
                'Jobs with good pay accessible with Bac+2 or less',
                'Des métiers auprès des parents avec peu de concurrence',
                'Random jobs',
            ],
            [s.get('name') for s in response['sections']])


class MoreJobsTests(base_test.ServerTestCase):
    """Unit tests for upskilling more jobs endpoints."""

    def setUp(self) -> None:
        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token(
            data={'projects': [{'city': {'departementId': '31'}}]})
        self._db.job_group_info.insert_many([
            {
                '_id': f'A12{i:02d}',
                'automationRisk': i,
                # Job rarely requiring anything.
                'requirements': {'diplomas': [
                    {'percentRequired': 5, 'diploma': {'level': 'LICENCE_MAITRISE'}},
                ]},
            }
            for i in range(0, 100)
        ])
        self._db.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self._db.best_jobs_in_area.insert_one({
            '_id': '31',
            'bestSalariesJobs': [
                {'jobGroup': {'romeId': f'A12{i:02d}'}, 'localStats': {'imt': {
                    'juniorSalary': {'shortText': f'about 20{i:02d}0€ per year'}
                }}}
                for i in range(0, 100)
            ],
        })

    def test_basic(self) -> None:
        """Basic call to "the endpoint to get more jobs"."""

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections/best-salaries/jobs/best-salaries:10',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'jobs'}, response.keys())
        self.assertGreater(len(response['jobs']), 30)
        self.assertEqual(
            # Golden test: this is a random due to using "10" as a seed for the randomizer.
            ['A1264', 'A1277'],
            [job.get('jobGroup', {}).get('romeId') for job in response['jobs'][:2]])

    def test_no_project(self) -> None:
        """Trying to get more jobs but with no project."""

        http_response = self.app.post(
            '/api/upskilling/sections/best-salaries/jobs/10',
            data='{}', content_type='application/json')

        self.assertEqual(422, http_response.status_code)

    def test_start_index_wrong_format_no_generator(self) -> None:
        """Trying to get more jobs but giving the wrong format to the state."""

        http_response = self.app.post(
            '/api/upskilling/sections/best-salaries/jobs/more-more-more',
            data='{}', content_type='application/json')

        self.assertEqual(422, http_response.status_code)

    def test_start_index_wrong_format(self) -> None:
        """Trying to get more jobs but giving the wrong format to the start index."""

        http_response = self.app.post(
            '/api/upskilling/sections/best-salaries/jobs/best-salaries:more-more-more',
            data='{}', content_type='application/json')

        self.assertEqual(422, http_response.status_code)

    def test_unknown_section(self) -> None:
        """Trying to get more jobs for an unknown section."""

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections/my-section/jobs/unknown-generator:10',
            data=json.dumps(user_info), content_type='application/json')

        self.assertEqual(404, http_response.status_code)

    def test_more_random_jobs(self) -> None:
        """Get more random jobs but there aren't more."""

        self._db.job_group_info.drop()
        self._db.job_group_info.insert_many([
            {'_id': f'A12{i:02d}'} for i in range(30)
        ])
        user_info = {'projects': [{'city': {'departementId': '31'}}]}

        sections = self.json_from_response(self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')).get('sections', [])
        serendipity_section = next(s for s in sections if s.get('id') == 'serendipity')

        first_jobs = {
            job.get('jobGroup', {}).get('romeId')
            for job in serendipity_section.get('jobs', [])
        }
        state = serendipity_section['state']

        http_response = self.app.post(
            f'/api/upskilling/sections/serendipity/jobs/{state}',
            data=json.dumps(user_info), content_type='application/json')
        response = self.json_from_response(http_response)

        more_jobs = {
            job.get('jobGroup', {}).get('romeId')
            for job in response.get('jobs', [])
        }
        # Make sure the jobs in the second batch are new ones only.
        self.assertFalse(first_jobs & more_jobs, (first_jobs, more_jobs))
        self.assertGreater(len(more_jobs), 15)

    def test_more_random_jobs_for_sector(self) -> None:
        """Get more random jobs but there aren't more."""

        self._db.job_group_info.insert_many([
            {'_id': f'Z12{i:02d}'} for i in range(30)
        ])
        self._db.best_jobs_in_area.replace_one({'_id': '31'}, {
            'sectors': [
                {
                    'sectorId': '17034',
                    'bestLocalMarketScoreJobs': [
                        {'jobGroup': {'romeId': f'Z12{i:02d}'}} for i in range(30)
                    ],
                },
                {
                    'sectorId': '17036',
                    'bestLocalMarketScoreJobs': [
                        {'jobGroup': {'romeId': f'Z12{i:02d}'}} for i in range(30)
                    ],
                },
            ]
        })
        user_info = {'projects': [{'city': {'departementId': '31'}}]}

        sections = self.json_from_response(self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')).get('sections', [])
        a_sector_section = next(s for s in sections if s['id'].startswith('sector-'))

        first_jobs = {
            job.get('jobGroup', {}).get('romeId')
            for job in a_sector_section.get('jobs', [])
        }
        state = a_sector_section['state']

        http_response = self.app.post(
            f'/api/upskilling/sections/{a_sector_section["id"]}/jobs/{state}',
            data=json.dumps(user_info), content_type='application/json')
        response = self.json_from_response(http_response)

        more_jobs = {
            job.get('jobGroup', {}).get('romeId')
            for job in response.get('jobs', [])
        }
        # Make sure the jobs in the second batch are new ones only.
        self.assertFalse(first_jobs & more_jobs, (first_jobs, more_jobs))
        self.assertGreater(len(more_jobs), 15)


if __name__ == '__main__':
    unittest.main()
