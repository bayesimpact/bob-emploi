"""Tests for the bob_emploi.importer.adie_events module."""

from os import path
import unittest

from bob_emploi.frontend.api import event_pb2
from bob_emploi.data_analysis.importer import adie_events
from bob_emploi.data_analysis.lib import mongo


class AdieEventsTestCase(unittest.TestCase):
    """Unit tests for the importer."""

    def test_adie_events2dicts(self):
        """Basic usage."""

        collection = adie_events.adie_events2dicts(
            path.join(path.dirname(__file__), 'testdata/adie-evenements.html'))
        event_protos = dict(mongo.collection_to_proto_mapping(
            collection, event_pb2.Event))
        self.assertEqual({'2018-06_0', '2018-06_1'}, set(event_protos))
        event = event_protos['2018-06_0']
        self.assertEqual("Zoom sur le microcrédit et l'accompagnement de l'Adie.", event.title)
        self.assertEqual('Annecy', event.city_name)
        self.assertEqual(
            '***Ça parle de quoi ?***\n'
            '\n'
            "Posez vos questions, l'Adie vous répond ! En partenariat avec CMA. "
            "Pour s'inscrire, appelez le 04 50 23 92 22.\n"
            '\n'
            '***Ça se passe où ?***\n'
            '\n'
            "Chambre des métiers et de l'artisanat  \n"
            '28, avenue de France, 74000 Annecy\n'
            '\n'
            '***Quand ?***\n'
            '\n'
            'le lundi 5 février  \n'
            'de 14h à 17h',
            event.description)
        self.assertEqual('le 5 février', event.timing_text)
        self.assertEqual('2018-02-05', event.start_date)
        self.assertAlmostEqual(45.9100539, event.latitude, places=5)

        event_special_date = event_protos['2018-06_1']
        self.assertEqual('le 1er février', event_special_date.timing_text)
        self.assertEqual('2018-02-01', event_special_date.start_date)


if __name__ == '__main__':
    unittest.main()
