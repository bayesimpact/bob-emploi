# encoding: utf-8
"""Tests for the bob_emploi.importer.job_offers module."""

from os import path
import unittest

from bob_emploi.frontend.api import job_offer_counts_pb2
from bob_emploi.lib import mongo
from bob_emploi.importer import job_offers


class JobOffersTestCase(unittest.TestCase):
    """Unittests for job offers."""

    job_offers_csv = path.join(
        path.dirname(__file__), 'testdata/job_offers/job_offers.csv')

    def test_csv2dicts(self):
        """Test basic usage of the csv2dicts function."""
        collection = job_offers.csv2dicts(self.job_offers_csv)
        self.assertEqual(3, len(collection))
        collection_proto = dict(mongo.collection_to_proto_mapping(
            collection, job_offer_counts_pb2.JobOfferCounts))
        # Point check, csv designed to match these numbers.
        city_id = '79202'
        city = collection_proto['F1106:c' + city_id]
        self.assertEqual(city_id, city.city.city_id)
        self.assertEqual(2, city.city_count)
        self.assertEqual(3, city.departement_count)
        self.assertEqual(4, city.region_count)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
