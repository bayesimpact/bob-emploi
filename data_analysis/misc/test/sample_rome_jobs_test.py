"""Tests for the bob_emploi.sample_rome_jobs module."""

import os
from os import path
import tempfile
import unittest

from bob_emploi.data_analysis.misc import sample_rome_jobs


class SampleRomeJobsTestCase(unittest.TestCase):
    """Unit tests for the public functions."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')

    def setUp(self) -> None:
        super().setUp()
        tmpfile, self.tmpfile_name = tempfile.mkstemp()
        os.close(tmpfile)

    def tearDown(self) -> None:
        os.remove(self.tmpfile_name)
        super().tearDown()

    def test_main(self) -> None:
        """Unit test for the main function."""

        sample_rome_jobs.main(
            path.join(self.testdata_dir, 'sample_rome_jobs_appellation.csv'),
            self.tmpfile_name)

        with open(self.tmpfile_name) as output_file:
            output = output_file.read()

        self.assertEqual(
            'Animateur conseiller en -TIC-\n'
            "Exploitant d'attractions\n",
            output)


if __name__ == '__main__':
    unittest.main()
