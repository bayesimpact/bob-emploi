"""Tests for the bob_emploi.data_analysis.importer.deployments.uk.unemployment_rate module."""

from os import path
import os
import unittest

import requests_mock

from bob_emploi.data_analysis.importer.deployments.uk import unemployment_rate


@requests_mock.mock()
class TestCareerChangers(unittest.TestCase):
    """Testing the main function."""

    test_data_folder = path.join(path.dirname(__file__), 'testdata')

    def test_basic_usage(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic usage."""

        mock_requests.get('http://api.lmiforall.org.uk/api/v1/lfs/unemployment', json={
            'soc': 1115,
            'years': [
                {
                    'year': 2020,
                    'unemprate': 10.15
                }
            ]
        })
        out = path.join(self.test_data_folder, 'unem_rate.csv')

        unemployment_rate.main(out, jobs_xls=os.path.join(self.test_data_folder, 'soc/soc2010.xls'))
        with open(out) as output_file:
            header = output_file.readline()
            first_line = output_file.readline()

        self.assertEqual('Unit_Group\tname\tunemployment_rate\n', header)
        self.assertEqual('1115\tChief executives and senior officials\t10.15\n', first_line)

    def test_invalid_answer(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic usage."""

        mock_requests.get('http://api.lmiforall.org.uk/api/v1/lfs/unemployment', json={
            'soc': 1115,
            'no-years': [
                {
                    'werid': 2020,
                    'strange': 10.15
                }
            ]
        })
        out = path.join(self.test_data_folder, 'unem_rate.csv')

        unemployment_rate.main(out, jobs_xls=os.path.join(self.test_data_folder, 'soc/soc2010.xls'))
        with open(out) as output_file:
            header = output_file.readline()
            first_line = output_file.readline()

        self.assertEqual('Unit_Group\tname\tunemployment_rate\n', header)
        self.assertEqual('1115\tChief executives and senior officials\t-1.0\n', first_line)


if __name__ == '__main__':
    unittest.main()
