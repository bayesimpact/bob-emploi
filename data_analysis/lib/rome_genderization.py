"""Module to genderize job titles in ROME.

This module allows one to normalize French job titles across genders in
ROME. In the standard ROME file provided by Pole Emploi job titles are often
inconsistently specified, which leads to confusion and poorer user experience.
In addition it makes the job title longer than it should be, which makes them
harder to identify at a glance.

For readability English-language examples are provided in the comments in this
module.

Example:
A job such as "Senior Fireman" might sometimes be genderized as
"Senior Fireman / Senior Firewoman" and sometimes as "Senior Fire(wo)man".
We want to turn any variant of these possible genderizations into a
normalized pair of two strings: "Senior Fireman" and "Senior Firewoman".
If a job title is not gendered, for example "Artist", we want to simply return
"Artist" and "Artist".

Nomenclature in this module:
- bracket notation: when the job title is gendered using the form
                    "Senior Fire(wo)man"
- slash notation:   when the job title is gendered using the form
                    "Senior Fireman / Firewoman"
"""

import re
import typing

import pandas as pd

# This variable is a {postfix: [word_endings]} dictionary of lists
# describing how a postfix is supposed to transform a word based on its
# possible word endings. These are strings that, when found at the end
# of the word to be transformed, will be replaced by the postfix.
# If a postfix is meant to be simply appended to a word, the empty
# string should be used.
# Note that the list ordering matters and must be from more specific
# to more general (ie. in decreasing order of length), as the postfix
# substitution will perform the first substitution that matches the last
# characters of the word to be transformed.
# Example: {'euse': ['eur', 'er']} means that the postfix 'euse' will
# transform 'Vendeur' into 'Vendeuse' and 'Manager' into 'Manageuse'.
# Status: This list is currently comprehensive with regards to the postfixes
# found in ROME v238, with the exception of the 's' postfix as it
# denotes pluralization rather than gender.
_POSTFIX_MAP = {
    'e': [''],
    'ère': ['er'],
    'se': ['r'],
    'sse': [''],
    'euse': ['eur', 'er'],
    've': ['f'],
    're': ['r'],
    'rice': ['eur'],
    'ne': [''],
    'trice': ['teur'],
    'le': [''],
    'ive': ['if'],
    'ière': ['ier'],
}

# Known list of genderization in lower case.
_KNOWN_GENDERIZATION = frozenset([
    ('homme', 'femme'),
    ('steward', 'hôtesse')])

# A string of chars not present in input text to serve as placeholder for
# non-genderization slashes to preserve them and prevent further parsing.
_SLASH_PLACEHOLDER_CHARS = '##'


def _substitute_postfix(word: str, postfix: str) -> str:
    """Given a word and a postfix, return the transformed word.

    Perform the correct postfix substitution from a masculine word to a
    feminine word, taking into account the fact that some postfix are meant
    to be appended to the base string while others are meant to be substituted.
    Both nouns and adjectives may be genderized.

    Will perform the first possible substitution that matches the known word
    endings for a given postfix in the _POSTFIX_MAP dictionary.
    See the documentation for _POSTFIX_MAP for more details.

    Examples:
    - Abbateur(se) -> Abbateur, Abbateuse
    - Accompagnateur(trice) -> Accompagnateur, Accompagnatrice
    - social(e) -> social, sociale
    - Technicien(ne) -> Technicien, Technicienne
    - administratif(ive) -> administratif, administrative
    etc.

    Args:
        word: A string representing the word a postfix pertains to.
        postfix: A string representing the postfix.

    Return:
        A string containing the transformed word once the postfix has been
        applied.
    """

    if postfix not in _POSTFIX_MAP:
        raise ValueError('Unknown postfix: ' + postfix)

    known_endings = _POSTFIX_MAP[postfix]
    for known_ending in known_endings:
        if word.endswith(known_ending):
            root = word[:len(word) - len(known_ending)]
            return root + postfix

    error_string = f'{word}: Unmapped ending for postfix "{postfix}"'
    raise ValueError(error_string)


def _extract_bracket_notation(raw_job_name: str) -> typing.Optional[typing.Tuple[str, str]]:
    """Parse a genderized string in the bracket notation.

    Extract the genderized strings from a job title with the bracket notation,
    by going through the string and parsing occurences of words(postfixes) by
    generating a pair of strings, one without the postfixes and the other with
    all words with postfixes transformed according to substitute_postfix().

    For example, turn:
    "The Fire(wo)man puts his(her) hat on" into "The Fireman puts his hat on"
    and "The Firewoman puts her hat on".

    Args:
        word: A string representing the raw job name, possibly but not
            necessarily in bracket notation.

    Return:
        If treating the string as one in bracket notation worked: a pair
        of strings representing the masculine and the ferminine version,
        respectively.

        Return None if the item doesn't appear to be in bracket notation.
    """

    # We only want brackets directly following a character:
    bracket_regex = re.compile(r'(\S+?)\((\S+?)\)')

    matches = re.findall(bracket_regex, raw_job_name)
    if not matches:  # if we don't seem to be in the bracket notation
        return None

    # Masculine name is just the string without the bracket content;
    # to get feminine names we also substitute the relevant words.
    # We'll perform these deletions/substitutions iteratively.
    masculine_name = feminine_name = raw_job_name
    for word, postfix in matches:
        if postfix == 's':  # ignore the plural postfix case
            continue

        masculine_name = masculine_name.replace(f'({postfix})', '')
        feminine_name = feminine_name.replace(f'({postfix})', '')

        new_word = _substitute_postfix(word, postfix)
        feminine_name = feminine_name.replace(word, new_word)

    return masculine_name, feminine_name


def _expand_qualifiers(left_string: str, right_string: str) -> typing.Tuple[str, str]:
    """Distribute qualifiers from the left side to the right and vice-versa.

    When a proposition is gendered in the slash format (e.g. "Senior
    Fireman / Firewoman"), the qualifiers on either side of the slash
    may or may not be meant to be distributive with respect to the other
    side. Given both sies of such a proposition, this function returns
    both sides with all qualifiers fully distributed.

    For example, the masculine name "Junior in training" could be
    genderized in the slash notation as:
    - "Junior Fireman in training / Junior Firewoman in training"
        (all qualifiers repeated, no distribution needed)
    - "Junior Fireman / Firewoman in training"
        (no qualifiers repeated, qualifiers on both sides must be distributed)
    - "Junior Fireman / Junior Firewoman in training"
        (only qualifiers on the left side are repeated)
    - "Junior Fireman in training / Firewoman in training"
        (only qualifiers on the right side are repeated)
    We want to turn any of these into "Junior Fireman in training" and
    "Junior Firewoman in training".

    Args:
        left_string: A string representing the left side of the proposition
            (ie. the part before the slash) for a phrase in the slash notation.
        right_string: A string representing the left side of the proposition
            (ie. the part after the slash) for a phrase in the slash notation.

    Return:
        A pair of strings, representing the left_string and right_string passed
        as input but with all qualifiers on either side fully expanded.

        Return two equal strings if it appears the slash does not represent a
        genderized substring, both equal to the input string with the slash
        substituted with _SLASH_PLACEHOLDER_CHARS to prevent further parsing.
    """

    right_words = right_string.split(' ')
    left_words = left_string.split(' ')

    # Insert words from the left side in front of the right until a word that
    # looks like right side's first shared word is found.
    # We need to fuzzy match to find this shared root because these words will
    # usually be in different genders. For our purposes simply comparing the
    # first few characters should be enough, especially since in French the
    # genderization usually only changes the word ending.
    to_insert = []
    for word in left_words:
        if word[:3] == right_words[0][:3]:
            break
        if (word.lower(), right_words[0].lower()) in _KNOWN_GENDERIZATION:
            break
        to_insert.append(word)

    if to_insert == left_words:  # looks like we had a non-genderization slash
        full_string = left_string + _SLASH_PLACEHOLDER_CHARS + right_string
        return full_string, full_string

    right_words = to_insert + right_words

    # Now that all left-side qualifiers have been distributed to the right,
    # append extra right-side words to the the left side:
    left_words += right_words[len(left_words):]

    expanded_left_string = ' '.join(left_words)
    expanded_right_string = ' '.join(right_words)

    return expanded_left_string, expanded_right_string


def _extract_slash_notation(raw_job_name: str) -> typing.Optional[typing.Tuple[str, str]]:
    """Parse a genderized string in the slash notation.

    Extract the genderized strings from a job title with the slash notation,
    such as "Senior Fireman / Firewoman". Note that a job title may feature
    multiple slashes, as in: "The Fireman / Firewoman puts his / her hat on".

    Return two strings respectively containing the masculine version and the
    feminine version, while making sure all qualifiers on either side are
    properly distributed, as qualifiers (such as "Senior" in this example)
    on a given side of the slash are sometimes repeated on both sides
    in the original name and sometimes not. See distribute_qualifiers() for
    more details.

    For example, turn:
    - "Senior Fireman / Firewoman" (single slash case)
        into "Senior Fireman" and "Senior Firewoman"
    - "The Fireman / Firewoman puts his / her hat on" (multiple slashes case)
        into "The Fireman puts his hat on" and The Firewoman puts her hat on".

    Args:
        word: A string representing the raw job name, possibly but not
            necessarily in slash notation.

    Return:
        If treating the string as one in slash notation worked: a pair
        of strings representing the masculine and the ferminine version,
        respectively.

        Return None if the item doesn't appear to be in slash notation.
    """

    if '/' not in raw_job_name:
        return None

    if _SLASH_PLACEHOLDER_CHARS in raw_job_name:
        error_string = \
            f'Reserved substring "{_SLASH_PLACEHOLDER_CHARS}" in job name: {raw_job_name}'
        raise ValueError(error_string)

    raw_job_name = raw_job_name.replace(' / ', '/')  # normalize spacing first
    substrings = raw_job_name.split('/', maxsplit=1)

    masculine_name, feminine_name = _expand_qualifiers(*substrings)

    # When multiple slashes are present (ie. the job name contains multiple
    # subsequences to be genderized), expanding each slash one at a time then
    # repeatedly expanding each such subsequence will yield the correct output.
    while '/' in masculine_name:
        masculine_substrings = masculine_name.split('/', maxsplit=1)
        masculine_name = _expand_qualifiers(*masculine_substrings)[0]

        feminine_substrings = feminine_name.split('/', maxsplit=1)
        feminine_name = _expand_qualifiers(*feminine_substrings)[1]

    # Restore any non-gender slash, if any:
    masculine_name = masculine_name.replace(_SLASH_PLACEHOLDER_CHARS, '/')
    feminine_name = feminine_name.replace(_SLASH_PLACEHOLDER_CHARS, '/')

    if masculine_name == feminine_name:  # catch cases with a non-gender slash
        return None

    return masculine_name, feminine_name


def genderize(raw_job_names: pd.Series) -> typing.Tuple[pd.Series, pd.Series]:
    """Normalize the genderization of a dataframe of ROME job titles.

    Take a pandas Series of the raw job titles as present in the ROME and
    genderize it, adding a masculine_name and a feminine_name field to it.

    Args:
        raw_job_names: A pandas Series of strings representing job names
            with ambiguous genderization.

    Return:
        A pair of pandas Series, respectively containing the masculine
        and the feminine version of the job names passed as input.
    """

    # By default, masculine_name = feminine_name = raw_job_name, then we
    # overwrite the value when either rule is successful.
    masculine_names = raw_job_names.copy()
    feminine_names = raw_job_names.copy()

    bracket_output = raw_job_names.apply(_extract_bracket_notation)
    slash_output = raw_job_names.apply(_extract_slash_notation)

    is_bracket = bracket_output.notnull()
    is_slash = slash_output.notnull()

    masculine_names[is_bracket] = bracket_output[is_bracket].apply(
        lambda x: x[0])
    feminine_names[is_bracket] = bracket_output[is_bracket].apply(
        lambda x: x[1])

    masculine_names[is_slash] = slash_output[is_slash].apply(
        lambda x: x[0])
    feminine_names[is_slash] = slash_output[is_slash].apply(
        lambda x: x[1])

    return masculine_names, feminine_names
