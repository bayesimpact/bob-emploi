"""Unit tests for the module frontend.geo."""
import unittest


from bob_emploi.frontend import geo


class DepartementCase(unittest.TestCase):
    """Unit tests for departement functions."""

    def test_get_departement_name(self):
        """Point checks for the get_departement_name func."""
        self.assertEqual('Guadeloupe', geo.get_departement_name('971'))
        self.assertEqual('Nièvre', geo.get_departement_name('58'))
        self.assertEqual('La Réunion', geo.get_departement_name('974'))

    def test_get_departement_name_unknown_id(self):
        """Check get_departement_name on an unknown département."""
        with self.assertRaises(KeyError):
            geo.get_departement_name('xxx')

    def test_get_in_a_departement_text(self):
        """Point checks for the get_in_a_departement_text func."""
        self.assertEqual('en Corrèze', geo.get_in_a_departement_text('19'))
        self.assertEqual('en Haute-Garonne', geo.get_in_a_departement_text('31'))
        self.assertEqual('à Paris', geo.get_in_a_departement_text('75'))
        self.assertEqual('dans les Bouches-du-Rhône', geo.get_in_a_departement_text('13'))
        self.assertEqual('à la Réunion', geo.get_in_a_departement_text('974'))

    def test_get_in_a_departement_text_missing_id(self):
        """Check get_in_a_departement_text on an unknown département."""
        with self.assertRaises(KeyError):
            geo.get_in_a_departement_text('999')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
