"""Tests for the bob_emploi.importer.workup_events module."""

import io
import json
import os
import tempfile
import unittest

from bob_emploi.frontend.api import event_pb2
from bob_emploi.data_analysis.importer import workup_events
from bob_emploi.data_analysis.lib import mongo


class WorkupEventsTestCase(unittest.TestCase):
    """Unit tests for the importer."""

    def setUp(self) -> None:
        super().setUp()
        file_handle, self.events_json_path = tempfile.mkstemp()
        self.events_file = os.fdopen(file_handle, 'wt')

    def tearDown(self) -> None:
        self.events_file.close()
        os.remove(self.events_json_path)
        super().tearDown()

    def test_events2dicts(self) -> None:
        """Basic usage."""

        json.dump([
            {
                'title': 'Event A',
                'organiser': 'Pascal',
                'latitude': 45.75,
                'longitude': 4.85,
                'price': 0,
                'id': 'event-a',
                'slug': 'slug-event-a',
                'date': '2017-08-19',
                'category': ['Trouver un job'],
            },
        ], self.events_file)
        self.events_file.close()

        collection = workup_events.events2dicts(
            self.events_json_path,
            io.StringIO('''departement_id,max_latitude,max_longitude,min_latitude,min_longitude
38,45.8667,6.18333,44.75,4.76667
69,46.2833,5.1116,45.45,4.3
75,48.86,2.34445,48.86,2.34445
'''))
        event_protos = dict(mongo.collection_to_proto_mapping(
            collection, event_pb2.Event))
        self.assertEqual({'event-a'}, set(event_protos))
        event = event_protos['event-a']
        self.assertEqual('Event A', event.title)
        self.assertEqual('https://www.workuper.com/events/slug-event-a', event.link)
        self.assertEqual(['for-departement(38,69)'], event.filters)

    def test_cosly_event(self) -> None:
        """Non-free event."""

        json.dump([
            {
                'title': 'Event A',
                'organiser': 'Pascal',
                'latitude': 45.75,
                'longitude': 4.85,
                'price': 1,
                'id': 'event-a',
                'slug': 'slug-event-a',
                'date': '2017-08-19',
                'category': ['Trouver un job'],
            },
        ], self.events_file)
        self.events_file.close()

        collection = workup_events.events2dicts(
            self.events_json_path,
            io.StringIO('''departement_id,max_latitude,max_longitude,min_latitude,min_longitude
38,45.8667,6.18333,44.75,4.76667
69,46.2833,5.1116,45.45,4.3
75,48.86,2.34445,48.86,2.34445
'''))

        self.assertFalse(collection)

    def test_create_company_event(self) -> None:
        """Event to learn how to create a company."""

        json.dump([
            {
                'title': 'Event A',
                'organiser': 'Pascal',
                'latitude': 45.75,
                'longitude': 4.85,
                'price': 0,
                'id': 'event-a',
                'slug': 'slug-event-a',
                'date': '2017-08-19',
                'category': ['Créer sa boite'],
            },
        ], self.events_file)
        self.events_file.close()

        collection = workup_events.events2dicts(
            self.events_json_path,
            io.StringIO('''departement_id,max_latitude,max_longitude,min_latitude,min_longitude
38,45.8667,6.18333,44.75,4.76667
69,46.2833,5.1116,45.45,4.3
75,48.86,2.34445,48.86,2.34445
'''))

        self.assertFalse(collection)

    def test_webinar(self) -> None:
        """Webinar."""

        json.dump([
            {
                'title': 'Event A',
                'organiser': 'Pascal',
                'latitude': 45.4839244,
                'longitude': -73.4671686,
                'price': 0,
                'id': 'event-a',
                'slug': 'slug-event-a',
                'date': '2017-08-19',
                'category': ['Trouver un job'],
                'address': 'En ligne ',
            },
        ], self.events_file)
        self.events_file.close()

        collection = workup_events.events2dicts(
            self.events_json_path,
            io.StringIO('''departement_id,max_latitude,max_longitude,min_latitude,min_longitude
38,45.8667,6.18333,44.75,4.76667
69,46.2833,5.1116,45.45,4.3
75,48.86,2.34445,48.86,2.34445
'''))
        event_protos = dict(mongo.collection_to_proto_mapping(
            collection, event_pb2.Event))
        self.assertEqual({'event-a'}, set(event_protos))
        event = event_protos['event-a']
        self.assertEqual('Event A', event.title)
        self.assertEqual('https://www.workuper.com/events/slug-event-a', event.link)
        self.assertFalse(event.filters)


if __name__ == '__main__':
    unittest.main()
