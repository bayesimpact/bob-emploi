"""Unit tests for the quick advisor part of bob_emploi.frontend.advisor module."""

import json
from typing import Any, Dict
import unittest

from bob_emploi.frontend.server.test import base_test


class QuickAdvisorTest(base_test.ServerTestCase):
    """Unit tests for the quick advisor."""

    def setUp(self) -> None:
        super().setUp()
        user_info = {'profile': {'name': 'Albert', 'yearOfBirth': 1973}}
        self.user_id, self.auth_token = self.create_user_with_token(data=user_info)

    def _update_user(self, user_data: Dict[str, Any]) -> None:
        self.app.post(
            '/api/user',
            data=json.dumps(user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})

    def test_empty_project(self) -> None:
        """Test a quick save when no project is set yet."""

        response = self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'profile': {'yearOfBirth': 1987}}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        self.assertEqual(200, response.status_code)

        json_user = self.get_user_info(self.user_id, self.auth_token)
        self.assertEqual(1987, json_user.get('profile', {}).get('yearOfBirth'))

    def test_city_field(self) -> None:
        """Test a quick advice when setting the city field."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'departementCounts': {
                '69': 365,
            },
        })

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [{'city': {'departementId': '69'}}]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'CITY_FIELD',
                'comment': {'stringParts': [
                    'Super, ', '365', ' personnes dans ce département ont déjà testé le '
                    'diagnostic de Bob\xa0!',
                ]},
            }]},
            response,
        )

    def test_target_job_field(self) -> None:
        """Test a quick advice when setting the target job field."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'jobGroupCounts': {
                'L1510': 256
            },
        })

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'TARGET_JOB_FIELD',
                'comment': {'stringParts': [
                    "Ça tombe bien, j'ai déjà accompagné ", '256', ' personnes pour ce métier\xa0!',
                ]},
            }]},
            response,
        )

    def test_salary_field(self) -> None:
        """Test a quick advice when setting the target job field to advise on salary."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{'city': {'departementId': '69'}}]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'SALARY_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'En général les gens demandent un salaire de 1 300 € à 15 200 € par mois.',
                ]},
            }]},
            response,
        )

    def test_salary_field_already_sent(self) -> None:
        """Test that we do not send the salary again if nothing changed."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'juniorSalary': {'shortText': 'De 1 300 € à 15 200 €'}}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['profile']['yearOfBirth'] = 1995
        user_info['projects'] = [{
            'city': {'departementId': '69'},
            'targetJob': {'jobGroup': {'romeId': 'L1510'}},
        }]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'name': 'New name'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertFalse(response)

    def test_required_diplomas_field(self) -> None:
        """Test that we send the required diplomas once we know the target job."""

        self._db.job_group_info.insert_one({
            '_id': 'B9876',
            'requirements': {'diplomas': [
                {
                    'name': 'Aucune formation',
                    'percentRequired': 70,
                    'diploma': {'level': 'NO_DEGREE'},
                },
                {'name': 'CAP', 'percentRequired': 28},
                {'name': 'Bac+12', 'percentRequired': 2},
            ]},
        })

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'B9876'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'REQUESTED_DIPLOMA_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'Les offres demandent souvent un CAP ou équivalent.',
                ]},
            }]},
            response,
        )

    def test_required_diplomas_field_sorted(self) -> None:
        """Test that we sort the required diplomas and only show the 2 top ones."""

        self._db.job_group_info.insert_one({
            '_id': 'B9876',
            'requirements': {'diplomas': [
                {
                    'name': 'Bac+5',
                    'percentRequired': 60,
                    'diploma': {'level': 'DEA_DESS_MASTER_PHD'},
                },
                {
                    'name': 'Bac+4',
                    'percentRequired': 25,
                    'diploma': {'level': 'LICENCE_MAITRISE'},
                },
                {
                    'name': 'Bac',
                    'percentRequired': 15,
                    'diploma': {'level': 'BAC_BACPRO'},
                },
            ]},
        })

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'B9876'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'REQUESTED_DIPLOMA_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'Les offres demandent souvent un Bac+4, Bac+5 ou équivalent.',
                ]},
            }]},
            response,
        )

    def test_required_diplomas_main(self) -> None:
        """Test that we return only one required diploma when it's hugely requested."""

        self._db.job_group_info.insert_one({
            '_id': 'B9876',
            'requirements': {'diplomas': [
                {
                    'name': 'Bac+5',
                    'percentRequired': 75,
                    'diploma': {'level': 'DEA_DESS_MASTER_PHD'},
                },
                {
                    'name': 'Bac+4',
                    'percentRequired': 20,
                    'diploma': {'level': 'LICENCE_MAITRISE'},
                },
            ]},
        })

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'B9876'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'REQUESTED_DIPLOMA_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': [
                    'Les offres demandent souvent un Bac+5 ou équivalent.',
                ]},
            }]},
            response,
        )

    def test_employment_type_field(self) -> None:
        """Test a quick advice when setting the target job field to advise on employment type."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'employmentTypePercentages': [
                {'employmentType': 'CDI', 'percentage': 45.9},
                {'employmentType': 'INTERNSHIP', 'percentage': 38},
                {'employmentType': 'INTERIM', 'percentage': 16.1},
            ]}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['projects'] = [{'city': {'departementId': '69'}}]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'EMPLOYMENT_TYPE_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': ['Plus de 45% des offres sont en CDI.']},
            }]},
            response,
        )

    def test_employment_type_field_all_offers(self) -> None:
        """Advise on employment type when all offers are in interim."""

        self._db.local_diagnosis.insert_one({
            '_id': '69:L1510',
            'imt': {'employmentTypePercentages': [
                {'employmentType': 'INTERIM', 'percentage': 98.5},
            ]}
        })

        user_info = self.get_user_info(self.user_id, self.auth_token)
        # Junior user.
        user_info['projects'] = [{'city': {'departementId': '69'}}]
        self._update_user(user_info)

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {'projects': [
                {'targetJob': {'jobGroup': {'romeId': 'L1510'}}},
            ]}}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'EMPLOYMENT_TYPE_FIELD',
                'isBeforeQuestion': True,
                'comment': {'stringParts': ['La plupart des offres sont en intérim.']},
            }]},
            response,
        )

    def test_i18n(self) -> None:
        """Test a quick advice when setting the city field in English."""

        self._db.user_count.insert_one({
            'aggregatedAt': '2016-11-15T16:51:55Z',
            'departementCounts': {
                '69': 365,
            },
        })
        self._db.translations.insert_many([
            {
                'string': 'Super, <strong>{count}</strong> personnes dans ce département ont déjà '
                          'testé le diagnostic de Bob\xa0!',
                'en': 'Great, <strong>{count}</strong> people have tested Bob in this area!',
            }
        ])

        response = self.json_from_response(self.app.post(
            f'/api/user/{self.user_id}/update-and-quick-diagnostic',
            data=json.dumps({'user': {
                'profile': {'locale': 'en'},
                'projects': [{'city': {'departementId': '69'}}],
            }}),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token}))
        self.assertEqual(
            {'comments': [{
                'field': 'CITY_FIELD',
                'comment': {'stringParts': [
                    'Great, ', '365', ' people have tested Bob in this area!',
                ]},
            }]},
            response,
        )


if __name__ == '__main__':
    unittest.main()
