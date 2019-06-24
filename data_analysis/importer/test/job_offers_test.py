"""Tests for the bob_emploi.importer.job_offers module."""

from os import path
import unittest

from bob_emploi.frontend.api import job_offer_counts_pb2
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import job_offers


class JobOffersTestCase(unittest.TestCase):
    """Unittests for job offers."""

    job_offers_csv = path.join(
        path.dirname(__file__), 'testdata/job_offers/job_offers.csv')
    colnames_csv = path.join(
        path.dirname(__file__), 'testdata/job_offers/column_names.txt')

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = job_offers.csv2dicts(self.job_offers_csv, self.colnames_csv)
        self.assertEqual(4, len(collection))
        collection_proto = dict(mongo.collection_to_proto_mapping(
            collection, job_offer_counts_pb2.JobOfferCounts))
        # Point check, csv designed to match these numbers.
        city_id = '79202'
        city = collection_proto['F1106:c' + city_id]
        self.assertEqual(city_id, city.city.city_id)
        self.assertEqual(2, city.city_count)
        self.assertEqual(6, city.departement_count)
        self.assertEqual(7, city.region_count)


if __name__ == '__main__':
    unittest.main()
