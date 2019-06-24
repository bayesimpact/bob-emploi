"""Unit tests for the strategist module."""

import json
import typing
import unittest

from bob_emploi.frontend.server.test import base_test


class StrategyModulesTestCase(base_test.ServerTestCase):
    """Test strategy modules generation."""

    def setUp(self) -> None:
        super().setUp()
        # The default user should get strategies.
        self._db.strategy_modules.insert_many([
            {
                'categoryIds': ['stuck-market', 'find-what-you-like'],
                'strategyId': 'application-method',
                'triggerScoringModel': 'constant(1)',
                'title': 'Un troisième titre',
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
        self._db.translations.insert_one({
            'string': 'Vous devriez utiliser un commutateur',
            'fr_FR@tu': 'Tu devrais utiliser un commutateur',
        })
        self.user_id, self.auth_token = self.authenticate_new_user_token(email='foo@bar.com')
        # Modify this user if you don't want them to get a strategy.
        self.project: typing.Dict[str, typing.Any] = {
            'advices': [{'adviceId': 'commute', 'numStars': 2}],
            'city': {'name': 'Toulouse'},
            'diagnostic': {'categoryId': 'stuck-market'},
        }
        self.user_data: typing.Dict[str, typing.Any] = {
            'userId': self.user_id,
            'profile': {
                'canTutoie': True,
                'email': 'foo@bar.com',
                'gender': 'FEMININE',
            },
            'projects': [self.project],
        }

    def test_get_strategy_two_control(self) -> None:
        """User cannot get a strategy if they're in the control group for strat_two."""

        self._user_db.user.update_one({}, {'$set': {'featuresEnabled.stratTwo': 'CONTROL'}})
        response = self.app.post(
            '/api/user',
            data=json.dumps(self.user_data),
            content_type='application/json',
            headers={'Authorization': 'Bearer ' + self.auth_token})
        user_info = self.json_from_response(response)

        project = user_info['projects'][0]
        self.assertFalse(project.get('strategies'))
        self.assertEqual('CONTROL', user_info['featuresEnabled'].get('stratTwo'))

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
        self.assertEqual('ACTIVE', user_info['featuresEnabled'].get('stratTwo'))

    def test_get_strategy_in_other_category(self) -> None:
        """User gets a strategy on complete project if they have one advice in it."""

        self.user_data['projects'][0]['diagnostic']['categoryId'] = 'find-what-you-like'
        self.user_data['projects'][0]['advices'].append({'adviceId': 'improve-resume'})
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
        self.assertEqual('ACTIVE', user_info['featuresEnabled'].get('stratTwo'))

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

    def test_get_alpha_strategies(self) -> None:
        """Ensure an alpha user get strategies for a category in the works."""

        self._db.diagnostic_category.insert_one({
            'categoryId': 'stuck-market',
            'strategiesIntroduction': 'Stuck Market',
            'areStrategiesForAlphaOnly': True,
            'order': 1,
        })

        user_id, auth_token = self.authenticate_new_user_token(email='foo@example.com')
        # Modify this user if you don't want them to get a strategy.
        user_data: typing.Dict[str, typing.Any] = {
            'userId': user_id,
            'profile': {
                'canTutoie': True,
                'email': 'foo@example.com',
                'gender': 'FEMININE',
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

    def test_dont_get_alpha_strategies_if_not_alpha(self) -> None:
        """Ensure a non-alpha user does not get strategies for a category in the works."""

        self._db.diagnostic_category.insert_one({
            'categoryId': 'stuck-market',
            'strategiesIntroduction': 'Stuck Market',
            'areStrategiesForAlphaOnly': True,
            'order': 1,
        })

        self.project['advices'] = [
            {'adviceId': 'other-work-env'},
            {'adviceId': 'network-application'},
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
        self.assertFalse([s.get('strategyId') for s in strategies])

    def test_get_specific_to_job(self) -> None:
        """Ensure specific-to-job advice is given in the relevant strategies."""

        self._db.specific_to_job_advice.insert_one({
            'filters': ['for-job-group(A1234)'],
            'goal': 'planter des choux dans votre jardin',
            'strategyIds': ['other-leads']
        })
        self._db.translations.insert_one({
            'string': 'planter des choux dans votre jardin',
            'fr_FR@tu': 'planter des choux dans ton jardin',
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


if __name__ == '__main__':
    unittest.main()
