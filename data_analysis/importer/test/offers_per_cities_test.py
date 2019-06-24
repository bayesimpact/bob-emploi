"""Tests for the bob_emploi.importer.offers_per_city module."""

from os import path
import unittest
from unittest import mock

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import offers_per_city
from bob_emploi.frontend.api import commute_pb2


@mock.patch(offers_per_city.tqdm.__name__ + '.tqdm', new=lambda iterable, **kwargs: iterable)
class OffersPerCityTestCase(unittest.TestCase):
    """Unit tests for the tested module functions."""

    offers_csv = path.join(path.dirname(__file__), 'testdata/job_offers/job_offers.csv')
    colnames_csv = path.join(path.dirname(__file__), 'testdata/job_offers/column_names.txt')

    def test_extract_offers_per_cities(self) -> None:
        """Basic usage of extract_offers_per_cities."""

        cities = offers_per_city.extract_offers_per_cities(
            self.offers_csv, self.colnames_csv, '2015-01-01',
            data_folder=path.join(path.dirname(__file__), 'testdata'))

        city_protos = dict(mongo.collection_to_proto_mapping(cities, commute_pb2.HiringCities))

        self.assertEqual(['F1106'], list(city_protos.keys()))

        f_cities = city_protos['F1106'].hiring_cities
        self.assertEqual(['Parthenay', 'PARTHENAY-mod', 'Lyon'], [h.city.name for h in f_cities])
        offer_rates = [h.offers_per_inhabitant for h in f_cities]
        self.assertEqual(sorted(offer_rates, reverse=True), offer_rates)
        best_city = f_cities[0]
        self.assertEqual('Parthenay', best_city.city.name)
        self.assertEqual('79202', best_city.city.city_id)
        self.assertEqual('79', best_city.city.departement_id)
        self.assertEqual(10478, best_city.city.population)
        self.assertEqual(2, best_city.offers)
        self.assertAlmostEqual(2 / 10478, best_city.offers_per_inhabitant, places=5)
        self.assertAlmostEqual(46.65, best_city.city.latitude, places=5)
        self.assertAlmostEqual(-0.25, best_city.city.longitude, places=5)

        # Test that the arrondissement gets removed for LYON 06
        self.assertEqual('Lyon', f_cities[2].city.name)


if __name__ == '__main__':
    unittest.main()
