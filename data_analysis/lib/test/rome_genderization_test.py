"""Tests for the bob_emploi.lib.rome_genderization module."""

import unittest

import pandas

from bob_emploi.data_analysis.lib import rome_genderization


class _GenderizeTestCase(unittest.TestCase):
    """Base for unit tests for the genderize function."""

    def _genderize_lists(self, names):
        """Helper function to call genderize using lists instead of Series."""

        masculine, feminine = rome_genderization.genderize(pandas.Series(names))
        self.assertEqual(len(masculine), len(names))
        self.assertEqual(len(feminine), len(names))
        return masculine.tolist(), feminine.tolist()

    def _genderize_one(self, name):
        """Helper function to call genderize using only one name."""

        masculine, feminine = self._genderize_lists([name])
        return masculine[0], feminine[0]


class GenderizeTestCase(_GenderizeTestCase):
    """General unit tests for the genderize function."""

    def test_genderize_empty(self):
        """Test genderize with an empty input."""

        masculine, feminine = self._genderize_lists([])
        self.assertEqual([], masculine)
        self.assertEqual([], feminine)

    def test_genderize_invariant(self):
        """Test genderize with an invariant name."""

        masculine, feminine = self._genderize_one('Artist')
        self.assertEqual('Artist', masculine)
        self.assertEqual('Artist', feminine)

    def test_genderize_all_cases_at_once(self):
        """Test genderize with a list of multiple genderization cases."""

        masculine, feminine = self._genderize_lists([
            'Artiste',
            'Vendeur(euse)',
            'Vendeur / Vendeuse',
            'Pompier(ère)',
            'Manager(euse)'])
        self.assertEqual([
            'Artiste',
            'Vendeur',
            'Vendeur',
            'Pompier',
            'Manager'], masculine)
        self.assertEqual([
            'Artiste',
            'Vendeuse',
            'Vendeuse',
            'Pompière',
            'Manageuse'], feminine)

    def test_genderize_bracket_and_slash(self):
        """Test genderize with a name using both bracket and slash."""

        masculine, feminine = self._genderize_one(
            'Vendeur(se) retail / commerce')
        self.assertEqual('Vendeur retail / commerce', masculine)
        self.assertEqual('Vendeuse retail / commerce', feminine)


class BracketNotationTestCase(_GenderizeTestCase):
    """Unit tests for the genderize function using bracket notation."""

    def test_genderize_bracket_notation(self):
        """Test genderize with simple bracket notation."""

        masculine, feminine = self._genderize_one('Vendeur(euse)')
        self.assertEqual('Vendeur', masculine)
        self.assertEqual('Vendeuse', feminine)

    def test_genderize_multiple_bracket_notations(self):
        """Test genderize with several bracket notations."""

        masculine, feminine = self._genderize_one(
            'Manager(euse)-inspecteur(trice)')
        self.assertEqual('Manager-inspecteur', masculine)
        self.assertEqual('Manageuse-inspectrice', feminine)

    def test_genderize_ignore_plural_bracket_notations(self):
        """Test genderize with a plural in bracket notation."""

        masculine, feminine = self._genderize_one(
            'Vendeur(euse) commercial(e) tissu(s)')
        self.assertEqual('Vendeur commercial tissu(s)', masculine)
        self.assertEqual('Vendeuse commerciale tissu(s)', feminine)

    def test_genderize_unknown_suffix(self):
        """Test genderize with unknown suffix in bracket notation."""

        self.assertRaises(
            ValueError, self._genderize_one, 'Title with unknown(foo) suffix')

    def test_genderize_known_suffix_not_matching(self):
        """Test genderize with suffix not matching the one in brackets."""

        self.assertRaises(
            ValueError, self._genderize_one,
            'Title with non matching(euse) suffix')


class SlashNotationTestCase(_GenderizeTestCase):
    """Unit tests for the genderize function using slash notation."""

    def test_genderize_slash_notation(self):
        """Test genderize with simple slash notation."""

        masculine, feminine = self._genderize_one('Vendeur / Vendeuse')
        self.assertEqual('Vendeur', masculine)
        self.assertEqual('Vendeuse', feminine)

    def test_genderize_slash_notation_no_blanks(self):
        """Test genderize with slash notation without blanks around slash."""

        masculine, feminine = self._genderize_one('Vendeur/Vendeuse')
        self.assertEqual('Vendeur', masculine)
        self.assertEqual('Vendeuse', feminine)

    def test_genderize_slash_notation_distribute_right(self):
        """Test genderize with slash notation with more context on the right."""

        masculine, feminine = self._genderize_one(
            'Vendeur expert / Vendeuse experte retail')
        self.assertEqual('Vendeur expert retail', masculine)
        self.assertEqual('Vendeuse experte retail', feminine)

    def test_genderize_slash_notation_distribute_left(self):
        """Test genderize with slash notation with more context on the left."""

        masculine, feminine = self._genderize_one(
            'Super vendeur expert retail / vendeuse experte retail')
        self.assertEqual('Super vendeur expert retail', masculine)
        self.assertEqual('Super vendeuse experte retail', feminine)

    def test_genderize_slash_notation_distribute_right_one(self):
        """Slash notation with more context on the right but no common root."""

        masculine, feminine = self._genderize_one('Homme / Femme de pied')
        self.assertEqual('Homme de pied', masculine)
        self.assertEqual('Femme de pied', feminine)

    def test_genderize_multiple_slash_notation(self):
        """Test genderize with extra slashes in slash notation."""

        masculine, feminine = self._genderize_one(
            'Empoteur/dépoteur / Empoteuse/dépoteuse')
        self.assertEqual('Empoteuse/dépoteuse', feminine)
        self.assertEqual('Empoteur/dépoteur', masculine)

    def test_genderize_multiple_slash_notation_distribute_right(self):
        """Test genderize with extra slash in slash notation to distribute."""

        masculine, feminine = self._genderize_one(
            'Chroniqueur / Chroniqueuse TV / Radio')
        # TODO: Decide whether dropping spaces around non-genderization slashes
        # is a bug or desirable behavior (usage in ROME is inconsistent)
        self.assertEqual('Chroniqueur TV/Radio', masculine)
        self.assertEqual('Chroniqueuse TV/Radio', feminine)

# TODO: (related to the above) there is a bit of magic involved in handling
#       these cases (it turns out to work because no shared root is found),
#       we may want to make this behavior more explicit


# pylint: disable=protected-access
class GenderizationInernalsTestCase(unittest.TestCase):
    """Unit tests of internals of the genderization module."""

    def test_check_mapping_specification(self):
        """Make sure the postfix dictionary is in the right format.

        Check whether the mapping of postfix to word endings correctly returns
        a list of possible word endings to substitute that goes from more
        specific (longer) to more general.
        """

        postfix_map = rome_genderization._POSTFIX_MAP

        for postfix_map in postfix_map.values():
            self.assertEqual(
                sorted(postfix_map, key=len, reverse=True),
                postfix_map)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
