"""Tests for the bob_emploi.importer.job_offers_change."""
from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.importer import job_offers_changes
from bob_emploi.lib import mongo


class JobOffersEvolutionImporterTestCase(unittest.TestCase):
    """Tests for the job offers change csv2dicts converter."""

    testdata_folder = path.join(
        path.dirname(__file__), 'testdata/job_offers')

    def test_basic_usage(self):
        """Basic usage."""
        changes = job_offers_changes.csv2dicts(
            path.join(self.testdata_folder, 'job_offers.csv'),
            path.join(self.testdata_folder, 'column_names.txt'))

        changes_proto = dict(mongo.collection_to_proto_mapping(
            changes, job_pb2.LocalJobStats))

        self.assertEqual(set(['78:F1106', '79:F1106']), set(changes_proto))

        proto = changes_proto['79:F1106']
        self.assertEqual(200, proto.job_offers_change)
        self.assertEqual(3, proto.num_job_offers_last_year)
        self.assertEqual({2014: 1, 2015: 3}, proto.num_job_offers_per_year)

        proto = changes_proto['78:F1106']
        self.assertEqual({2015: 1}, proto.num_job_offers_per_year)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
