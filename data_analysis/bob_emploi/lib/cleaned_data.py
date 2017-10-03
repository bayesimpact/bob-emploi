# encoding: utf-8
"""Module to access to datasets already cleaned up.

You should not use this for notebooks that are trying to understand a dataset,
but on the opposite once you've done this notebook you should add some code
here so that all other code can just access it. This code should be very much
tied to the data below it and shouldn't try to cope with errors in the data if
we have checked there are none (e.g. don't remove duplicates if we've checked
that lines are unique).

The format of all the function in this module should always be the same: a
function representing a table, taking as an optional argument the base data
folder and another optional argument (overriding the first one) the exact file
to import from. Each function should return a pandas DataFrame with cleaned
values and column names. The documentation of the function should currently be
the documentation of the returned DataFrame. See the rome_job_group as a good
example.
"""
import codecs
import collections
from os import path
import re

import pandas

_ROME_VERSION = 'v332'


# TODO: Use this function in city suggest importer to read the stats file.
def french_city_stats(data_folder='data', filename_city_stats=None):
    """Read the french city stats."""
    if not filename_city_stats:
        filename_city_stats = path.join(data_folder, 'geo/french_cities.csv')
    return pandas.read_csv(
        filename_city_stats,
        sep=',', header=None, usecols=[1, 8, 10, 14, 19, 20],
        names=['departement_id', 'zipCode', 'city_id', 'population', 'longitude', 'latitude'],
        dtype={
            'departement_id': str,
            'zipCode': str,
            'city_id': str,
            'population': int,
            'latitude': float,
            'longitude': float,
        }).set_index('city_id', drop=False)


def job_offers(data_folder='data',
               filename_offers=None, filename_colnames=None):
    """Read the job offers dataset we got from Pole Emploi.

    More info about the structure of this dataset can be found
    in the notebook datasets/job_offers.ipynb
    """
    default_offers_path = 'job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_18JANV2016.csv'
    filename_offers = path.join(
        data_folder, filename_offers or default_offers_path)
    filename_colnames = path.join(
        data_folder, filename_colnames or 'job_offers/column_names.txt')

    with open(filename_colnames) as lines:
        column_names = [line.strip() for line in lines.readlines()]
    dtypes = {}
    dtypes[column_names.index('city_code')] = str
    dtypes[column_names.index('departement_code')] = str
    dtypes[column_names.index('region_code')] = str
    offers = pandas.read_csv(
        filename_offers,
        encoding='latin-1',
        delimiter='|',    # The file is *pipe separated*, not *comma separated*
        escapechar='\\',  # It also contains escaped *pipe separated* strings.
        header=None,
        names=column_names,
        dtype=dtypes)
    # Convert to datetime
    offers['creation_date'] =\
        pandas.to_datetime(offers['creation_date'])
    offers['date_debut_validite_offre'] =\
        pandas.to_datetime(offers['date_debut_validite_offre'])
    offers['rome_id'] = offers.rome_profession_card_code
    # Remove undesirable spaces
    offers['rome_name'] = offers['rome_profession_card_name'].str.strip()
    offers['annual_maximum_salary'] = pandas.to_numeric(
        offers.annual_maximum_salary, errors='coerce')
    offers['annual_minimum_salary'] = pandas.to_numeric(
        offers.annual_minimum_salary, errors='coerce')
    # We use `availibility_date` when available and impute `creation_date`
    # when missing.
    offers['date_debut_imputed'] = offers['date_debut_validite_offre']
    offers.loc[offers.date_debut_imputed.isnull(),
               'date_debut_imputed'] = offers['creation_date']
    # `experience_min_duration` is sometimes expressed in Months or in Year :
    # Let's convert everything into month.
    annual_expe_condition = (offers.exp_duration_type_code == 'AN')
    offers.loc[annual_expe_condition, 'experience_min_duration'] =\
        offers.loc[annual_expe_condition, 'experience_min_duration'] * 12
    offers.loc[annual_expe_condition, 'exp_duration_type_code'] = 'MO'
    return offers


def rome_to_skills(data_folder='data',
                   filename_items=None, filename_skills=None):
    """Load a dictionary that maps rome ID to a list of skill IDs.

    The 'coherence' table contains a general mapping from rome ID to items
    associated with this rome ID. Joining with the skills table will leave only
    the skill related associations.
    """
    if not filename_items:
        filename_items = path.join(
            data_folder,
            'rome/csv/unix_coherence_item_{}_utf8.csv'.format(_ROME_VERSION))
    if not filename_skills:
        filename_skills = path.join(
            data_folder,
            'rome/csv/unix_referentiel_competence_{}_utf8.csv'.format(_ROME_VERSION))
    rome_to_item = pandas.read_csv(filename_items, dtype=str)
    skills = pandas.read_csv(filename_skills, dtype=str)
    merged = pandas.merge(rome_to_item, skills, on='code_ogr')
    merged['skill_name'] = merged.libelle_competence.str.replace("''", "'")\
        .apply(maybe_add_accents)
    merged['skill_is_practical'] = merged.code_type_competence == '2'
    return merged[['code_rome', 'code_ogr', 'skill_name', 'skill_is_practical']]


def rome_job_groups(data_folder='data', filename=None):
    """A list of all job groups in ROME with their names.

    The only column is "name" and the index is the ROME code. Each row
    represents a job group clustering multiple professions.
    """
    if not filename:
        filename = path.join(
            data_folder,
            'rome/csv/unix_referentiel_code_rome_{}_utf8.csv'.format(_ROME_VERSION))

    job_groups = pandas.read_csv(filename)

    # Fix names that contain double '.
    job_groups['name'] = job_groups['libelle_rome'].str.replace("''", "'")\
        .apply(maybe_add_accents)

    job_groups.set_index('code_rome', inplace=True)

    return job_groups[['name']]


def rome_holland_codes(data_folder='data', filename=None):
    """A list of all job groups in ROME with their Holland Codes.

    The only columns are the "major" and the "minor" Holland Code and the index
    is the ROME code. Each row represents a job group clustering multiple
    professions.
    """
    if not filename:
        file_pattern = 'rome/csv/unix_referentiel_code_rome_riasec_{}_utf8.csv'
        filename = path.join(data_folder, file_pattern.format(_ROME_VERSION))

    column_names = ['code_rome', 'major', 'minor']
    holland_codes = pandas.read_csv(filename, names=column_names)
    holland_codes.major.fillna('', inplace=True)
    holland_codes.minor.fillna('', inplace=True)
    return holland_codes.set_index('code_rome')


def rome_texts(data_folder='data', filename=None):
    """A list of all job groups in ROME with some lengthy text definitions.

    The columns are "definition", "requirements" and "working_environment".
    Each row represents a job group clustering multiple professions.
    """
    if not filename:
        filename = path.join(
            data_folder, 'rome/csv/unix_texte_{}_utf8.csv'.format(_ROME_VERSION))

    texts = pandas.read_csv(filename).pivot_table(
        index='code_rome',
        columns='libelle_type_texte',
        values='libelle_texte',
        aggfunc=lambda x: '\n\n'.join(x).replace("''", "'"))
    return texts.rename(columns={
        'acces_a_em': 'requirements',
        'cond_exercice_activite': 'working_environment',
    })


def rome_work_environments(
        data_folder='data', links_filename=None, ref_filename=None):
    """A list of all work environment of job groups in ROME.

    The columns are "code_rome", "code_ogr" (a unique ID for a work environment
    item), "name", "section" (one of STRUCTURES, CONDITIONS and SECTEURS).
    """
    if not links_filename:
        links_filename = path.join(
            data_folder,
            'rome/csv/unix_liens_rome_referentiels_{}_utf8.csv'.format(_ROME_VERSION))
    if not ref_filename:
        ref_filename = path.join(
            data_folder,
            'rome/csv/unix_referentiel_env_travail_{}_utf8.csv'.format(_ROME_VERSION))

    links = pandas.read_csv(links_filename)
    ref = pandas.read_csv(ref_filename)
    environments = pandas.merge(links, ref, on='code_ogr', how='inner')
    environments['name'] = environments.libelle_env_travail.str.replace("''", "'")\
        .apply(maybe_add_accents)
    return environments.rename(columns={
        'libelle_type_section_env_trav': 'section',
    })[['name', 'code_ogr', 'code_rome', 'section']]


def rome_jobs(data_folder='data', filename=None):
    """A list of all jobs in ROME with their names and their groups.

    The columns are "name" and "code_rome" and the index is the OGR code. Each
    row represents a profession.
    """
    if not filename:
        filename = path.join(
            data_folder,
            'rome/csv/unix_referentiel_appellation_{}_utf8.csv'.format(_ROME_VERSION))

    jobs = pandas.read_csv(filename, dtype=str)

    # Fix names that contain double '.
    jobs['name'] = jobs['libelle_appellation_court'].str.replace("''", "'")\
        .apply(maybe_add_accents)

    jobs.set_index('code_ogr', inplace=True)

    return jobs[['name', 'code_rome']]


def rome_job_groups_mobility(data_folder='data', filename=None, expand_jobs=False):
    """A list of oriented edges in the ROME mobility graph.

    The expand_jobs parameter defines what to do with edges going from or to
    jobs directly instead of job groups: if True, the function expands the edge
    to concern the whole job groups even if only one job was specified ; if
    False, the function ignores such edges.

    The columns are "source_rome_id", "source_name", "target_rome_id",
    "target_name", "mobility_type".
    """
    if not filename:
        filename = path.join(
            data_folder,
            'rome/csv/unix_rubrique_mobilite_{}_utf8.csv'.format(_ROME_VERSION))

    mobility = pandas.read_csv(filename, dtype=str)
    mobility.rename(columns={
        'code_rome': 'source_rome_id',
        'code_rome_cible': 'target_rome_id',
    }, inplace=True)

    # Expand or ignore job edges.
    if expand_jobs:
        mobility = mobility.drop_duplicates(subset=['source_rome_id', 'target_rome_id'])
    else:
        mobility = mobility[
            mobility.code_appellation_source.isnull() & mobility.code_appellation_cible.isnull()]

    # Add names.
    rome_job_group_names = rome_job_groups(data_folder=data_folder).name
    mobility['source_rome_name'] = mobility.source_rome_id.map(rome_job_group_names)
    mobility['target_rome_name'] = mobility.target_rome_id.map(rome_job_group_names)

    # Translate mobility type.
    mobility['mobility_type'] = mobility.libelle_type_mobilite.map({
        'Proche': 'Near',
        'Evolution': 'Evolution',
    })

    return mobility[[
        'source_rome_id',
        'source_rome_name',
        'target_rome_id',
        'target_rome_name',
        'mobility_type',
    ]]


def rome_fap_mapping(data_folder='data', filename=None):
    """Mapping from ROME ID to FAP codes.

    The index are the ROME IDs and the only column "fap_codes" is a list of
    corresponding FAP codes.
    """
    if not filename:
        filename = path.join(data_folder, 'crosswalks/passage_fap2009_romev3.txt')
    with codecs.open(filename, 'r', 'latin-1') as fap_file:
        mapping = collections.defaultdict(set)
        for line in fap_file:
            matches = re.search(r'"(.*?)"+\s+=\s+"(.*?)"', line)
            if not matches:
                continue
            qualified_romes = matches.groups()[0]
            fap = matches.groups()[1]
            for qualified_rome in qualified_romes.replace('"', '').split(','):
                rome_id = qualified_rome[:5]
                mapping[rome_id].add(fap)
    return pandas.Series(mapping, name='fap_codes').to_frame()


def french_departements(data_folder='data', filename=None):
    """French départements.

    The index are the IDs of the départements, and the columns are "name" and
    "region_id".
    """
    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_departements.tsv')
    departements = pandas.concat([
        pandas.read_csv(filename, sep='\t', dtype=str),
        pandas.read_csv(
            path.join(data_folder, 'geo/insee_france_oversee_collectivities.tsv'),
            sep='\t', dtype=str)])
    departements.rename(
        columns={
            'REGION': 'region_id',
            'DEP': 'departement_id',
            'NCCENR': 'name',
        },
        inplace=True)
    departements.set_index('departement_id', inplace=True)
    return departements[['name', 'region_id']]


def french_regions(data_folder='data', filename=None):
    """French régions (on January 1st, 2016).

    The index are the IDs of the régions, and the only column is "name".
    """
    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_regions.tsv')
    regions = pandas.read_csv(filename, sep='\t', dtype=str)
    regions.rename(
        columns={'REGION': 'region_id', 'NCCENR': 'name'}, inplace=True)
    regions.set_index('region_id', inplace=True)
    return regions[['name']]


def french_cities(data_folder='data', filename=None, unique=False):
    """French cities (all the ones that have existed until January 1st, 2016).

    The index are the IDs (Code Officiel Géographique) of the cities, and the
    columns are "name", "departement_id", "region_id", "current" (whether the
    city is still a city on 2016-01-01) and "current_city_id" (for cities that
    have been merged, the ID of the merged city).
    """
    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_cities.tsv')
    cities = pandas.read_csv(filename, sep='\t', dtype=str)

    cities['city_id'] = cities.DEP + cities.COM
    if unique:
        # Drop duplicate indices: french cities table has sometimes multiple
        # rows for the same ID, as a city can change name.
        cities.drop_duplicates('city_id', inplace=True)
    cities.set_index('city_id', inplace=True)

    cities.rename(columns={
        'NCCENR': 'name',
        'ARTMIN': 'prefix',
        'DEP': 'departement_id',
        'REG': 'region_id',
        'POLE': 'current_city_id',
    }, inplace=True)

    cities['current'] = cities.ACTUAL == '1'
    cities['arrondissement'] = cities.ACTUAL == '5'

    cities.prefix.fillna('', inplace=True)
    cities.prefix = cities.prefix.str[1:-1]
    cities['separator'] = cities.prefix.map(
        lambda prefix: '' if not prefix or prefix.endswith("'") else ' ')
    cities.name = cities.prefix + cities.separator + cities.name

    return cities[[
        'name', 'departement_id', 'region_id', 'current', 'current_city_id', 'arrondissement']]


def scraped_imt(data_folder='data', filename=None):
    """IMT - Information sur le Marché du Travail.

    This is information on the labor market scraped from the Pôle emploi website.

    The table is indexed by "departement_id" and "rome_id" and contains the
    fields equivalent to the ImtLocalJobStats protobuf in camelCase.
    """
    if not filename:
        filename = path.join(data_folder, 'scraped_imt_local_job_stats.json')
    imt = pandas.read_json(filename, orient='records')
    imt['departement_id'] = imt.city.apply(lambda c: c['departementId'])
    imt['rome_id'] = imt.job.apply(lambda j: j['jobGroup']['romeId'])
    return imt.set_index(['departement_id', 'rome_id'])


# Regular expression to match unaccented capital E in French text that should
# be capitalized. It has been computed empirically by testing on the full ROME.
# It matches the E in "Etat", "Ecrivain", "Evolution", but not in "Entreprise",
# "Ethnologue" nor "Euro".
_UNACCENTED_E_MATCH = re.compile(
    r'E(?=('
    '([bcdfghjklpqrstvz]|[cpt][hlr])[aeiouyéèêë]|'
    'n([eouyéèêë]|i[^v]|a[^m])|'
    'm([aeiuyéèêë]|o[^j])))')


def maybe_add_accents(title):
    """Add an accent on capitalized letters if needed.

    In the ROME, most of the capitalized letters have no accent even if the
    French word would require one. This function fixes this by using
    heuristics.
    """
    return _UNACCENTED_E_MATCH.sub('É', title)
