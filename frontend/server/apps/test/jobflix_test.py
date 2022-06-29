"""Tests for the upskilling endpoints."""

import datetime
import json
import logging
import os
from typing import Any
import unittest
from unittest import mock

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import mailjetmock

_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


class UpskillingSectionsTests(base_test.ServerTestCase):
    """Unit tests for upskilling sections endpoints."""

    def setUp(self) -> None:
        super().setUp()
        self.user_id, self.auth_token = self.create_user_with_token(
            data={'projects': [{'city': {'departementId': '31'}}]})
        self._db.section_generators.insert_many([
            {'generator': 'best-relative-local-score'},
            {'generator': 'best-local-market-score'},
            {'generator': 'best-salaries'},
            {'generator': 'random-sector'},
            {'generator': 'best-salaries-no-qualifications'},
            {'generator': 'best-salaries-low-qualifications'},
            {'generator': 'random-sector'},
            {'generator': 'serendipity'},
            {'generator': 'random-sector'},
        ])
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
        self.assertEqual('Des métiers qui recrutent bien en Haute-Garonne', section.get('name'))
        self.assertCountEqual(
            ['B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])

        section = response['sections'][1]
        self.assertCountEqual(
            ['C0000', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])

        section = response['sections'][2]
        self.assertEqual('Des métiers avec un bon salaire en Haute-Garonne', section.get('name'))
        self.assertCountEqual(
            ['D9999', 'B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])
        self.assertIn('about 20k€ per year', [j.get('shownMetric') for j in section['jobs']])
        for job in section.get('jobs', []):
            self.assertIn('GOOD_SALARY', job.get('perks'), msg=job)

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
            'Des métiers avec un bon salaire accessibles sans diplôme en Haute-Garonne',
            section.get('name'))
        self.assertEqual(2, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'B4242', 'A1234'})
        for job in section.get('jobs', []):
            self.assertIn('GOOD_SALARY', job.get('perks'), msg=job)

        section = response['sections'][5]
        self.assertEqual(
            'Des métiers avec un bon salaire accessibles avec un Bac+2 ou moins en Haute-Garonne',
            section.get('name'))
        self.assertCountEqual(
            ['B4242', 'A1234'],
            [job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])])
        self.assertIn('2k€ per month', [j.get('shownMetric') for j in section['jobs']])
        for job in section.get('jobs', []):
            self.assertIn('GOOD_SALARY', job.get('perks'), msg=job)

        section = response['sections'][7]
        self.assertEqual('Des métiers au hasard', section.get('name'))
        self.assertEqual(4, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'A1234', 'B4242', 'C0000', 'D9999'})

        for section in response['sections']:
            for job in section.get('jobs', []):
                self.assertIn(
                    'NOW_HIRING', job.get('perks', []),
                    msg=f'Perks for job "{job.get("jobGroup", {}).get("romeId", "")}" '
                    f'in section "{section.get("name")}"')

    def test_simple_section(self) -> None:
        """Work with only one section."""

        self._db.section_generators.drop()
        self._db.section_generators.insert_one({'generator': 'serendipity'})

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(['serendipity'], [s.get('id') for s in response['sections']])

        section = response['sections'][0]
        self.assertEqual('Des métiers au hasard', section.get('name'))
        self.assertEqual(4, len(section.get('jobs', [])))
        self.assertLessEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'A1234', 'B4242', 'C0000', 'D9999'})

    def test_sort_sections(self) -> None:
        """Sections have a specific order."""

        self._db.section_generators.drop()
        self._db.section_generators.insert_many([
            {'generator': 'serendipity', '_order': 2},
            {'generator': 'best-salaries', '_order': 1},
        ])

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(
            ['best-salaries', 'serendipity'], [s.get('id') for s in response['sections']])

    def test_missing_generator(self) -> None:
        """Work with a section with unknown generator."""

        self._db.section_generators.drop()
        self._db.section_generators.insert_many([
            {'generator': 'unknown-generator'},
            {'generator': 'serendipity'},
        ])

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        with self.assertLogs(level=logging.ERROR) as mock_logger:
            http_response = self.app.post(
                '/api/upskilling/sections',
                data=json.dumps(user_info), content_type='application/json')
        assert mock_logger

        self.assertIn('"unknown-generator"', mock_logger.output[0])
        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(['serendipity'], [s.get('id') for s in response['sections']])

    def test_only_for_alpha(self) -> None:
        """Exclude an alpha section to non alpha users."""

        self._db.section_generators.drop()
        self._db.section_generators.insert_many([
            {'generator': 'serendipity', 'isForAlphaOnly': True},
        ])

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertFalse(response.keys())

    def test_available_for_alpha(self) -> None:
        """Include an alpha section restricted to alpha users."""

        self._db.section_generators.drop()
        self._db.section_generators.insert_many([
            {'generator': 'serendipity', 'isForAlphaOnly': True},
        ])

        user_info = {
            'featuresEnabled': {'alpha': True},
            'projects': [{'city': {'departementId': '31'}}],
        }
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(['serendipity'], [s.get('id') for s in response['sections']])

    def test_low_automation_risk(self) -> None:
        """Work with a section using the low automation risk."""

        self._db.job_group_info.update_one({'_id': 'A1234'}, {'$set': {'automationRisk': 21}})

        self._db.section_generators.drop()
        self._db.section_generators.insert_many([
            {'generator': 'low-automation-risk'},
        ])

        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())
        self.assertEqual(['low-automation-risk'], [s.get('id') for s in response['sections']])
        section = response['sections'][0]
        self.assertEqual(
            'Des métiers qui ne seront pas remplacés par des robots', section.get('name'))
        self.assertEqual(2, len(section.get('jobs', [])))
        self.assertEqual(
            {job.get('jobGroup', {}).get('romeId') for job in section.get('jobs', [])},
            {'A1234', 'D9999'})

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

        self.add_translations([
            {
                'string': 'jobflix_sections:sector-17034',
                'en': 'Jobs with low competition that involve working with kids',
            },
            {
                'string': 'jobflix_sections:sector-17036',
                'en': 'Jobs with low competition that involve working with parents',
            },
        ])

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

    @mock.patch('random.shuffle', lambda items: items.reverse())
    @mock.patch.dict(os.environ, {'BOB_DEPLOYMENT': 'uk'})
    def test_uk(self) -> None:
        """Basic call to "/sections" in the UK deployment."""

        self.add_translations([
            {
                'string': 'jobflix_sections:best-salaries-low-qualifications_uk',
                'fr':
                'Des métiers avec un bon salaire accessibles avec une certification ou moins',
            },
            {
                'string': 'jobflix_sections:best-salaries-low-qualifications',
                'fr':
                'Des métiers avec un bon salaire accessibles '
                'avec un Bac +2 ou moins %inDepartement',
            },
        ])
        user_info = {'projects': [{'city': {'departementId': '31'}}]}
        http_response = self.app.post(
            '/api/upskilling/sections',
            data=json.dumps(user_info), content_type='application/json')

        response = self.json_from_response(http_response)
        self.assertEqual({'sections'}, response.keys())

        sections = response['sections']
        low_qualif = next(s for s in sections if s.get('id') == 'best-salaries-low-qualifications')
        self.assertEqual(
            'Des métiers avec un bon salaire accessibles avec une certification ou moins',
            low_qualif.get('name'))
        for section in sections:
            for job in section.get('jobs', []):
                self.assertNotIn(
                    'NOW_HIRING', job.get('perks', []),
                    msg=f'Perks for job "{job.get("jobGroup", {}).get("romeId", "")}" '
                    f'in section "{section.get("name")}"')


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
        self._db.section_generators.insert_one({'generator': 'best-salaries'})

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

        self._db.section_generators.insert_one({'generator': 'serendipity'})
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
        """Get more random jobs in sector but there aren't more."""

        self._db.section_generators.insert_one({'generator': 'random-sector'})
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

    @mock.patch.dict(os.environ, {'BOB_DEPLOYMENT': 't_pro'})
    def test_sector_in_tpro(self) -> None:
        """Sector jobs in T-Pro should be considered all valid even if low automation."""

        self._db.section_generators.insert_one({'generator': 'random-sector'})
        # Only very risky jobs.
        self._db.job_group_info.insert_many([
            {'_id': f'Z12{i:02d}', 'automationRisk': 99} for i in range(30)
        ])
        self._db.best_jobs_in_area.replace_one({'_id': '31'}, {
            'sectors': [
                {
                    'sectorId': '17034',
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
        self.assertGreater(len(first_jobs), 8)


class _UserBaseTestCase(base_test.ServerTestCase):
    def setUp(self) -> None:
        super().setUp()
        self._user_db = self._user_db.with_prefix('jobflix_')


class SaveUserTestCase(_UserBaseTestCase):
    """Test the user saving route."""

    def _save_user(self, user_info: str) -> dict[str, Any]:
        return self.json_from_response(
            self.app.post('/api/upskilling/user', data=user_info, content_type='application/json'))

    @nowmock.patch()
    def test_save_user(self, mock_now: mock.MagicMock) -> None:
        """Saves a user on jobflix_user collection."""

        mock_now.return_value = datetime.datetime(2021, 5, 18, 20, 5)

        user_info = {
            'profile': {'email': 'jobflix@example.com'},
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        user_response = self._save_user(json.dumps(user_info))
        user_id = user_response.pop('userId')
        self.assertEqual('jobflix@example.com', user_response.get('profile', {}).get('email'))
        self.assertEqual('jobflix_user', self._user_db.user.name)
        self.assertFalse(
            self._user_db.user.database.get_collection('user').find_one({}),
            msg='Something was saved in Bob users collection.')
        db_user = self._user_db.user.find_one({})
        self.assertTrue(db_user, msg='No user found in jobflix user collection.')
        assert db_user
        self.assertEqual(str(db_user.pop('_id')), user_id)
        db_user.pop('_server')
        self.assertEqual(db_user, user_response)
        user_response.pop('hashedEmail')
        user_response.pop('featuresEnabled')
        user_response.pop('revision')
        self.assertEqual('2021-05-18T20:05:00Z', user_response.pop('registeredAt'))
        self.assertEqual('31:A1234', user_response.get('projects', [{}])[0].pop('projectId'))
        self.assertEqual(
            '2021-05-18T20:05:00Z', user_response.get('projects', [{}])[0].pop('createdAt'))
        self.assertEqual(user_info, user_response)

    def test_save_user_silently(self) -> None:
        """Saving a user without an email."""

        user_info = {
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        user_response = self._save_user(json.dumps(user_info))
        self.assertTrue(user_response.get('projects'))

    @mailjetmock.patch()
    def test_save_user_silently_then_not(self) -> None:
        """Saving a user without an email, then adding their email."""

        user_info: dict[str, Any] = {
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        user_info = self._save_user(json.dumps(user_info))
        self.assertTrue(user_info.get('userId'))
        user_info['profile'] = {'email': 'cest.moi@domaine.fr'}
        user_response = self._save_user(json.dumps(user_info))
        self.assertEqual(1, self._user_db.user.count_documents({}))
        self.assertEqual('cest.moi@domaine.fr', user_response.get('profile', {}).get('email'))

    @nowmock.patch()
    def test_update_user(self, mock_now: mock.MagicMock) -> None:
        """Saving a user with the same email appends the new job(s)."""

        mock_now.return_value = datetime.datetime(2021, 12, 15, 12, 30)
        user_info = {
            'profile': {'email': 'jobflix@example.com'},
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        self._save_user(json.dumps(user_info))
        mock_now.return_value = datetime.datetime(2021, 12, 17, 8, 30)
        user_info['projects'] = [{
            'city': {'departementId': '69'},
            'targetJob': {
                'codeOgr': '54321',
                'jobGroup': {'romeId': 'B9876'},
            },
        }]
        user_response = self._save_user(json.dumps(user_info))
        created_users = self._user_db.user.count_documents({})
        self.assertEqual(1, created_users)
        self.assertEqual([
            {
                'city': {'departementId': '31'},
                'createdAt': '2021-12-15T12:30:00Z',
                'projectId': '31:A1234',
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            },
            {
                'city': {'departementId': '69'},
                'createdAt': '2021-12-17T08:30:00Z',
                'projectId': '69:B9876',
                'targetJob': {
                    'codeOgr': '54321',
                    'jobGroup': {'romeId': 'B9876'},
                },
            },
        ], user_response.get('projects'))

    @nowmock.patch()
    def test_update_user_same_job_and_dpt(self, mock_now: mock.MagicMock) -> None:
        """Saving a user with the same job and departement do nothing."""

        mock_now.return_value = datetime.datetime(2021, 12, 15, 12, 30)
        user_info = {
            'profile': {'email': 'jobflix@example.com'},
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        self._save_user(json.dumps(user_info))

        mock_now.return_value = datetime.datetime(2021, 12, 17, 8, 30)
        user_info['projects'] = [
            {
                'city': {'departementId': '69'},
                'targetJob': {
                    'codeOgr': '54321',
                    'jobGroup': {'romeId': 'B9876'},
                },
            },
            {
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            },
        ]
        user_response = self._save_user(json.dumps(user_info))
        self.assertEqual([
            {
                'city': {'departementId': '31'},
                'createdAt': '2021-12-15T12:30:00Z',
                'projectId': '31:A1234',
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            },
            {
                'city': {'departementId': '69'},
                'createdAt': '2021-12-17T08:30:00Z',
                'projectId': '69:B9876',
                'targetJob': {
                    'codeOgr': '54321',
                    'jobGroup': {'romeId': 'B9876'},
                },
            },
        ], user_response.get('projects'))


class DeleteUserTestCase(_UserBaseTestCase):
    """Test the user deletion route."""

    def setUp(self) -> None:
        super().setUp()
        user_info = {
            'profile': {'email': 'jobflix@example.com'},
            'projects': [{
                'city': {'departementId': '31'},
                'targetJob': {
                    'codeOgr': '12345',
                    'jobGroup': {'romeId': 'A1234'},
                },
            }],
        }
        self.app.post(
            '/api/upskilling/user', data=json.dumps(user_info), content_type='application/json')
        saved_user = self._user_db.user.find_one({})
        assert saved_user
        self.user_id = str(saved_user['_id'])

    def test_delete_url(self) -> None:
        """User can be deleted using a simple GET URL and an 'unsubscribe' auth token."""

        unsub_token = auth_token.create_token(self.user_id, role='unsubscribe')
        response = self.app.get(f'/api/upskilling/user/delete/{self.user_id}?token={unsub_token}')
        self.assertLess(response.status_code, 400, msg=response.get_data(as_text=True))
        self.assertIn('adresse email sera supprimée', response.get_data(as_text=True))

    @mock.patch(auth_token.__name__ + '._ADMIN_AUTH_TOKEN', 'really-good-token')
    def test_delete_admin(self) -> None:
        """User can be deleted using an admin token."""

        response = self.app.delete('/api/upskilling/user?email=jobflix@example.com', headers={
            'Authorization': 'Bearer really-good-token',
        })
        self.assertLess(response.status_code, 400, msg=response.get_data(as_text=True))
        self.assertIn('adresse email sera supprimée', response.get_data(as_text=True))


if __name__ == '__main__':
    unittest.main()
