"""Module to bundle data queries that are used over several notebooks.

Created by Stephan on Nov 3, 2015
"""

import codecs
from copy import copy, deepcopy
import glob
import os
import re
import typing

import pandas as pd
import xmltodict

from .migration_helpers import transform_categorial_vars

# Regular expression to match FAP description. It matches lines such as:
# '"D2Z41"="D2Z41 : Tuyauteurs"'
_FAP_NAME_REGEXP = re.compile(
    r'^"(?P<fap_code>[A-Z0-9]{1,5})"="(?P=fap_code) : (?P<fap_name>.*)"$')


def parse_fap_rome_crosswalk(lines: typing.Iterable[str]) -> pd.DataFrame:
    """docstring for parse_FAP_ROME_crosswalk"""

    collect = []
    for line in lines:
        matches = re.search(r'"(.*?)"+\s+=\s+"(.*?)"', line)
        if not matches:
            continue

        romes = matches.groups()[0]
        fap = matches.groups()[1]
        for rome in romes.replace('"', '').split(','):
            collect.append((rome, fap))
    res = pd.DataFrame(collect)
    res.columns = ['rome', 'fap']
    return res


def parse_intitule_fap(filename: str = 'data/intitule_fap2009.txt') -> pd.DataFrame:
    """Parse the name of the FAP from the official file.

    Args:
        path of the file containing the description to parse.
    Returns:
        A simple DataFrame with two columns: fap_code and fap_name.
    """

    faps = []
    with codecs.open(filename, 'r', 'windows-1252') as fap_file:
        for line in fap_file:
            matches = _FAP_NAME_REGEXP.match(line.strip())
            if not matches:
                continue
            faps.append((matches.group('fap_code'), matches.group('fap_name')))
    faps_df = pd.DataFrame(faps)
    faps_df.columns = ['fap_code', 'fap_name']
    return faps_df


def load_fiches_from_xml(xml_folder: str) -> typing.List[typing.Dict[typing.Any, typing.Any]]:
    """Load ROME files ("fiches" in French) from XML."""

    fiche_dicts = []
    for fname in glob.glob(os.path.join(xml_folder, '*.xml')):
        with open(fname) as xml_file:
            fiche = xmltodict.parse(xml_file.read())
            fiche_dicts.append(fiche['fiche_emploi_metier'])
    return fiche_dicts


def _extract_path(tree: typing.Dict[str, typing.Any], path: typing.Iterable[str]) \
        -> typing.List[typing.Any]:
    res = copy(tree)
    for elem in path:
        res = typing.cast(typing.Dict[str, typing.Any], res.get(elem))
    if isinstance(res, list):
        return res
    return [res]


def _extract_activities(tree: typing.Dict[str, typing.Any]) -> typing.List[typing.Dict[str, str]]:
    acts = _extract_path(
        tree, ['bloc_activites_de_base', 'activites_de_base', 'item_ab'])
    for act in acts:
        act['riasec_mineur'] = (
            act['riasec_mineur'].upper() if 'riasec_mineur' in act else None)
        act['name'] = act.pop('libelle')
    return acts


def _compute_riasec_profile(activities: typing.Iterable[typing.Dict[str, str]]) \
        -> typing.Dict[str, int]:
    riasec_profile = {c: 0 for c in 'RIASEC'}
    for act in activities:
        if 'riasec_majeur' in act:
            riasec_profile[act['riasec_majeur']] += 1
    return riasec_profile


def _extract_skills(tree: typing.Dict[str, typing.Dict[str, str]]) \
        -> typing.List[typing.Dict[str, str]]:
    action_skills: typing.List[typing.Dict[str, str]] = []
    acts_block = tree['bloc_activites_de_base']
    theory_skills = _extract_path(
        acts_block, ['savoir_theorique_et_proceduraux', 'item_ab_stp'])

    if 'item_ab_sa' in acts_block['savoir_action']:
        action_skills = _extract_path(
            acts_block, ['savoir_action', 'item_ab_sa'])
    res = theory_skills + action_skills
    for skill in res:
        skill['name'] = skill.pop('libelle')
    return res


def fiche_extractor(fiche: typing.Dict[str, typing.Any]) -> typing.Dict[str, typing.Any]:
    """Extract info from a ROME file ("fiche" in French).

    Args:
        fiche: the file in its original format diretly read from XML.
    Returns:
        a flattened Python dict.
    """

    fiche = deepcopy(fiche)
    rome = typing.cast(typing.Dict[str, typing.Any], copy(fiche['bloc_code_rome']))
    rome['description'] = _extract_path(fiche, ['definition', '#text'])
    rome['work_cond'] = _extract_path(
        fiche, ['condition_exercice_activite', '#text'])
    rome['work_env'] = _extract_path(
        fiche, ['bloc_environnement_de_travail', 'item_env'])
    rome['activities'] = _extract_activities(fiche)
    rome['riasec_profile'] = _compute_riasec_profile(rome['activities'])
    rome['skills'] = _extract_skills(fiche)
    titles = _extract_path(fiche, ['bloc_appellation', 'item_app'])
    rome['titles'] = [x['libelle'] for x in titles]
    return rome


def load_applications_sample_df(database: typing.Any) -> pd.DataFrame:
    """
    Given a DB object, loads a deterministic sample of 100,000 user
    applications, postprocesses it into a more human-readable format, and
    returns a DataFrame.
    """

    query = '''
        SELECT
            *
        FROM users
        JOIN bayes_applications_under_study
                USING (application_id)
    '''

    # Load column names transformation dict from column_descriptions spreadsheet
    column_names_df = pd.read_excel(
        '../../data/mixed_sources/FHS_column_descriptions.xlsx',
        sheet_name='en__users')
    column_names_df = column_names_df[
        column_names_df['english_column_name'].map(str) != 'nan']
    column_names = dict(zip(
        typing.cast(typing.Iterable[str], column_names_df.orig_column_name),
        typing.cast(typing.Iterable[str], column_names_df.english_column_name)))

    def _rename_column(col: str) -> str:
        if '_french' in col:
            return f'{column_names[col[:-7]]}_french'
        elif '_english' in col:
            return f'{column_names[col[:-8]]}_english'
        else:
            return column_names[col]

    # Load codebook from spreadsheet and replace column codes with column names
    # everywhere
    codebook = pd.read_excel(
        '../../data/mixed_sources/FHS_en_table_codebook.xlsx', sheet_name=None)
    codebook = {
        column_names[key]: mapping.rename(columns=_rename_column)
        for key, mapping in codebook.items()}

    # Run query, transform results using codebook, and return
    data_frame = database.query(query)
    print(f'Loaded {data_frame.application_id.nunique():d} unique application records.')
    data_frame.set_index('application_id', inplace=True)
    return transform_categorial_vars(data_frame, codebook)
