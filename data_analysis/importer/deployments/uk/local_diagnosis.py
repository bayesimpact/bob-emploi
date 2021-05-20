"""Module to upload the number of unemployed people per occupation and local authority from Emsi.

To run it, you need job seekers numbers and openings dataset from Emsi.

docker-compose run --rm -e MONGO_URL=<the UK MONGO URL> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/deployments/uk/local_diagnosis.py
"""

from typing import Any, Dict, Iterable, Iterator

import numpy
import pandas as pd

from bob_emploi.data_analysis.lib import job_airtable
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data


def _prepare_emsi_csv(filename: str) -> pd.Series:
    raw_emsi = pd.read_csv(filename, dtype={'Area': str, 'Occupation': str})
    return raw_emsi.set_index(['Occupation', 'Area']).squeeze()


def compute_market_score(
        *,
        postings_csv: str = 'data/uk/emsi_postings_counts_2019_area4-occ4.csv',
        occupations_csv: str = 'data/uk/emsi_occupation_counts_2019_area4-occ4.csv') \
        -> pd.DataFrame:
    """Compute the market score for each local market.

    EMSI data should be at occupation level 4 (4-digits SOC).
    """

    postings = _prepare_emsi_csv(postings_csv)
    occupations = _prepare_emsi_csv(occupations_csv)
    demand_tension = postings.div(occupations)

    # TODO(sil): Make a proper notebook about EMSI data quality.
    # TODO(cyrille): Make a proper notebook about demand tension.
    # Market tension cannot be computed with confidence from EMSI data,
    # since job seekers count proxy (claimants) is not of good enough quality.
    # We decide to use demand tension instead,
    # ie the ratio of entrances in the market (in-flux, represented by postings)
    # to the size of the market (stock, represented by occupations).
    # We more or less arbitrarly choose 10% demand tension to be the limit for stuck-market,
    # so we make it match market_score = 4.
    market_score_by_job_group = demand_tension.mul(40).apply(numpy.floor)\
        .to_frame('market_score').reset_index()
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
        info_by_prefix_airtable: str) \
        -> Iterator[Dict[str, Any]]:
    """Compute market stress from unemployed and openings dataset."""

    local_stats = compute_market_score(
        postings_csv=postings_csv, occupations_csv=occupations_csv)
    career_jumps = pd.read_csv(career_jumps_csv, dtype='str')
    job_group_names = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls).squeeze()

    # Drop covid risky jobs.
    job_group_info = load_prefixed_info_from_airtable(
        job_group_names.index, info_by_prefix_airtable)
    safe_career_jumps = career_jumps[
        career_jumps.target_job_group.map(job_group_info.covidRisk) != 'COVID_RISKY']

    yield from market_score_derivatives.local_diagnosis(
        local_stats, safe_career_jumps, job_group_names=job_group_names.to_dict())


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'local_diagnosis', count_estimate=143495)
