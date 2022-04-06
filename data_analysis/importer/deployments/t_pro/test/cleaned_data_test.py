"""Tests for cleaned Transitios Pro data."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.t_pro import cleaned_data


class TestCleanMetiers(unittest.TestCase):
    """Tests for the clean_metiers function"""

    data_folder = path.join(path.dirname(__file__), 'testdata')

    def test_clean(self) -> None:
        """Ensure it cleans the XLSX."""

        my_df = cleaned_data.clean_metiers(path.join(self.data_folder, 'metiers_porteurs.xlsx'))
        self.assertCountEqual(my_df.columns, {'job_group', 'name', 'sector'})


if __name__ == '__main__':
    unittest.main()
