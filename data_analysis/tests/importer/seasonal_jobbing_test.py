"""Tests for the bob_emploi.importer.local_diagnosis module."""
from os import path
import unittest

from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.importer import seasonal_jobbing

from bob_emploi.lib import mongo


class SeasonalJobbingImporterTestCase(unittest.TestCase):
    """Unit tests for the BMO Rome importer."""

    offers_csv = path.join(
        path.dirname(__file__), 'testdata/job_offers/seasonal_offers_2015_2017.csv')

    def test_csv2dicts(self):
        """Test basic usage of the csv2dicts function."""
        offers = seasonal_jobbing.csv2dicts(self.offers_csv)

        offers_proto = dict(mongo.collection_to_proto_mapping(
            offers, seasonal_jobbing_pb2.MonthlySeasonalJobbingStats))

        self.assertEqual([3], list(offers_proto.keys()))

        march_proto = offers_proto[3]
        self.assertEqual(['06'], [d.departement_id for d in march_proto.departement_stats])

        first_departement_proto = march_proto.departement_stats[0]
        self.assertEqual('06', first_departement_proto.departement_id)
        self.assertEqual(793, first_departement_proto.departement_seasonal_offers)
        self.assertEqual(11, len(first_departement_proto.job_groups))
        self.assertEqual(
            'Personnel de cuisine',
            first_departement_proto.job_groups[0].name.strip())
        self.assertEqual(166, first_departement_proto.job_groups[0].offers)
        self.assertEqual('G1602', first_departement_proto.job_groups[0].rome_id)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
