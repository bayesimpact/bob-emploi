"""Tests for the bob_emploi.importer.french_city_suggest module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer import french_city_suggest


class PrepareCitiesTestCase(unittest.TestCase):
    """Integration tests for the prepare_cities function."""

    stats_csv = path.join(
        path.dirname(__file__), 'testdata/french_cities.csv')
    urbans_xls = path.join(
        path.dirname(__file__), 'testdata/french_urban_entities.xls')
    transports_html = path.join(
        path.dirname(__file__), 'testdata/ville-ideale-transports.html')
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
                    'departementPrefix': "dans l'",
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                },
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'departementPrefix': "dans l'",
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
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
                    'departementPrefix': "dans l'",
                    'population': 784,
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '01400',
                },
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'departementPrefix': "dans l'",
                    'population': 221,
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'zipCode': '01640',
                },
            ],
            cities[:2])

    def test_with_urban(self):
        """Give a file containing urban entities as well."""

        cities = french_city_suggest.prepare_cities(
            self.testdata_folder, urban_entities_filename=self.urbans_xls)
        self.assertEqual(
            [
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'departementPrefix': "dans l'",
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'urban': 0,
                },
                {
                    'objectID': '69386',
                    'cityId': '69123',
                    'name': 'Lyon 6e  Arrondissement',
                    'departementId': '69',
                    'departementName': 'Rhône',
                    'departementPrefix': 'dans le ',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'urban': 7,
                },
            ],
            cities[1:3])

    def test_with_transport(self):
        """Give a file containing transport scores as well."""

        cities = french_city_suggest.prepare_cities(
            self.testdata_folder, transport_scores_filename=self.transports_html)
        self.assertEqual(
            [
                {
                    'objectID': '01002',
                    'cityId': '01002',
                    'name': "L'Abergement-de-Varey",
                    'departementId': '01',
                    'departementName': 'Ain',
                    'departementPrefix': "dans l'",
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'transport': 0.0,
                },
                {
                    'objectID': '69386',
                    'cityId': '69123',
                    'name': 'Lyon 6e  Arrondissement',
                    'departementId': '69',
                    'departementName': 'Rhône',
                    'departementPrefix': 'dans le ',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'transport': 8.85,
                },
            ],
            cities[1:3])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
