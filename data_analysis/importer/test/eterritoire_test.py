"""Unit tests for the bob_emploi.importer.eterritoire module."""

import json
import unittest
from unittest import mock

import requests

from bob_emploi.frontend.api import association_pb2
from bob_emploi.data_analysis.importer import eterritoire
from bob_emploi.data_analysis.lib import mongo


class ETerritoireImporterTestCase(unittest.TestCase):
    """Unit tests for the e-Territoire links importer."""

    @mock.patch(requests.__name__ + '.get')
    def test_get_cities_dicts(self, mock_get: mock.MagicMock) -> None:
        """Basic usage."""

        mock_get().json.return_value = json.loads('''[
            {
                "idinsee": "01001",
                "nom": "Abergement-Clémenciat",
                "url": "\\/territoires\\/auvergne-rhone-alpes\\/ain\\/abergement\\/1001\\/1"
            },
            {
                "idinsee":"32013",
                "nom":"Auch",
                "url":"\\/territoires\\/occitanie\\/gers\\/auch\\/32013\\/12474"
            },
            {
                "idinsee":"2A004",
                "nom":"Ajaccio",
                "url":"\\/territoires\\/corse\\/corse-du-sud\\/ajaccio\\/992004\\/37369"
            }
        ]''')

        cities = dict(mongo.collection_to_proto_mapping(
            eterritoire.get_cities_dicts(),
            association_pb2.SimpleLink))

        self.assertEqual({'01001', '32013', '2A004'}, cities.keys())
        self.assertEqual(
            '/territoires/corse/corse-du-sud/ajaccio/992004/37369',
            cities['2A004'].path)


if __name__ == '__main__':
    unittest.main()
