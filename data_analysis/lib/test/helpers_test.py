"""Tests for the bob_emploi.lib.importer_helpers module."""

import unittest

from bob_emploi.data_analysis.lib import importer_helpers


class ImporterHelpersTestCase(unittest.TestCase):
    """Unit tests for the tested module functions."""

    def test_finalize_duration_estimation(self) -> None:
        """Basic usage of finalize_duration_estimation."""

        estimation = importer_helpers.finalize_duration_estimation({
            'minDays': 29,
            'maxDays': 205,
            'medianDays': 90})
        self.assertEqual('3 mois', estimation['shortText'])


if __name__ == '__main__':
    unittest.main()
