"""Tests for the bob_emploi.data_analysis.importer.deployments.uk.career_changers module."""

import io
from os import path
import unittest

import requests_mock

from bob_emploi.data_analysis.importer.deployments.uk import career_changers


@requests_mock.mock()
class TestCareerChangers(unittest.TestCase):
    """Testing the main function."""

    us_data_folder = path.join(path.dirname(__file__), '../../usa/test/testdata')

    def test_basic_usage(self, mock_requests: requests_mock.Mocker) -> None:
        """Basic usage."""

        mock_requests.get('http://api.lmiforall.org.uk/api/v1/o-net/onet2soc', json=[
            {
                'onetCode': '11-1011.00',
                'socCodes': [{
                    'soc': 1115,
                    'title': 'Chief executives and senior officials',
                }],
            },
            {
                'onetCode': '13-1151.00',
                'socCodes': [{
                    'soc': 3563,
                    'title': 'Vocational and industrial trainers and instructors',
                }],
            },
        ])
        out = io.StringIO()
        career_changers.main(
            out, path.join(self.us_data_folder, 'onet_22_3/Career_Changers_Matrix.txt'))

        output = io.StringIO(out.getvalue()).readlines()
        self.assertEqual([
            'job_group,target_job_group\n',
            '1115,3563\n'], output)


if __name__ == '__main__':
    unittest.main()
