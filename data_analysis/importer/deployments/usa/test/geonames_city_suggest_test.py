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

    def test_upload(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test the full upload."""

        geonames_city_suggest.upload([
            '--geonames-dump', path.join(self.testdata_folder, 'geonames.txt'),
            '--geonames-admin-dump', path.join(self.testdata_folder, 'geonames_admin.txt'),
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
            [
                'Amchitka', 'Attu', 'Bauxite', 'Baxters', 'College Hill',
                'Concrete', 'Cost', 'Doty', 'Ko Olina', 'The Bronx', 'New York City', 'Pittsburgh',
            ],
            [city.get('name')
             for call in index.save_objects.call_args_list
             for city in call[0][0]])
        city = index.save_objects.call_args[0][0][0]
        self.assertEqual('AK', city.get('admin1Code'), msg=city)
        self.assertEqual('Alaska', city.get('admin1Name'), msg=city)
        self.assertEqual('Aleutians West Census Area', city.get('admin2Name'), msg=city)
        self.assertEqual('2016', city.get('admin2Code'), msg=city)
        self.assertEqual(0, city.get('borough'), msg=city)

        pittsburgh = index.save_objects.call_args[0][0][-1]
        self.assertEqual('42003', pittsburgh.get('admin2Code'), msg=pittsburgh)
        self.assertEqual('Allegheny County', pittsburgh.get('admin2Name'), msg=pittsburgh)

        ko_olina = index.save_objects.call_args[0][0][-4]
        self.assertEqual('15003', ko_olina.get('admin2Code'), msg=ko_olina)
        self.assertEqual('Honolulu County', ko_olina.get('admin2Name'), msg=ko_olina)

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities_US')

    def test_upload_with_failure(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test a failure during the upload."""

        mock_client = mock_algoliasearch.SearchClient.create()
        mock_client.init_index().save_objects.side_effect = exceptions.AlgoliaException

        output = io.StringIO()

        with self.assertRaises(exceptions.AlgoliaException):
            geonames_city_suggest.upload([
                '--geonames-dump', path.join(self.testdata_folder, 'geonames.txt'),
                '--geonames-admin-dump', path.join(self.testdata_folder, 'geonames_admin.txt'),
                '--states-fips-codes', path.join(self.testdata_folder, 'usa/states.txt'),
                '--algolia-api-key', 'my-api-key',
            ], out=output)

        mock_client.move_index.assert_not_called()
        mock_client.init_index().delete.assert_called_once_with()
        output_value = output.getvalue()
        self.assertTrue(
            output_value.startswith('[\n  {\n    "objectID": "4045510",'), msg=output_value)

    def test_without_states(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test not setting the states-fips-codes file parameter."""

        geonames_city_suggest.upload([
            '--geonames-dump', path.join(self.testdata_folder, 'geonames.txt'),
            '--geonames-admin-dump', path.join(self.testdata_folder, 'geonames_admin.txt'),
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
            [
                'Amchitka', 'Attu', 'Bauxite', 'Baxters', 'College Hill',
                'Concrete', 'Cost', 'Doty', 'Ko Olina', 'The Bronx', 'New York City', 'Pittsburgh',
            ],
            [city.get('name')
             for call in index.save_objects.call_args_list
             for city in call[0][0]])
        city = index.save_objects.call_args[0][0][1]
        self.assertEqual('AK', city.get('admin1Code'), msg=city)
        self.assertEqual('Alaska', city.get('admin1Name'), msg=city)
        self.assertEqual('Aleutians West Census Area', city.get('admin2Name'), msg=city)
        self.assertEqual('016', city.get('admin2Code'), msg=city)

        pittsburgh = index.save_objects.call_args[0][0][-1]
        self.assertEqual('003', pittsburgh.get('admin2Code'), msg=pittsburgh)
        # TODO(cyrille): Rather test from a file with unique admin2 codes.
        self.assertIn(
            pittsburgh.get('admin2Name'), {'Honolulu County', 'Allegheny County'}, msg=pittsburgh)

        new_york = index.save_objects.call_args[0][0][-2]
        self.assertEqual('000', new_york.get('admin2Code'), msg=new_york)
        # TODO(cyrille): Rather test from a file with unique admin2 codes.
        self.assertEqual(0, new_york.get('borough'), msg=new_york)

        the_bronx = index.save_objects.call_args[0][0][-3]
        self.assertEqual('005', the_bronx.get('admin2Code'), msg=the_bronx)
        # TODO(cyrille): Rather test from a file with unique admin2 codes.
        self.assertEqual(1, the_bronx.get('borough'), msg=the_bronx)

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities_US')


if __name__ == '__main__':
    unittest.main()
