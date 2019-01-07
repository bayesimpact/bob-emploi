"""Tests for the bob_emploi.importer.french_city_suggest module."""

import io
import os
from os import path
import unittest

from algoliasearch import helpers
import mock

from bob_emploi.data_analysis.importer import french_city_suggest


class PrepareCitiesTestCase(unittest.TestCase):
    """Integration tests for the prepare_cities function."""

    stats_csv = path.join(
        path.dirname(__file__), 'testdata/french_cities.csv')
    urbans_xls = path.join(
        path.dirname(__file__), 'testdata/geo/french_urban_entities.xls')
    transports_html = path.join(
        path.dirname(__file__), 'testdata/geo/ville-ideale-transports.html')
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
        lyon = next(c for c in cities if c.get('objectID') == '69123')
        self.assertEqual('Lyon', lyon.get('name'))
        self.assertEqual('69123', lyon.get('cityId'))

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
                    'objectID': '69123',
                    'cityId': '69123',
                    'name': 'Lyon',
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
                    'objectID': '69123',
                    'cityId': '69123',
                    'name': 'Lyon',
                    'departementId': '69',
                    'departementName': 'Rhône',
                    'departementPrefix': 'dans le ',
                    'regionId': '84',
                    'regionName': 'Auvergne-Rhône-Alpes',
                    'transport': 8.85,
                },
            ],
            cities[1:3])


@mock.patch(french_city_suggest.__name__ + '.algoliasearch')
@mock.patch.dict(os.environ, values={'ALGOLIA_API_KEY': 'my-api-key'})
class UploadTestCase(unittest.TestCase):
    """Integration tests for the upload function."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_upload(self, mock_algoliasearch):
        """Test the full upload."""

        french_city_suggest.upload(data_folder=self.testdata_folder)

        mock_algoliasearch.Client.assert_called_once_with('K6ACI9BKKT', 'my-api-key')
        mock_client = mock_algoliasearch.Client()
        indices = [c[0][0] for c in mock_client.init_index.call_args_list]
        self.assertEqual(2, len(indices), msg=indices)
        self.assertEqual(2, len(set(indices)), msg=indices)
        self.assertIn('cities', indices)
        tmp_name = (set(indices) - {'cities'}).pop()

        index = mock_client.init_index()
        self.assertTrue(index.add_objects.called)
        self.assertEqual(
            ['01001', '01002', '69123', '73002', '74002', '79202'],
            [city.get('objectID')
             for call in index.add_objects.call_args_list
             for city in call[0][0]])

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities')

    def test_upload_with_failure(self, mock_algoliasearch):
        """Test the full upload."""

        mock_client = mock_algoliasearch.Client()
        mock_client.init_index().add_objects.side_effect = helpers.AlgoliaException

        output = io.StringIO()

        with self.assertRaises(helpers.AlgoliaException):
            french_city_suggest.upload(data_folder=self.testdata_folder, out=output)

        mock_client.move_index.assert_not_called()
        mock_client.init_index().clear_index.assert_called_once_with()
        output_value = output.getvalue()
        self.assertTrue(
            output_value.startswith('[\n  {\n    "objectID": "01001"'), msg=output_value)


if __name__ == '__main__':
    unittest.main()
