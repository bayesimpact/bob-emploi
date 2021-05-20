"""Module to access to USA datasets already cleaned up.

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

from os import path
import typing
from typing import Optional

import pandas

_ONET_VERSION = '22_3'


_NEW_YORK_BOROUGHS = frozenset([
    '36061',  # Manhattan/New York County
    '36047',  # Brooklyn/Kings County
    '36081',  # Queens/Queens County
    '36005',  # The Bronx/Bronx County
    '36085',  # Staten Island/Richmond County
])

_NEW_YORK_AGG_COUNTY_ID = '36000'


def us_national_occupations(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """Script to parse occupational employment dataset provided by the US Bureau of Labor.

    Each row represents an occupation. Columns are:
    - the SOC code (occ_code). Every level of the SOC occupations are provided,
    - the level of the SOC code (o_group, major: e.g. 11-0000, minor: 11-1000, broad: 11-1010 and
    detailed: 11-1011), Note that some groups are both broad and detailed (11-2030): for those there
    are duplicate rows.
    - and the number of employees (tot_emp).
    """

    if not filename:
        filename = path.join(data_folder, 'usa/occupational_employment_national_statistics.xlsx')
    occupations = pandas.read_excel(filename, engine='openpyxl')
    return occupations[['occ_code', 'o_group', 'tot_emp']]


def us_soc2010_job_groups(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """A list of all job groups (SOC unit groups) in US SOC2010 with their names and descriptions.

    A dataframe with three columns "name", "description" and "romeId" is returned,
    the index is the SOC code (e.g. '11-1011').
    Each row represents a job group clustering multiple professions.
    """

    if not filename:
        filename = path.join(data_folder, 'usa/soc/soc_2010_definitions.xls')

    job_groups = pandas.read_excel(filename, skiprows=6)
    job_groups = job_groups.rename(
        {
            'SOC Code': 'romeId',
            'SOC Definition': 'description',
            'SOC Title': 'name',
        },
        axis='columns',
    )
    job_groups.name = job_groups.name.str.strip()
    job_groups.description = job_groups.description.str.strip()

    job_groups.set_index('romeId', drop=False, inplace=True)

    return job_groups[['name', 'description', 'romeId']]


def us_soc2018_job_groups(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """A list of all job groups (SOC unit groups) in US SOC2018 with their names and descriptions.

    A dataframe with three columns "name", "description" and "romeId" is returned,
    the index is the SOC code (e.g. '11-1011').
    Each row represents a job group clustering multiple professions.
    """

    if not filename:
        filename = path.join(data_folder, 'usa/soc/soc2018_definition.csv')

    job_groups = pandas.read_table(filename, sep=',')
    job_groups = job_groups.rename(
        {
            'O*NET-SOC 2019 Code': 'jobGroupId',
            'O*NET-SOC 2019 Description': 'description',
            'O*NET-SOC 2019 Title': 'name',
        },
        axis='columns',
    )

    job_groups['romeId'] = job_groups['jobGroupId'].str[:-3]
    job_groups = job_groups[job_groups['jobGroupId'].str[-3:] == '.00']
    job_groups.set_index('romeId', drop=False, inplace=True)

    return job_groups[['name', 'description', 'romeId']]


def usa_soc2010_career_changes(
        data_folder: str = 'data',
        filename: Optional[str] = None) -> pandas.DataFrame:
    """A list of adjacent job groups based on the SOC2010 classification.

    A dataframe with two columns "job_group" and "target_job_group".
    Each row represents a jump between two job groups.
    """

    if not filename:
        filename = path.join(
            data_folder, f'usa/onet_{_ONET_VERSION}/Career_Changers_Matrix.txt')

    career_jumps = pandas.read_csv(filename, delimiter='\t')
    career_jumps['job_group'] = career_jumps['O*NET-SOC Code'].str[:7]
    career_jumps['target_job_group'] = career_jumps['Related O*NET-SOC Code'].str[:7]

    return career_jumps[['job_group', 'target_job_group']].drop_duplicates()


def usa_soc2018_career_changes(
        data_folder: str = 'data',
        career_changes_filename: Optional[str] = None,
        crosswalk_filename: Optional[str] = None) -> pandas.DataFrame:
    """A list of adjacent job groups based on the SOC2018 classification.

    A dataframe with two columns "job_group" and "target_job_group".
    Each row represents a jump between two job groups.
    """

    if not career_changes_filename:
        career_changes_filename = path.join(
            data_folder, f'usa/onet_{_ONET_VERSION}/Career_Changers_Matrix.txt')
    if not crosswalk_filename:
        crosswalk_filename = path.join(data_folder, 'usa/soc/2010_to_2018_SOC_Crosswalk.csv')

    career_jumps = pandas.read_csv(career_changes_filename, delimiter='\t').rename(columns={
        'O*NET-SOC Code': 'job_group_2010', 'Related O*NET-SOC Code': 'target_job_group_2010'})

    crosswalk = pandas.read_csv(crosswalk_filename, delimiter=',') \
        .rename(
            columns={'O*NET-SOC 2010 Code': 'job_group_2010', '2018 SOC Code': 'job_group_2018'}) \
        .drop(['O*NET-SOC 2010 Title', '2018 SOC Title'], axis='columns')

    career_jumps_jg2018 = career_jumps.join(
        crosswalk.set_index('job_group_2010'), on='job_group_2010')[[
            'job_group_2010', 'target_job_group_2010', 'job_group_2018']]
    career_jumps_2018 = career_jumps_jg2018.join(
        crosswalk.set_index('job_group_2010'), on='target_job_group_2010', rsuffix='_target')

    return career_jumps_2018[['job_group_2018', 'job_group_2018_target']] \
        .drop_duplicates().rename(
            columns={'job_group_2018': 'job_group', 'job_group_2018_target': 'target_job_group'})


def _get_data_col_name(dataframe: pandas.DataFrame) -> str:
    remaining_col_names = set(dataframe.columns) - set(['Area', 'Occupation'])
    if len(remaining_col_names) > 1:
        raise ValueError(
            'Incorrect dataset format: your dataset has more than 3 columns: ' +
            f'{", ".join(set(dataframe.columns))}.')
    col_name = remaining_col_names.pop()
    if 'Hires' not in col_name and 'TwelveMonthAverage' not in col_name:
        raise ValueError(
            f'Incorrect dataset: your column name: {col_name}' +
            'should have either "Hires" or "TwelveMonthAverage" in it.')
    return typing.cast(str, col_name)


def _compute_aggregated_market_score(market_score: pandas.DataFrame) -> pandas.DataFrame:
    new_york_boroughs = market_score[market_score.Area.isin(_NEW_YORK_BOROUGHS)]
    new_york_mean = new_york_boroughs.groupby('Occupation')['vacancies'].mean().to_frame(
        'vacancies')
    new_york_mean['annual_num_job_seekers'] = new_york_boroughs.groupby('Occupation')[
        'annual_num_job_seekers'].mean()
    new_york_mean['market_score'] = new_york_mean.vacancies.div(
        new_york_mean['annual_num_job_seekers']).mul(10).round(0)
    return new_york_mean


def _usa_compute_raw_market_score(
        openings: pandas.DataFrame,
        job_seekers: pandas.DataFrame) -> pandas.DataFrame:

    job_seekers_col_name = _get_data_col_name(job_seekers)
    vacancy_col_name = _get_data_col_name(openings)

    openings['market'] = openings.Area.str.cat(openings.Occupation, sep=':')
    job_seekers['market'] = job_seekers.Area.str.cat(job_seekers.Occupation, sep=':')

    market_score = openings.copy()
    market_score.rename(columns={vacancy_col_name: 'vacancies'}, inplace=True)
    market_score['monthly_num_job_seekers'] = market_score.market.map(
        job_seekers.set_index('market')[job_seekers_col_name].squeeze())
    market_score['annual_num_job_seekers'] = market_score['monthly_num_job_seekers'].mul(12)
    market_score['market_score'] = market_score.vacancies.squeeze().div(
        market_score['annual_num_job_seekers']).mul(10).round(0)
    market_score_ny = _compute_aggregated_market_score(market_score)
    market_score_ny['Area'] = _NEW_YORK_AGG_COUNTY_ID
    return pandas.concat([market_score, market_score_ny.reset_index()])


def usa_compute_market_score(
        hires_csv: Optional[str] = None,
        job_seekers_csv: Optional[str] = None,
        data_folder: str = 'data',
        job_groups: Optional[pandas.DataFrame] = None) -> pandas.DataFrame:
    """Compute the market score for each local market."""

    if isinstance(job_groups, pandas.DataFrame):
        job_groups = job_groups.copy()
    else:
        job_groups = us_soc2018_job_groups(data_folder)

    job_groups['major_job_group_prefix'] = job_groups.romeId.str[:2]
    job_groups['major_job_group'] = job_groups.major_job_group_prefix + '-0000'

    hires_csv_filename = hires_csv or path.join(data_folder, 'usa/emsi_hires.csv')
    openings = pandas.read_csv(hires_csv_filename, dtype={'Area': str, 'Occupation': str})
    job_seekers_csv_filename = job_seekers_csv or \
        path.join(data_folder, 'usa/emsi_job_seekers_counts_dec_2019.csv')
    job_seekers = pandas.read_csv(job_seekers_csv_filename, dtype={'Area': str, 'Occupation': str})

    market_score = _usa_compute_raw_market_score(openings, job_seekers)
    market_score_by_job_group = market_score.\
        rename({'Area': 'district_id'}, axis='columns').\
        join(job_groups.set_index('major_job_group'), on='Occupation')
    market_score_by_job_group['local_id'] = market_score_by_job_group.district_id.str.cat(
        market_score_by_job_group.romeId, sep=':')

    # A bit of cleaning.
    market_score_by_job_group.dropna(subset=['local_id'], inplace=True)
    market_score_by_job_group.drop_duplicates(subset=['local_id'], inplace=True)

    # TODO(cyrille): Handle missing data and 0-valued data as expected by the proto.
    market_score_by_job_group.rename(columns={'romeId': 'job_group'}, inplace=True)

    return market_score_by_job_group[['market_score', 'job_group', 'district_id', 'local_id']]


def us_soc2010_isco08_mapping(
        data_folder: str = 'data', filename: Optional[str] = None) -> pandas.DataFrame:
    """Mapping from US Bureau of Labor Stats's SOC 2010 occupation groups to ISCO 08 codes.

    The index are the 6-digits SOC codes and the only column "isco08_code" is the corresponding
    ISCO code. Note that some SOC codes are mapped to several ISCO codes, and that some ISCO codes
    are mapped from several SOC codes.
    """

    if not filename:
        filename = path.join(data_folder, 'crosswalks/isco_us_soc2010_crosswalk.xls')
    mapping = pandas.read_excel(filename, sheet_name='2010 SOC to ISCO-08', dtype='str', skiprows=6)
    mapping.rename(
        {'2010 SOC Code': 'us_soc2010', 'ISCO-08 Code': 'isco08_code'},
        axis='columns', inplace=True)
    mapping['us_soc2010'] = mapping.us_soc2010.str.strip()
    mapping['isco08_code'] = mapping.isco08_code.str.strip()
    return mapping.set_index('us_soc2010')[['isco08_code']]


def us_automation_brookings(
        data_folder: str = 'data', filename: Optional[str] = None,
        soc_filename: Optional[str] = None) -> pandas.DataFrame:
    """Automation risk by Brookings 2019.

    The index are the 6-digits SOC 2010 codes and the only column "automation_risk" is the
    corresponding automation risk value between 0 and 1.

    See notebook in data_analysis/notebooks/datasets/usa/automation_risk_per_occupation.ipynb
    """

    if not filename:
        filename = path.join(data_folder, 'usa/automation-risk.json')
    brookings_2019 = pandas.read_json(filename)
    brookings_2019.rename({'auto': 'automation_risk'}, axis='columns', inplace=True)

    # Map names to O*Net SOC 2010 codes.
    soc_2010 = us_soc2010_job_groups(data_folder, filename=soc_filename)
    soc_2010_by_name = soc_2010.set_index('name').romeId
    brookings_2019['soccode'] = brookings_2019.occ.map(soc_2010_by_name)

    # Fixes.
    brookings_2019_soc_2010_fixes = {
        'Electrical and Electronics Engineering Technicians': '17-3023',
        'Postsecondary Teachers': '25-1000',
        'Door-to-Door Sales Workers, News and Street Vendors, and Related Workers': '41-9091',
        'Radio, Cellular, and Tower Equipment Installers and Repairs': '49-2021',
    }
    brookings_2019['soc_2010'] = brookings_2019.occ.map(brookings_2019_soc_2010_fixes)\
        .combine_first(brookings_2019.soccode)

    # Expand the 25-1000 group (teachers).
    teachers_risk = brookings_2019.loc[brookings_2019.soc_2010 == '25-1000', 'automation_risk']\
        .iloc[0]
    teachers_soc_code = soc_2010_by_name[soc_2010_by_name.str[:4] == '25-1']
    brookings_2019 = brookings_2019.append(pandas.DataFrame({
        'automation_risk': teachers_risk,
        'soc_2010': teachers_soc_code,
    }))
    brookings_2019 = brookings_2019[brookings_2019.soc_2010 != '25-1000']\
        .dropna(subset=['soc_2010', 'automation_risk'])
    return brookings_2019.set_index('soc_2010')[['automation_risk']]
