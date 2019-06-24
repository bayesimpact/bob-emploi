"""Unit tests for the bob_emploi.french_departements_bounds module."""

import io
from os import path
import unittest

import pandas as pd

from bob_emploi.data_analysis.misc import french_departements_bounds


class FrenchDepartementsBoundsTestCase(unittest.TestCase):
    """Unit tests for the main function."""

    def test_basic_usage(self) -> None:
        """Basic usage."""

        testfile = path.join(path.dirname(__file__), 'testdata/departements-avec-outre-mer.geojson')
        out = io.StringIO()
        french_departements_bounds.main(out, filename=testfile)

        bounds_file = io.StringIO(out.getvalue())
        bounds = pd.read_csv(bounds_file, dtype={'departement_id': str}).set_index('departement_id')
        self.assertEqual(
            ['max_latitude', 'max_longitude', 'min_latitude', 'min_longitude'],
            sorted(bounds.columns))
        self.assertEqual(['01', '03'], sorted(bounds.index))
        # Spot checks.
        self.assertAlmostEqual(4.91667, bounds.loc['01', 'max_longitude'], places=5)
        self.assertAlmostEqual(4.83333, bounds.loc['01', 'min_longitude'], places=5)
        self.assertAlmostEqual(46.2333, bounds.loc['03', 'max_latitude'], places=5)


if __name__ == '__main__':
    unittest.main()
