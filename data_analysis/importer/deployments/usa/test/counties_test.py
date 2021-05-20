"""Tests for the bob_emploi.importer.geonames_city_suggest module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.usa import counties


class CountiesTestCase(unittest.TestCase):
    """Integration tests for the upload function."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_upload(self) -> None:
        """Test the full upload."""

        found_counties = counties.make_dicts(
            path.join(self.testdata_folder, 'geonames_admin.txt'),
            path.join(self.testdata_folder, 'usa/states.txt'),
        )

        self.assertEqual(5, len(found_counties), msg=found_counties)
        self.assertEqual(
            [
                'Aleutians West Census Area, Alaska',
                'Allegheny County, Pennsylvania',
                'Bronx County, New York',
                'Honolulu County, Hawaii',
                'New York City, New York'
            ],
            [county.get('name') for county in found_counties])
        county = next(
            c for c in found_counties
            if c.get('name') == 'Aleutians West Census Area, Alaska')
        self.assertEqual('2016', county.get('_id'), msg=county)


if __name__ == '__main__':
    unittest.main()
