"""Tests for the bob_emploi.importer.deployments.uk.city_suggest module."""

import io
import re
from os import path
import unittest
from unittest import mock

from algoliasearch import exceptions
import requests_mock

from bob_emploi.data_analysis.importer.deployments.uk import city_suggest


@mock.patch(city_suggest.__name__ + '.search_client')
@requests_mock.mock()
class UploadTestCase(unittest.TestCase):
    """Integration tests for the upload function."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_upload(
            self, mock_algoliasearch: mock.MagicMock, mock_requests: requests_mock.Mocker) -> None:
        """Test the full upload."""

        mock_requests.get(re.compile(r'^https://findthatpostcode\.uk/points/'), json={
            'included': [],
        })
        city_suggest.upload([
            '--ward-ons-list', path.join(self.testdata_folder, 'wards.csv'),
            '--geonames', path.join(self.testdata_folder, 'geonames.txt'),
            '--geonames-admin', path.join(self.testdata_folder, 'geonames_admin.txt'),
            '--algolia-index', 'cities_UK',
            '--algolia-api-key', 'my-api-key',
        ])

        mock_algoliasearch.SearchClient.create.assert_called_once_with('K6ACI9BKKT', 'my-api-key')
        mock_client = mock_algoliasearch.SearchClient.create()
        indices = [c[0][0] for c in mock_client.init_index.call_args_list]
        self.assertEqual(2, len(indices), msg=indices)
        self.assertEqual(2, len(set(indices)), msg=indices)
        self.assertIn('cities_UK', indices)
        tmp_name = (set(indices) - {'cities_UK'}).pop()

        index = mock_client.init_index()
        self.assertTrue(index.save_objects.called)
        self.assertEqual(
            ['Stornoway', 'Dagenham', 'Strensall', 'Barking and Dagenham', 'Greenwich', 'Hackney'],
            [
                city.get('name')
                for call in index.save_objects.call_args_list
                for city in call[0][0]])

        # Point check.
        city = index.save_objects.call_args[0][0][2]
        self.assertEqual('Strensall', city.get('name'), msg=city)
        self.assertEqual('E12000003', city.get('admin1Code'), msg=city)
        self.assertEqual('Yorkshire and The Humber', city.get('admin1Name'), msg=city)
        self.assertEqual('York', city.get('admin2Name'), msg=city)
        self.assertEqual('E06000014', city.get('admin2Code'), msg=city)
        self.assertEqual('', city.get('county'), msg=city)
        self.assertEqual('England', city.get('countryUK'), msg=city)

        hackney = index.save_objects.call_args[0][0][-1]
        self.assertEqual('E12000007', hackney.get('admin1Code'), msg=hackney)
        self.assertEqual('London', hackney.get('admin1Name'), msg=hackney)
        self.assertEqual('Hackney', hackney.get('admin2Name'), msg=hackney)
        self.assertEqual('E09000012', hackney.get('admin2Code'), msg=hackney)
        self.assertEqual('Inner London', hackney.get('county'), msg=hackney)
        self.assertEqual('England', hackney.get('countryUK'), msg=hackney)

        mock_client.move_index.assert_called_once_with(tmp_name, 'cities_UK')

    def test_upload_with_failure(
            self, mock_algoliasearch: mock.MagicMock, mock_requests: requests_mock.Mocker) -> None:
        """Test a failure during the upload."""

        mock_requests.get(re.compile(r'^https://findthatpostcode\.uk/points/'), json={
            'included': [],
        })
        mock_client = mock_algoliasearch.SearchClient.create()
        mock_client.init_index().save_objects.side_effect = exceptions.AlgoliaException

        output = io.StringIO()

        with self.assertRaises(exceptions.AlgoliaException):
            city_suggest.upload([
                '--ward-ons-list', path.join(self.testdata_folder, 'wards.csv'),
                '--geonames', path.join(self.testdata_folder, 'geonames.txt'),
                '--geonames-admin', path.join(self.testdata_folder, 'geonames_admin.txt'),
                '--algolia-api-key', 'my-api-key',
            ], out=output)

        mock_client.move_index.assert_not_called()
        mock_client.init_index().delete.assert_called_once_with()
        output_value = output.getvalue()
        self.assertTrue(
            output_value.startswith('[\n  {\n    "objectID": "2636790",'), msg=output_value)


if __name__ == '__main__':
    unittest.main()
