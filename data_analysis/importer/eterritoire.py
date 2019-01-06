"""Importer for e-Territoire URLs into MongoDB."""

import requests

from bob_emploi.data_analysis.lib import mongo


def get_cities_dicts():
    """Download e-Territoire URLs from their website and prepare them.

    Returns:
        For each city (by INSEE ID) a deep link URL.
    """

    response = requests.get('http://www.eterritoire.fr/webservice/listeCommunes.php')
    response.raise_for_status()
    urls = response.json()

    return [{'_id': u['idinsee'], 'path': u['url']} for u in urls]


if __name__ == '__main__':
    mongo.importer_main(get_cities_dicts, 'eterritoire_links')
