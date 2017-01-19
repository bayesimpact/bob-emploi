"""Unit tests for the bob_emploi.lib.job_offers module."""
from os import path
import unittest

import pandas as pd

from bob_emploi.lib import job_offers


class LibJobOffersTestCase(unittest.TestCase):
    """Unit tests."""

    def test_double_property_frequency(self):
        """Basic usage of double_property_frequency"""
        offers = pd.DataFrame({
            'diploma_1': ['Bac', 'Brevet', None, 'Bac', 'Bac'],
            'dip_req_1': ['S', 'E', None, 'S', 'E'],
            'diploma_2': ['Bac', None, None, 'Brevet', None],
            'dip_req_2': ['E', None, None, 'S', None],
        })
        frequencies = job_offers.double_property_frequency(
            offers, 'diploma', 'dip_req')

        self.assertEqual(['Bac', 'Brevet'], frequencies.index.tolist())
        self.assertEqual(
            ['frequency', 'required_frequency'], list(frequencies.columns))
        self.assertEqual('diploma', frequencies.index.name)
        self.assertEqual(.6, frequencies.ix['Bac', 'frequency'])
        self.assertEqual(.4, frequencies.ix['Brevet', 'frequency'])
        self.assertEqual(.4, frequencies.ix['Bac', 'required_frequency'])
        self.assertEqual(.2, frequencies.ix['Brevet', 'required_frequency'])


class IterateTestCase(unittest.TestCase):
    """Unit tests for the iterate function."""

    testdata_folder = path.join(
        path.dirname(__file__), 'testdata/job_offers')

    def test_basic(self):
        """Test basic usage."""
        offers = list(job_offers.iterate(
            path.join(self.testdata_folder, 'job_offers.csv'),
            path.join(self.testdata_folder, 'column_names.txt')))
        # Golden values.
        self.assertEqual(5, len(offers))
        self.assertEqual('000053Q', offers[0].id_offre)
        self.assertEqual('Contrat travail', offers[1].contract_nature_name)

    def test_missing_required_fields(self):
        """Test missing required field."""
        offers = job_offers.iterate(
            path.join(self.testdata_folder, 'job_offers.csv'),
            path.join(self.testdata_folder, 'column_names.txt'),
            required_fields=set(['foobar']))
        self.assertRaises(ValueError, next, offers)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
