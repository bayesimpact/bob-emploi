"""Tests for the bob_emploi.importer.geonames_city_suggest module."""

import io
from os import path
import unittest
from unittest import mock

from algoliasearch import exceptions

from bob_emploi.data_analysis.importer.deployments.usa import geonames_city_suggest


@mock.patch(geonames_city_suggest.__name__ + '.search_client')
class UploadTestCase(unittest.TestCase):
    """Integration tests for the upload function."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_with_zip_codes(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test with zip coded cities as file parameter."""

        geonames_city_suggest.upload([
            '--cities-with-zip', path.join(self.testdata_folder, 'cities_zip.txt'),
            '--population-by-zip', path.join(self.testdata_folder, 'population_by_zip_codes.txt'),
            '--states-fips-codes', path.join(self.testdata_folder, 'usa/states.txt'),
            '--algolia-index', 'cities_US',
            '--algolia-api-key', 'my-api-key',
        ])

        mock_algoliasearch.SearchClient.create.assert_called_once_with('K6ACI9BKKT', 'my-api-key')
        mock_client = mock_algoliasearch.SearchClient.create()
        indices = [c[0][0] for c in mock_client.init_index.call_args_list]
        self.assertEqual(2, len(indices), msg=indices)
        self.assertEqual(2, len(set(indices)), msg=indices)
        self.assertIn('cities_US', indices)
        tmp_name = (set(indices) - {'cities_US'}).pop()

        index = mock_client.init_index()
        self.assertTrue(index.save_objects.called)
        self.assertEqual(
            ['Akutan', 'Cold Bay', 'Springfield', 'Springfield', 'New York', 'Bronx', 'Pittsburgh'],
            [city.get('name')
             for call in index.save_objects.call_args_list
             for city in call[0][0]])
        city = index.save_objects.call_args[0][0][1]
        self.assertEqual('AK', city.get('admin1Code'), msg=city)
        self.assertEqual('Alaska', city.get('admin1Name'), msg=city)
        self.assertEqual('Aleutians East', city.get('admin2Name'), msg=city)
        self.assertEqual('2013', city.get('admin2Code'), msg=city)
        self.assertEqual('AK_2013_ColdBay', city.get('objectID'), msg=city)
        self.assertEqual(142, city.get('population'), msg=city)

        springfield_ohio = index.save_objects.call_args[0][0][2]
        self.assertEqual('39023', springfield_ohio.get('admin2Code'), msg=springfield_ohio)
        self.assertEqual('Ohio', springfield_ohio.get('admin1Name'), msg=springfield_ohio)

        springfield_oregon = index.save_objects.call_args[0][0][3]
        self.assertEqual('41039', springfield_oregon.get('admin2Code'), msg=springfield_oregon)
        self.assertEqual('Oregon', springfield_oregon.get('admin1Name'), msg=springfield_oregon)

        pittsburgh = index.save_objects.call_args[0][0][-1]
        self.assertEqual('42003', pittsburgh.get('admin2Code'), msg=pittsburgh)
        self.assertEqual('Allegheny', pittsburgh.get('admin2Name'), msg=pittsburgh)

        new_york = index.save_objects.call_args[0][0][-3]
        self.assertEqual('36061', new_york.get('admin2Code'), msg=new_york)
        self.assertEqual('10001-10002-10003', new_york.get('zipCodes'), msg=new_york)
        self.assertEqual(98596, new_york.get('population'), msg=new_york)

        the_bronx = index.save_objects.call_args[0][0][-2]
        self.assertEqual('36005', the_bronx.get('admin2Code'), msg=the_bronx)
        self.assertEqual('10451-10452-10453', the_bronx.get('zipCodes'), msg=the_bronx)

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities_US')

    def test_upload_with_failure(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test a failure during the upload."""

        mock_client = mock_algoliasearch.SearchClient.create()
        mock_client.init_index().save_objects.side_effect = exceptions.AlgoliaException

        output = io.StringIO()

        with self.assertRaises(exceptions.AlgoliaException):
            geonames_city_suggest.upload([
                '--cities-with-zip', path.join(self.testdata_folder, 'cities_zip.txt'),
                '--population-by-zip', path.join(
                    self.testdata_folder, 'population_by_zip_codes.txt'),
                '--states-fips-codes', path.join(self.testdata_folder, 'usa/states.txt'),
                '--algolia-api-key', 'my-api-key',
            ], out=output)

        mock_client.move_index.assert_not_called()
        mock_client.init_index().delete.assert_called_once_with()
        output_value = output.getvalue()
        self.assertTrue(
            output_value.startswith('[\n  {\n    "admin2Code": "2013",'), msg=output_value)

    def test_without_states(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test not setting the states-fips-codes file parameter."""

        geonames_city_suggest.upload([
            '--cities-with-zip', path.join(self.testdata_folder, 'cities_zip.txt'),
            '--population-by-zip', path.join(self.testdata_folder, 'population_by_zip_codes.txt'),
            '--algolia-index', 'cities_US',
            '--algolia-api-key', 'my-api-key',
        ])

        mock_algoliasearch.SearchClient.create.assert_called_once_with('K6ACI9BKKT', 'my-api-key')
        mock_client = mock_algoliasearch.SearchClient.create()
        indices = [c[0][0] for c in mock_client.init_index.call_args_list]
        self.assertEqual(2, len(indices), msg=indices)
        self.assertEqual(2, len(set(indices)), msg=indices)
        self.assertIn('cities_US', indices)
        tmp_name = (set(indices) - {'cities_US'}).pop()

        index = mock_client.init_index()
        self.assertTrue(index.save_objects.called)
        self.assertEqual(
            ['Akutan', 'Cold Bay', 'Springfield', 'Springfield', 'New York', 'Bronx', 'Pittsburgh'],
            [city.get('name')
             for call in index.save_objects.call_args_list
             for city in call[0][0]])
        city = index.save_objects.call_args[0][0][1]
        self.assertEqual('AK', city.get('admin1Code'), msg=city)
        self.assertEqual('Alaska', city.get('admin1Name'), msg=city)
        self.assertEqual('Aleutians East', city.get('admin2Name'), msg=city)
        self.assertEqual('013', city.get('admin2Code'), msg=city)
        self.assertEqual('AK_013_ColdBay', city.get('objectID'), msg=city)

        new_york = index.save_objects.call_args[0][0][-3]
        self.assertEqual('061', new_york.get('admin2Code'), msg=new_york)
        self.assertEqual('10001-10002-10003', new_york.get('zipCodes'), msg=new_york)

        the_bronx = index.save_objects.call_args[0][0][-2]
        self.assertEqual('005', the_bronx.get('admin2Code'), msg=the_bronx)
        self.assertEqual('10451-10452-10453', the_bronx.get('zipCodes'), msg=the_bronx)

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities_US')


if __name__ == '__main__':
    unittest.main()
