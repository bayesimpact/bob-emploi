"""Tests for the bob_emploi.importer.adie_events module."""

from os import path
import unittest

from bob_emploi.frontend.api import event_pb2
from bob_emploi.data_analysis.importer import adie_events
from bob_emploi.data_analysis.lib import mongo


class AdieEventsTestCase(unittest.TestCase):
    """Unit tests for the importer."""

    def test_adie_events2dicts(self) -> None:
        """Basic usage."""

        collection = adie_events.adie_events2dicts(
            path.join(path.dirname(__file__), 'testdata/adie-events.json'))
        event_protos = dict(mongo.collection_to_proto_mapping(
            collection, event_pb2.Event))
        self.assertLess({'a0w1W00000Mdkz2QAB', 'a0w1W00000MdkaRQAR'}, set(event_protos))
        self.assertEqual(13, len(event_protos), msg=event_protos)
        event = event_protos['a0w1W00000Mdkz2QAB']
        self.assertEqual("Atelier de la création d'entreprise", event.title)
        self.assertEqual('Anglet', event.city_name)
        self.assertEqual(
            '***Ça parle de quoi ?***\n'
            '\n'
            'ENA accueil\n'
            '\n'
            '***Ça se passe où ?***\n'
            '\n'
            "Agence Adie d'Anglet\n"
            "Résidence de l'Alliance - Centre Jorlis, 3, rue du Pont de l'Aveugle, 64600 Anglet\n"
            '\n'
            '***Quand ?***\n'
            '\n'
            'le lundi 23 septembre 2019 de 14h00 à 16h00\n',
            event.description)
        self.assertEqual('le 23 septembre', event.timing_text)
        self.assertEqual('2019-09-23', event.start_date)
        self.assertAlmostEqual(43.499046, event.latitude, places=5)

        event_special_date = event_protos['a0w1W00000MdkaRQAR']
        self.assertEqual('le 06 août', event_special_date.timing_text)
        self.assertEqual('2019-08-06', event_special_date.start_date)


if __name__ == '__main__':
    unittest.main()
