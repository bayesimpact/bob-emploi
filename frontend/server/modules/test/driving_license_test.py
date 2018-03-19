"""Unit tests for the driving_license module."""

import datetime
import unittest

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import scoring_test


class DrivingLicenseHelpScoringModelTestCase(
        scoring_test.ScoringModelTestBase('advice-driving-license-low-income')):
    """Unit tests for the "Get help for getting your driving license" advice."""

    def _create_scoreable_persona(self, rome_id='A1234', departement='69'):
        """Assumes user does not have CAR driving license,
        is old enough and has been searching for some time.
        """

        self.now = datetime.datetime(2018, 2, 2)
        self.database.local_diagnosis.insert_one({
            '_id': '{}:{}'.format(departement, rome_id),
            'salary': {
                'medianSalary': 18000,
            },
        })
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 1990
        persona.project.ClearField('job_search_has_not_started')
        persona.project.target_job.job_group.rome_id = rome_id
        persona.project.mobility.city.departement_id = departement
        persona.project.job_search_started_at.FromDatetime(datetime.datetime(2017, 5, 1))
        persona.user_profile.has_car_driving_license = user_pb2.FALSE
        return persona

    def test_already_has_license(self):
        """User already has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.has_car_driving_license = user_pb2.TRUE
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_license_status_unknown(self):
        """We don't know whether user has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.ClearField('has_car_driving_license')
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_young(self):
        """User is younger than required age for driving license."""

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 1995
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_not_searched_enough(self):
        """User hasn't been searching for long."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(datetime.datetime(2017, 11, 1))
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_too_rich(self):
        """User has probably too much in indemnities."""

        self.database.local_diagnosis.insert_one({
            '_id': '69:A1234',
            'salary': {
                'medianSalary': 25000,
            },
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.departement_id = '69'
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_big_city_not_required(self):
        """User lives in a large enough city with good public transportation,
        and job doesn't need a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [],
            },
        })
        persona = self._random_persona().clone()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 8
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_required_by_job(self):
        """Job group expects people to have a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'percentRequired': 50,
                }],
            },
        })
        persona = self._create_scoreable_persona(rome_id='A1234')
        persona.project.mobility.city.urban_score = 7
        score = self._score_persona(persona)

        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_small_city(self):
        """Small town people need cars more often."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 5
        persona.project.mobility.city.public_transportation_score = 7
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))

    def test_bad_transport_city(self):
        """City with bad public transportations forces people to use cars."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 3.2
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))

    def test_expanded_card_data(self):
        """city coordinates are given as expanded card data."""

        self.database.cities.insert_one({
            '_id': '69383',
            'latitude': 45.5,
            'longitude': 4.5,
        })

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.city_id = '69383'

        project = persona.scoring_project(self.database)
        result = self.model.get_expanded_card_data(project)

        self.assertEqual(result.latitude, 45.5, msg='Failed for "{}"'.format(persona.name))
        self.assertEqual(result.longitude, 4.5, msg='Failed for "{}"'.format(persona.name))


class DrivingLicenseOneEuroScoringModelTestCase(
        scoring_test.ScoringModelTestBase('advice-driving-license-euro')):
    """Unit tests for the "Driving License at 1 euro / day" advice."""

    def _create_scoreable_persona(self):
        """Assumes user does not have CAR driving license,
        is old enough and has been searching for some time.
        """

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 2000
        persona.user_profile.has_car_driving_license = user_pb2.FALSE
        return persona

    def test_already_has_license(self):
        """User already has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.has_car_driving_license = user_pb2.TRUE
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_license_status_unknown(self):
        """We don't know whether user has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.ClearField('has_car_driving_license')
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_young(self):
        """User is younger than required age for 1 euro driving license program."""

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 2004
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_old(self):
        """User is older than required age for 1 euro driving license program."""

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 1987
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_big_city_not_required(self):
        """User lives in a large enough city, and job doesn't need a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [],
            },
        })
        persona = self._random_persona().clone()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 7
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_required_by_job(self):
        """Job group expects people to have a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'percentRequired': 50,
                }],
            },
        })
        persona = self._create_scoreable_persona()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.urban_score = 7
        score = self._score_persona(persona)

        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_small_city(self):
        """Small town people need cars more often."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 5
        persona.project.mobility.city.public_transportation_score = 7
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))

    def test_bad_transport_city(self):
        """City with bad public transportations forces people to use cars."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 3.2
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))


class DrivingLicenseWrittenScoringModelTestCase(
        scoring_test.ScoringModelTestBase('advice-driving-license-written')):
    """Unit tests for the "Prepare your driving license written exam" advice."""

    def _create_scoreable_persona(self):
        """Assumes user does not have CAR driving license,
        is old enough and has been searching for some time.
        """

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 2000
        persona.user_profile.has_car_driving_license = user_pb2.FALSE
        return persona

    def test_already_has_license(self):
        """User already has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.has_car_driving_license = user_pb2.TRUE
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_license_status_unknown(self):
        """We don't know whether user has driving license."""

        persona = self._random_persona().clone()
        persona.user_profile.ClearField('has_car_driving_license')
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_is_too_young(self):
        """User is younger than required age for 1 euro driving license program."""

        self.now = datetime.datetime(2018, 2, 2)
        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = 2004
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_big_city_not_required(self):
        """User lives in a large enough city, and job doesn't need a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [],
            },
        })
        persona = self._random_persona().clone()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 7
        persona.project.target_job.job_group.rome_id = 'A1234'
        score = self._score_persona(persona)

        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_required_by_job(self):
        """Job group expects people to have a car."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'percentRequired': 50,
                }],
            },
        })
        persona = self._create_scoreable_persona()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.project.mobility.city.urban_score = 7
        score = self._score_persona(persona)

        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_small_city(self):
        """Small town people need cars more often."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 5
        persona.project.mobility.city.public_transportation_score = 7
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))

    def test_bad_transport_city(self):
        """City with bad public transportations forces people to use cars."""

        persona = self._create_scoreable_persona()
        persona.project.mobility.city.urban_score = 7
        persona.project.mobility.city.public_transportation_score = 3.2
        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 1, msg='Failed for "{}"'.format(persona.name))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
