"""Unit tests for the bob_emploi.lib.usa_cleaned_data module."""

import os
import unittest

from bob_emploi.data_analysis.lib import usa_cleaned_data


class USACleanedDataTests(unittest.TestCase):
    """Unit tests for each dataset."""

    is_real_data = os.getenv('TEST_REAL_DATA')
    test_data_folder = os.path.join(os.path.dirname(__file__), 'testdata')
    data_folder = 'data' if is_real_data else test_data_folder

    def test_us_national_occupations(self) -> None:
        """Check the parsing of U.S. national occupational employment statistics."""

        occupations = usa_cleaned_data.us_national_occupations(
            filename=os.path.join(
                self.test_data_folder,
                'usa/occupational_employment_statistics.xlsx')).reset_index()
        self.assertEqual(
            ['00-0000', '11-0000', '11-1000', '11-1010', '11-1011'],
            sorted(occupations.occ_code))
        self.assertEqual([205890, 205890, 2658440, 8054120, 146875480], sorted(occupations.tot_emp))

    def test_us_soc2010_job_groups(self) -> None:
        """Check format of the us_soc2010_job_groups table."""

        us_soc2010_job_groups = usa_cleaned_data.us_soc2010_job_groups(data_folder=self.data_folder)

        self.assertEqual(
            ['description', 'name', 'romeId'], sorted(us_soc2010_job_groups.columns))
        self.assertTrue(us_soc2010_job_groups.index.is_unique)

        # Point checks.
        self.assertEqual(
            'Chief Executives', us_soc2010_job_groups.loc['11-1011', 'name'])
        self.assertIn(
            'formulate policies', us_soc2010_job_groups.loc['11-1011', 'description'])
        self.assertEqual(
            '11-1031', us_soc2010_job_groups.loc['11-1031', 'romeId'])
        self.assertIn('55-3017', us_soc2010_job_groups.index)
        self.assertEqual(
            'Radar and Sonar Technicians', us_soc2010_job_groups.loc['55-3017', 'name'])
        self.assertNotIn(
            '55-6032', us_soc2010_job_groups.index, msg='This group exists only in SOC 2018')
        # https://www.bls.gov/oes/current/oes151256.htm
        self.assertNotIn(
            '15-1256', us_soc2010_job_groups.index,
            msg='This group is not in SOC 2018 nor SOC 2010')

    def test_us_soc2018_job_groups(self) -> None:
        """Check format of the us_soc2018_job_groups table."""

        soc2018_job_groups = usa_cleaned_data.us_soc2018_job_groups(data_folder=self.data_folder)

        self.assertEqual(
            ['description', 'name', 'romeId'], sorted(soc2018_job_groups.columns))
        self.assertTrue(soc2018_job_groups.index.is_unique)

        # Point checks.
        self.assertEqual(
            'Chief Executives', soc2018_job_groups.loc['11-1011', 'name'])
        self.assertIn(
            'formulate policies', soc2018_job_groups.loc['11-1011', 'description'])
        self.assertEqual(
            '11-1031', soc2018_job_groups.loc['11-1031', 'romeId'])
        self.assertIn('53-6032', soc2018_job_groups.index)
        self.assertNotIn(
            '55-3017', soc2018_job_groups.index, msg='This group exists only in SOC 2010')
        # https://www.bls.gov/oes/current/oes151256.htm
        self.assertNotIn(
            '15-1256', soc2018_job_groups.index, msg='This group is not in SOC 2018 nor SOC 2010')

    def test_usa_soc2018_career_changes(self) -> None:
        """Check format of the usa_soc2018_career_changes table."""

        soc2018_career_changes = usa_cleaned_data.usa_soc2018_career_changes(
            data_folder=self.data_folder)

        self.assertEqual(
            ['job_group', 'target_job_group'], sorted(soc2018_career_changes.columns))

        # Point check.
        self.assertEqual(
            ['11-3012', '11-3013'],
            sorted(
                soc2018_career_changes[soc2018_career_changes.job_group == '11-2032']
                .target_job_group.unique()))

    def test_us_soc2010_isco08_mapping(self) -> None:
        """Check format of the us_soc2010_isco08_mapping table."""

        us_soc2010_isco08_mapping = usa_cleaned_data.us_soc2010_isco08_mapping(
            data_folder=self.data_folder)

        self.assertEqual(['isco08_code'], sorted(us_soc2010_isco08_mapping.columns))
        self.assertEqual(1125, len(us_soc2010_isco08_mapping))

        # Point checks.
        self.assertEqual('7544', us_soc2010_isco08_mapping.loc['37-2021'].isco08_code)
        self.assertEqual(
            ['1211', '1346'],
            sorted(us_soc2010_isco08_mapping.loc['11-3031', 'isco08_code'].to_list()))
        self.assertEqual(
            ['37-2019', '47-4071'],
            sorted(
                us_soc2010_isco08_mapping[us_soc2010_isco08_mapping.isco08_code == '9129']
                .index.to_list()
            ))

    def test_us_automation_brookings(self) -> None:
        """Check format of the us_automation_brookings table."""

        us_automation_brookings = usa_cleaned_data.us_automation_brookings(
            data_folder=self.data_folder)

        self.assertEqual(['automation_risk'], sorted(us_automation_brookings.columns))
        self.assertGreaterEqual(us_automation_brookings.automation_risk.min(), 0)
        self.assertLessEqual(us_automation_brookings.automation_risk.max(), 1)
        self.assertGreater(len(us_automation_brookings), 10)

        # Point checks.
        self.assertAlmostEqual(
            0.13316, us_automation_brookings.loc['11-2021'].automation_risk,
            msg='Marketing Managers')
        self.assertAlmostEqual(
            0.39524, us_automation_brookings.loc['41-9091'].automation_risk,
            msg='Door-to-Door Sales Workers')
        self.assertAlmostEqual(
            0.22134, us_automation_brookings.loc['25-1041'].automation_risk,
            msg='Postsecondary Teachers')
        self.assertNotIn('25-1000', us_automation_brookings.index)


if __name__ == '__main__':
    unittest.main()
