""" rule_engine.py

Contains the main parsing logic to extract ROME requirements
into a machine-readable format.

As of now type and importance rules have very good coverage and accuracy,
though they could be improved pretty easily by adding more patterns.

Content rules are where most of the improvements need to happen:
    1) we need to add more rules that catch specific sentence structures
    2) we need a bit more logic to clean-up the extracted values so that
    they are more standardized
"""

import re
from collections import defaultdict

import pandas as pd

from bob_emploi.parsers.rome_parser import rules


def get_rules():
    """Takes the rules defined in rule.py and compiles them;
    returns a nested dictionary where the top level is the
    type of rule, and the second level is a dictionary of
    {rule_name: compiled_regex} pairs."""
    compiled_rules = defaultdict(dict)

    for dict_name, dict_ in [
            ('type', rules.TYPE_RULES),
            ('importance', rules.IMPORTANCE_RULES),
            ('content', rules.CONTENT_RULES)]:
        for name, rule in dict_.items():
            compiled_rules[dict_name][name] = re.compile(rule, re.IGNORECASE)

    return compiled_rules


def clean_str(string, pattern, capitalize=False):
    """Broadcastable function to clean an extraction."""
    if string:
        string = re.sub(pattern, '', string)
        if len(string) > 1 and capitalize:
            if string[1].islower():
                string = string[0].upper() + string[1:]
        return string
    else:
        return string


def apply_rules(text):
    """It will run every rule sequentially, setting flags for each type and
    importance rules. For content rules it will run each of them in turn each
    one overwriting the previous ones for the rows where it succeeds.
    This means that rules should be in order of generic (more coverage) to
    more specific (more accuracy). Then we run some cleaning routines to
    clean-up the extracted values.
    """
    clean_level = re.compile(r"^((la|le|un|une|des) )", re.IGNORECASE)
    clean_subj = re.compile(r"^(l'|)", re.IGNORECASE)
    clean_subj2 = re.compile(r"[ ,.]+$", re.IGNORECASE)
    rules_dict = get_rules()

    res = {'level': None, 'subject': None}

    # Run type and importance rules first to get binary flags.
    for group in ['type', 'importance']:
        for name, rule in rules_dict[group].items():
            parsed = rule.search(text)
            res[name] = bool(parsed)

    # Run content rules to extract requirement level & subject.
    for name, rule in rules_dict['content'].items():
        parsed = rule.search(text)
        if parsed:
            level = parsed.group(1)
            res['level'] = clean_str(level, clean_level, True)

            subject = parsed.group(2)
            subject = clean_str(subject, clean_subj)
            res['subject'] = clean_str(subject, clean_subj2)
            res['last_rule_applied'] = name

    return res


def run_rules(data):
    """Takes a dataframe and a rule dictionary as input."""
    applied_series = [apply_rules(d) for d in data]
    return pd.DataFrame(applied_series)


def check_quality(parsed):
    """This just prints coverage values (number of lines recognized) for each rule.
    Collisions count the number of times multiple flags are true for the same
    type or importance rule, which should only very rarely happen (when the
    requirement is weirdly defined).
    """
    print("Total number of lines: ", len(parsed))
    print("\nTypes: ", sum(parsed.degree | parsed.certification |
                           parsed.skill | parsed.experience))
    print("- Collisions: ", sum(sum((parsed.degree, parsed.certification,
                                     parsed.skill, parsed.experience)) > 1))
    print("\nImportances: ", sum(parsed.required | parsed.alternative |
                                 parsed.sometimes | parsed.bonus))
    print("- Collisions: ", sum(sum((parsed.required, parsed.alternative,
                                     parsed.sometimes, parsed.bonus)) > 1))
    print("\nLevels: ", sum(parsed.level.notnull()))
