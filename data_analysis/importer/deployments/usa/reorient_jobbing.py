"""Importer for job data in MongoDB.

 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/deployments/usa/reorient_jobbing.py \
        --job_zones_tsv data/usa/onet_22_3/job_zones.tsv \
        --occupation_data_txt data/usa/onet_22_3/Occupation_Data.txt

TODO(émilie): Add this script to the USA scheduled tasks.

"""

import typing
from typing import Any, Optional

import pandas as pd

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import usa_cleaned_data

ONET_VERSION = '22_3'


def csv2dicts(
        job_zones_tsv: str,
        occupation_data_txt: str,
        market_scores_csv: Optional[str] = None) -> list[dict[str, Any]]:
    """Import reorient jobbing data per county in MongoDB."""

    # Get the jobs, filter for zone1 and clean the columns
    jobs = pd.read_csv(job_zones_tsv, sep='\t')
    jobs = jobs.loc[jobs['Job Zone'] == 1]
    jobs = jobs.rename(columns={'O*NET-SOC Code': 'job_group'})

    # Get occupation names
    occupation_names = pd.read_table(occupation_data_txt)

    # TODO(émilie): Move this logic of name giving into usa_cleaned_data.
    # Give jobs names
    jobs['name'] = jobs['job_group'].map(occupation_names.set_index('O*NET-SOC Code').Title)
    # TODO(émilie): Update for masculine/feminine the day we have a problem (it should not happen).

    # Clean columns
    jobs['job_group'] = jobs['job_group'].str[:7]
    jobs = jobs[['job_group', 'name']]

    # Get market score and keep only jobs that have at least a market score
    # (offers per 10 candidates) of 13, as described here:
    # https://github.com/bayesimpact/bob-emploi-internal/blob/HEAD/data_analysis/notebooks/datasets/usa/market_stress.ipynb
    # (13 is the median of the USA market scores)
    if not market_scores_csv:
        market_scores = usa_cleaned_data.usa_compute_market_score()
    else:
        market_scores = pd.read_csv(market_scores_csv)
    market_scores_filtered = market_scores[market_scores.market_score >= 13]

    # Extract the best jobbings by county
    best_jobbings = pd.merge(
        jobs, market_scores_filtered,
        on=['job_group'])[['job_group', 'district_id', 'name', 'market_score']]

    # TODO(émilie): Calculate offers.
    best_jobbings['offers'] = 0

    best_jobbings = best_jobbings.rename(columns={'job_group': 'rome_id'})

    def _create_job_groups(jobs: pd.DataFrame) -> Any:
        return jobs[['name', 'rome_id', 'offers', 'market_score']]\
            .to_dict(orient='records')[0]

    rome_district_job_groups = best_jobbings\
        .groupby(['district_id', 'rome_id', 'name', 'offers'])\
        .apply(_create_job_groups)\
        .to_frame('jobs')\
        .reset_index()\
        .rename(columns={'district_id': '_id'})

    def _create_jobbing_stats(jobs: pd.DataFrame) -> Any:
        return jobs.sort_values('offers', ascending=False)[['jobs']].head().to_dict(orient='list')

    jobbing_stats = rome_district_job_groups\
        .groupby('_id')\
        .apply(_create_jobbing_stats)\
        .to_frame('departementJobStats')\
        .reset_index()

    return typing.cast(list[dict[str, Any]], jobbing_stats.to_dict(orient='records'))


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'reorient_jobbing')
