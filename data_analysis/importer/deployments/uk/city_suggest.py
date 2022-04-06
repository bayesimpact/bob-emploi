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
import os
import typing
from typing import Any, Iterator, Optional

from bob_emploi.data_analysis.lib import algolia
from bob_emploi.data_analysis.lib import uk_cleaned_data


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
    latitude: float
    longitude: float
    name: str
    population: int


def _prepare_city(city: _FinalGeonameTuple) -> dict[str, Any]:
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
        'latitude': city.latitude,
        'longitude': city.longitude,
        'population': city.population,
    }


def prepare_cities(
        wards_filename: str, geonames_filename: str, geonames_admin_filename: str,
        min_population: int) \
        -> Iterator[dict[str, Any]]:
    """Prepare cities for upload to Algolia.


    Args:
        geonames_dump_filename: path to the txt file containing the Geonames data.

    Returns:
        A list of dict JSON-like objects each containing properties of a city.
    """

    for geoname in uk_cleaned_data.uk_cities(
        wards_filename=wards_filename, geonames_filename=geonames_filename,
        geonames_admin_filename=geonames_admin_filename, min_population=min_population,
    ).itertuples():
        yield _prepare_city(geoname)


def upload(string_args: Optional[list[str]] = None) -> None:
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

    suggestions = prepare_cities(
        args.ward_ons_list, args.geonames, args.geonames_admin, min_population=args.min_population)
    algolia.upload(
        suggestions, app_id=args.algolia_app_id, api_key=args.algolia_api_key,
        batch_size=args.batch_size, index=args.algolia_index)


if __name__ == '__main__':
    upload()
