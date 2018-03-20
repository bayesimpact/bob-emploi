"""Unit tests for the module TODO: module name."""

import datetime
import json
import unittest

import mock

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceCreateYourCompanyTestCase(
        scoring_test.ScoringModelTestBase('advice-create-your-company')):
    """Unit tests for the "Create your company" scoring model."""

    def test_too_late(self):
        """Test the score after the date of all events."""

        persona = self._random_persona().clone()
        self.now = datetime.datetime(2018, 2, 25)
        score = self._score_persona(persona)
        self.assertEqual(0, score, msg='Fail for "{}"'.format(persona.name))

    def test_atypic_profile(self):
        """Test the scoring function before the events with an atypic profile."""

        persona = self._random_persona().clone()
        self.now = datetime.datetime(2018, 1, 25)
        persona.user_profile.frustrations.append(user_pb2.ATYPIC_PROFILE)
        score = self._score_persona(persona)
        self.assertEqual(2, score, msg='Fail for "{}"'.format(persona.name))

    def test_not_really_needed_yet(self):
        """Test the scoring function for someone that has just started their search."""

        persona = self._random_persona().clone()
        self.now = datetime.datetime(2018, 1, 25)
        del persona.user_profile.frustrations[:]
        persona.project.job_search_has_not_started = False
        persona.project.job_search_started_at.FromDatetime(datetime.datetime(2018, 12, 14))
        score = self._score_persona(persona)
        self.assertEqual(1, score, msg='Fail for "{}"'.format(persona.name))


class ExtraDataTestCase(base_test.ServerTestCase):
    """Unit tests for maybe_advise to compute extra data for advice modules."""

    def setUp(self):  # pylint: disable=missing-docstring,invalid-name
        super(ExtraDataTestCase, self).setUp()
        patcher = mock.patch(now.__name__ + '.get')
        mock_now = patcher.start()
        mock_now.return_value = datetime.datetime(2018, 1, 25)
        self.addCleanup(patcher.stop)
        self._db.advice_modules.insert_one({
            'adviceId': 'my-advice',
            'triggerScoringModel': 'advice-create-your-company',
            'extraDataFieldName': 'create_your_company_data',
            'isReadyForProd': True,
        })

    def test_close_to_city_with_events(self):
        """Test close to a city with multiple events."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'cityId': '69266'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
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
        ])

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')

        self.assertEqual('du 5 au 7 février', advice.get('createYourCompanyData', {}).get('period'))
        self.assertEqual('Lyon', advice.get('createYourCompanyData', {}).get('city'))

    def test_far_from_any_city_with_events(self):
        """Test far from any city with events."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'cityId': '67462'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.cities.insert_one({
            '_id': '67462',
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
        ])

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')

        self.assertEqual('du 5 au 7 février', advice.get('createYourCompanyData', {}).get('period'))
        self.assertFalse(advice.get('createYourCompanyData', {}).get('city'))

    def test_no_events(self):
        """Test without any events."""

        project = {
            'targetJob': {'jobGroup': {'romeId': 'A1234'}},
            'mobility': {'city': {'cityId': '67462'}},
            'jobSearchLengthMonths': 7, 'weeklyApplicationsEstimate': 'A_LOT',
            'totalInterviewCount': 1,
        }
        self._db.cities.insert_one({
            '_id': '67462',
            'latitude': 48.2667,
            'longitude': 7.45,
        })

        response = self.app.post(
            '/api/project/compute-advices',
            data=json.dumps({'projects': [project]}),
            content_type='application/json')
        advices = self.json_from_response(response)

        advice = next(
            a for a in advices.get('advices', [])
            if a.get('adviceId') == 'my-advice')

        self.assertEqual('du 5 au 7 février', advice.get('createYourCompanyData', {}).get('period'))
        self.assertFalse(advice.get('createYourCompanyData', {}).get('city'))


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../events endpoint."""

    def setUp(self):
        super(EndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'create-your-company',
            'triggerScoringModel': 'advice-create-your-company',
            'extraDataFieldName': 'create_your_company_data',
            'isReadyForProd': True,
        })

    def test_close_to_city_with_events(self):
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
            data='{"projects": [{"mobility": {"city": {"cityId": "69266"}}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual('Lyon', data.get('city'))
        self.assertEqual(
            ['Create your company', 'Work as a freelance'],
            [event.get('title') for event in data.get('events', [])])

    def test_far_from_any_city_with_events(self):
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
            data='{"projects": [{"mobility": {"city": {"cityId": "67462"}}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual({'events'}, data.keys())
        self.assertEqual(
            ['Entrepreneur in Dijon', 'Create your company'],
            [event.get('title') for event in data['events']])

    def test_no_location(self):
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
            data='{"projects": [{"mobility": {"city": {"cityId": "69266"}}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertEqual({'events'}, data.keys())
        self.assertEqual(
            {'Entrepreneur in Dijon', 'Create your company'},
            {event.get('title') for event in data['events']})

    def test_no_events(self):
        """Test without any events."""

        response = self.app.post(
            '/api/advice/create-your-company',
            data='{"projects": [{"mobility": {"city": {"cityId": "69266"}}}]}',
            content_type='application/json')

        data = self.json_from_response(response)
        self.assertFalse(data)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
