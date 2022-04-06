"""Unit tests for the bob_emploi.lib.uk_cleaned_data module."""

import os
from os import path
import unittest
from unittest import mock

from bob_emploi.data_analysis.lib import uk_cleaned_data


class UKCleanedDataTests(unittest.TestCase):
    """Unit tests for each dataset."""

    is_real_data = os.getenv('TEST_REAL_DATA')
    test_data_folder = path.join(path.dirname(__file__), 'testdata')
    data_folder = 'data' if is_real_data else test_data_folder

    def test_uk_soc2010_job_groups(self) -> None:
        """Check format of the uk_soc2010_job_groups table."""

        soc2010_job_groups = uk_cleaned_data.uk_soc2010_job_groups(data_folder=self.data_folder)

        self.assertEqual(['name'], soc2010_job_groups.columns)
        self.assertTrue(soc2010_job_groups.index.is_unique)

        # Point checks.
        self.assertEqual(
            'Chief executives and senior officials', soc2010_job_groups.loc['1115', 'name'])
        self.assertEqual(
            'Chemical scientists', soc2010_job_groups.loc['2111', 'name'])

    def test_uk_soc2010_group_descriptions(self) -> None:
        """Check format of the uk_soc2010_group_descriptions table."""

        descriptions = uk_cleaned_data.uk_soc2010_group_descriptions(
            data_folder=self.data_folder)

        self.assertEqual(
            ['name', 'description', 'jobs', 'minimum_diploma'], list(descriptions.columns))
        self.assertTrue(descriptions.index.is_unique)

        self.assertEqual('CHIEF EXECUTIVES AND SENIOR OFFICIALS', descriptions.loc['1115', 'name'])
        self.assertEqual('CHEMICAL SCIENTISTS', descriptions.loc['2111', 'name'])

        self.assertIn('Ecologist', descriptions.loc['2141', 'jobs'])
        self.assertNotIn('', descriptions.loc['2141', 'jobs'])

        self.assertIn(
            'Special needs education teaching professionals organise and provide instruction',
            descriptions.loc['2316', 'description'])

        self.assertEqual('FINANCE OFFICERS', descriptions.loc['4124', 'name'])
        self.assertEqual('UNKNOWN_DEGREE', descriptions.loc['4124', 'minimum_diploma'])

        self.assertEqual('WAITERS AND WAITRESSES', descriptions.loc['9273', 'name'])
        self.assertEqual('NO_DEGREE', descriptions.loc['9273', 'minimum_diploma'])

        self.assertEqual(
            'BOOK-KEEPERS, PAYROLL MANAGERS AND WAGES CLERKS', descriptions.loc['4122', 'name'])
        self.assertEqual('UNKNOWN_DEGREE', descriptions.loc['4122', 'minimum_diploma'])

    def test_uk_national_occupations(self) -> None:
        """Check the parsing of UK national occupational employment statistics."""

        occupations = uk_cleaned_data.uk_national_occupations(self.data_folder)
        self.assertEqual(
            ['1', '111', '1115'],
            sorted(occupations.occ_code)[:3])
        self.assertEqual({'major', 'minor', 'unit'}, set(occupations.o_group.unique()))
        # Point check.
        self.assertEqual(126695, occupations.set_index('occ_code').loc['1223', 'tot_emp'])

    def test_uk_soc2010_isco08_mapping(self) -> None:
        """Test the UK SOC 2010 -> ISCO08 mapping table."""

        uk_soc2010_isco08_mapping = uk_cleaned_data.uk_soc2010_isco08_mapping(
            data_folder=self.data_folder)
        self.assertEqual(['isco08_code'], uk_soc2010_isco08_mapping.columns)
        self.assertEqual(385, len(uk_soc2010_isco08_mapping))
        # Point checks.
        self.assertEqual('5414', uk_soc2010_isco08_mapping.isco08_code['9241'])
        self.assertEqual(
            ['6210', '9215'],
            sorted(uk_soc2010_isco08_mapping.loc['9112', 'isco08_code'].to_list()))
        for_8321 = uk_soc2010_isco08_mapping[uk_soc2010_isco08_mapping.isco08_code == '8321']
        self.assertTrue(for_8321.empty, for_8321)

    def test_uk_2020_salaries(self) -> None:
        """Test salaries extraction by job and region."""

        uk_salaries = uk_cleaned_data.get_salaries(
            data_folder=self.data_folder)
        self.assertEqual(['1115', '1116', '2232'], list(uk_salaries.index.values))
        self.assertEqual('E06000014', uk_salaries.loc['1116', 'Area'])
        self.assertEqual(35389, uk_salaries.loc['1115', 'Median_salary'])
        self.assertEqual(92684, uk_salaries.loc['1116', 'Median_salary'])

    @mock.patch(uk_cleaned_data.search_client.__name__ + '.SearchClient')
    def test_algolia_districts(self, mock_client: mock.MagicMock) -> None:
        """Get local authority districts from Algolia, if available."""

        mock_index = mock_client.create().init_index()
        mock_index.browse_objects.return_value = [
            {'admin1Code': 'S92000003', 'admin2Code': 'S12000013'},
            {'admin1Code': 'E12000007', 'admin2Code': 'E09000002'},
            {'admin1Code': 'E12000003', 'admin2Code': 'E06000014'},
            {'admin1Code': 'E12000007', 'admin2Code': 'E09000011'},
            {'admin1Code': 'E12000007', 'admin2Code': 'E09000012'},
        ]
        uk_salaries = uk_cleaned_data.get_salaries(
            data_folder=self.data_folder)
        self.assertEqual(['1115', '1116', '2232'], list(uk_salaries.index.values))
        self.assertEqual('E06000014', uk_salaries.loc['1116', 'Area'])
        self.assertEqual(35389, uk_salaries.loc['1115', 'Median_salary'])
        self.assertEqual(92684, uk_salaries.loc['1116', 'Median_salary'])


if __name__ == '__main__':
    unittest.main()
