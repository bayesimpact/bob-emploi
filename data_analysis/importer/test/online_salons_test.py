"""Tests for the bob_emploi.importer.online_salons module."""

import datetime
from os import path
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.importer import online_salons
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import online_salon_pb2

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')
# These two aren't really needed as a cache is mocked for regions.
_FRENCH_REGION_FILENAME = path.join(_TESTDATA_FOLDER, 'geo/insee_france_regions.tsv')
_REGION_PREFIX_FILENAME = path.join(_TESTDATA_FOLDER, 'geo/region_prefix.tsv')


class OnlineSalonsImporterTestCase(airtablemock.TestCase):
    """Unit tests for the online salons importer."""

    events_filename = path.join(_TESTDATA_FOLDER, 'online_salons.json')

    @mock.patch(online_salons.airtable_to_protos.__name__ + '._AIRTABLE_API_KEY', new='apikey')
    @mock.patch(online_salons.__name__ + '._REGIONS', new=[{'94': {'prefix': 'en '}}])
    @mock.patch(online_salons.__name__ + '.search_client')
    @mock.patch(online_salons.logging.__name__ + '.warning')
    def test_json2dicts(self, mock_logging: mock.MagicMock, mock_algolia: mock.MagicMock) -> None:
        """Test basic usage of the json2dicts function."""

        client = airtable.Airtable('appXmyc7yYj0pOcae', '')

        client.create('tbl6eAgUh8JGoiYnp', {
            'fields': 'localisation,titre',
            'regexp': r'\(dept *(\d{2,3})\)',
            'location_kind': 'DEPARTEMENT',
            'location_ids': r'\1',
        })

        client.create('tbl6eAgUh8JGoiYnp', {
            'fields': 'titre,description',
            'regexp': r'int[eé]rim',
            'filters': ['for-very-short-contract'],
        })

        online_salons.clear_algolia_index()

        mock_algolia.SearchClient.create().init_index().search.side_effect = [
            {'hits': [{
                'departementId': '62',
                'regionName': 'Hauts-de-France',
                'name': 'Liévin',
                'departementPrefix': 'dans le ',
                'cityId': '62510',
                'departementName': 'Pas-de-Calais',
                '_highlightResult': {'name': {
                    'fullyHighlighted': True,
                    'value': '<em>Liévin</em>',
                    'matchedWords': ['lievin'],
                    'matchLevel': 'full'
                }},
                'regionId': '32',
            }]},
            {'hits': []},
            {'hits': [{
                'departementId': '63',
                'regionName': 'Auvergne-Rhône-Alpes',
                'name': 'Riom',
                'departementPrefix': 'dans le ',
                'cityId': '63300',
                'departementName': 'Puy-de-Dôme',
                '_highlightResult': {},
                'regionId': '84',
            }]},
            {'hits': [{
                'departementId': '2A',
                'regionName': 'Corse',
                'name': 'Ajaccio',
                'departementPrefix': 'en ',
                'cityId': '2A004',
                'departementName': 'Corse-du-Sud',
                '_highlightResult': {
                    'regionName': {
                        'fullyHighlighted': True,
                        'value': '<em>Corse</em>',
                        'matchedWords': ['corse'],
                        'matchLevel': 'full'
                    },
                    'departementName': {
                        'fullyHighlighted': False,
                        'value': '<em>Corse</em>-du-Sud',
                        'matchedWords': ['corse'],
                        'matchLevel': 'full'
                    }
                },
                'regionId': '94',
            }]},
        ]

        collection = online_salons.json2dicts(
            self.events_filename, _FRENCH_REGION_FILENAME, _REGION_PREFIX_FILENAME)

        protos = [
            mongo.parse_doc_to_proto(salon_json, online_salon_pb2.OnlineSalon)
            for salon_json in collection]
        self.assertEqual(3, len(protos))

        # Point check.
        salon = protos[0]
        self.assertEqual(3, salon.offer_count)
        self.assertEqual('SALON EN LIGNE SAP', salon.title)
        self.assertEqual(datetime.datetime(2018, 2, 20), salon.start_date.ToDatetime())
        self.assertEqual(datetime.datetime(2018, 5, 1), salon.application_end_date.ToDatetime())
        self.assertEqual('https://salonenligne.pole-emploi.fr/candidat/?salonId=640', salon.url)
        salon_location = salon.locations[0]
        self.assertEqual(geo_pb2.CITY, salon_location.area_type)
        self.assertEqual('Liévin', salon_location.city.name)
        self.assertEqual('62510', salon_location.city.city_id)
        self.assertEqual('62', salon_location.city.departement_id)
        self.assertEqual('Pas-de-Calais', salon_location.city.departement_name)
        self.assertEqual('dans le ', salon_location.city.departement_prefix)
        self.assertEqual('32', salon_location.city.region_id)
        self.assertEqual('Hauts-de-France', salon_location.city.region_name)

        # Check the location rule import.
        rule_departement_salon_location = protos[1].locations[0]
        self.assertEqual(geo_pb2.DEPARTEMENT, rule_departement_salon_location.area_type)
        self.assertEqual('63', rule_departement_salon_location.city.departement_id)
        self.assertEqual('Puy-de-Dôme', rule_departement_salon_location.city.departement_name)

        # Check the filter rule import.
        self.assertEqual(['for-very-short-contract'], protos[2].filters)

        self.assertEqual(
            4, mock_logging.call_count, msg='Logger should be called once for each salon.')


@mock.patch(online_salons.__name__ + '._REGIONS', new=[{'94': {'prefix': 'en '}}])
@mock.patch(online_salons.__name__ + '.search_client')
class FetchLocationTestCase(unittest.TestCase):
    """Test the fetch_location function."""

    def setUp(self) -> None:
        super().setUp()
        online_salons.clear_algolia_index()

    def test_approx_name(self, mock_algolia: mock.MagicMock) -> None:
        """A location fetched from approximative name should find a match."""

        mock_algolia.SearchClient.create().init_index().search.return_value = {'hits': [{
            'departementId': '62',
            'regionName': 'Hauts-de-France',
            'name': 'Liévin',
            'departementPrefix': 'dans le ',
            'cityId': '62510',
            'departementName': 'Pas-de-Calais',
            '_highlightResult': {'name': {
                'fullyHighlighted': True,
                'value': '<em>Liévin</em>',
                'matchedWords': ['lievin'],
                'matchLevel': 'full'
            }},
            'regionId': '32',
        }]}
        fetched_location = online_salons.fetch_location(
            _FRENCH_REGION_FILENAME, _REGION_PREFIX_FILENAME, {'name': 'LIEVIN'})
        self.assertTrue(fetched_location)
        self.assertEqual('CITY', fetched_location.get('areaType'))
        self.assertEqual('Liévin', fetched_location.get('city', {}).get('name'))

    def test_exact_region_id(self, mock_algolia: mock.MagicMock) -> None:
        """A location fetched from region ID should find a match."""

        mock_algolia.SearchClient.create().init_index().search.return_value = {'hits': [{
            'departementId': '2A',
            'regionName': 'Corse',
            'name': 'Ajaccio',
            'departementPrefix': 'en ',
            'cityId': '2A004',
            'departementName': 'Corse-du-Sud',
            '_highlightResult': {'regionId': {
                'fullyHighlighted': True,
                'value': '<em>94</em>',
                'matchedWords': ['94'],
                'matchLevel': 'full',
            }},
            'regionId': '94',
        }]}
        fetched_location = online_salons.fetch_location(
            _FRENCH_REGION_FILENAME, _REGION_PREFIX_FILENAME, {'regionId': '94'},
            is_exact=True)
        self.assertTrue(fetched_location)
        self.assertEqual('REGION', fetched_location.get('areaType'))
        self.assertEqual('Corse', fetched_location.get('city', {}).get('regionName'))
        self.assertEqual('en ', fetched_location.get('city', {}).get('regionPrefix'))


if __name__ == '__main__':
    unittest.main()
