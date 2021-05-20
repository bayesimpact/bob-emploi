"""Module to upload a Geonames cities dataset to Algolia for city suggest.

To run it, you need an Algolia API key suited for updating the cities index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/geonames_city_suggest.py \
    --geonames-dump bob_emploi/data/usa/geonames.txt
"""

import argparse
import csv
import json
import os
import sys
import time
import typing
from typing import Any, Dict, List, Optional, TextIO

from algoliasearch import exceptions
from algoliasearch import search_client

from bob_emploi.data_analysis.lib import geonames

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


# TODO(cyrille): Move to a geo.py file.
def prepare_state_codes(filename: str) -> Optional[Dict[str, UsState]]:
    """Make a dict to translate from ISO code (e.g. CA) to FIPS code (e.g. 6) or name."""

    if not filename:
        return None
    code_to_fips: Dict[str, UsState] = {}
    with open(filename, 'rt') as file:
        state_reader = csv.DictReader(file, delimiter='|')
        return {
            state['STUSAB']: UsState(state['STATE_NAME'], state['STUSAB'], int(state['STATE']))
            for state in state_reader}
    return code_to_fips


def _make_admin2_code(
        geoname: Dict[str, Any], states_by_code: Optional[Dict[str, UsState]]) -> str:
    if geoname['name'] in SPECIAL_AREAS:
        index = 0 if states_by_code else 2
        return SPECIAL_AREAS[geoname['name']][index:]
    if states_by_code:
        return f'{states_by_code[geoname["admin1_code"]].fips}{geoname["admin2_code"]}'
    return typing.cast(str, geoname['admin2_code'])


def _prepare_city(
        city: Dict[str, str],
        admin_1: Dict[str, str], admin_2: Dict[str, str],
        states_by_code: Optional[Dict[str, UsState]]) -> Dict[str, Any]:
    admin2_code = _make_admin2_code(city, states_by_code)
    # New York City is composed of 5 boroughs. We want to prioritize boroughs over the entire city.
    # TODO(sil): Handle NY City admin2Code as it has none.
    borough = 0
    if admin2_code and 'Borough' in city['alternatenames'] and city['admin1_code'] == 'NY':
        borough = 1
    return {
        'objectID': city['geonameid'],
        'name': city['name'],
        'alternatenames': city['alternatenames'],
        'population': int(city['population']),
        'countryCode': city['country_code'],
        'admin1Code': city['admin1_code'],
        'admin1Name': admin_1.get(city['admin1_code']),
        'admin2Code': admin2_code,
        'admin2Name': admin_2.get(admin2_code),
        'borough': borough,
    }


def prepare_cities(
        geonames_dump_filename: str, geonames_admin_dump_filename: str,
        states_fips_codes_filename: str,
        min_population: int) -> List[Dict[str, Any]]:
    """Prepare cities for upload to Algolia.

    Args:
        geonames_dump_filename: path to the txt file containing the Geonames data.

    Returns:
        A list of dict JSON-like objects each containing properties of a city.
    """

    admin_1 = {}
    admin_2 = {}

    states_by_code = prepare_state_codes(states_fips_codes_filename)

    for geoname in geonames.iterate_geonames(geonames_admin_dump_filename):
        if geoname['feature_code'] == 'ADM1':
            admin_1[geoname['admin1_code']] = geoname['name']
        elif geoname['feature_code'] == 'ADM2':
            admin_2[_make_admin2_code(geoname, states_by_code)] = geoname['name']

    cities = [
        _prepare_city(city, admin_1, admin_2, states_by_code)
        for city in geonames.iterate_geonames(geonames_dump_filename)
        if int(city['population']) >= min_population
    ]
    return cities


def upload(string_args: Optional[List[str]] = None, out: TextIO = sys.stdout) -> None:
    """Upload city suggestions to Algolia index."""

    parser = argparse.ArgumentParser(
        description='Upload a Geonames cities dataset to Algolia for city suggest')

    parser.add_argument(
        '--geonames-dump', help='Path to the txt file containing the Geonames data for cities.',
        default='data/usa/geonames.txt')
    parser.add_argument(
        '--geonames-admin-dump',
        help='Path to the txt file containing the Geonames data for administrative divisions.',
        default='data/usa/geonames_admin.txt')
    parser.add_argument(
        '--states-fips-codes',
        help='Path to the csv file containing the correspondance between stat FIPS and ISO codes,'
        ' if needed.',
        default='')
    parser.add_argument(
        '--min-population',
        help='Minimum number of inhabitants to keep a place in the index.', type=int,
        default=50)
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
    suggestions = prepare_cities(
        args.geonames_dump, args.geonames_admin_dump,
        args.states_fips_codes, min_population=args.min_population)
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
