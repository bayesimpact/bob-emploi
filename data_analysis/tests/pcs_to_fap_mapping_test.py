"""Unit tests for the bob_emploi.pcs_to_fap_mapping module."""
import io
from os import path
import unittest

import pandas as pd

from bob_emploi import pcs_to_fap_mapping


class PcsToFapMappingTestCase(unittest.TestCase):
    """Unit tests for the main function."""

    def test_basic_usage(self):
        """Basic usage."""
        testfile = path.join(
            path.dirname(__file__), 'testdata/c2rp_table_supra_def_fap_pcs_rome.xlsx')
        out = io.StringIO()
        pcs_to_fap_mapping.main(out, filename=testfile)

        mapping_file = io.StringIO(out.getvalue())
        mapping = pd.read_csv(mapping_file)
        self.assertEqual(['PCS', 'ROME'], sorted(mapping.columns))
        mapping.set_index('ROME', inplace=True)
        self.assertEqual(['A1403', 'A1416'], sorted(mapping.index))
        # Spot checks.
        self.assertEqual('691b', mapping.loc['A1403', 'PCS'])
        self.assertEqual('691e', mapping.loc['A1416', 'PCS'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
