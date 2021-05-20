"""Unit tests for the events module."""

import datetime
import unittest
from unittest import mock

from bob_emploi.common.python import now
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class AdviceEventScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit test for the "Event Advice" scoring model."""

    model_id = 'advice-event'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()
        self.database.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

    def test_important_application(self) -> None:
        """Network is important for the user."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.city.departement_id = '69'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(self.persona)
        self.assertGreaterEqual(score, 2, msg=f'Fail for "{self.persona.name}"')

    def test_unimportant_application(self) -> None:
        """Network is important for the user."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.city.departement_id = '69'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'R4Z92': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 1, msg=f'Fail for "{self.persona.name}"')


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../events endpoint."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'events',
            'triggerScoringModel': 'advice-event',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self) -> None:
        """Test with a non existing project ID."""

        response = self.app.get(
            f'/api/advice/events/{self.user_id}/foo',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_events(self) -> None:
        """Basic test with no events."""

        response = self.app.get(
            f'/api/advice/events/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        events = self.json_from_response(response)
        self.assertEqual({}, events)

    @mock.patch(now.__name__ + '.get')
    def test_with_events(self, mock_now: mock.MagicMock) -> None:
        """Basic test with alpha user and constant events."""

        mock_now.return_value = datetime.datetime(2017, 8, 21)
        self._db.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

        response = self.app.get(
            f'/api/advice/events/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        events = self.json_from_response(response)
        self.assertEqual(
            [
                'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'Le Salon du Travail et de la Mobilité Professionnelle',
            ],
            [e.get('title') for e in events.get('events', [])])

    @mock.patch(now.__name__ + '.get')
    def test_with_old_events(self, mock_now: mock.MagicMock) -> None:
        """Basic test with alpha user and constant events, some being in the past."""

        mock_now.return_value = datetime.datetime(2017, 9, 17)
        self._db.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

        response = self.app.get(
            f'/api/advice/events/{self.user_id}/{self.project_id}',
            headers={'Authorization': 'Bearer ' + self.auth_token})

        events = self.json_from_response(response)
        self.assertEqual(
            ['Le Salon du Travail et de la Mobilité Professionnelle'],
            [e.get('title') for e in events.get('events', [])])

    @mock.patch(now.__name__ + '.get')
    def test_compute_endpoint(self, mock_now: mock.MagicMock) -> None:
        """Use the compute (POST) endpoint that does not require authentication."""

        mock_now.return_value = datetime.datetime(2017, 8, 21)
        self._db.events.insert_many([
            {
                'title': 'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'link': 'https://www.workuper.com/events/ap-heros-candidats-madircom-bordeaux',
                'organiser': 'MADIRCOM',
                'startDate': '2017-08-29',
            },
            {
                'title': 'Le Salon du Travail et de la Mobilité Professionnelle',
                'link': 'https://www.workuper.com/events/le-salon-du-travail-et-de-la-mobilite-'
                        'professionnelle',
                'organiser': 'Altice Media Events',
                'startDate': '2018-01-19',
            },
        ])

        response = self.app.post(
            '/api/advice/events', data='{"projects": [{}]}', content_type='application/json')

        events = self.json_from_response(response)
        self.assertEqual(
            [
                'AP HEROS CANDIDATS MADIRCOM - BORDEAUX',
                'Le Salon du Travail et de la Mobilité Professionnelle',
            ],
            [e.get('title') for e in events.get('events', [])])


if __name__ == '__main__':
    unittest.main()
