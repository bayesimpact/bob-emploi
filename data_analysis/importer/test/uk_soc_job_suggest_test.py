"""Tests for the bob_emploi.importer.uk_soc_job_suggest module."""

import io
import os
from os import path
import unittest
from unittest import mock

from algoliasearch import exceptions

from bob_emploi.data_analysis.importer import uk_soc_job_suggest


@mock.patch(uk_soc_job_suggest.__name__ + '.search_client')
@mock.patch.dict(os.environ, values={'ALGOLIA_API_KEY': 'my-api-key'})
class UploadTestCase(unittest.TestCase):
    """Integration tests for the upload function."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_upload(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test the full upload."""

        uk_soc_job_suggest.upload(data_folder=self.testdata_folder)

        mock_algoliasearch.SearchClient.create.assert_called_once_with('K6ACI9BKKT', 'my-api-key')
        mock_client = mock_algoliasearch.SearchClient.create()
        indices = [c[0][0] for c in mock_client.init_index.call_args_list]
        self.assertEqual(2, len(indices), msg=indices)
        self.assertEqual(2, len(set(indices)), msg=indices)
        self.assertIn('jobs_en_UK', indices)
        tmp_name = (set(indices) - {'jobs_en_UK'}).pop()

        index = mock_client.init_index()
        self.assertTrue(index.save_objects.called)
        self.assertEqual(
            ['Ambassador'],
            [job.get('name')
             for call in index.save_objects.call_args_list
             for job in call[0][0] if job.get('jobGroupId') == '1115'])
        self.assertEqual(
            ['AM', 'Councillor'],
            [job.get('name')
             for call in index.save_objects.call_args_list
             for job in call[0][0] if job.get('jobGroupId') == '1116'])
        self.assertEqual(
            ['Chemical analyst'],
            [job.get('name')
             for call in index.save_objects.call_args_list
             for job in call[0][0] if job.get('jobGroupId') == '2111'])

        job = index.save_objects.call_args[0][0][0]
        self.assertEqual('Chief executives and senior officials', job['jobGroupName'], msg=job)
        self.assertEqual(110090, job.get('numEmployed'), msg=job)

        mock_client.move_index.assert_called_once_with(tmp_name, 'jobs_en_UK')

    def test_upload_with_failure(self, mock_algoliasearch: mock.MagicMock) -> None:
        """Test a failure during the upload."""

        mock_client = mock_algoliasearch.SearchClient.create()
        mock_client.init_index().save_objects.side_effect = exceptions.AlgoliaException

        output = io.StringIO()

        with self.assertRaises(exceptions.AlgoliaException):
            uk_soc_job_suggest.upload(data_folder=self.testdata_folder, out=output)

        mock_client.move_index.assert_not_called()
        mock_client.init_index().delete.assert_called_once_with()
        output_value = output.getvalue()
        self.assertTrue(
            output_value.startswith('[\n  {\n    "jobGroupId": "1115"'), msg=output_value)


if __name__ == '__main__':
    unittest.main()
