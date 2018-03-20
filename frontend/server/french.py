# encoding: utf-8
"""Module for manipulating pieces of French sentences.

If you fix any of the functions here, you'll probably want to update
frontend/src/store/french.js as well.
"""

import re

from bob_emploi.frontend.api import user_pb2


_SOFT_START_REGEXP = re.compile('^[aâàäeéêëèhiïoôöuùûü]', re.IGNORECASE)
_FIRST_NAME_WORD_SEPARATORS = re.compile('[ .]+')


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


# TODO(cyrille): Ensure that imported sentences are not capitalized or punctuated.
def join_sentences_properly(sentences):
    """
    Returns a nice sentence, depending on the length of the array 'sentences'.
    If two sentences, joins them with 'mais' coordinator.
    """

    if not sentences:
        return ''
    full_sentence = ' mais '.join(sentences).strip()
    without_added_period = full_sentence[0].upper() + full_sentence[1:]
    if without_added_period[-1] in ['.', '!']:
        return without_added_period
    return without_added_period + '.'


def try_stringify_number(value):
    """Get the French word or words representing a numeric value."""

    try:
        return _NUMBER_WORDS[value]
    except KeyError:
        raise NotImplementedError('No French words defined for {:d}'.format(value))


def cleanup_firstname(firstname):
    """Cleanup a French first name, using proper capitalization."""

    return _FIRST_NAME_WORD_SEPARATORS.sub(' ', firstname.strip().title())


def genderize_job(job, gender):
    """Genderize a job."""

    if gender == user_pb2.MASCULINE and job.masculine_name:
        return job.masculine_name
    if gender == user_pb2.FEMININE and job.feminine_name:
        return job.feminine_name
    return job.name
