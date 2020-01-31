"""Unit tests for the bob_emploi.misc.vae_stats_to_airtable script."""

from os import path
import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.misc import vae_stats_to_airtable


class UploadTest(airtablemock.TestCase):
    """Unit tests."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')

    def setUp(self) -> None:
        super().setUp()
        airtablemock.create_empty_table('appABCD', 'my-table')

    def test_from_scratch(self) -> None:
        """Tests starting with an empty table."""

        vae_stats_to_airtable.main(
            'apiKey', base_id='appABCD', table='my-table', data_folder=self.testdata_dir)

        stats = list(airtable.Airtable('appABCD', '').iterate('my-table'))
        self.assertEqual(30, len(stats), msg=stats)
        # Point check.
        self.assertEqual(
            {
                'name': 'Petite enfance (CAP)',
                'vae_ratio_in_diploma': 6.6,
            },
            stats[0]['fields'])

    def test_update(self) -> None:
        """Tests starting with a table already containing stuff."""

        client = airtable.Airtable('appABCD', '')
        client.create('my-update-table', {
            'name': 'Petite enfance (CAP)',
            'related_rome_ids': ['A1234', 'B1234'],
            'vae_ratio_in_diploma': 3,
        })
        client.create(
            'my-update-table', {'name': 'Old diploma', 'vae_ratio_in_diploma': 42})
        client.create(
            'my-update-table', {'name': 'Other line'})

        vae_stats_to_airtable.main(
            'apiKey', base_id='appABCD', table='my-update-table', data_folder=self.testdata_dir)

        stats = list(airtable.Airtable('appABCD', '').iterate('my-update-table'))
        self.assertEqual(32, len(stats), msg=stats)
        # Row 0 was updated.
        self.assertEqual(
            {
                'name': 'Petite enfance (CAP)',
                'related_rome_ids': ['A1234', 'B1234'],
                'vae_ratio_in_diploma': 6.6,
            },
            stats[0]['fields'])
        # Row 1 was untouched.
        self.assertEqual(
            {
                'name': 'Old diploma',
                'vae_ratio_in_diploma': 42,
            },
            stats[1]['fields'])
        # Row 2 was untouched.
        self.assertEqual({'name': 'Other line'}, stats[2]['fields'])
        # Point check.
        self.assertEqual(
            {
                'name': 'Commerce (bac pro)',
                'vae_ratio_in_diploma': 2.2,
            },
            stats[10]['fields'])


if __name__ == '__main__':
    unittest.main()
