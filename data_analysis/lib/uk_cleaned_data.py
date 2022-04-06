"""Module to access to UK datasets already cleaned up.

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

import datetime
from os import path
import re
import typing
from typing import Literal, Optional, Union

from algoliasearch import search_client as search_client  # pylint: disable=useless-import-alias
from algoliasearch import exceptions
import numpy
import pandas
import pyjson5
import requests

from bob_emploi.data_analysis.lib import geonames
from bob_emploi.frontend.api import job_pb2


_SOC_LEVEL = Literal[  # pylint: disable=invalid-name
    'Major_Group', 'Sub_Major_Group', 'Minor_Group', 'Unit_Group']

# Mapping between region official code and region name. See here:
# https://public.opendatasoft.com/explore/dataset/georef-united-kingdom-region/table/?flg=fr&disjunctive.ctry_code&disjunctive.ctry_name&disjunctive.rgn_code&disjunctive.rgn_name
REGIONS_MAP = {
    'North East': 'E12000001',
    'Nort West': 'E12000002',
    'Yorkshire and The Humber': 'E12000003',
    'East Midlands': 'E12000004',
    'West Midlands': 'E12000005',
    'East': 'E12000006',
    'London': 'E12000007',
    'South East': 'E12000008',
    'South West': 'E12000009',
    'Wales': 'W92000004',
    'Scotland': 'S92000003',
    'Northern Ireland': 'N92000002',
}


def uk_soc2010_job_groups(
        data_folder: str = 'data', filename: Optional[str] = None,
        level: _SOC_LEVEL = 'Unit_Group') -> pandas.DataFrame:
    """A list of all job groups (SOC unit groups) in UK SOC2010 with their names.

    The only column is "name" and the index is the SOC code (e.g. '1111' or '2111'). Each row
    represents a job group clustering multiple professions.
    """

    if not filename:
        filename = path.join(data_folder, 'uk/soc/soc2010.xls')

    job_groups = pandas.read_excel(filename, sheet_name='SOC2010 Structure', dtype='str')
    job_groups.columns = ['Major_Group', 'Sub_Major_Group', 'Minor_Group', 'Unit_Group', 'name']

    job_groups_no_na = job_groups.dropna(how='all')
    unit_groups = job_groups_no_na[job_groups_no_na[level].notna()]

    unit_groups.set_index(level, inplace=True)

    return unit_groups[['name']]


# See notebooks/datasets/uk/elementary_jobs.ipynb
_NON_ACADEMIC_PATTERNS = r'possess|vocational|degree'
_NO_DEGREE_PATTERNS = r'no formal academic|no minimum|no academic'


def uk_soc2010_group_descriptions(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """Description of all occupation groups (SOC unit groups) in UK SOC2010.

    The columns are "name" (capitalized name of the unit group), "jobs" (a list of job titles),
    "description" (a lengthy description of the occupations), and "minimum_diploma"
    (a DegreeLevel required for entry in this job). The index is the SOC code
    (e.g. '1115').
    """

    if not filename:
        filename = path.join(data_folder, 'uk/soc/socDB.js')

    with open(filename, 'r', encoding='windows-1252') as file:
        json_lines = [
            # Lines are written as:
            # socDB[42] = {...};
            pyjson5.loads(line.split('=', 1)[1].strip()[:-1])
            for line in file
            if line.startswith('socDB[') and 'soc2010' in line and 'soc2010:0' not in line
        ]

    # There are other keys that we haven't investigated: entry, tasks, opcat, ancls, redoc, redac.

    descriptions = pandas.DataFrame(json_lines)
    descriptions.rename(
        {
            'desc': 'description',
            'entry': 'raw_qualif',
            'related': 'jobs',
            'unit': 'name',
        },
        axis='columns', inplace=True)
    descriptions['soc2010'] = descriptions.soc2010.astype(str)
    descriptions['jobs'] = descriptions.jobs.apply(
        lambda job_names: [name for name in job_names if name])
    descriptions.set_index('soc2010', inplace=True)
    descriptions['minimum_diploma'] = job_pb2.DegreeLevel.Name(job_pb2.UNKNOWN_DEGREE)
    # TODO(cyrille): Add more levels, using more regexes.
    descriptions.loc[
        (~descriptions.raw_qualif.str.contains(_NON_ACADEMIC_PATTERNS, case=False, regex=True)) &
        (descriptions.raw_qualif.str.contains(_NO_DEGREE_PATTERNS, case=False, regex=True)),
        'minimum_diploma',
    ] = job_pb2.DegreeLevel.Name(job_pb2.NO_DEGREE)
    return descriptions[['name', 'description', 'jobs', 'minimum_diploma']]


def uk_national_occupations(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """Script to parse occupational employment dataset provided by the UK Office of National Stats.

    Each row represents an occupation. Columns are:
    - the SOC code (occ_code, e.g. '111' or '1161'). Every level of the SOC occupations are
      provided,
    - the level of the SOC code (o_group, major: e.g. 1, minor: 111, unit: 1115).
    - and the number of employees (tot_emp).
    """

    if not filename:
        filename = path.join(data_folder, 'uk/employment_by_occupation_sept_2018.xls')
    occupations = pandas.read_excel(filename, skiprows=6, header=None)

    # Add fields before filtering.
    occupations['occ_code'] = \
        occupations.iloc[:, 0].replace(to_replace=' .*$', value='', regex=True)
    occupations['o_group'] = ''
    occupations.loc[occupations.occ_code.str.len() == 1, 'o_group'] = 'major'
    occupations.loc[occupations.occ_code.str.len() == 3, 'o_group'] = 'minor'
    occupations.loc[occupations.occ_code.str.len() == 4, 'o_group'] = 'unit'
    occupations['tot_emp'] = occupations.iloc[:, 1].replace(to_replace='*', value=0)

    return occupations[['occ_code', 'o_group', 'tot_emp']].dropna()


def uk_soc2010_isco08_mapping(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """Mapping from UK SOC 2010 ID to ISCO 08 codes.

    The indices are the 4-digits SOC codes and the only column "isco08_code" is the corresponding
    ISCO code. Note that some SOC codes are mapped to several ISCO codes, and that some ISCO codes
    are never mapped.
    """

    if not filename:
        filename = path.join(data_folder, 'crosswalks/uk_SOC_2010_to_ISCO-08_mapping.xls')
    mapping = pandas.read_excel(filename, sheet_name='1to1s', dtype='str')
    mapping.rename(
        {'ISCO08': 'isco08_code', 'SOC\n2010': 'soc_2010'}, axis='columns', inplace=True)
    mapping.replace('', numpy.NaN, inplace=True)
    mapping.fillna(method='pad', inplace=True)
    return mapping.set_index('soc_2010')[['isco08_code']]


def _get_local_authorities(
        wards_ons_csv: str, geonames_txt: str, geonames_admin_txt: str) -> pandas.DataFrame:
    try:
        # Get the LAD already imported in Algolia, since it's very long to recompute.
        client = search_client.SearchClient.create('K6ACI9BKKT')
        index = client.init_index('local_authorities')
        cities = pandas.DataFrame(list(index.browse_objects({'query': ''})))
    except (exceptions.AlgoliaException, KeyError):
        cities = uk_cities(
            wards_filename=wards_ons_csv,
            geonames_filename=geonames_txt,
            geonames_admin_filename=geonames_admin_txt,
            min_population=100)
        cities = pandas.DataFrame(
            {
                'admin1Code': city.GOR10CD if city.GOR10CD else city.CTRY16CD,
                'admin2Code': city.LAD16CD
            }
            for city in cities.itertuples()
        )
    return cities[['admin1Code', 'admin2Code']].drop_duplicates().set_index('admin1Code')


def _get_salaries_by_county(
        salaries_by_region: pandas.DataFrame,
        wards_ons_csv: str,
        geonames_txt: str,
        geonames_admin_txt: str) -> pandas.DataFrame:
    local_authorities = _get_local_authorities(wards_ons_csv, geonames_txt, geonames_admin_txt)

    areas = salaries_by_region.\
        join(local_authorities, on='Region')[['Code', 'admin2Code', 'Median_salary']].\
        rename({'admin2Code': 'Area'}, axis=1)
    return areas


# TODO(sil): Use low and high percentiles to simulate junior and senior salaries.
def get_salaries(
        data_folder: str = 'data',
        salary_filename: Optional[str] = None,
        wards_ons_csv: Optional[str] = None,
        geonames_txt: Optional[str] = None,
        geonames_admin_txt: Optional[str] = None) -> pandas.DataFrame:
    """Extracting salaries by occupation and region.

    The indices are the 4-digits SOC codes. There are two columns, one with the ares (counties…)
    names and the other ones with the median salaries.
    """

    if not salary_filename:
        salary_filename = path.join(data_folder, 'uk/salaries_by_region_2020.xlsx')
    if not wards_ons_csv:
        wards_ons_csv = path.join(data_folder, 'uk/wards.csv')
    if not geonames_txt:
        geonames_txt = path.join(data_folder, 'uk/geonames.txt')
    if not geonames_admin_txt:
        geonames_admin_txt = path.join(data_folder, 'uk/geonames_admin.txt')

    salaries_by_region = pandas.read_excel(
        salary_filename, sheet_name='All', na_values='x', skiprows=4)
    salaries_by_region['Description'] = salaries_by_region.Description.str.strip()
    salaries_by_region['Region_name'] = salaries_by_region.Description.str.split(
        ',', n=1, expand=True)[0]
    salaries_by_region['Region'] = salaries_by_region.Region_name.replace(REGIONS_MAP)
    salaries_by_region.loc[
        ~salaries_by_region.Region.isin(REGIONS_MAP.values()), 'Region'] = 'National'

    unit_group_salaries = salaries_by_region[
        salaries_by_region.Code.str.len() == 4].copy()
    national_salaries = unit_group_salaries[unit_group_salaries.Region == 'National'] \
        .drop_duplicates('Code')

    unit_group_salaries['National_median_salary'] = unit_group_salaries.Code.map(
        national_salaries.set_index('Code').Median)
    unit_group_salaries['Median_salary'] = unit_group_salaries.Median.combine_first(
        unit_group_salaries.National_median_salary)

    job_group_salaries_by_region = unit_group_salaries[
        unit_group_salaries.Region.isin(REGIONS_MAP.values())]

    job_group_salaries_by_county = _get_salaries_by_county(
        job_group_salaries_by_region[['Code', 'Region', 'Median_salary']],
        wards_ons_csv, geonames_txt, geonames_admin_txt)
    return job_group_salaries_by_county.set_index('Code')


def _prepare_geonames_dataframe(geonames_filename: str, min_population: int) -> pandas.DataFrame:
    frame = pandas.read_csv(
        geonames_filename, names=geonames.GEONAMES_FIELDNAMES, sep='\t', dtype={
            'geonameid': 'str',
        })
    return frame[
        (frame.population > min_population) &
        frame.admin1_code.isin(['ENG', 'WLS', 'SCT', 'NIR'])][[
            'geonameid', 'name', 'latitude', 'longitude', 'population',
            'feature_code', 'admin1_code', 'admin2_code', 'admin3_code', 'admin4_code',
        ]]


class _WithCoordinates(typing.Protocol):
    latitude: float
    longitude: float


def _get_lad_from_coords(location: _WithCoordinates) -> Union[float, str]:
    response = requests.get(
        f'https://findthatpostcode.uk/points/{location.latitude}%2C{location.longitude}.json')
    response.raise_for_status()
    included_documents = response.json().get('included', [])
    current_lad_cd: Optional[str] = next(filter(None, (
        doc['attributes'].get('laua') for doc in included_documents)), None)
    if not current_lad_cd:
        return float('nan')
    current_lad = next(doc for doc in included_documents if doc['id'] == current_lad_cd)
    start_date = datetime.datetime.strptime(
        current_lad['attributes'].get('date_start'),
        '%a, %d %b %Y %H:%M:%S GMT')
    if start_date > datetime.datetime(2017, 1, 1, 0, 0, 0):
        # The current LAD is too recent, so it won't have a LAD16CD.
        return float('nan')
    return current_lad_cd


def uk_cities(
    data_folder: str = 'data',
    wards_filename: Optional[str] = None, geonames_filename: Optional[str] = None,
    geonames_admin_filename: Optional[str] = None,
    min_population: int = 100
) -> pandas.DataFrame:
    """
    Cities and towns in the UK.

    See go/bob-uk:places-to-lad

    Fields contain geonameid (can be used as unique ID), name, GOR10CD, CTRY16CD, CTRY16NM.
    """

    if not wards_filename:
        wards_filename = path.join(data_folder, 'uk/wards.csv')
    if not geonames_filename:
        geonames_filename = path.join(data_folder, 'uk/geonames.txt')
    if not geonames_admin_filename:
        geonames_admin_filename = path.join(data_folder, 'uk/geonames_admin.txt')

    local_authorities = pandas.read_csv(wards_filename)\
        .drop(['WD16NM', 'WD16CD'], axis=1).drop_duplicates(['LAD16NM', 'LAD16CD'])
    geonames_admin = _prepare_geonames_dataframe(geonames_admin_filename, min_population)
    geonames_cities = _prepare_geonames_dataframe(geonames_filename, min_population)
    geonames_admin['cleanName'] = geonames_admin.name\
        .str.replace(r' District$', '', regex=True)\
        .str.replace(r'^Royal ', '', regex=True)\
        .str.replace(
            r'^(City|County|District|Borough|Isle)( and (District|County|Borough))? of ',
            '', regex=True)\
        .str.replace(r'( (County|Borough))+$', '', flags=re.IGNORECASE, regex=True)\
        .str.replace(r'(\b|^)St\.', 'St', regex=True)\
        .str.replace(r'^The ', '', regex=True)
    local_authorities['cleanName'] = local_authorities.LAD16NM\
        .str.replace(r'(\b|^)St\.', 'St', regex=True)\
        .str.replace(r', C(i|oun)ty of$', '', regex=True)\
        .str.replace(r'^(City|Isle) of ', '', regex=True)

    geonames_admin['LAD16CD'] = geonames_admin.cleanName.map(
        local_authorities.set_index('cleanName').LAD16CD)
    geonames_admin['admin_code'] = float('nan')
    geonames_admin.loc[geonames_admin.feature_code == 'ADM3', 'admin_code'] = \
        geonames_admin.admin3_code
    geonames_admin.loc[geonames_admin.feature_code == 'ADM2', 'admin_code'] = \
        geonames_admin.admin2_code
    admin_to_lad = geonames_admin[
        geonames_admin.admin_code.notna() & geonames_admin.LAD16CD.notna()]\
        .set_index('admin_code').LAD16CD
    # Hand-matched LADs.
    admin_to_lad = admin_to_lad.combine_first(pandas.Series({
        'E7': 'E09000011',
        'W8': 'S12000013',
        'Q1': 'E08000015',
        'Y8': 'W06000023',
        'N09000002': 'N09000002',
        'N09000010': 'N09000010',
    }))

    geonames_cities['LAD16CD'] = float('nan')
    geonames_cities.loc[
        geonames_cities.admin3_code.isin(admin_to_lad.index), 'LAD16CD'
    ] = geonames_cities.admin3_code.map(admin_to_lad)
    geonames_cities.loc[
        geonames_cities.admin2_code.isin(admin_to_lad.index), 'LAD16CD'
    ] = geonames_cities.admin2_code.map(admin_to_lad)

    # Add Poole and Bournemouth by hand (their LADs got merged after 2016).
    geonames_cities.loc[geonames_cities.name == 'Poole', 'LAD16CD'] = 'E06000029'
    geonames_cities.loc[geonames_cities.name == 'Bournemouth', 'LAD16CD'] = 'E06000028'

    # Get missing LADs from coordinates and "Find your Postcode" API.
    missing_lad = geonames_cities[
        geonames_cities.LAD16CD.isna() & (geonames_cities.name != 'London')]
    geonames_cities.loc[missing_lad.index, 'LAD16CD'] = \
        missing_lad.apply(_get_lad_from_coords, axis=1)

    geonames_with_lads = geonames_cities.join(
        local_authorities.set_index('LAD16CD'), on='LAD16CD', how='inner')\
        .fillna('')

    # Adding London boroughs (Greater London Region is E12000007).
    london_boroughs = local_authorities[(local_authorities.GOR10CD == 'E12000007')]\
        .set_index('LAD16CD')\
        .drop(['cleanName'], axis=1)
    geonames_admin_boroughs = geonames_admin.join(
        london_boroughs, on='LAD16CD', how='inner').fillna('')

    return pandas.concat([geonames_with_lads, geonames_admin_boroughs])
