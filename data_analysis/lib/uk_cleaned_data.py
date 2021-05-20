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

from os import path
from typing import Literal, Optional

import numpy
import pandas


_SOC_LEVEL = Literal[  # pylint: disable=invalid-name
    'Major_Group', 'Sub_Major_Group', 'Minor_Group', 'Unit_Group']


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
