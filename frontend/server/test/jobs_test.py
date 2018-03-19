"""Unit tests for the frontend.server.jobs module."""

import unittest

import mongomock

from bob_emploi.frontend.server import jobs


class JobsTest(unittest.TestCase):
    """Unit tests for the frontend.server.jobs module."""

    def setUp(self):
        super(JobsTest, self).setUp()
        self.database = mongomock.MongoClient().test
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

    def test_get_job_proto_missing_job_id(self):
        """Job ID is missing."""

        self.assertFalse(jobs.get_job_proto(self.database, None, None))
        self.assertFalse(jobs.get_job_proto(self.database, None, 'A1234'))

    def test_get_job_proto_wrong_job_group(self):
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

    def test_get_job_proto(self):
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
        self.assertTrue(job_proto)
        self.assertEqual('This is the job we are looking for', job_proto.name)
        self.assertEqual('Feminine', job_proto.feminine_name)
        self.assertEqual('Job Group with the correct Job', job_proto.job_group.name)
        self.assertFalse(job_proto.job_group.jobs)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
