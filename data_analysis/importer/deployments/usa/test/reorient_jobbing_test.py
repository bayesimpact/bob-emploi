"""Tests for the bob_emploi.importer.deployments.usa.reorient_jobbing module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.usa import reorient_jobbing
from bob_emploi.frontend.api import reorient_jobbing_pb2

from bob_emploi.data_analysis.lib import mongo

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


class ReorientJobbingImporterTestCase(unittest.TestCase):
    """Unit tests for the ReorientJobbing importer."""

    job_zones_tsv = path.join(_TESTDATA_FOLDER, 'onet_22_3/job_zones.tsv')
    occupation_names_txt = path.join(_TESTDATA_FOLDER, 'onet_22_3/Occupation_Data.txt')
    market_scores_csv = path.join(_TESTDATA_FOLDER, 'market_score.csv')

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        jobs = reorient_jobbing.csv2dicts(
            self.job_zones_tsv, self.occupation_names_txt,
            self.market_scores_csv)

        jobs_proto = dict(mongo.collection_to_proto_mapping(
            jobs, reorient_jobbing_pb2.LocalJobbingStats))

        self.assertIn(36061, list(jobs_proto.keys()))

        manhattan_jobs = jobs_proto[36061]

        self.assertEqual(1, len(manhattan_jobs.departement_job_stats.jobs))
        self.assertEqual(['35-2011'], [
            job.rome_id for job in manhattan_jobs.departement_job_stats.jobs])
        self.assertEqual(
            'Cooks, Fast Food', manhattan_jobs.departement_job_stats.jobs[0].name)


if __name__ == '__main__':
    unittest.main()
