"""Precomputation for changes of # of job offers.

NOTE: This script is not an importer!

This script gathers information from job offers into a JSON file that is then
combined with other results and uploaded to MongoDB. It computes the changes in
the past year per job group and per département.

It does not use pandas as we want to be able to swallow a very large file (13
Gb) that would not fit in memory. To do that we compute data on the fly.

You can try it out on a local instance if you have a job offers file:
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/importer/job_offers_changes.py \
        --job_offers_csv data/job_offers/sample_10perc.csv \
        --colnames_txt data/job_offers/column_names.txt \
        --to_json data/job_offers/job_offers_changes.json
"""

import collections

from bob_emploi.data_analysis.lib import job_offers
from bob_emploi.data_analysis.lib import mongo

# Job offer fields required by this script.
_REQUIRED_FIELDS = frozenset([
    'creation_date',
    'departement_code',
    'rome_profession_card_code',
])


class _EvolutionCounter(object):

    def __init__(self, last_year):
        self._last_year = last_year
        self.offers_per_year = collections.defaultdict(lambda: collections.defaultdict(int))

    def collect(self, job_offer):
        """Count a job offer."""

        year = int(job_offer.creation_date[:4])
        bucket_id = '{}:{}'.format(
            job_offer.departement_code, job_offer.rome_profession_card_code)
        self.offers_per_year[bucket_id][year] += 1

    def get_proto_dicts(self):
        """Gets the changes per bucket (département x job group).

        Yields:
            A dict compatible with the JSON version of the LocalJobStats
            protobuffer with an extra "_id" property containing the bucket's
            ID.
        """

        for bucket_id, offers_per_year in self.offers_per_year.items():
            num_old_offers = offers_per_year.get(self._last_year - 1, 0)
            if not num_old_offers:
                num_old_offers = 1
            num_recent_offers = offers_per_year.get(self._last_year, 0)
            yield {
                '_id': bucket_id,
                'jobOffersChange': round(
                    100 * num_recent_offers / num_old_offers - 100),
                'numJobOffersLastYear': num_recent_offers,
                'numJobOffersPreviousYear': num_old_offers,
                'numJobOffersPerYear': offers_per_year
            }


def csv2dicts(job_offers_csv, colnames_txt, last_year='2015'):
    """Import the changes of # of job offers per job group and dept in MongoDB.

    Args:
        job_offers_csv: Path of the csv containing the data.
        colnames_txt: Path to a file containing the name of the CSV's columns.
        last_year: The year to consider to compute the metrics.
    Returns:
        Evolution data as a LocalJobStats JSON-proto compatible dict.
    """

    counter = _EvolutionCounter(int(last_year))
    for job_offer in job_offers.iterate(
            job_offers_csv, colnames_txt, _REQUIRED_FIELDS):
        counter.collect(job_offer)
    return list(counter.get_proto_dicts())


if __name__ == '__main__':
    # This is actually never used like this, in a normal importing flow, we
    # would import the data in a .json file and then combine it with other data
    # in local_diagnosis.py.
    mongo.importer_main(csv2dicts, 'job_offers_changes')  # pragma: no cover
