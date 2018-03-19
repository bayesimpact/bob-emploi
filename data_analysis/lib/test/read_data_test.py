"""Unit tests for read_data module."""

from os import path
import unittest

from bob_emploi.data_analysis.lib import read_data


class ParseIntituleTestCase(unittest.TestCase):
    """Unit tests for the parse_intitule_fap method."""

    testdata_dir = path.join(path.dirname(__file__), 'testdata')

    def test_parse_intitule_fap(self):
        """Test basic case."""

        fap_names = read_data.parse_intitule_fap(
            path.join(self.testdata_dir, 'intitule_fap2009.txt'))

        self.assertEqual(338, len(fap_names.index))
        self.assertEqual(['fap_code', 'fap_name'], fap_names.columns.tolist())

        point_check = fap_names[fap_names['fap_code'] == 'P2Z92']['fap_name']
        self.assertEqual(
            [u"Cadres de l'armée et de la gendarmerie"],
            point_check.tolist())

        # Point check on a name using char not present in latin-1.
        point_check = fap_names[fap_names['fap_code'] == 'B0Z21']['fap_name']
        self.assertEqual(
            [u'Ouvriers non qualifiés du gros œuvre du bâtiment'],
            point_check.tolist())

        # Point check on a family of FAP.
        point_check = fap_names[fap_names['fap_code'] == 'X']['fap_name']
        self.assertEqual(['Politique, religion'], point_check.tolist())


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
