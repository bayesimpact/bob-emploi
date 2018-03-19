"""Tests for the bob_emploi.importer.unverified_data_zones module."""

import hashlib
from os import path
import unittest

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import unverified_data_zones
from bob_emploi.frontend.api import user_pb2


class RomeMobilityImporterTestCase(unittest.TestCase):
    """Unit tests for the Rome mobility importer."""

    testdata_folder = path.join(path.dirname(__file__), '../../lib/test/testdata')

    def test_csv2dicts(self):
        """Test basic usage of the csv2dicts function."""

        collection = unverified_data_zones.csv2dicts(self.testdata_folder)

        protos = dict(mongo.collection_to_proto_mapping(
            collection, user_pb2.UnverifiedDataZone))
        self.assertEqual(533, len(protos))

        # Point check.
        key = hashlib.md5('03120:A1301'.encode('utf-8')).hexdigest()
        unverified_zone_entry = protos[key]
        self.assertEqual('03120', unverified_zone_entry.postcodes)
        self.assertEqual('A1301', unverified_zone_entry.rome_id)

    def test_get_zones(self):
        """Test zones list is correctly constructed from the three files."""

        zones_list = unverified_data_zones.get_data_zones(self.testdata_folder)
        # 531 (for all romes of the one postcode in the third file) +
        # 1 for the `rome_id` `postcode` combination in the first file +
        # 1 for the `rome_id` `postcode` combination in the second file
        self.assertEqual(533, len(zones_list))
        # All existing ROME Ids
        self.assertEqual(531, zones_list.rome_id.nunique())
        # Spot check file 1
        entries = [
            e for e in zones_list.itertuples()
            if e.rome_id == 'A1301' and e.postcodes == '03120']
        self.assertEqual(1, len(entries))
        # Spot check file 3
        self.assertEqual(531, sum(1 for e in zones_list.itertuples() if e.postcodes == '13002'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
