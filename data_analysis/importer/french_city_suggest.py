"""Module to upload the French cities dataset to Algolia for city suggest.

To run it, you need an Algolia API key suited for updating the cities index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/french_city_suggest.py
"""

import os
from os import path
import typing
from typing import Any, Optional

import pandas

from bob_emploi.data_analysis.lib import algolia
from bob_emploi.data_analysis.lib import cleaned_data


def prepare_cities(
        data_folder: str = 'data',
        stats_filename: Optional[str] = None,
        urban_entities_filename: Optional[str] = None,
        transport_scores_filename: Optional[str] = None) \
        -> list[dict[str, Any]]:
    """Prepare cities for upload to Algolia.

    Args:
        data_folder: the root of the data folder.
        stats_filename: path to a file containing more stats about cities.
        urban_entities_filename: path to an excel file containing the
            description about French urban entities.
        transport_scores_filename: path to an html file containing the scores for public
            transportation in some French cities.

    Returns:
        A list of dict JSON-like objects each containing properties of a French
        city.
    """

    cities = cleaned_data.french_cities(data_folder)

    useful_columns = [
        'objectID', 'cityId', 'name', 'departementId', 'departementName',
        'departementPrefix', 'regionId', 'regionName']

    # Keep only cities that are still cities on 2016-01-01.
    cities = cities[cities.current]

    # Set city ID on objectID as this is what Algolia uses.
    cities['objectID'] = cities.index

    # Get département's names.
    cities['departementId'] = cities.departement_id
    departements = cleaned_data.french_departements(data_folder)
    cities['departementName'] = cities.departement_id.map(departements.name)
    cities['departementPrefix'] = cities.departement_id.map(departements.prefix)

    # Get région's names.
    cities['regionId'] = cities.region_id
    cities['regionName'] = cities.region_id.map(
        cleaned_data.french_regions(data_folder).name)

    if stats_filename:
        city_stats = pandas.read_csv(
            stats_filename,
            sep=',', header=None, usecols=[8, 10, 14, 19, 20],
            names=['zipCode', 'city_id', 'population', 'longitude', 'latitude'],
            dtype={
                'zipCode': str,
                'city_id': str,
                'population': int,
                'latitude': float,
                'longitude': float,
            })
        city_stats.set_index('city_id', inplace=True)
        cities = cities.join(city_stats)
        cities.zipCode.fillna('', inplace=True)
        cities.population.fillna(0, inplace=True)
        cities.latitude.fillna(0, inplace=True)
        cities.longitude.fillna(0, inplace=True)
        useful_columns.extend(['zipCode', 'population', 'latitude', 'longitude'])

    # cityId is the ID used throughout the app.
    cities['cityId'] = cities['objectID']

    # The urban score is 0 for rural, 1 for cities in urban areas between
    # 2k and 5k inhabitants, 2 for urban areas below 10k, 3 for 20k, 4 for
    # 50k, 5 for 100k, 6 for 200k, 7 for 2M, and 8 for Paris urban area.
    if urban_entities_filename:
        urban = cleaned_data.french_urban_entities(filename=urban_entities_filename)
        cities['urban'] = cities.cityId.map(urban.urban)
        cities.urban.fillna(0, inplace=True)
        cities.urban.astype(int)
        useful_columns.append('urban')

    if transport_scores_filename:
        transport = cleaned_data.transport_scores(filename=transport_scores_filename)
        cities['transport'] = cities.objectID.map(transport)
        cities.transport.fillna(0, inplace=True)
        useful_columns.append('transport')

    return typing.cast(
        list[dict[str, Any]], cities.sort_index()[useful_columns].to_dict(orient='records'))


def upload(batch_size: int = 5000, data_folder: str = 'data') -> None:
    """Upload French city suggestions to Algolia index."""

    api_key = os.environ.get('ALGOLIA_API_KEY')
    if not api_key:
        raise ValueError('Need a valid Algolia API key. Please set ALGOLIA_API_KEY.')
    suggestions = prepare_cities(
        data_folder,
        path.join(data_folder, 'geo/french_cities.csv'),
        path.join(data_folder, 'geo/french_urban_entities.xls'),
        path.join(data_folder, 'geo/ville-ideale-transports.html'))
    algolia.upload(
        suggestions,
        app_id=os.environ.get('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        api_key=api_key,
        index=os.environ.get('ALGOLIA_CITIES_INDEX', 'cities'),
        batch_size=batch_size)


if __name__ == '__main__':
    upload()
