"""Unit tests for the commute module."""

import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


class CommuteScoringModelTestCase(scoring_test.ScoringModelTestBase('advice-commute')):
    """Unit test for the "Commute" scoring model."""

    # TODO(guillaume): Add more tests when the scoring model takes the city into account.

    def setUp(self):
        super(CommuteScoringModelTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.database.cities.insert_one({
            '_id': '69123',
            'longitude': 4.6965532,
            'latitude': 45.7179675
        })

        self.database.hiring_cities.insert_one({
            '_id': 'M1604',
            'hiringCities': [
                {
                    'offers': 10,
                    'city': {
                        'name': 'Brindas',
                        'longitude': 4.6965532,
                        'latitude': 45.7179675,
                        'population': 10000
                    }
                },
                {
                    'offers': 40,
                    'city': {
                        'name': 'Lyon',
                        'longitude': 4.8363116,
                        'latitude': 45.7640454,
                        'population': 400000
                    }
                },
                {
                    'offers': 40,
                    'city': {
                        'name': 'Saint-Priest',
                        'longitude': 4.9123846,
                        'latitude': 45.7013617,
                        'population': 20000
                    }
                },
                {
                    'offers': 40,
                    'city': {
                        'name': 'Vaulx-en-Velin',
                        'longitude': 4.8892431,
                        'latitude': 45.7775502,
                        'population': 10000
                    }
                }
            ]
        })

    def test_lyon(self):
        """Test that people in Lyon match."""

        self.persona.project.mobility.city.city_id = '69123'
        self.persona.project.target_job.job_group.rome_id = 'M1604'
        score = self._score_persona(self.persona)
        self.assertGreater(score, 1, msg='Fail for "{}"'.format(self.persona.name))

    def test_non_valid(self):
        """Test that people with a non-valid INSEE code should not get any commute advice."""

        self.persona.project.mobility.city.city_id = '691234'
        self.persona.project.target_job.job_group.rome_id = 'M1604'
        score = self._score_persona(self.persona)
        self.assertEqual(score, 0, msg='Fail for "{}"'.format(self.persona.name))

    def test_super_commute(self):
        """Test that people that wants to move and with super commute cities have score 3."""

        self.persona.project.mobility.city.city_id = '69123'
        self.persona.project.target_job.job_group.rome_id = 'M1604'
        if self.persona.project.mobility.area_type <= geo_pb2.CITY:
            self.persona.project.mobility.area_type = geo_pb2.DEPARTEMENT
        score = self._score_persona(self.persona)
        self.assertEqual(score, 3, msg='Fail for "{}"'.format(self.persona.name))

    def test_extra_data(self):
        """Compute extra data."""

        self.persona.project.mobility.city.city_id = '69123'
        self.persona.project.target_job.job_group.rome_id = 'M1604'
        project = self.persona.scoring_project(self.database)
        result = self.model.compute_extra_data(project)
        self.assertGreater(len(result.cities), 1, msg='Failed for "{}"'.format(self.persona.name))


class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../commute endpoint."""

    def setUp(self):
        super(EndpointTestCase, self).setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'commute',
            'triggerScoringModel': 'advice-commute',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_bad_project_id(self):
        """Test with a non existing project ID."""

        response = self.app.get(
            '/api/advice/commute/{}/foo'.format(self.user_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual(404, response.status_code)
        self.assertIn('Projet &quot;foo&quot; inconnu.', response.get_data(as_text=True))

    def test_no_cities(self):
        """Basic test with no cities."""

        response = self.app.get(
            '/api/advice/commute/{}/{}'.format(self.user_id, self.project_id),
            headers={'Authorization': 'Bearer ' + self.auth_token})

        self.assertEqual({}, self.json_from_response(response))

    def test_lyon(self):
        """Cities available close to Lyon."""

        user_id, auth_token = self.create_user_with_token(
            data={'projects': [{
                'mobility': {'city': {'cityId': '69123'}},
                'targetJob': {'jobGroup': {'romeId': 'A6789'}},
            }]})
        self._db.cities.insert_one({
            '_id': '69123',
            'name': 'Lyon',
            'longitude': 4.8363116,
            'latitude': 45.7640454,
            'population': 400000,
        })
        self._db.hiring_cities.insert_one({
            '_id': 'A6789',
            'hiringCities': [
                {
                    'offers': 10,
                    'city': {
                        'cityId': '69124',
                        'name': 'Brindas',
                        'longitude': 4.6965532,
                        'latitude': 45.7179675,
                        'population': 10000,
                    },
                },
                {
                    'offers': 40,
                    'city': {
                        'cityId': '69123',
                        'name': 'Lyon',
                        'longitude': 4.8363116,
                        'latitude': 45.7640454,
                        'population': 400000,
                    },
                },
            ],
        })
        user_info = self.get_user_info(user_id, auth_token)
        project_id = user_info['projects'][0]['projectId']
        response = self.app.get(
            '/api/advice/commute/{}/{}'.format(user_id, project_id),
            headers={'Authorization': 'Bearer ' + auth_token})

        self.assertEqual(
            ['Brindas'],
            [m.get('name') for m in self.json_from_response(response).get('cities', [])])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
