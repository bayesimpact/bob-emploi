"""Unit tests for the bob_emploi.frontend.french module."""
import unittest

from bob_emploi.frontend import french


class MaybeContractTestCase(unittest.TestCase):
    """Unit tests for maybe_contract_prefix methods."""

    def test_consonant(self):
        """Next word starts with a consonant."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', 'starts with an S')
        self.assertEqual('foo starts with an S', sentence)

    def test_vowel(self):
        """Next word starts with a vowel."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', 'a starts with an A')
        self.assertEqual('bar a starts with an A', sentence)

    def test_accented_vowel(self):
        """Next word starts with an accented vowel."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', 'à starts with an A')
        self.assertEqual('bar à starts with an A', sentence)

    def test_h(self):
        """Next word starts with an H."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', 'h starts with an H')
        self.assertEqual('bar h starts with an H', sentence)

    def test_upper_case(self):
        """Next word starts with an upper case vowel."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', 'A starts with an uppercase A')
        self.assertEqual('bar A starts with an uppercase A', sentence)

    def test_empty(self):
        """Next word is empty."""
        sentence = french.maybe_contract_prefix('foo ', 'bar ', '')
        self.assertEqual('foo ', sentence)


class LowerFirstLetterTestCase(unittest.TestCase):
    """Unit tests for the lower_first_letter function."""

    def test_all_uppercase(self):
        """All upper case."""
        sentence = french.lower_first_letter('THIS IS ALL UPPERCASE')
        self.assertEqual('tHIS IS ALL UPPERCASE', sentence)

    def test_one_letter(self):
        """Only one letter."""
        sentence = french.lower_first_letter('T')
        self.assertEqual('t', sentence)

    def test_empty(self):
        """Empty string."""
        sentence = french.lower_first_letter('')
        self.assertEqual('', sentence)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
