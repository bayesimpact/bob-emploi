"""Module to upload UK cities to Algolia for city suggest.

To run it, you need an Algolia API key suited for updating the cities index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/deployments/uk/uk_city_suggest.py \
    --ward-ons-list data/uk/wards_counties_regions_local_authorities_2016.csv \
    --geonames data/uk/geonames.txt \
    --geonames-admin data/uk/geonames_admin.txt
"""

import argparse
import datetime
import json
import os
import re
import sys
import time
import typing
from typing import Any, Dict, Iterator, List, Optional, TextIO, Union

from algoliasearch import exceptions
from algoliasearch import search_client
import pandas as pd
import requests
import typing_extensions

from bob_emploi.data_analysis.lib import batch
from bob_emploi.data_analysis.lib import geonames


# Columns in wards_counties_regions_local_authorities_2016 follow the following scheme:
#     AAAAYYXX
#     AAAA is the area level, which can be
#         - WD for Ward
#         - LAD for Local Authority District
#         - CTY for County
#         - GOR for Government Office Region
#         - CTRY for Country
#     YY describes the year for the updated data, which is 16 for very field except GOR.
#     XX describes the content of the field, which can be
#         - CD for ONS ID (format A12345678)
#         - NM for Name


class _FinalGeonameTuple(typing.NamedTuple):
    CTRY16CD: str
    CTRY16NM: str
    CTY16NM: str
    geonameid: str
    GOR10CD: str
    GOR10NM: str
    LAD16CD: str
    LAD16NM: str
    name: str
    population: int


def _prepare_city(city: _FinalGeonameTuple) -> Dict[str, Any]:
    return {
        'objectID': city.geonameid,
        'name': city.name,
        'countryCode': 'UK',
        # TODO(cyrille): Use county instead, once we have complete data about them.
        # When there's no region, use country instead.
        'admin1Code': city.GOR10CD if city.GOR10CD else city.CTRY16CD,
        'admin1Name': city.GOR10NM if city.GOR10CD else city.CTRY16NM,
        'admin2Code': city.LAD16CD,
        'admin2Name': city.LAD16NM,
        # These fields are not required for Bob, but help searching for the relevant city.
        'county': city.CTY16NM,
        'countryUK': city.CTRY16NM,
        'population': city.population,
    }


def _prepare_geonames_dataframe(geonames_filename: str, min_population: int) -> pd.DataFrame:
    frame = pd.read_csv(
        geonames_filename, names=geonames.GEONAMES_FIELDNAMES, sep='\t', dtype={
            'geonameid': 'str',
        })
    return frame[
        (frame.population > min_population) &
        frame.admin1_code.isin(['ENG', 'WLS', 'SCT', 'NIR'])][[
            'geonameid', 'name', 'latitude', 'longitude', 'population',
            'feature_code', 'admin1_code', 'admin2_code', 'admin3_code', 'admin4_code',
        ]]


class _WithCoordinates(typing_extensions.Protocol):
    latitude: float
    longitude: float


def _get_lad_from_coords(location: _WithCoordinates) -> Union[float, str]:
    response = requests.get(
        f'https://findthatpostcode.uk/points/{location.latitude}%2C{location.longitude}.json')
    response.raise_for_status()
    included_documents = response.json().get('included', [])
    current_lad_cd: Optional[str] = next(filter(None, (
        doc['attributes'].get('laua') for doc in included_documents)), None)
    if not current_lad_cd:
        return float('nan')
    current_lad = next(doc for doc in included_documents if doc['id'] == current_lad_cd)
    start_date = datetime.datetime.strptime(
        current_lad['attributes'].get('date_start'),
        '%a, %d %b %Y %H:%M:%S GMT')
    if start_date > datetime.datetime(2017, 1, 1, 0, 0, 0):
        # The current LAD is too recent, so it won't have a LAD16CD.
        return float('nan')
    return current_lad_cd


# See go/bob-uk:places-to-lad
def prepare_cities(
        wards_filename: str, geonames_filename: str, geonames_admin_filename: str,
        min_population: int) \
        -> Iterator[Dict[str, Any]]:
    """Prepare cities for upload to Algolia.


    Args:
        geonames_dump_filename: path to the txt file containing the Geonames data.

    Returns:
        A list of dict JSON-like objects each containing properties of a city.
    """

    local_authorities = pd.read_csv(wards_filename)\
        .drop(['WD16NM', 'WD16CD'], axis=1).drop_duplicates(['LAD16NM', 'LAD16CD'])
    geonames_admin = _prepare_geonames_dataframe(geonames_admin_filename, min_population)
    geonames_cities = _prepare_geonames_dataframe(geonames_filename, min_population)
    geonames_admin['cleanName'] = geonames_admin.name\
        .str.replace(r' District$', '', regex=True)\
        .str.replace(r'^Royal ', '', regex=True)\
        .str.replace(
            r'^(City|County|District|Borough|Isle)( and (District|County|Borough))? of ',
            '', regex=True)\
        .str.replace(r'( (County|Borough))+$', '', flags=re.IGNORECASE, regex=True)\
        .str.replace(r'(\b|^)St\.', 'St', regex=True)\
        .str.replace(r'^The ', '', regex=True)
    local_authorities['cleanName'] = local_authorities.LAD16NM\
        .str.replace(r'(\b|^)St\.', 'St', regex=True)\
        .str.replace(r', C(i|oun)ty of$', '', regex=True)\
        .str.replace(r'^(City|Isle) of ', '', regex=True)

    geonames_admin['LAD16CD'] = geonames_admin.cleanName.map(
        local_authorities.set_index('cleanName').LAD16CD)
    geonames_admin['admin_code'] = float('nan')
    geonames_admin.loc[geonames_admin.feature_code == 'ADM3', 'admin_code'] = \
        geonames_admin.admin3_code
    geonames_admin.loc[geonames_admin.feature_code == 'ADM2', 'admin_code'] = \
        geonames_admin.admin2_code
    admin_to_lad = geonames_admin[
        geonames_admin.admin_code.notna() & geonames_admin.LAD16CD.notna()]\
        .set_index('admin_code').LAD16CD
    # Hand-matched LADs.
    admin_to_lad = admin_to_lad.combine_first(pd.Series({
        'E7': 'E09000011',
        'W8': 'S12000013',
        'Q1': 'E08000015',
        'Y8': 'W06000023',
        'N09000002': 'N09000002',
        'N09000010': 'N09000010',
    }))

    geonames_cities['LAD16CD'] = float('nan')
    geonames_cities.loc[
        geonames_cities.admin3_code.isin(admin_to_lad.index), 'LAD16CD'
    ] = geonames_cities.admin3_code.map(admin_to_lad)
    geonames_cities.loc[
        geonames_cities.admin2_code.isin(admin_to_lad.index), 'LAD16CD'
    ] = geonames_cities.admin2_code.map(admin_to_lad)

    # Add Poole and Bournemouth by hand (their LADs got merged after 2016).
    geonames_cities.loc[geonames_cities.name == 'Poole', 'LAD16CD'] = 'E06000029'
    geonames_cities.loc[geonames_cities.name == 'Bournemouth', 'LAD16CD'] = 'E06000028'

    # Get missing LADs from coordinates and "Find your Postcode" API.
    missing_lad = geonames_cities[
        geonames_cities.LAD16CD.isna() & (geonames_cities.name != 'London')]
    geonames_cities.loc[missing_lad.index, 'LAD16CD'] = \
        missing_lad.apply(_get_lad_from_coords, axis=1)

    geonames_with_lads = geonames_cities.join(
        local_authorities.set_index('LAD16CD'), on='LAD16CD', how='inner')\
        .fillna('')

    # Adding London boroughs (Greater London Region is E12000007).
    london_boroughs = local_authorities[(local_authorities.GOR10CD == 'E12000007')]\
        .set_index('LAD16CD')\
        .drop(['cleanName'], axis=1)
    geonames_admin_boroughs = geonames_admin.join(
        london_boroughs, on='LAD16CD', how='inner').fillna('')

    for geoname in pd.concat([geonames_with_lads, geonames_admin_boroughs]).itertuples():
        yield _prepare_city(geoname)


def upload(string_args: Optional[List[str]] = None, out: TextIO = sys.stdout) -> None:
    """Upload city suggestions to Algolia index."""

    parser = argparse.ArgumentParser(
        description='Upload a Geonames cities dataset to Algolia for city suggest')

    parser.add_argument(
        '--ward-ons-list', help='Path to the csv file containing the ONS data for wards.',
        default='data/uk/wards_counties_regions_local_authorities_2016.csv')
    parser.add_argument(
        '--geonames', help='Path to the txt file containing geonames populated places.',
        default='data/uk/geonames.txt')
    parser.add_argument(
        '--geonames-admin', help='Path to the txt file containing geonames administrative areas.',
        default='data/uk/geonames_admin.txt')
    parser.add_argument(
        '--min-population',
        help='Minimum number of inhabitants to keep a place in the index.', type=int,
        default=100)
    parser.add_argument(
        '--algolia-app-id', help='ID of the Algolia app to upload to.',
        default='K6ACI9BKKT')
    parser.add_argument(
        '--algolia-api-key', help='Algolia API key.',
        default=os.getenv('ALGOLIA_API_KEY'))
    parser.add_argument(
        '--algolia-index', help='Name of the Algolia index to upload to.',
        default='cities_UK')
    parser.add_argument(
        '--batch-size', help='Number of suggestions to upload to Algolia per batch.',
        default=5000, type=int)

    args = parser.parse_args(string_args)

    batch_size = args.batch_size
    suggestions = prepare_cities(
        args.ward_ons_list, args.geonames, args.geonames_admin, min_population=args.min_population)
    client = search_client.SearchClient.create(args.algolia_app_id, args.algolia_api_key)
    index_name = args.algolia_index
    cities_index = client.init_index(index_name)
    tmp_index_name = f'{index_name}_{round(time.time())}'
    tmp_cities_index = client.init_index(tmp_index_name)

    tmp_cities_index.set_settings(cities_index.get_settings())
    for suggestion_batch in batch.batch_iterator(suggestions, batch_size):
        try:
            tmp_cities_index.save_objects(suggestion_batch)
        except exceptions.AlgoliaException:
            tmp_cities_index.delete()
            out.write(json.dumps(suggestion_batch[:10], indent=2))
            raise

    # OK we're ready finally replace the index.
    client.move_index(tmp_index_name, index_name)


if __name__ == '__main__':
    upload()
