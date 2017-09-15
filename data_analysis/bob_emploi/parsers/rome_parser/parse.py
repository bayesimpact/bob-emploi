""" parse.py

Extract qualifications from ROME job fiches from a natural language paragraph
to a machine-readable format. Since there can be many types of requirements,
we define a schema we force every requirement into, defined as follows:

Ontology:
    - Type: one of (degree, certification, skill,
                    professional experience, other);
        This indicates the type of requirement.
        Some overlap is expected between degree (education level) and
        certifications (shorter training programs, licences, etc.)
        as the distinction is sometimes somewhat fuzzy.
        Other encodes misc. stuff like "clear criminal records", etc.
    - Importance: one of (yes, alternative, sometimes, bonus)
        This indicates whether the requirement is mandatory, a nice-to-have,
        an alternative to another requirement (e.g. professional experience
        in lieu of a degree), or only sometimes required.
        The distinction between 'bonus' and 'sometimes' is fuzzy, but I'm
        leaving both in just in case, since they're often worded differently in
        the requirements.
    - Level: string
        This indicates the level of the requirement. This is flexibile enough
        to encode different types of requirements.
        e.g. a level for a degree is something like "BA" or "MS",
        for professional experience it's the number of years or "some",
        for a weird case like "criminal record" it could be "clear".
    - Subject: string
        This indicates the content of the requirement and what field/subject
        it pertains to.
        e.g. for a degree it would be the field of the degree (e.g.
        "chemistry" or "accounting"),
        for a professional experience it could be the field the experience
        must be in (e.g. "in the agricultural sector"), etc.


Input:
This procedure takes as input a CSV file that contains one row per sentence
(the idea being that each sentence = one requirement; this is mostly true
but in a few rare cases there is still some cleaning up to do -- this can be
detectable by inspecting the ones where there's a collision or parsing errors).
This file must contain the following fields:
    - code_ogr: to tie the requirement back to a specific job
    - title: the title of the job this requirement refers to
    - requirements: the original natural language description

Output:
A JSON file, structured as follows:
    - code_ogr: to tie the requirement back to a specific job
    - title: the title of the job this requirement refers to
    - requirements: the original natural language description
    - type: a dictionary of boolean flags, one for each type value
    - importance: a dictionary of boolean flags, one for each importance value
    - level: a text field containing the requirement level we extracted
    - subject: a text field containing the requirement subject we extracted

type, importance, level, and subject are extracted by the rule engine.

"""

import sys

import pandas as pd

from bob_emploi.parsers.rome_parser.helpers import save_dataframe_to_json
from bob_emploi.parsers.rome_parser import rule_engine


def main(in_file, out_file):
    """This is an example of how to use the parser."""
    rules = rule_engine.get_rules()
    data = pd.read_csv(in_file, encoding='latin-1')
    parsed = rule_engine.run_rules(data.requirements)
    rule_engine.check_quality(parsed)

    # Save the output, selecting only the columns we want.
    to_display = ['code_ogr', 'title', 'requirements', 'level', 'subject']
    to_display += ['last_rule_applied']
    to_display += list(rules['type'].keys()) + list(rules['importance'].keys())

    out = pd.concat([data, parsed], axis=1)
    save_dataframe_to_json(out[to_display], out_file + '.json', rules)
    out[to_display].to_csv(out_file + '.csv', encoding='latin-1')
    # End output will be in JSON but CSV is easier for manual spotcheck.


if __name__ == '__main__':
    main(*sys.argv[1:])
