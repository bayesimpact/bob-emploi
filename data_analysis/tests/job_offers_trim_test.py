"""Tests for the bob_emploi.job_offers_trim module."""
import os
from os import path
import tempfile
import unittest

from bob_emploi import job_offers_trim


class JobOffersTrimTestCase(unittest.TestCase):
    """Test for the trim_job_offers_csv function."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')

    def setUp(self):
        super(JobOffersTrimTestCase, self).setUp()
        tmpfile, self.tmpfile_name = tempfile.mkstemp()
        os.close(tmpfile)

    def tearDown(self):
        os.remove(self.tmpfile_name)
        super(JobOffersTrimTestCase, self).tearDown()

    def test_trim(self):
        """Basic use of trim_job_offers_csv."""
        job_offers_trim.trim_job_offers_csv(
            path.join(self.testdata_dir, 'job_offers.csv'),
            path.join(self.testdata_dir, 'column_names.txt'),
            self.tmpfile_name,
            '2015-08-01',
            'id_offre,experience_min_duration')

        with open(self.tmpfile_name) as output_file:
            output = output_file.read()

        self.assertEqual(
            'id_offre,experience_min_duration\n'
            '000053Q,5\n'
            '000185Q,6\n'
            '000BFNN,0\n'
            '000BLZH,1\n',
            output)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
