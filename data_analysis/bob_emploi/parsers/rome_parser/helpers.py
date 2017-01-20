""" helpers.py

This contains some helper functions, mostly to handle the
I/O from the files.
"""

import codecs
import json
import sys

import pandas as pd

from bob_emploi.lib import read_data


def prepare_data(fiche_xml_path):
    """Read job information from fiche XML files and return a dataframe
    The output frame has three columns 'code_ogr', 'title' and 'requirements'
    """

    def _extractor(fiche):
        return [fiche['bloc_code_rome']['code_ogr'],
                fiche['bloc_code_rome']['intitule'],
                fiche['acces_emploi_metier']['#text']]

    fiche_dicts = read_data.load_fiches_from_xml(fiche_xml_path)
    requirements = [_extractor(fiche) for fiche in fiche_dicts]
    col_names = ['code_ogr', 'title', 'requirements']
    data_frame = pd.DataFrame(requirements, columns=col_names)
    data = pd.DataFrame(data_frame.requirements.str.split('\n').tolist(),
                        index=[data_frame.code_ogr, data_frame.title])
    data = data.stack().reset_index()[['code_ogr', 'title', 0]]
    data.columns = col_names
    data.title.str.encode('latin-1')
    data.requirements.str.encode('latin-1')
    return data


def save_dataframe_to_json(data_frame, filename, rules):
    """Pretty prints a dataframe with the relevant fields
    to a JSON file.
    It takes the rules dictionary as input in order to
    nest some of the fields in the JSON for easier reading
    (mainly the type and importance binary flags)."""

    json_parsed = json.loads(
        data_frame.to_json(orient='records', force_ascii=False))

    for group in ['type', 'importance']:
        for row in json_parsed:
            temp_dict = {}
            for rule_name in rules[group]:
                temp_dict[rule_name] = row.pop(rule_name)
            row[group] = temp_dict

    with codecs.open(filename, 'w', encoding='utf-8') as json_file:
        json.dump(json_parsed, json_file, ensure_ascii=False, indent=4)


def main(fiche_xml_path, out_file):
    """Extract requirements from ROME XML files as a flatten CSV."""
    data = prepare_data(fiche_xml_path)
    data.to_csv(out_file, encoding='latin-1')


if __name__ == '__main__':
    main(*sys.argv[1:])
