"""This script computes nearby cities that have offers.

The script looks at the number of offers per city for any given job group and returns it.

The output is used for ranking cities according to which have the most job offers for a given job
group.

If you managed to get your hands on the offers dataset, you can run:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/offers_per_city.py \
        --offers_file="data/job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_17JANV2017_FGU.csv" \
        --colnames="data/job_offers/column_names.txt" \
        --min_creation_date="2015/01/01" \
        --to_json
"""

import collections
import math
import sys
import typing
from typing import Any, Iterable

import tqdm

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import job_offers
from bob_emploi.data_analysis.lib import mongo

# Field in the offers table for the city code.
# TODO(guillaume): put this in job offers.
_CITY_CODE_FIELD = 'city_code'
_JOB_GROUP_CODE_FIELD = 'rome_profession_card_code'
_LATITUDE_CODE_FIELD = 'latitude'
_LONGITUDE_CODE_FIELD = 'longitude'
_CITY_NAME_CODE_FIELD = 'city_name'
_TOTAL_RECORDS = 11170764


class _CityData(typing.NamedTuple):
    job_group_to_city_ids: dict[str, dict[str, int]]
    offers_per_job_group: dict[str, int]
    city_info: dict[str, Any]


def _add_population_data(
        city_info: dict[str, dict[str, Any]], data_folder: str) -> None:
    french_city_stats = cleaned_data.french_city_stats(data_folder)
    for city_code in city_info:
        try:
            city_info[city_code]['population'] = int(french_city_stats.loc[city_code, 'population'])
        except (ValueError, KeyError):
            city_info[city_code]['population'] = 0


def _list_hiring_cities(
        offers_rows: Iterable['job_offers._JobOffer'], min_creation_date: str,
        data_folder: str) -> _CityData:
    """Segmenting the data into three dictionaries."""

    french_cities = cleaned_data.french_cities(data_folder, unique=True)
    french_cities.loc[french_cities.current_city_id.isnull(), 'current_city_id'] = \
        french_cities[french_cities.current_city_id.isnull()].index

    job_group_to_city_ids: dict[str, dict[str, int]] = \
        collections.defaultdict(lambda: collections.defaultdict(int))
    offers_per_job_group: dict[str, int] = collections.defaultdict(int)
    city_info: dict[str, Any] = {}
    bad_format_records = 0

    for offer in tqdm.tqdm(offers_rows, total=_TOTAL_RECORDS, file=sys.stdout):
        if offer.creation_date < min_creation_date:
            continue

        city_name = offer.city_name
        city_code = offer.city_code
        departement_id = offer.departement_code
        job_group_code = offer.rome_profession_card_code
        latitude = offer.latitude
        longitude = offer.longitude

        if 'NULL' in (city_code, job_group_code, latitude, longitude):
            bad_format_records += 1
            continue

        # Try to remove the arrondissement and find current city ids.
        try:
            city_code = str(french_cities.loc[city_code, 'current_city_id'])
        except KeyError:
            pass

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except ValueError:
            bad_format_records += 1
            continue

        offers_per_job_group[job_group_code] += 1
        if city_code not in city_info:
            try:
                city_name = french_cities.loc[city_code, 'name']
            except KeyError:
                pass
            if not city_name or city_name == 'NULL':
                continue
            city_info[city_code] = {
                'cityId': city_code,
                'departementId': departement_id,
                'name': city_name,
                'latitude': latitude,
                'longitude': longitude,
            }
        job_group_to_city_ids[job_group_code][city_code] += 1

    _add_population_data(city_info, data_folder)

    return _CityData(
        job_group_to_city_ids=job_group_to_city_ids,
        offers_per_job_group=offers_per_job_group,
        city_info=city_info)


def extract_offers_per_cities(
        offers_file: str, colnames: str, min_creation_date: str, data_folder: str = 'data') \
        -> list[dict[str, Any]]:
    """Extract the interesting cities in terms of number of offers for each job group.

    Args:
        offers_file: path of cvs file with offers.
        colnames: the names of the columns in the offer file.
        min_creation_date: the date from which we consider the offers.
    """

    required_fields = {
        _CITY_CODE_FIELD, _JOB_GROUP_CODE_FIELD, _LATITUDE_CODE_FIELD,
        _LONGITUDE_CODE_FIELD, _CITY_NAME_CODE_FIELD}

    offers_rows = job_offers.iterate(offers_file, colnames, required_fields)

    city_data = _list_hiring_cities(offers_rows, min_creation_date, data_folder)

    # Computing the threshold per job group.
    job_group_threshold: dict[str, float] = collections.defaultdict(float)
    for job_group, offers in city_data.offers_per_job_group.items():
        job_group_threshold[job_group] = math.pow(offers, 0.6) / 40

    job_group_to_kept_cities: dict[str, list[dict[str, Any]]] = \
        collections.defaultdict(list)
    for job_group, city_ids in city_data.job_group_to_city_ids.items():
        kept_cities = []
        for city_id, offer_count in city_ids.items():
            if offer_count > job_group_threshold[job_group]:
                city_info = city_data.city_info[city_id]
                population = city_info.get('population')
                if population:
                    kept_cities.append({
                        'city': city_info,
                        'offers': offer_count,
                        'offersPerInhabitant': offer_count / population
                    })

        job_group_to_kept_cities[job_group] = sorted(
            kept_cities, key=lambda k: typing.cast(float, k['offersPerInhabitant']), reverse=True)

    return [
        {'_id': job_group_id, 'hiringCities': job_group_weighted_cities}
        for job_group_id, job_group_weighted_cities in job_group_to_kept_cities.items()]


if __name__ == '__main__':
    mongo.importer_main(extract_offers_per_cities, 'hiring_cities')
