"""Tests for the bob_emploi.importer.offers_per_city module."""

from os import path
import unittest

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import offers_per_city
from bob_emploi.frontend.api import commute_pb2


class OffersPerCityTestCase(unittest.TestCase):
    """Unit tests for the tested module functions."""

    offers_csv = path.join(path.dirname(__file__), 'testdata/job_offers/job_offers.csv')
    colnames_csv = path.join(path.dirname(__file__), 'testdata/job_offers/column_names.txt')

    def test_extract_offers_per_cities(self):
        """Basic usage of extract_offers_per_cities."""

        cities = offers_per_city.extract_offers_per_cities(
            self.offers_csv, self.colnames_csv, '2015-01-01',
            data_folder=path.join(path.dirname(__file__), 'testdata'))

        city_protos = dict(mongo.collection_to_proto_mapping(cities, commute_pb2.HiringCities))

        self.assertEqual(['F1106'], list(city_protos.keys()))

        f_cities = city_protos['F1106']
        self.assertEqual(
            ['Lyon', 'PARTHENAY-mod', 'PARTHENAY-mod1', 'Parthenay'],
            sorted(h.city.name for h in f_cities.hiring_cities))
        self.assertEqual(10478, f_cities.hiring_cities[1].city.population)
        self.assertEqual(2, f_cities.hiring_cities[1].offers)
        self.assertEqual(0, f_cities.hiring_cities[2].city.population)
        self.assertEqual('Parthenay', f_cities.hiring_cities[1].city.name)
        self.assertAlmostEqual(46.65, f_cities.hiring_cities[1].city.latitude, places=5)
        self.assertAlmostEqual(-0.25, f_cities.hiring_cities[1].city.longitude, places=5)

        # Test that the arrondissement gets removed for LYON 06
        self.assertEqual('Lyon', f_cities.hiring_cities[0].city.name)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
