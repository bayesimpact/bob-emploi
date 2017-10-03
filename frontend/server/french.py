# encoding: utf-8
"""Module for manipulating pieces of French sentences.

If you fix any of the functions here, you'll probably want to update
frontend/src/store/french.js as well.
"""
import re

_SOFT_START_REGEXP = re.compile('^[aâàäeéêëèhiïoôöuùûü]', re.IGNORECASE)


def maybe_contract_prefix(prefix, contracted_prefix, sentence):
    """Use contracted form of a word if the next word starts with a vower or a silent H."""
    if sentence and _SOFT_START_REGEXP.match(sentence):
        return contracted_prefix + sentence
    return prefix + sentence


def lower_first_letter(sentence):
    """Lower the first letter of a string."""
    return sentence[:1].lower() + sentence[1:]


def of_city(city_name):
    """Compute the right prefix for a city name when writing "of City C"."""
    if city_name.startswith('Le '):
        return 'du {}'.format(city_name[3:])
    if city_name.startswith('Les '):
        return 'des {}'.format(city_name[4:])
    if city_name.startswith('La '):
        return 'de la {}'.format(city_name[3:])
    if city_name.startswith("L'"):
        return "de l'{}".format(city_name[2:])
    return 'de {}'.format(city_name)


def in_city(city_name):
    """Compute the right prefix for a city name when writing "in City C"."""
    if city_name.startswith('Le '):
        return 'au {}'.format(city_name[3:])
    if city_name.startswith('Les '):
        return 'aux {}'.format(city_name[4:])
    if city_name.startswith('La '):
        return 'à la {}'.format(city_name[3:])
    if city_name.startswith("L'"):
        return "à l'{}".format(city_name[2:])
    return 'à {}'.format(city_name)


_NUMBER_WORDS = {
    1: 'un',
    2: 'deux',
    3: 'trois',
    4: 'quatre',
    5: 'cinq',
    6: 'six',
}


def try_stringify_number(value):
    """Get the French word or words representing a numeric value."""
    try:
        return _NUMBER_WORDS[value]
    except KeyError:
        raise NotImplementedError('No French words defined for {:d}'.format(value))
