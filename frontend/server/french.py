# encoding: utf-8
"""Module for manipulating pieces of French sentences.

If you fix any of the functions here, you'll probably want to update
frontend/src/store/french.js as well.
"""

import itertools
import re
import typing

import typing_extensions

from bob_emploi.frontend.api import user_pb2


_SOFT_START_REGEXP = re.compile('^[aâàäeéêëèhiïoôöuùûü]', re.IGNORECASE)
_FIRST_NAME_WORD_SEPARATORS = re.compile('[ .]+')


def maybe_contract_prefix(prefix: str, contracted_prefix: str, sentence: str) -> str:
    """Use contracted form of a word if the next word starts with a vower or a silent H."""

    if sentence and _SOFT_START_REGEXP.match(sentence):
        return contracted_prefix + sentence
    return prefix + sentence


def lower_first_letter(sentence: str) -> str:
    """Lower the first letter of a string."""

    return sentence[:1].lower() + sentence[1:]


def upper_first_letter(sentence: str) -> str:
    """Upper the first letter of a string."""

    return sentence[:1].upper() + sentence[1:]


def of_city(city_name: str) -> str:
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


def in_city(city_name: str) -> str:
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


_NUMBER_WORDS: typing.Dict[int, str] = {
    1: 'un',
    2: 'deux',
    3: 'trois',
    4: 'quatre',
    5: 'cinq',
    6: 'six',
}


def join_sentences_properly(sentences: typing.List[str]) -> str:
    """
    Returns a nice sentence, depending on the length of the array 'sentences'.
    If two sentences, joins them with 'mais' coordinator.
    """

    if not sentences:
        return ''
    full_sentence = ' mais '.join(sentences).strip()
    return upper_first_letter(full_sentence) + '.'


def try_stringify_number(value: int) -> str:
    """Get the French word or words representing a numeric value."""

    try:
        return _NUMBER_WORDS[value]
    except KeyError:
        raise NotImplementedError('No French words defined for {:d}'.format(value))


def cleanup_firstname(firstname: str) -> str:
    """Cleanup a French first name, using proper capitalization."""

    return _FIRST_NAME_WORD_SEPARATORS.sub(' ', firstname.strip().title())


class _NamedJob(typing_extensions.Protocol):
    """Structural typing for classes which can produce a name depending on a gender."""

    feminine_name: str
    masculine_name: str
    name: str


def genderize_job(job: _NamedJob, gender: user_pb2.Gender, is_lowercased: bool = False) -> str:
    """Genderize a job."""

    def _maybe_lower(name: str) -> str:
        return lower_first_letter(name) if is_lowercased else name
    if gender == user_pb2.MASCULINE and job.masculine_name:
        return _maybe_lower(job.masculine_name)
    if gender == user_pb2.FEMININE and job.feminine_name:
        return _maybe_lower(job.feminine_name)
    return ungenderize(
        _maybe_lower(job.masculine_name), _maybe_lower(job.feminine_name), _maybe_lower(job.name))


def _common_prefix_length(list1: typing.List[str], list2: typing.List[str]) -> int:
    return sum(1 for _ in itertools.takewhile(lambda pair: pair[0] == pair[1], zip(list1, list2)))


def ungenderize(masculine: str, feminine: str, neutral: str) -> str:
    """Return a string with both masculine and feminine version, if they exist."""

    if not masculine or not feminine:
        return neutral
    if masculine == feminine:
        return masculine
    masculine_words = masculine.strip().split(' ')
    feminine_words = feminine.strip().split(' ')
    start = _common_prefix_length(masculine_words, feminine_words)
    if start == len(masculine_words):
        return '{} / {}'.format(masculine, ' '.join(feminine_words[start:]))
    if start == len(feminine_words):
        return '{} / {}'.format(feminine, ' '.join(masculine_words[start:]))
    end = _common_prefix_length(masculine_words[::-1], feminine_words[::-1])
    return '{} / {}'.format(
        ' '.join(masculine_words[:-end]), ' '.join(feminine_words[start:]))
