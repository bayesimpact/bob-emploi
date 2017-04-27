"""Tests for the bob_emploi.importer.show_unverified_data_users module."""
import unittest

from airtable import airtable
import mock

from bob_emploi.importer import show_unverified_data_users


@mock.patch(airtable.__name__ + '.Airtable')
class ShowUnverifiedDataUsersImporterTestCase(unittest.TestCase):
    """Tests for the importer."""

    def test_airtable2dicts(self, mock_airtable):
        """Test the airtable2dicts method."""
        show_unverified_data_users.API_KEY = 'apikey1'
        mock_airtable().iterate.return_value = [
            {'_id': 'rec0', 'fields': {'email': 'pascal@example.com'}},
            {'_id': 'rec1', 'fields': {'email': 'guillaume@example.com'}},
        ]

        dicts = show_unverified_data_users.airtable2dicts('app0', 'table0')
        self.assertEqual(
            [{'_id': 'pascal@example.com'}, {'_id': 'guillaume@example.com'}],
            dicts)

        mock_airtable.assert_called_with('app0', 'apikey1')
        mock_airtable().iterate.assert_called_once_with('table0', view=None)

    def test_missing_api_key(self, mock_airtable):
        """Test that it raises an error if the API key is missing."""
        show_unverified_data_users.API_KEY = ''
        mock_airtable().iterate.return_value = [
            {'_id': 'rec0', 'fields': {'email': 'pascal@example.com'}},
            {'_id': 'rec1', 'fields': {'email': 'guillaume@example.com'}},
        ]

        self.assertRaises(
            ValueError,
            show_unverified_data_users.airtable2dicts, 'app0', 'table0')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
