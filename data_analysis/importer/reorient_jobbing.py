"""Importer for monthly job data in MongoDB.

The data will be imported into the `reorient_jobbing` collection.

The data from this importer is indexed by departement ID.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up -d frontend-dev`.
 - Create a CSV file with job offers for the last 2 years
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/misc/job_offers_trim.py \
        data/job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_17JANV2017_FGU.csv \
        data/job_offers/column_names.txt \
        data/job_offers/reorient_jobbing_offers_2015_2017.csv \
        2015-01-01 \
        rome_profession_name,rome_profession_code,rome_profession_card_name,\
        rome_profession_card_code,creation_date,departement_code
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/reorient_jobbing.py \
        --market_score_csv data/imt/market_score.csv \
        --offers_csv reorient_jobbing_offers_2015_2017.csv \
        --rome_item_arborescence data/rome/csv/unix_item_arborescence_v337_utf8.csv \
        --referentiel_code_rome_csv data/rome/csv/unix_referentiel_code_rome_v337_utf8.csv \
        --referentiel_apellation_rome_csv data/rome/csv/unix_referentiel_appellation_v337_utf8.csv \
        --mongo_url mongodb://frontend-db/test
"""

import pandas as pd

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import rome_genderization
from bob_emploi.data_analysis.lib import mongo

# The minimal number of job offers (out of two years)
# to consider to recommend a job.
_MIN_JOB_OFFERS = 50


def csv2dicts(
        market_score_csv, offers_csv, referentiel_code_rome_csv, rome_item_arborescence,
        referentiel_apellation_rome_csv):
    """Import reorient jobbing data per month per departement in MongoDB.

    Args:
        market_score_csv: path to a CSV file containing the market stress data.
        offers_csv: path to a CSV file containing the job offer data.
        rome_item_arborescence: path to a CSV file containing ROME item arborescence.
        referentiel_code_rome_csv: path to a CSV file containing job groups.
    """

    # Get number of job offers in the last 2 years.
    jobs = cleaned_data.rome_jobs(filename=referentiel_apellation_rome_csv)
    jobs.index.name = 'codeOgr'
    masculine_job_names, feminine_job_names = (rome_genderization.genderize(jobs.name))
    jobs['masculineName'] = masculine_job_names
    jobs['feminineName'] = feminine_job_names
    job_offers = pd.read_csv(offers_csv, dtype={'departement_code': str})
    job_offers.rename(columns={
        'rome_profession_card_code': 'rome_id',
        'departement_code': 'departement_id',
    }, inplace=True)

    # Strip job names.
    job_offers['codeOgr'] = job_offers.rome_profession_code.apply(lambda code: str(int(code)))
    job_offers['name'] = job_offers.codeOgr.map(jobs.name)
    job_offers['masculineName'] = job_offers.codeOgr.map(jobs['masculineName'])
    job_offers['feminineName'] = job_offers.codeOgr.map(jobs['feminineName'])

    # Trimming offers after the first january 2017 to have exactly 2 years of data.
    job_offers = job_offers[job_offers.creation_date < '2017-01-01']

    # Get the number of job offers per job and per departement.
    job_offers_per_dep = job_offers.groupby(
        ['name', 'masculineName', 'feminineName', 'departement_id', 'rome_id'])\
        .size()\
        .to_frame('offers')\
        .reset_index()\
        .sort_values(by=['offers'], ascending=False)

    # Inside each job group only get the job with the most offers to give at least
    # one concrete example to the user.
    # TODO(marielaure): Check if we could benefit from proposing more than one job
    # name.
    best_job_in_group = job_offers_per_dep.groupby(['rome_id', 'departement_id'])\
        .first()\
        .reset_index()

    # Get market score and keep only jobs that have at least a market score
    # (offers per 10 candidates) of 4, as described here:
    # https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/research/reorientation/reorient_market_stress_skilless.ipynb
    market_score = pd.read_csv(market_score_csv, dtype={'AREA_CODE': str})
    market_score.rename(columns={
        'AREA_CODE': 'departement_id',
        'ROME_PROFESSION_CARD_CODE': 'rome_id',
    }, inplace=True)
    market_score_filtered = market_score[market_score.TENSION_RATIO >= 4]

    # Compute jobs without qualification.
    job_groups = pd.read_csv(referentiel_code_rome_csv)
    rome_item_arborescence = pd.read_csv(rome_item_arborescence)
    # The strrategy for filtering jobs without qualification is described here:
    # https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/research/jobbing/seasonal_offers.ipynb
    unqualification_jobs_index = '017'
    first_level = rome_item_arborescence[
        rome_item_arborescence.code_pere == unqualification_jobs_index]
    second_level = rome_item_arborescence[
        rome_item_arborescence.code_pere.isin(first_level.code_noeud)]
    job_groups_arborescence = pd.merge(
        second_level, job_groups, left_on=['code_item_arbo_associe'], right_on=['code_ogr'])
    job_groups_arborescence.rename(columns={'code_rome': 'rome_id'}, inplace=True)
    no_qualification_jobs = job_groups_arborescence[['rome_id', 'libelle_rome']]
    no_qualification_jobs_market = pd.merge(
        no_qualification_jobs, market_score_filtered, on='rome_id')

    departement_rome_market = no_qualification_jobs_market[
        no_qualification_jobs_market.AREA_TYPE_NAME == 'Département']
    rome_dep_with_best_job = pd.merge(
        best_job_in_group, departement_rome_market, on=['rome_id', 'departement_id'])[[
            'rome_id', 'departement_id', 'masculineName', 'feminineName', 'offers',
            'name', 'TENSION_RATIO']]

    # Filter best jobs without qualification that have at least 50 offers out of the last
    # 2 years.
    rome_dep_with_best_job = rome_dep_with_best_job[
        rome_dep_with_best_job.offers > _MIN_JOB_OFFERS]\
        .rename(columns={'TENSION_RATIO': 'market_score'})

    def _create_job_groups(jobs):
        return jobs[['name', 'masculineName', 'feminineName', 'rome_id', 'offers', 'market_score']]\
            .to_dict(orient='records')[0]

    rome_dep_job_groups = rome_dep_with_best_job\
        .groupby(['departement_id', 'rome_id', 'name', 'masculineName', 'feminineName', 'offers'])\
        .apply(_create_job_groups)\
        .to_frame('jobs')\
        .reset_index()\
        .rename(columns={'departement_id': '_id'})

    def _create_jobbing_stats(jobs):
        return jobs.sort_values('offers', ascending=False)[['jobs']].head().to_dict(orient='list')

    jobbing_stats = rome_dep_job_groups\
        .groupby('_id')\
        .apply(_create_jobbing_stats)\
        .to_frame('departementJobStats')\
        .reset_index()

    return jobbing_stats.to_dict(orient='records')


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'reorient_jobbing')
