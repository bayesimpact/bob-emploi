"""Importer for # of job offers available.

This script contacts Emploi Store Dev then uploads to MongoDB the numbers of
open job offers per job group and per département.

It takes a bit more than 8 minutes to run.

To use this script you first have to create a `client_id` and a `client_secret`
for an [Emploi Store app](https://www.emploi-store-dev.fr). When you have these
access credentials, set the environment variables EMPLOI_STORE_CLIENT_ID and
EMPLOI_STORE_CLIENT_SECRET with them.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/recent_job_offers_count.py \
        --mongo_url mongodb://frontend-db/test
"""

import collections
import os

import emploi_store
import tqdm

from bob_emploi.data_analysis.lib import mongo


def download_and_count(file=None):
    """Import the # of job offers available per job group and dept in MongoDB.

    Returns:
        Recent job offers count as a LocalJobStats JSON-proto compatible dict.
    """

    counts = collections.defaultdict(int)
    for job_offer in tqdm.tqdm(_iterate_job_offers(), file=file):
        local_id = '{}:{}'.format(
            job_offer['DEPARTEMENT_CODE'],
            job_offer['ROME_PROFESSION_CARD_CODE'])
        counts[local_id] += 1
    return [
        {'_id': local_id, 'numAvailableJobOffers': count}
        for local_id, count in counts.items()]


def _iterate_job_offers():
    client = emploi_store.Client(
        client_id=os.getenv('EMPLOI_STORE_CLIENT_ID'),
        client_secret=os.getenv('EMPLOI_STORE_CLIENT_SECRET'))
    package = client.get_package('offres')
    resource = package.get_resource(name="Offres d'emploi")
    return resource.records(fields=[
        'DEPARTEMENT_CODE', 'ROME_PROFESSION_CARD_CODE'])


if __name__ == '__main__':
    mongo.importer_main(download_and_count, 'recent_job_offers')
