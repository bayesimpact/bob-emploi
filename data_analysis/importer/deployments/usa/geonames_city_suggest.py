"""Module to upload a Geonames cities dataset to Algolia for city suggest.

To run it, you need an Algolia API key suited for updating the cities index.
Check out https://www.algolia.com/api-keys to find such a key.

You'll need a list of cities with their zip codes and population counts associated to these zip
codes. Geonames provides such a list.
Most of the time 1 zip code corresponds to 1 city or a portion of it. But sometimes, several cities
share the same zip code. Because US residents are used to rely on zip codes for administrative
stuff, it's not that much of a problem. If they can't find their exact city in the list,
they always have the fallback of using their zip codes (it should be linked to a city nearby…
the one with the post office!).

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/deployments/usa/geonames_city_suggest.py \
    --cities-with-zip bob_emploi/data/usa/cities_with_zip.txt \
    --population-by-zip dbob_emploi/ata/usa/population_by_zip_codes.txt
"""

import argparse
import csv
import json
import os
import sys
import time
import typing
from typing import Any, Mapping, Optional, TextIO

from algoliasearch import exceptions
from algoliasearch import search_client
import pandas as pd


# Names of the fields in geonames postal code datasets format.
# See https://download.geonames.org/export/zip/readme.txt
_GEONAMES_ZIP_FIELDNAMES = (
    'country_code',  # iso country code
    'zip_code',  # postal code varchar(20)
    'name',  # name of the city, varchar(180)
    'admin1_name',  # 1. order subdivision (state) varchar(100)
    'admin1_code',  # fipscode 1. order subdivision (state) varchar(20)
    'admin2_name',  # 2. order subdivision name (county/province) varchar(100)
    'admin2_code',  # second administrative division code (county/province) in the US varchar(20)
    'admin3_name',  # 3. order subdivision name (community) varchar(100)
    'admin3_code',  # code for third level administrative division, varchar(20)
    'latitude',  # estimated latitude in decimal degrees (wgs84)
    'longitude',  # estimated longitude in decimal degrees (wgs84)
    'accuracy',  # accuracy of lat/lng (1=estimated, 4=geonameid, 6=centroid of addresses or shape)
)

# For some areas it's difficult to attribute an admin2Code so we'll do it manually.
NEW_YORK_AGG_COUNTY_ID = '36000'
SPECIAL_AREAS = {
    'Ko Olina': '15003',
    'New York City': NEW_YORK_AGG_COUNTY_ID,
}


class UsState(typing.NamedTuple):
    """A simple descriptor for US states with ISO code and FIPS."""

    name: str
    code: str
    fips: int


class _AdminCodes(typing.NamedTuple):
    """A simple descriptor for US admin codes."""

    states: dict[str, str]
    counties: dict[str, str]


# TODO(cyrille): Move to a geo.py file.
def prepare_state_codes(filename: str) -> Optional[Mapping[str, UsState]]:
    """Make a dict to translate from ISO code (e.g. CA) to FIPS code (e.g. 6) or name."""

    if not filename:
        return None
    code_to_fips: dict[str, UsState] = {}
    with open(filename, 'rt', encoding='utf-8') as file:
        state_reader = csv.DictReader(file, delimiter='|')
        return {
            state['STUSAB']: UsState(state['STATE_NAME'], state['STUSAB'], int(state['STATE']))
            for state in state_reader}
    return code_to_fips


def _make_admin2_code(
        geoname: Mapping[str, Any], states_by_code: Optional[Mapping[str, UsState]]) -> str:
    if geoname['name'] in SPECIAL_AREAS:
        index = 0 if states_by_code else 2
        return SPECIAL_AREAS[geoname['name']][index:]
    if states_by_code and geoname['admin1_code'] in states_by_code:
        return f'{states_by_code[geoname["admin1_code"]].fips}{geoname["admin2_code"]}'
    return typing.cast(str, geoname['admin2_code'])


def _get_city_population(population_by_zip_filename: str) -> pd.Series:
    """Make a dataframe with population number associated to each zip code from census data."""

    population = pd.read_json(population_by_zip_filename)
    population.columns = population.iloc[0]
    population.drop(population.index[0], inplace=True)
    population.rename(columns={'zip code tabulation area': 'zip_code'}, inplace=True)
    population['S0101_C01_001E'] = pd.to_numeric(population['S0101_C01_001E'])
    population.set_index('zip_code', inplace=True)
    return population['S0101_C01_001E']


def get_cities_with_population(
        population_by_zip: pd.Series, cities_with_zip_filename: str) -> pd.DataFrame:
    """Match cities administrative info to zip codes.

    Args:
        population_by_zip: A map between zip_codes and population count.
        cities_with_zip_filename: path to the txt file containing the Geonames data.

    Returns:
        A dataframe with geonames and population data for cities.
    """

    cities = pd.read_csv(
        cities_with_zip_filename, sep='\t', names=_GEONAMES_ZIP_FIELDNAMES,
        dtype={'zip_code': 'str', 'admin2_code': 'str', 'admin1_code': 'str'}) \
        .set_index('zip_code')
    cities['zip_population'] = population_by_zip
    return cities.reset_index()


def prepare_zip_cities(
        cities: pd.DataFrame,
        states_by_code: Optional[Mapping[str, UsState]]) -> list[dict[str, Any]]:
    """Prepare cities from zip code dataset for upload to Algolia.

    Args:
        cities: A dataframe with geonames and population data for cities.

    Returns:
        A list of dict JSON-like objects each containing properties of a city.
    """

    cities.set_index(['name', 'admin1_code', 'admin2_code'], inplace=True)
    cities['zipCodes'] = cities.sort_values(['name', 'zip_code']).groupby(
        ['name', 'admin1_code', 'admin2_code']).zip_code.apply('-'.join)
    cities['population'] = cities.groupby(
        ['name', 'admin1_code', 'admin2_code']).zip_population.apply(sum)
    unique_cities = cities.reset_index().drop_duplicates(['name', 'admin1_code', 'admin2_code'])
    unique_cities['computed_admin2_code'] = unique_cities.apply(
        lambda city: _make_admin2_code(city, states_by_code), axis='columns')

    useful_columns = [
        'computed_admin2_code', 'admin1_code', 'admin1_name', 'admin2_name',
        'name', 'country_code', 'zipCodes', 'population']
    unique_cities.dropna(axis='index', subset=useful_columns, inplace=True)
    unique_cities['objectID'] = unique_cities[[
        'admin1_code', 'computed_admin2_code', 'name']].apply(
            '_'.join, axis='columns').str.replace(' ', '')

    clean_cities = unique_cities[useful_columns + ['objectID']].rename(columns={
        'admin1_code': 'admin1Code',
        'admin1_name': 'admin1Name',
        'admin2_code': 'admin2Code',
        'admin2_name': 'admin2Name',
        'computed_admin2_code': 'admin2Code',
        'country_code': 'countryCode',
    })

    return typing.cast(list[dict[str, Any]], clean_cities.to_dict('records'))


def upload(string_args: Optional[list[str]] = None, out: TextIO = sys.stdout) -> None:
    """Upload city suggestions to Algolia index."""

    parser = argparse.ArgumentParser(
        description='Upload a Geonames cities dataset to Algolia for city suggest')

    parser.add_argument(
        '--cities-with-zip',
        help='Path to the txt file containing US cities and their ZIP codes',
        default='data/usa/cities_with_zip.txt')
    parser.add_argument(
        '--population-by-zip', help='Path to the txt file containing population count by zip code.',
        default='data/usa/population_by_zip_codes.txt')
    parser.add_argument(
        '--states-fips-codes',
        help='Path to the csv file containing the correspondance between state FIPS and ISO codes,'
        ' if needed.',
        default='')
    parser.add_argument(
        '--algolia-app-id', help='ID of the Algolia app to upload to.',
        default='K6ACI9BKKT')
    parser.add_argument(
        '--algolia-api-key', help='Algolia API key.',
        default=os.getenv('ALGOLIA_API_KEY'))
    parser.add_argument(
        '--algolia-index', help='Name of the Algolia index to upload to.',
        default='cities_US')
    parser.add_argument(
        '--batch-size', help='Number of suggestions to upload to Algolia per batch.',
        default=5000, type=int)

    args = parser.parse_args(string_args)

    batch_size = args.batch_size

    city_population = _get_city_population(args.population_by_zip)
    cities_with_population = get_cities_with_population(city_population, args.cities_with_zip)
    states_by_code = prepare_state_codes(args.states_fips_codes)

    suggestions = prepare_zip_cities(cities_with_population, states_by_code)

    client = search_client.SearchClient.create(args.algolia_app_id, args.algolia_api_key)
    index_name = args.algolia_index
    cities_index = client.init_index(index_name)
    tmp_index_name = f'{index_name}_{round(time.time())}'
    tmp_cities_index = client.init_index(tmp_index_name)

    try:
        tmp_cities_index.set_settings(cities_index.get_settings())
        for start in range(0, len(suggestions), batch_size):
            tmp_cities_index.save_objects(suggestions[start:start + batch_size])

        # OK we're ready finally replace the index.
        client.move_index(tmp_index_name, index_name)
    except exceptions.AlgoliaException:
        tmp_cities_index.delete()
        out.write(json.dumps(suggestions[:10], indent=2))
        raise


if __name__ == '__main__':
    upload()
