"""Tests for the bob_emploi.job_offers_trim module."""

import io
import os
from os import path
import tempfile
import unittest

from bob_emploi.data_analysis.misc import job_offers_trim


class JobOffersTrimTestCase(unittest.TestCase):
    """Test for the main function."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')

    def setUp(self) -> None:
        super().setUp()
        tmpfile, self.tmpfile_name = tempfile.mkstemp()
        os.close(tmpfile)

    def tearDown(self) -> None:
        os.remove(self.tmpfile_name)
        super().tearDown()

    def test_trim(self) -> None:
        """Basic use of trim_job_offers_csv."""

        job_offers_trim.main([
            path.join(self.testdata_dir, 'job_offers.csv'),
            path.join(self.testdata_dir, 'column_names.txt'),
            self.tmpfile_name,
            '2015-08-01',
            'id_offre,experience_min_duration',
        ], out=io.StringIO())

        with open(self.tmpfile_name) as output_file:
            output = output_file.read()

        self.assertEqual(
            'id_offre,experience_min_duration\n'
            '000053Q,5\n'
            '000185Q,6\n'
            '000BFNN,0\n'
            '000BLZH,1\n',
            output)

    def test_trim_dates(self) -> None:
        """Trim job offers dates."""

        job_offers_trim.main([
            path.join(self.testdata_dir, 'job_offers.csv'),
            path.join(self.testdata_dir, 'column_names.txt'),
            self.tmpfile_name,
            '2015-08-01',
            'id_offre,creation_date',
            '--trim-dates',
        ], out=io.StringIO())

        with open(self.tmpfile_name) as output_file:
            output = output_file.read()

        self.assertEqual(
            'id_offre,creation_date\n'
            '000053Q,2015-08-16\n'
            '000185Q,2015-08-16\n'
            '000BFNN,2015-08-16\n'
            '000BLZH,2015-08-16\n',
            output)


if __name__ == '__main__':
    unittest.main()
