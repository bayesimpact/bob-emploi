"""Tests for the bob_emploi.importer.city_locations module."""

from os import path
import unittest

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import city_locations
from bob_emploi.frontend.api import geo_pb2


class CityLocationsImporterTestCase(unittest.TestCase):
    """Unit tests for the city locations importer."""

    test_data_folder = path.join(path.dirname(__file__), 'testdata')
    stats_filename = path.join(test_data_folder, 'french_cities.csv')
    urban_context_filename = path.join(test_data_folder, 'geo/french_urban_areas.xls')

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = city_locations.csv2dicts(self.stats_filename, self.urban_context_filename)

        protos = dict(mongo.collection_to_proto_mapping(collection, geo_pb2.FrenchCity))
        self.assertEqual(11, len(protos))

        # Point check.
        city = protos['39001']
        self.assertAlmostEqual(47.0667, city.latitude, places=5)
        self.assertAlmostEqual(5.38333, city.longitude, places=5)
        other_city = protos['01002']
        self.assertEqual(geo_pb2.PERIURBAN, other_city.urban_context)


if __name__ == '__main__':
    unittest.main()
