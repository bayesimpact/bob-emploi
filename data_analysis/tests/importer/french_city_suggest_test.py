# encoding: utf-8
"""Tests for the bob_emploi.importer.french_city_suggest module."""
from os import path
import unittest

from bob_emploi.importer import french_city_suggest


class PrepareCitiesTestCase(unittest.TestCase):
    """Integration tests for the prepare_cities function."""

    stats_csv = path.join(
        path.dirname(__file__), 'testdata/french_cities.csv')
    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_basic_usage(self):
        """Basic Usage."""
        cities = french_city_suggest.prepare_cities(self.testdata_folder)
        self.assertEqual(
            [
                {
                    'objectID': '01001',
                    'cityId': '01001',
                    'name': "L'Abergement-Clémenciat",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '',
                    'population': 0,
                },
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '',
                    'population': 0,
                },
            ],
            cities[:2])
        lyon_6 = next(c for c in cities if c.get('objectID') == '69386')
        self.assertEqual('Lyon 6e  Arrondissement', lyon_6.get('name'))
        self.assertEqual('69123', lyon_6.get('cityId'))
        self.assertFalse(sum(1 for c in cities if c.get('objectID') == '69123'))

    def test_with_stats(self):
        """Give a file containing stats as well."""
        cities = french_city_suggest.prepare_cities(
            self.testdata_folder, stats_filename=self.stats_csv)
        self.assertEqual(
            [
                {
                    'objectID': '01001',
                    'cityId': '01001',
                    'name': "L'Abergement-Clémenciat",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '01400',
                    'population': 784,
                },
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '01640',
                    'population': 221,
                },
            ],
            cities[:2])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
