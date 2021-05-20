"""Unit tests for the strategist module."""

import json
from typing import Any, Dict
import unittest
from unittest import mock

from bob_emploi.frontend.server.test import base_test


class StrategyModulesTestCase(base_test.ServerTestCase):
    """Test strategy modules generation."""

    def setUp(self) -> None:
        super().setUp()
        # The default user should get strategies.
        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'stuck-market',
            'strategiesIntroduction': 'Stuck Market',
            'order': 1,
        })
        self._db.strategy_modules.insert_many([
            {
                'categoryIds': ['stuck-market', 'find-what-you-like'],
                'strategyId': 'application-method',
                'triggerScoringModel': 'constant(1)',
                'title': 'Un troisième titre',
                'descriptionTemplate': 'Vous êtes fait%eFeminine pour cette stratégie',
            },
            {
                'categoryIds': ['stuck-market'],
                'strategyId': 'other-leads',
                'triggerScoringModel': 'constant(3)',
                'title': 'Un titre',
                'headerTemplate': 'Un template %inCity',
            },
            {
                'categoryIds': ['stuck-market'],
                'strategyId': 'before-search',
                'triggerScoringModel': 'constant(2)',
                'title': 'Un autre titre',
            },
        ])
        self._db.strategy_advice_templates.insert_many([
            {
                'adviceId': 'other-work-env',
                'strategyId': 'other-leads',
            },
            {
                'adviceId': 'commute',
                'headerTemplate': 'Vous devriez utiliser un commutateur',
                'strategyId': 'other-leads',
                'teaserTemplate': 'Apprends à commuter',
            },
            {
                'adviceId': 'network-application',
                'strategyId': 'before-search',
            },
            {
                'adviceId': 'improve-resume',
                'strategyId': 'application-method',
            },
        ])
        self._db.translations.insert_many([
            {
                'string': 'Vous devriez utiliser un commutateur',
                'fr@tu': 'Tu devrais utiliser un commutateur',
            },
            {
                'string': 'strategyModules:application-method:description_template',
                'fr': 'Vous êtes fait%eFeminine pour cette stratégie',
                'fr@tu': 'Tu es fait%eFeminine pour cette stratégie',
            }
        ])
        self.user_id, self.auth_token = self.authenticate_new_user_token(email='foo@bar.com')
        # Modify this user if you don't want them to get a strategy.
        self.project: Dict[str, Any] = {
            'advices': [{'adviceId': 'commute', 'numStars': 2}],
            'city': {'name': 'Toulouse'},
            'diagnostic': {
                'categoryId': 'stuck-market',
                'categories': [{'categoryId': 'stuck-market', 'relevance': 1}],
            },
        }
        self.user_data: Dict[str, Any] = {
            'userId': self.user_id,
            'profile': {
                'email': 'foo@bar.com',
                'gender': 'FEMININE',
                'locale': 'fr@tu',
            },
            'projects': [self.project],
        }

    def test_get_strategy_two_control(self) -> None:
        """User in the control group for strat_two coming back ignore their strat_two flag."""

        self._user_db.user.update_one({}, {'$set': {'featuresEnabled.stratTwo': 'CONTROL'}})
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        project = user_info['projects'][0]
        self.assertTrue(project.get('strategies'))
        self.assertEqual(
            'CONTROL', user_info['featuresEnabled'].get('stratTwo'),
            msg='control flag should be kept')

    def test_get_strategy(self) -> None:
        """User gets a strategy on complete project if they have one advice in it."""

        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        project = user_info['projects'][0]
        self.assertTrue(project.get('strategies'), msg=project)
        strategy = project['strategies'][0]
        self.assertEqual(100, strategy.get('score'))
        self.assertFalse(strategy.get('isSecondary'))
        self.assertEqual('Un titre', strategy.get('title'))
        self.assertEqual('Un template à Toulouse', strategy.get('header'))
        self.assertEqual(
            [{
                'adviceId': 'commute',
                'header': 'Tu devrais utiliser un commutateur',
                'teaser': 'Apprends à commuter',
            }],
            strategy.get('piecesOfAdvice'))
        self.assertFalse(user_info['featuresEnabled'].get('stratOne'))

    def test_get_strategy_in_other_category(self) -> None:
        """User gets a strategy on complete project if they have one advice in it."""

        self.project['diagnostic']['categoryId'] = 'find-what-you-like'
        self.project['advices'].append({'adviceId': 'improve-resume'})
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        project = user_info['projects'][0]
        self.assertTrue(project.get('strategies'), msg=project)
        strategy = project['strategies'][0]
        self.assertEqual('Un troisième titre', strategy.get('title'))
        self.assertEqual([{'adviceId': 'improve-resume'}], strategy.get('piecesOfAdvice'))
        self.assertFalse(user_info['featuresEnabled'].get('stratOne'))

    def test_dont_get_strategy(self) -> None:
        """User doesn't get a strategy if they don't have the required advice."""

        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        self.project['advices'] = [{'adviceId': 'specific-to-job', 'numStars': 2}]
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        self.assertFalse(user_info['projects'][0].get('strategies'))

    def test_strategy_end_point(self) -> None:
        """Make strategies from a user proto."""

        response = self.app.post(
            '/api/project/strategize',
            data=json.dumps(self.user_data),
            content_type='application/json')
        strategies = self.json_from_response(response).get('strategies', [])
        self.assertEqual(1, len(strategies), msg=strategies)

    def test_get_strategies(self) -> None:
        """Ensure one can get all the strategies from DB, ordered by score."""

        self.project['advices'] = [
            {'adviceId': 'other-work-env'},
            {'adviceId': 'network-application-good'},
            {'adviceId': 'improve-resume'},
        ]
        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        strategies = user_info['projects'][0].get('strategies', [])
        self.assertEqual(
            ['other-leads', 'before-search', 'application-method'],
            [s.get('strategyId') for s in strategies])
        self.assertEqual(
            ['other-work-env', 'network-application-good', 'improve-resume'],
            [s.get('piecesOfAdvice', [])[0].get('adviceId') for s in strategies])
        self.assertEqual(
            'Tu es faite pour cette stratégie', strategies[2].get('description'))
        self.assertTrue(strategies[0].get('isPrincipal'))
        self.assertNotIn(True, [s.get('isPrincipal') for s in strategies[1:]])

    def test_get_alpha_strategies(self) -> None:
        """Ensure an alpha user get strategies for a category in the works."""

        self._db.diagnostic_main_challenges.drop()
        self._db.diagnostic_main_challenges.insert_one({
            'categoryId': 'stuck-market',
            'strategiesIntroduction': 'Stuck Market',
            'areStrategiesForAlphaOnly': True,
            'order': 1,
        })

        user_id, auth_token = self.authenticate_new_user_token(email='foo@example.com')
        # Modify this user if you don't want them to get a strategy.
        user_data: Dict[str, Any] = {
            'userId': user_id,
            'profile': {
                'email': 'foo@example.com',
                'gender': 'FEMININE',
                'locale': 'fr@tu',
            },
            'projects': [self.project],
        }
        self.project['advices'] = [
            {'adviceId': 'other-work-env'},
            {'adviceId': 'network-application'},
            {'adviceId': 'improve-resume'},
        ]
        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        response = self.app.post(
            '/api/user',
            data=json.dumps(user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + auth_token})
        user_info = self.json_from_response(response)
        strategies = user_info['projects'][0].get('strategies', [])
        self.assertEqual(
            ['other-leads', 'before-search', 'application-method'],
            [s.get('strategyId') for s in strategies])

    def test_get_specific_to_job(self) -> None:
        """Ensure specific-to-job advice is given in the relevant strategies."""

        self._db.specific_to_job_advice.insert_one({
            'filters': ['for-job-group(A1234)'],
            'goal': 'planter des choux dans votre jardin',
            'strategyIds': ['other-leads']
        })
        self._db.translations.insert_one({
            'string': 'planter des choux dans votre jardin',
            'fr@tu': 'planter des choux dans ton jardin',
        })
        self.project['targetJob'] = {'jobGroup': {'romeId': 'A1234'}}
        self.project['advices'] = [
            {'adviceId': 'other-work-env'},
            {'adviceId': 'specific-to-job'},
        ]
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        strategies = user_info['projects'][0].get('strategies', [])
        self.assertEqual(['other-leads'], [s.get('strategyId') for s in strategies])
        pieces_of_advice = strategies[0].get('piecesOfAdvice', [])
        self.assertCountEqual(
            ['other-work-env', 'specific-to-job'], [a.get('adviceId') for a in pieces_of_advice])
        # Teaser should not be set from the server.
        self.assertFalse(next(
            a.get('teaser') for a in pieces_of_advice if a.get('adviceId') == 'specific-to-job'))

    def test_capped_score(self) -> None:
        """Ensure that a large delta is capped if the user already has a big score."""

        self.project['diagnostic'] = {
            'categoryId': 'stuck-market',
            'overallScore': 80,
        }
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        strategies = user_info['projects'][0].get('strategies', [])
        self.assertTrue(strategies)
        for strategy in strategies:
            self.assertGreaterEqual(20, strategy['score'])

    def test_secondary(self) -> None:
        """Ensure that low score strategies are flagged as secondary."""

        self._db.strategy_modules.update_one(
            {'strategyId': 'other-leads'},
            {'$set': {'triggerScoringModel': 'constant(.3)'}})
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        strategy = next(
            strat for
            strat in user_info['projects'][0].get('strategies', [])
            if strat.get('strategyId') == 'other-leads')
        self.assertTrue(strategy.get('isSecondary'))

    def test_hide_alpha_strategy(self) -> None:
        """User does not get alpha strategies if they are not in alpha version."""

        self._db.strategy_modules.update_one(
            {'strategyId': 'other-leads'},
            {'$set': {'isForAlpha': True}})

        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        strategy_ids = [
            strat.get('strategyId')
            for strat in user_info['projects'][0].get('strategies', [])
        ]
        self.assertNotIn('other-leads', strategy_ids)

    def test_show_alpha_strategy(self) -> None:
        """User gets alpha strategies if they are in alpha version."""

        self._db.strategy_modules.update_one(
            {'strategyId': 'other-leads'},
            {'$set': {'isForAlpha': True}})

        self.user_data['featuresEnabled'] = {'alpha': True}
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        strategy_ids = [
            strat.get('strategyId')
            for strat in user_info['projects'][0].get('strategies', [])
        ]
        self.assertIn('other-leads', strategy_ids)

    def test_get_strategy_external_url(self) -> None:
        """User gets a strategy even if there are no advice modules, if it has an external URL."""

        self._db.strategy_modules.update_one(
            {'strategyId': 'other-leads'},
            {'$set': {'externalUrlTemplate': '/orientation?departement=%departementId'}})

        self.project['city']['departementId'] = '31'
        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        self.project['advices'] = []
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        self.assertFalse(user_info['projects'][0].get('advices'))
        self.assertTrue(user_info['projects'][0].get('strategies'))
        strategy = user_info['projects'][0]['strategies'][0]
        self.assertEqual('/orientation?departement=31', strategy.get('externalUrl'))

    @mock.patch('logging.error')
    def test_get_strategy_external_url_with_methods(self, mock_logging: mock.MagicMock) -> None:
        """User gets a strategy with both methods and an external URL."""

        self._db.strategy_modules.update_one(
            {'strategyId': 'other-leads'},
            {'$set': {'externalUrlTemplate': '/orientation?departement=%departementId'}})

        self.project['city']['departementId'] = '31'
        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        self.assertTrue(user_info['projects'][0].get('advices'))
        self.assertTrue(user_info['projects'][0].get('strategies'))
        strategy = user_info['projects'][0]['strategies'][0]
        self.assertTrue(strategy.get('piecesOfAdvice'))
        self.assertEqual('/orientation?departement=31', strategy.get('externalUrl'))

        self.assertTrue(mock_logging.called)
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn(
            'Strategy other-leads has both an external URL and some pieces of advice',
            error_message)

    @mock.patch('logging.error')
    def test_no_strategies(self, mock_error: mock.MagicMock) -> None:
        """Properly log when no strategies match."""

        self.project['advices'] = [
            {'adviceId': 'a-very-old-module'},
        ]
        self.project['diagnostic'] = {'categoryId': 'stuck-market'}
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)
        mock_error.assert_called_once()
        error_message = mock_error.call_args[0][0] % mock_error.call_args[0][1:]
        self.assertIn('We could not find *any* strategy', error_message)
        self.assertIn('application-method, other-leads, before-search', error_message)
        self.assertIn('a-very-old-module', error_message)
        strategies = user_info['projects'][0].get('strategies', [])
        self.assertFalse([s.get('strategyId') for s in strategies])


if __name__ == '__main__':
    unittest.main()
