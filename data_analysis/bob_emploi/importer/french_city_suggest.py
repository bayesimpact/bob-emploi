# encoding: utf-8
"""Module to upload the French cities dataset to Algolia for city suggest.

To run it, you need an Algolia API key suited for updating the cities index.
Check out https://www.algolia.com/api-keys to find such a key.

docker-compose run --rm -e ALGOLIA_API_KEY=<the key> \
    data-analysis-prepare python3 \
    bob_emploi/importer/french_city_suggest.py
"""
import json
import os
import time

from algoliasearch import algoliasearch
from algoliasearch import helpers
import pandas

from bob_emploi.lib import cleaned_data


def prepare_cities(data_folder='data', stats_filename=None):
    """Prepare cities for upload to Algolia.

    Args:
        data_folder: the root of the data folder.
        stats_filename: path to a file containing more stats about cities.

    Returns:
        A list of dict JSON-like objects each containing properties of a French
        city.
    """
    cities = cleaned_data.french_cities(data_folder)

    # Keep only cities that are still cities on 2016-01-01 and arrondissements.
    cities = cities[cities.current | cities.arrondissement]

    # Set city ID on objectID as this is what Algolia uses.
    cities['objectID'] = cities.index

    # Get département's names.
    cities['departementId'] = cities.departement_id
    cities['departementName'] = cities.departement_id.map(
        cleaned_data.french_departements(data_folder).name)

    # Get région's names.
    cities['regionId'] = cities.region_id
    cities['regionName'] = cities.region_id.map(
        cleaned_data.french_regions(data_folder).name)

    if stats_filename:
        city_stats = pandas.read_csv(
            stats_filename,
            sep=',', header=None, usecols=[8, 10, 14],
            names=['zipCode', 'city_id', 'population'],
            dtype={'zipCode': str, 'city_id': str, 'population': int})
        city_stats.set_index('city_id', inplace=True)
        cities = cities.join(city_stats)
        cities.zipCode.fillna('', inplace=True)
        cities.population.fillna(0, inplace=True)
    else:
        cities['zipCode'] = ''
        cities['population'] = 0

    cities['cityId'] = cities['objectID']
    # Treat arrondissements specifically: remove the full cities and use the
    # full city ID for the arrondissements..
    cities.loc[cities.objectID.str.startswith('132'), 'cityId'] = '13055'
    cities.loc[cities.objectID.str.startswith('751'), 'cityId'] = '75056'
    cities.loc[cities.objectID.str.startswith('6938'), 'cityId'] = '69123'
    cities.drop(['13055', '75056', '69123'], errors='ignore', inplace=True)

    return cities[[
        'objectID', 'cityId', 'name',
        'departementId', 'departementName',
        'regionId', 'regionName',
        'zipCode', 'population',
    ]].to_dict(orient='records')


def upload(batch_size=5000):
    """Upload French city suggestions to Algolia index."""
    suggestions = prepare_cities('data', 'data/geo/french_cities.csv')
    client = algoliasearch.Client(
        os.getenv('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        os.getenv('ALGOLIA_API_KEY'))
    index_name = os.getenv('ALGOLIA_CITIES_INDEX', 'cities')
    cities_index = client.init_index(index_name)
    tmp_index_name = '%s_%x' % (index_name, round(time.time()))
    tmp_cities_index = client.init_index(tmp_index_name)

    try:
        tmp_cities_index.set_settings(cities_index.get_settings())
        # TODO(pascal): Add synonyms if we start having some.
        for start in range(0, len(suggestions), batch_size):
            tmp_cities_index.add_objects(suggestions[start:start+batch_size])

        # OK we're ready finally replace the index.
        client.move_index(tmp_index_name, index_name)
    except helpers.AlgoliaException:
        tmp_cities_index.clear_index()
        print(json.dumps(suggestions[:10], indent=2))
        raise


if __name__ == '__main__':
    upload()
