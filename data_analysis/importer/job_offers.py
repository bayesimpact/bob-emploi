"""Importer for job_offers data mapped to ROME jobs to MongoDB.

Check the datasets/job_postings.ipynb for more details.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-db`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/job_offers.py \
        --job_offers_csv job_offers/sample_10perc.csv \
        --mongo_url mongodb://frontend-db/test
"""

import pandas as pd

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import cleaned_data


def csv2dicts(job_offers_csv, colnames_csv=None):
    """Import the job offers data in MongoDB.

    We only count job offers of the last 30 days of the currently available
    dataset.

    Args:
        job_offers_csv: Path of the csv containing the data.
    Returns:
        Count job offers per ROME and geographical levels.
    """

    res = []
    offers = cleaned_data.job_offers(
        filename_offers=job_offers_csv, filename_colnames=colnames_csv)
    # Fix data to make sure every `_code` only has one `_name`.
    offers.loc[offers.departement_code == '988', 'departement_name'] = 'Nouvelle-Calédonie'

    # WARNING: This could cause trouble in case our dataset has an outlier.
    thirty_days_ago = offers.creation_date.max() - pd.Timedelta(days=30)
    recent_offers = offers[thirty_days_ago <= offers.creation_date]
    group_cols = [
        'rome_id', 'city_code', 'departement_code', 'region_code',
        'city_name', 'departement_name', 'region_name',
    ]
    city_count = recent_offers.groupby(group_cols).id_offre.count()
    city_count.name = 'city_count'
    city_count = city_count.reset_index()

    # Compute departement counts for each city.
    group_cols = ['rome_id', 'departement_code']
    departement_count = recent_offers.groupby(group_cols).id_offre.count()
    by_departement = city_count.set_index(group_cols)
    by_departement['departement_count'] = departement_count
    city_count = by_departement.reset_index()

    # Compute region counts for each city.
    group_cols = ['rome_id', 'region_code']
    region_count = recent_offers.groupby(group_cols).id_offre.count()
    by_region = city_count.set_index(group_cols)
    by_region['region_count'] = region_count
    city_count = by_region.reset_index()

    # Compute country counts for each city.
    country_count = recent_offers.groupby('rome_id').id_offre.count()
    by_country = city_count.set_index('rome_id')
    by_country['country_count'] = country_count
    city_count = by_country.reset_index()

    for row in city_count.itertuples():
        res.append({
            '_id': row.rome_id + ':c' + row.city_code,
            'city': {
                'cityId': row.city_code,
                'name': row.city_name,
                'departementId': row.departement_code,
                'departementName': row.departement_name,
                'regionId': row.region_code,
                'regionName': row.region_name,
            },
            'cityCount': int(row.city_count),
            'departementCount': int(row.departement_count),
            'regionCount': int(row.region_count),
            'countryCount': int(row.country_count),
        })
    return res


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'job_offers')
