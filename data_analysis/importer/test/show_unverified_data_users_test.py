"""Tests for the bob_emploi.importer.show_unverified_data_users module."""

import unittest

import airtablemock

from bob_emploi.data_analysis.importer import show_unverified_data_users


@airtablemock.patch(show_unverified_data_users.__name__ + '.airtable')
class ShowUnverifiedDataUsersImporterTestCase(unittest.TestCase):
    """Tests for the importer."""

    def setUp(self):
        super(ShowUnverifiedDataUsersImporterTestCase, self).setUp()
        table = airtablemock.Airtable('app0', 'apikey1')
        table.create('table0', {'email': 'pascal@example.com'})
        table.create('table0', {'email': 'guillaume@example.com'})

    def test_airtable2dicts(self):
        """Test the airtable2dicts method."""

        show_unverified_data_users.API_KEY = 'apikey1'

        dicts = show_unverified_data_users.airtable2dicts('app0', 'table0')
        self.assertEqual(
            [{'_id': 'guillaume@example.com'}, {'_id': 'pascal@example.com'}],
            sorted(dicts, key=lambda a: a['_id']))

    def test_missing_api_key(self):
        """Test that it raises an error if the API key is missing."""

        show_unverified_data_users.API_KEY = ''

        self.assertRaises(
            ValueError,
            show_unverified_data_users.airtable2dicts, 'app0', 'table0')


if __name__ == '__main__':
    unittest.main()
