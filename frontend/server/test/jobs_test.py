"""Unit tests for the frontend.server.jobs module."""

import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo


class JobsTest(unittest.TestCase):
    """Unit tests for the frontend.server.jobs module."""

    def setUp(self) -> None:
        super().setUp()
        self.database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'romeId': 'A1234',
            'name': 'Main Job Group',
            'jobs': [
                {
                    'codeOgr': '56789',
                    'name': 'A job name',
                },
            ],
        })

    def test_get_localized_job_group_proto(self) -> None:
        """Using a different locale gives a translated proto."""

        self.database.job_group_info.insert_one({
            '_id': 'de:A1234',
            'romeId': 'A1234',
            'name': 'Hauptberufsgruppe',
            'jobs': [
                {
                    'codeOgr': '56789',
                    'name': 'Ein Jobname',
                },
            ],
        })
        job_group_proto = jobs.get_group_proto(self.database, 'A1234', locale='de')
        assert job_group_proto
        self.assertEqual('Hauptberufsgruppe', job_group_proto.name)

    @mock.patch('logging.warning')
    def test_get_missing_localized_job_group_proto(self, mock_warning: mock.MagicMock) -> None:
        """Using a different locale without translation fallsback to main proto."""

        job_group_proto = jobs.get_group_proto(self.database, 'A1234', locale='de')
        assert job_group_proto
        self.assertEqual('Main Job Group', job_group_proto.name)
        mock_warning.assert_called_once()

    def test_get_job_proto_missing_job_id(self) -> None:
        """Job ID is missing."""

        self.assertFalse(jobs.get_job_proto(self.database, '', ''))
        self.assertFalse(jobs.get_job_proto(self.database, '', 'A1234'))

    def test_get_job_proto_wrong_job_group(self) -> None:
        """The job is in another job group."""

        self.database.job_group_info.insert_many([
            {
                '_id': 'empty',
                'romeId': 'empty',
                'name': 'Empty Job Group',
            },
            {
                '_id': 'correct',
                'romeId': 'correct',
                'name': 'Job Group with the correct Job',
                'jobs': [{
                    'codeOgr': 'my-job',
                    'name': 'This is the job we are looking for',
                }],
            },
        ])
        self.assertFalse(jobs.get_job_proto(self.database, 'my-job', 'empty'))

    def test_get_job_proto(self) -> None:
        """Regular usage of get_job_proto."""

        self.database.job_group_info.insert_one({
            '_id': 'correct',
            'romeId': 'correct',
            'name': 'Job Group with the correct Job',
            'jobs': [{
                'codeOgr': 'my-job',
                'name': 'This is the job we are looking for',
                'feminineName': 'Feminine',
                'masculineName': 'Masculine',
            }],
        })
        job_proto = jobs.get_job_proto(self.database, 'my-job', 'correct')
        assert job_proto
        self.assertEqual('This is the job we are looking for', job_proto.name)
        self.assertEqual('Feminine', job_proto.feminine_name)
        self.assertEqual('Job Group with the correct Job', job_proto.job_group.name)
        self.assertFalse(job_proto.job_group.jobs)

    def test_super_group(self) -> None:
        """Upgrade a job-group to a super-job-group."""

        self.assertEqual('Manutention', jobs.upgrade_to_super_group('N1103'))
        self.assertEqual('Art et spectacle', jobs.upgrade_to_super_group('B1234'))
        # job-group not in any super group.
        self.assertFalse(jobs.upgrade_to_super_group('A1234'))

        custom_groups = {'A': 'job-name', 'B': 'job-name'}
        self.assertEqual('job-name', jobs.upgrade_to_super_group('A1234', custom_groups))
        self.assertFalse(jobs.upgrade_to_super_group('C1234', custom_groups))

    def test_get_all_job_group_ids(self) -> None:
        """Get all job group IDs."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_many([
            {'_id': 'A1234'},
            {'_id': 'A1235', 'automationRisk': 99},
        ])

        self.assertEqual({'A1234', 'A1235'}, jobs.get_all_job_group_ids(self.database))

    def test_get_all_good_job_group_ids(self) -> None:
        """Get all good job group IDs."""

        self.database.job_group_info.drop()
        self.database.job_group_info.insert_many([
            {'_id': 'A0000'},
            # High automation risk, drop.
            {'_id': 'A1235', 'automationRisk': 99},
            {
                '_id': 'B4242',
                'automationRisk': 50,
            },
            # Mostly temp job, drop.
            {
                '_id': 'C8888',
                'automationRisk': 20,
                'requirements': {'contractTypes': [
                    {'contractType': 'CDD_LESS_EQUAL_3_MONTHS', 'percentSuggested': 56},
                    {'contractType': 'CDI', 'percentSuggested': 24},
                    {'contractType': 'CDD_OVER_3_MONTHS', 'percentSuggested': 20},
                ]},
            },
            {
                '_id': 'D9876',
                'automationRisk': 20,
                'requirements': {'contractTypes': [
                    {'contractType': 'CDD_LESS_EQUAL_3_MONTHS', 'percentSuggested': 40},
                    {'contractType': 'CDI', 'percentSuggested': 34},
                    {'contractType': 'CDD_OVER_3_MONTHS', 'percentSuggested': 26},
                ]},
            },
        ])

        self.assertEqual(
            {'A0000', 'B4242', 'D9876'}, jobs.get_all_good_job_group_ids(self.database))

    def test_get_best_jobs_in_area_cache(self) -> None:
        """get_best_jobs_in_area has limited caching ability."""

        database_proxy = mongo.HashableNoPiiMongoDatabase(self.database)

        self.database.best_jobs_in_area.drop()
        self.database.best_jobs_in_area.insert_one({
            '_id': '69',
            'bestLocalMarketScoreJobs': [{'jobGroup': {'romeId': 'C0000'}}],
        })

        self.assertEqual(
            'C0000',
            jobs.get_best_jobs_in_area(database_proxy, '69')
            .best_local_market_score_jobs[0].job_group.rome_id)

        self.database.best_jobs_in_area.drop()
        self.database.best_jobs_in_area.insert_one({
            '_id': '69',
            'bestLocalMarketScoreJobs': [{'jobGroup': {'romeId': 'Z4242'}}],
        })

        self.assertEqual(
            'C0000',
            jobs.get_best_jobs_in_area(database_proxy, '69')
            .best_local_market_score_jobs[0].job_group.rome_id,
            msg='Value is cached')

        # Bust the cache.
        for i in range(31):
            jobs.get_best_jobs_in_area(database_proxy, f'{i}')
            jobs.get_best_jobs_in_area(database_proxy, f'{i}')
            jobs.get_best_jobs_in_area(database_proxy, f'{i}')

        self.assertEqual(
            'Z4242',
            jobs.get_best_jobs_in_area(database_proxy, '69')
            .best_local_market_score_jobs[0].job_group.rome_id,
            msg='Value is fetched again')


if __name__ == '__main__':
    unittest.main()
