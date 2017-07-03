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
