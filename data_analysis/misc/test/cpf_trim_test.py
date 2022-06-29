"""Unit tests for the cpf_trim script."""

import io
import os
import tempfile
import unittest

from bob_emploi.data_analysis.misc import cpf_trim


class CPFTrimTests(unittest.TestCase):
    """Tests for the main function."""

    testdata_dir = os.path.join(os.path.dirname(__file__), 'testdata')

    def setUp(self) -> None:
        super().setUp()
        tmpfile, self.tmpfile_name = tempfile.mkstemp()
        os.close(tmpfile)

    def tearDown(self) -> None:
        os.remove(self.tmpfile_name)
        super().tearDown()

    def test_trim(self) -> None:
        """Basic use of trim_cpf."""

        cpf_trim.main([
            os.path.join(self.testdata_dir, 'cpf.json'),
            self.tmpfile_name,
            '--fields', 'formation.title,formation.proximiteRomes.code,duration',
        ], out=io.StringIO())

        with open(self.tmpfile_name, encoding='utf-8') as output_file:
            output = output_file.read()

        self.assertTrue(
            output.startswith('formation.title,formation.proximiteRomes.code,duration\n'),
            msg=output)
        self.assertTrue(output.endswith('\n'), msg=output[:-20])

        lines = output.split('\n')[:-1]
        # Number of ROMEs per training: 3, 1, 3, 3, 3, 0, 0, 2, 2
        # We should have 1 line for the header, plus one line per ROME, and one line for trainings
        # with no ROMEs.
        self.assertEqual(20, len(lines), msg=output)
        # Point check:
        self.assertIn('Sauveteur Secouriste du Travail ,A1101,14', lines)


if __name__ == '__main__':
    unittest.main()
