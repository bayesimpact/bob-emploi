"""Unit tests for the bob_emploi.frontend.french module."""

import collections
import unittest

from bob_emploi.frontend.server import french


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


_CityPrefixTestCase = collections.namedtuple(
    '_CityPrefixTestCase', ['description', 'city_name', 'expected'])


class CityPrefixTestCase(unittest.TestCase):
    """Unit tests for the in_city and of_city functions."""

    def test_in_city(self):
        """Test the in_city function."""

        test_cases = [
            _CityPrefixTestCase('Regular city name', 'Toulouse', 'à Toulouse'),
            _CityPrefixTestCase('Contract "à" + "Le"', 'Le Mans', 'au Mans'),
            _CityPrefixTestCase('Lowercase "La" as first word', 'La Ferté', 'à la Ferté'),
            _CityPrefixTestCase('Do not lowercase "La" as prefix', 'Laval', 'à Laval'),
            _CityPrefixTestCase('Contract "à" + "Les"', 'Les Ulis', 'aux Ulis'),
            _CityPrefixTestCase('Lowercase "L\'"', "L'Arbresle", "à l'Arbresle"),
        ]

        for description, city_name, expected in test_cases:
            self.assertEqual(expected, french.in_city(city_name), description)

    def test_of_city(self):
        """Test the of_city function."""

        test_cases = [
            _CityPrefixTestCase('Regular city name', 'Toulouse', 'de Toulouse'),
            _CityPrefixTestCase('Contract "de" + "Le"', 'Le Mans', 'du Mans'),
            _CityPrefixTestCase('Lowercase "La" as first word', 'La Ferté', 'de la Ferté'),
            _CityPrefixTestCase('Do not lowercase "La" as prefix', 'Laval', 'de Laval'),
            _CityPrefixTestCase('Contract "de" + "Les"', 'Les Ulis', 'des Ulis'),
            _CityPrefixTestCase('Lowercase "L\'"', "L'Arbresle", "de l'Arbresle"),
        ]

        for description, city_name, expected in test_cases:
            self.assertEqual(expected, french.of_city(city_name), description)


class NumberTestCase(unittest.TestCase):
    """Unit tests for the try_stringify_number function."""

    def test_spot_check(self):
        """Spot checks."""

        self.assertEqual('trois', french.try_stringify_number(3))
        self.assertEqual('six', french.try_stringify_number(6))

    def test_missing_value(self):
        """Check a missing value."""

        self.assertRaises(NotImplementedError, french.try_stringify_number, 123)


class JoinSentenceProperly(unittest.TestCase):
    """Unit tests for the join_sentences_properly function."""

    def test_empty_list(self):
        """Empty list should return empty string."""

        self.assertEqual('', french.join_sentences_properly([]))

    def test_one_sentence(self):
        """One sentence list should be stripped, capitalized and punctuated."""

        self.assertEqual(
            'Bonjour, le monde.', french.join_sentences_properly(['bonjour, le monde   ']))

    def test_two_sentences(self):
        """Two sentences should be linked by 'mais'."""

        self.assertEqual(
            "Vous avez de l'expérience mais vous êtes vieux.",
            french.join_sentences_properly(["vous avez de l'expérience", 'vous êtes vieux']))

    def test_double_sentences(self):
        """Internal punctation/capitalization should be kept."""

        self.assertEqual(
            'Votre recherche est sur la bonne voie mais votre projet est compliqué. \
Il faut attendre.',
            french.join_sentences_properly([
                'votre recherche est sur la bonne voie',
                'votre projet est compliqué. Il faut attendre',
            ])
        )


class FirstnameCleanupTestCase(unittest.TestCase):
    """Unit tests for the cleanup_firstname function."""

    def test_mixed_case(self):
        """First name has various casing."""

        self.assertEqual('Pascal', french.cleanup_firstname('pascal'))
        self.assertEqual('Pascal', french.cleanup_firstname('PASCAL'))
        self.assertEqual('Pascal', french.cleanup_firstname('pASCAL'))
        self.assertEqual('Pascal', french.cleanup_firstname('PaScAl'))

    def test_compound_name(self):
        """First name is a compound."""

        self.assertEqual('Marie-Laure', french.cleanup_firstname('marie-laure'))
        self.assertEqual('Marie Laure', french.cleanup_firstname('marie laure'))
        self.assertEqual('Marie Laure', french.cleanup_firstname('marie.laure'))
        self.assertEqual('Marie Laure', french.cleanup_firstname('marie   laure'))

    def test_apostrophe(self):
        """First name contains an apostrophe."""

        self.assertEqual("D'Arles", french.cleanup_firstname("D'ARLES"))
        # This one is not that great, but we'll keep it here to make it obvious
        # what the result is. As it's not really a first name, I think it's ok.
        self.assertEqual("Cap'Tain", french.cleanup_firstname("CAP'TAIN"))

    def test_special_chars(self):
        """First name contains special chars."""

        self.assertEqual('Éloïse', french.cleanup_firstname('éloïse'))
        self.assertEqual('Éloïse', french.cleanup_firstname('ÉLOÏSE'))

    def test_extra_blanks(self):
        """First name contains special unneeded blanks."""

        self.assertEqual('Pascal', french.cleanup_firstname('pascal '))
        self.assertEqual('Pascal', french.cleanup_firstname(' pascal'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
