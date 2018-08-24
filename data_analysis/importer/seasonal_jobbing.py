"""Importer for monthly job data in MongoDB.

The data will be imported into the `seasonal_jobbing` collection.

The data from this importer is indexed by month and
contains seasonal job offer data for each departement id.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/seasonal_jobbing.py \
        --offer_types_csv data/job_offers/offer_types_2015_2017.csv \
        --mongo_url mongodb://frontend-db/test
"""

import pandas as pd

from bob_emploi.data_analysis.lib import mongo

# The code used by pole emploi to describe seasonal jobs.
_SEASONAL_CODE = 'SAI'


def csv2dicts(offer_types_csv):
    """Import seasonal jobbing data per month per departement in MongoDB.

    Args:
        offer_types_csv: path to a CSV file containing the offer data, that may or may not be
                         already filtered for seasonal jobs.
    """

    job_offers = pd.read_csv(offer_types_csv, dtype=str)
    job_offers.rename(columns={
        'rome_profession_card_code': 'romeId',
        'rome_profession_card_name': 'name',
        'departement_code': 'departementId',
    }, inplace=True)

    # Trimming offers after the first january 2017 to have exactly 2 years of data.
    job_offers = job_offers[job_offers.creation_date < '2017-01-01']

    job_offers['creationMonth'] = job_offers.creation_date.apply(lambda x: int(x.split('-')[1]))
    job_offers['name'] = job_offers.name.apply(lambda x: x.strip())

    raw_seasonal_offers = job_offers[job_offers.contract_type_code == _SEASONAL_CODE]

    # Computing the list of job groups per departement-month.
    seasonal_offers = raw_seasonal_offers\
        .groupby(['departementId', 'creationMonth', 'romeId', 'name'])\
        .size()\
        .to_frame('offers')\
        .reset_index()\
        .sort_values(by=['offers'], ascending=False)

    total_offers_per_dep_month = raw_seasonal_offers\
        .groupby(['departementId', 'creationMonth'])\
        .apply(lambda offers: pd.Series({'departementSeasonalOffers': len(offers)}))

    offers_per_dep_month = seasonal_offers\
        .join(total_offers_per_dep_month, on=['departementId', 'creationMonth'])

    # Filter departements on having more than 750 job offers per month.
    top_departements_per_month = \
        offers_per_dep_month[offers_per_dep_month.departementSeasonalOffers > 750]\
        .reset_index()

    # Filter Job Groups on having more than 10 offers per departement month.
    top_departements_per_month = \
        top_departements_per_month[top_departements_per_month.offers > 10]

    # Adding the job groups inside.
    def _create_jobgroups(jobs):
        return jobs[['name', 'romeId', 'offers']].to_dict(orient='records')

    romes_per_dep_month = top_departements_per_month.groupby(
        ['departementId', 'creationMonth', 'departementSeasonalOffers'])\
        .apply(_create_jobgroups)\
        .to_frame('jobGroups')\
        .reset_index()\
        .rename(columns={'creationMonth': '_id'})

    def _create_month_stats(jobs):
        return jobs[['departementId', 'jobGroups', 'departementSeasonalOffers']]\
            .to_dict(orient='records')

    monthly_data = romes_per_dep_month\
        .groupby('_id')\
        .apply(_create_month_stats)\
        .to_frame('departementStats')\
        .reset_index()

    return monthly_data.to_dict(orient='records')


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'seasonal_jobbing')  # pragma: no cover
