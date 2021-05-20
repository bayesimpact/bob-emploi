"""Tests for the bob_emploi.job_offers_skills module."""

import json
from os import path
import shutil
import unittest

from bob_emploi.data_analysis.misc import job_groups_skills


class JobOffersTrimTestCase(unittest.TestCase):
    """Test for the main function."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')
    out_dir = 'test_out'

    def tearDown(self) -> None:
        shutil.rmtree(path.join(self.testdata_dir, self.out_dir))
        super().tearDown()

    def test_get_skills(self) -> None:
        """Basic use of job_offers_skills module."""

        job_groups_skills.main(data_folder=self.testdata_dir, out_dir=self.out_dir)

        with open(path.join(self.testdata_dir, 'test_out/skills_A1101.json')) as output_file:
            output = json.load(output_file)

        self.assertEqual(2, len(output))
        self.assertEqual([100003, 100007], [rec.get('codeOgr') for rec in output])
        self.assertEqual([True, False], [rec.get('isPriority') for rec in output])
        self.assertEqual(
            ['Techniques de soudage'],
            [rec.get('name') for rec in output if rec.get('codeOgr') == 100007])


if __name__ == '__main__':
    unittest.main()
