"""Module to upload the number of unemployed people per occupation and local authority from Emsi.

To run it, you need job seekers numbers and openings dataset from Emsi.

docker-compose run --rm -e MONGO_URL=<the UK MONGO URL> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/deployments/uk/local_diagnosis.py
"""

import locale
import math
import typing
from typing import Any, Iterable, Iterator, Literal, Union

import numpy
import pandas as pd

from bob_emploi.data_analysis.lib import job_airtable
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data
from bob_emploi.frontend.api import job_pb2

# Third quartile for the distribution of (#postings / unique postings) * (median_posting_duration)
_MEDIAN_TOTAL_POSTING_DURATION_THIRD_QUARTILE = 111


@typing.overload
def _prepare_emsi_csv(filename: str) -> pd.DataFrame:
    ...


@typing.overload
def _prepare_emsi_csv(filename: str, *, is_single_col: Literal[True]) -> pd.Series:
    ...


def _prepare_emsi_csv(filename: str, *, is_single_col: bool = False) \
        -> Union[pd.Series, pd.DataFrame]:
    raw_emsi = pd.read_csv(filename, dtype={'Area': str, 'Occupation': str})
    indexed = raw_emsi.set_index(['Occupation', 'Area'])
    if is_single_col:
        return indexed.squeeze()
    return indexed


def compute_market_score(
        *,
        postings_csv: str = 'data/uk/emsi_postings_counts_2019_area4-occ4.csv',
        occupations_csv: str = 'data/uk/emsi_occupation_counts_2019_area4-occ4.csv') \
        -> pd.DataFrame:
    """Compute the market score for each local market.

    EMSI data should be at occupation level 4 (4-digits SOC).
    """

    postings = _prepare_emsi_csv(postings_csv)
    occupations = _prepare_emsi_csv(occupations_csv, is_single_col=True).rename('occupations')
    postings = postings.join(occupations)
    demand_tension = postings.Unique_postings.div(postings.occupations)

    # "Recover" jobs with low demand tension according to the above,
    #   but high demand, according to uptime for postings.
    # The decided limit for bad demand tension is 10% (see below).
    median_total_posting_duration = postings.Duplicate_postings.\
        div(postings.Unique_postings).\
        mul(postings.Median_posting_duration)
    demand_tension.loc[
        (median_total_posting_duration > _MEDIAN_TOTAL_POSTING_DURATION_THIRD_QUARTILE) &
        (demand_tension < .1)] = .1

    # TODO(sil): Make a proper notebook about EMSI data quality.
    # TODO(cyrille): Make a proper notebook about demand tension.
    # Market tension cannot be computed with confidence from EMSI data,
    # since job seekers count proxy (claimants) is not of good enough quality.
    # We decide to use demand tension instead,
    # ie the ratio of entrances in the market (in-flux, represented by postings)
    # to the size of the market (stock, represented by occupations).
    # We more or less arbitrarly choose 10% demand tension to be the limit for stuck-market,
    # so we make it match market_score = 4.
    market_score_by_job_group = demand_tension[postings.Unique_postings >= 6]\
        .mul(40).apply(numpy.floor).to_frame('market_score').reset_index()
    market_score_by_job_group['local_id'] = market_score_by_job_group.Area.str.cat(
        market_score_by_job_group.Occupation, sep=':')

    # A bit of cleaning.
    market_score_by_job_group.dropna(subset=['local_id'], inplace=True)
    market_score_by_job_group.drop_duplicates(subset=['local_id'], inplace=True)
    market_score_by_job_group.loc[market_score_by_job_group.market_score == 0, 'market_score'] = -1
    market_score_by_job_group.market_score.fillna(0, inplace=True)

    market_score_by_job_group = market_score_by_job_group.rename(
        columns={'Area': 'district_id', 'Occupation': 'job_group'})

    return market_score_by_job_group[['market_score', 'job_group', 'district_id', 'local_id']]


# TODO(sil): DRY this.
def _isnan(value: Any) -> bool:
    """Check whether a Python value is numpy's NaN."""

    return isinstance(value, float) and math.isnan(value)


def _get_single_salary_detail(salary: pd.Series) -> dict[str, Any]:
    if _isnan(salary.Median_salary):
        return {}
    median_salary_text = locale.format_string('%d', salary.Median_salary, grouping=True)
    short_text = f'Around £{median_salary_text}'
    return {
        'medianSalary': salary.Median_salary,
        'shortText': short_text,
        'unit': job_pb2.SalaryUnit.Name(job_pb2.ANNUAL_GROSS_SALARY),
    }


def _get_salaries(
    salary_filename: str = 'data/uk/salaries_by_region_2020_xlsx',
    wards_ons_csv: str = 'data/uk/wards_ons_csv',
    geonames_txt: str = 'data/uk/geonames_txt',
    geonames_admin_txt: str = 'data/uk/geonames_admin_txt'
) -> pd.DataFrame:

    salaries = uk_cleaned_data.get_salaries(
        salary_filename=salary_filename,
        wards_ons_csv=wards_ons_csv,
        geonames_txt=geonames_txt,
        geonames_admin_txt=geonames_admin_txt).reset_index()
    salaries['local_id'] = salaries.Area.str.cat(
        salaries.Code, sep=':')
    salaries['salary'] = salaries.apply(_get_single_salary_detail, axis='columns')

    return salaries[['salary', 'local_id']]


def load_prefixed_info_from_airtable(
        job_groups: Iterable[str], info_by_prefix_airtable: str) -> pd.DataFrame:
    """Load prefixed info from Airtable per job group.s"""

    return job_airtable.load_prefixed_info(
        job_groups, info_by_prefix_airtable, job_group_id_field='soc_prefix',
        columns={
            'covidRisk': 0,
        })


def csv2dicts(
        *,
        postings_csv: str,
        occupations_csv: str,
        jobs_xls: str,
        career_jumps_csv: str,
        info_by_prefix_airtable: str,
        salary_filename: str,
        wards_ons_csv: str,
        geonames_txt: str,
        geonames_admin_txt: str) \
        -> Iterator[dict[str, Any]]:
    """Compute market stress from unemployed and openings dataset."""

    locale.setlocale(locale.LC_ALL, 'en_GB.UTF-8')

    local_stats = compute_market_score(
        postings_csv=postings_csv, occupations_csv=occupations_csv)
    salaries = _get_salaries(
        salary_filename=salary_filename,
        wards_ons_csv=wards_ons_csv,
        geonames_txt=geonames_txt,
        geonames_admin_txt=geonames_admin_txt)
    career_jumps = pd.read_csv(career_jumps_csv, dtype='str')
    job_group_names = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls).squeeze()

    # Drop covid risky jobs.
    job_group_info = load_prefixed_info_from_airtable(
        job_group_names.index, info_by_prefix_airtable)
    safe_career_jumps = career_jumps[
        career_jumps.target_job_group.map(job_group_info.covidRisk) != 'COVID_RISKY']

    yield from market_score_derivatives.local_diagnosis(
        local_stats, safe_career_jumps, salaries, job_group_names=job_group_names.to_dict())


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'local_diagnosis', count_estimate=143495)
