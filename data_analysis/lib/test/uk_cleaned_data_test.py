"""Unit tests for the bob_emploi.lib.uk_cleaned_data module."""

import os
from os import path
import unittest

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

    def test_uk_national_occupations(self) -> None:
        """Check the parsing of UK national occupational employment statistics."""

        occupations = uk_cleaned_data.uk_national_occupations(
            path.join(path.dirname(__file__), 'testdata'))
        self.assertEqual(
            ['1', '111', '1115'],
            sorted(occupations.occ_code)[:3])
        self.assertEqual({'major', 'minor', 'unit'}, set(occupations.o_group.unique()))
        # Point check.
        self.assertEqual(126695, occupations.set_index('occ_code').loc['1223', 'tot_emp'])

    def test_ruk_soc2010_isco08_mapping(self) -> None:
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


if __name__ == '__main__':
    unittest.main()
