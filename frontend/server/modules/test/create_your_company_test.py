"""Unit tests for the module create-your-company."""

import datetime
import unittest

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceCreateYourCompanyTestCase(scoring_test.ScoringModelTestBase):
    """Unit tests for the "Create your company" scoring model."""

    model_id = 'advice-create-your-company'

    def test_atypic_profile(self) -> None:
        """Test the scoring function before the events with an atypic profile."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_profile_pb2.ATYPIC_PROFILE)
        score = self._score_persona(persona)
        self.assertEqual(2, score, msg=f'Fail for "{persona.name}"')

    def test_not_really_needed_yet(self) -> None:
        """Test the scoring function for someone that has just started their search."""

        persona = self._random_persona().clone()
        self.now = datetime.datetime(2018, 1, 25)
        del persona.user_profile.frustrations[:]
        persona.project.job_search_has_not_started = False
        persona.project.job_search_started_at.FromDatetime(datetime.datetime(2018, 12, 14))
        score = self._score_persona(persona)
        self.assertEqual(1, score, msg=f'Fail for "{persona.name}"')


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../create-your-company endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'create-your-company',
            'triggerScoringModel': 'advice-create-your-company',
            'extraDataFieldName': 'create_your_company_data',
            'isReadyForProd': True,
        })

    def test_close_to_city_with_events(self) -> None:
        """Test close to a city with multiple events."""

        self._db.cities.insert_one({
            '_id': '69266',
            'latitude': 45.7667,
            'longitude': 4.88333,
        })
        self._db.adie_events.insert_many([
            {
                'title': 'Create your company',
                'cityName': 'Lyon',
                'latitude': 45.7589,
                'longitude': 4.84139,
            },
            {
                'title': 'Work as a freelance',
                'cityName': 'Lyon',
            },
            {
                'title': 'Entrepreneur in Paris',
                'cityName': 'Paris',
            },
        ])
        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"city": {"cityId": "69266"}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual('Lyon', data.get('closeByEvents', {}).get('city'))
        self.assertEqual(
            ['Create your company', 'Work as a freelance'],
            [event.get('title') for event in data.get('closeByEvents', {}).get('events')])

    def test_related_testimonials(self) -> None:
        """Test when testimonials related to the user's project exist."""

        self._db.adie_testimonials.insert_many([
            {
                'author_name': 'Bob',
                'author_job_name': 'coach',
                'link': 'www.here.org',
                'image_link': 'www.image.org',
                'description': 'I will help you',
                'filters': [],
                'preferred_job_group_ids': ['A1', 'B2'],
            },
            {
                'author_name': 'Bill',
                'author_job_name': 'witch',
                'link': 'www.away.org',
                'image_link': 'www.no-image.org',
                'description': 'I will put a spell on you',
                'filters': [],
                'preferred_job_group_ids': ['A2', 'B1'],
            },
            {
                'author_name': 'Lola',
                'author_job_name': 'driver',
                'link': 'www.there.org',
                'image_link': 'www.this-image.org',
                'description': 'I will try to help you',
                'filters': [],
                'preferred_job_group_ids': ['A12', 'B3'],
            },
        ])
        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"targetJob": {"jobGroup": {"romeId": "A1234"}}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual(2, len(data.get('relatedTestimonials', []).get('testimonials', [])))
        self.assertEqual(
            ['Bob', 'Lola'],
            [testimonial.get('authorName') for testimonial in data.get(
                'relatedTestimonials', []).get('testimonials', [])])

    def test_far_from_any_city_with_events(self) -> None:
        """Test far from any city with events."""

        self._db.cities.insert_one({
            '_id': '67462',
            # Sélestat: closer to Dijon than to Lyon.
            'latitude': 48.2667,
            'longitude': 7.45,
        })
        self._db.adie_events.insert_many([
            {
                'title': 'Create your company',
                'cityName': 'Lyon',
                'latitude': 45.7589,
                'longitude': 4.84139,
            },
            {
                'title': 'Entrepreneur in Dijon',
                'cityName': 'Dijon',
                'latitude': 47.322047,
                'longitude': 5.04148,
            },
        ])
        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"city": {"cityId": "67462"}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual({'closeByEvents'}, data.keys())
        self.assertEqual(
            ['Entrepreneur in Dijon', 'Create your company'],
            [event.get('title') for event in data.get('closeByEvents', {}).get('events')])

    def test_no_location(self) -> None:
        """Test city without no coordinates."""

        self._db.adie_events.insert_many([
            {
                'title': 'Create your company',
                'cityName': 'Lyon',
                'latitude': 45.7589,
                'longitude': 4.84139,
            },
            {
                'title': 'Entrepreneur in Dijon',
                'cityName': 'Dijon',
                'latitude': 47.322047,
                'longitude': 5.04148,
            },
        ])
        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"city": {"cityId": "69266"}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual({'closeByEvents'}, data.keys())
        self.assertEqual(
            {'Entrepreneur in Dijon', 'Create your company'},
            {event.get('title') for event in data.get('closeByEvents', {}).get('events')})

    def test_no_events(self) -> None:
        """Test without any events."""

        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"city": {"cityId": "69266"}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertFalse(data.get('closeByEvents'))

    @nowmock.patch(new=lambda: datetime.datetime(2018, 5, 9))
    def test_start_date(self) -> None:
        """Test events with start dates."""

        self._db.adie_events.insert_many([
            {
                'title': 'Past date',
                'cityName': 'Lyon',
                'latitude': 45.7589,
                'longitude': 4.84139,
                'startDate': '2018-05-02',
            },
            {
                'title': 'No date',
                'cityName': 'Dijon',
                'latitude': 47.322047,
                'longitude': 5.04148,
            },
            {
                'title': 'Today',
                'cityName': 'Dijon',
                'latitude': 47.322047,
                'longitude': 5.04148,
                'startDate': '2018-05-09',
            },
            {
                'title': 'Future date',
                'cityName': 'Dijon',
                'latitude': 47.322047,
                'longitude': 5.04148,
                'startDate': '2018-06-01',
            },
        ])
        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"city": {"cityId": "69266"}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual({'closeByEvents'}, data.keys())
        self.assertEqual(
            {'No date', 'Today', 'Future date'},
            {event.get('title') for event in data.get('closeByEvents', {}).get('events')})


if __name__ == '__main__':
    unittest.main()
