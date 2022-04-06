"""Unit tests for the frontend.network module."""

import json
import os
import unittest
from unittest import mock

from bob_emploi.frontend.server.test import base_test
from bob_emploi.frontend.server.test import scoring_test


_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


class ImproveYourNetworkScoringModelTestCase(scoring_test.ScoringModelTestBase):
    """Unit test for the "Improve your network" scoring model."""

    model_id = 'advice-improve-network'

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()

    def test_strong_network(self) -> None:
        """User already has a strong or good enough network."""

        if self.persona.project.network_estimate < 2:
            self.persona.project.network_estimate = 2
        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 0, msg=f'Fail for "{self.persona.name}"')

    def test_network_is_best_application_mode(self) -> None:
        """User is in a job that hires a lot through network."""

        self.persona = self._clone_persona('malek')
        self.persona.project.network_estimate = 1
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
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(self.persona)
        self.assertGreaterEqual(score, 3, msg=f'Fail for "{self.persona.name}"')

    def test_network_is_not_the_best_application_mode(self) -> None:
        """User is in a job that does not use network a lot to hire."""

        self.persona.project.network_estimate = 1
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
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Fail for "{self.persona.name}"')

    def test_network_is_not_always_the_best_application_mode(self) -> None:
        """User is in a job that does not use only network to hire."""

        self.persona.project.network_estimate = 1
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.city.departement_id = '69'
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {
                'Foo': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
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
                },
                'Bar': {
                    'modes': [
                        {
                            'percentage': 36.38,
                            'mode': 'PERSONAL_OR_PROFESSIONAL_CONTACTS'
                        },
                        {
                            'percentage': 29.46,
                            'mode': 'UNDEFINED_APPLICATION_MODE'
                        },
                        {
                            'percentage': 18.38,
                            'mode': 'PLACEMENT_AGENCY'
                        },
                        {
                            'percentage': 15.78,
                            'mode': 'SPONTANEOUS_APPLICATION'
                        }
                    ],
                }
            },
        })
        score = self._score_persona(self.persona)
        self.assertEqual(score, 2, msg=f'Fail for "{self.persona.name}"')


@mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
class EndpointTestCase(base_test.ServerTestCase):
    """Unit tests for the project/.../network-* endpoints."""

    def setUp(self) -> None:
        super().setUp()
        self._db.advice_modules.insert_one({
            'adviceId': 'network-advice-id',
            'triggerScoringModel': 'advice-better-network',
        })
        self.user_id, self.auth_token = self.create_user_with_token(
            modifiers=[base_test.add_project_modifier], advisor=True)
        user_info = self.get_user_info(self.user_id, self.auth_token)
        self.project_id = user_info['projects'][0]['projectId']

    def test_basic(self) -> None:
        """Get expanded card data."""

        self._db.contact_lead.insert_many([
            {
                'name': 'Le maire %ofCity',
                'emailTemplate': 'Bonjour, je cherche un emploi %ofJobName.',
                'contactTip': 'Après le conseil municipal',
            },
        ])
        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['projects'][0]['targetJob'] = {'name': 'facteur'}
        user_info['projects'][0]['city'] = {'name': 'Sartrouville'}
        self.app.post(
            '/api/user',
            data=json.dumps(user_info),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self.auth_token}'})

        response = self.app.get(
            f'/api/advice/network-advice-id/{self.user_id}/{self.project_id}',
            headers={'Authorization': f'Bearer {self.auth_token}'})

        leads = self.json_from_response(response)
        self.assertEqual(
            {'leads': [{
                'name': 'Le maire de Sartrouville',
                'emailExample': 'Bonjour, je cherche un emploi de facteur.',
                'contactTip': 'Après le conseil municipal',
            }]},
            leads)

    # TODO(sil): Make sure %ofCity is translated to.
    def test_translations(self) -> None:
        """Get expanded card data translations."""

        self._db.contact_lead.insert_many([
            {
                'name': 'Le maire %ofCity',
                'emailTemplate': 'Bonjour, je cherche un emploi %ofJobName.',
                'contactTip': 'Après le conseil municipal',
            },
        ])
        self.add_translations([
            {
                'string': 'Bonjour, je cherche un emploi %ofJobName.',
                'en': "Hi, I'm looking for a job %ofJobName.",
            },
            {
                'string': 'Après le conseil municipal',
                'en': 'After the city council',
            },
            {
                'string': 'Le maire %ofCity',
                'en': 'The mayor %ofCity',
            },
        ])
        user_info = self.get_user_info(self.user_id, self.auth_token)
        user_info['profile']['locale'] = 'en'
        user_info['projects'][0]['targetJob'] = {'name': 'postman'}
        user_info['projects'][0]['city'] = {'name': 'Sartrouville'}
        self.app.post(
            '/api/user',
            data=json.dumps(user_info),
            content_type='application/json',
            headers={'Authorization': f'Bearer {self.auth_token}'})

        response = self.app.get(
            f'/api/advice/network-advice-id/{self.user_id}/{self.project_id}',
            headers={'Authorization': f'Bearer {self.auth_token}'})

        leads = self.json_from_response(response)
        self.assertEqual(
            {'leads': [{
                'name': 'The mayor of Sartrouville',
                'emailExample': "Hi, I'm looking for a job of postman.",
                'contactTip': 'After the city council',
            }]},
            leads)


if __name__ == '__main__':
    unittest.main()
