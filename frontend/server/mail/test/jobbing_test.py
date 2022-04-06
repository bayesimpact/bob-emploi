"""Unit tests for the Jobbing mail module."""

import os
import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail.test import campaign_helper


_SCORING_MODELS_EXCEPT_JOBBING = dict(scoring.SCORING_MODELS)
del _SCORING_MODELS_EXCEPT_JOBBING['advice-reorient-jobbing']
_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


class JobbingTest(campaign_helper.CampaignTestBase):
    """Unit tests for the _get_jobbing_vars method."""

    campaign_id = 'jobbing'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.frustrations.append(user_profile_pb2.RESUME)

        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.opened_strategies.add(strategy_id='diploma-free-job')
        self.project.city.departement_id = '31'
        self.project.city.ClearField('departement_name')
        self.project.city.ClearField('departement_prefix')
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.job_group.rome_id = 'M1601'

        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self.database.local_diagnosis.insert_one({
            '_id': '31:M1601',
            'imt': {'yearlyAvgOffersPer10Candidates': 1},
        })
        self.database.reorient_jobbing.insert_one({
            '_id': '31',
            'departementJobStats': {
                'jobs': [
                    {
                        'romeId': 'A1413',
                        'masculineName': 'Aide caviste',
                        'feminineName': 'Aide caviste',
                        'name': 'Aide caviste',
                        'marketScore': 10,
                    },
                    {
                        'romeId': 'A1401',
                        'feminineName': 'Aide arboricole',
                        'masculineName': 'Aide arboricole',
                        'name': 'Aide arboricole',
                        'marketScore': 3,
                    },
                ],
            },
        })

    def test_basic_mail_blast(self) -> None:
        """Basic usage of a mail blast."""

        self._assert_user_receives_campaign()

    def test_not_started_strategy(self) -> None:
        """User did not started the diploma-free-job strategy."""

        del self.project.opened_strategies[:]
        self._assert_user_receives_focus(should_be_sent=False)

    def test_basic_focus(self) -> None:
        """Basic usage."""

        self._assert_user_receives_focus()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_logged_url('loginUrl', path='/projet/0')

        self._assert_remaining_variables({
            'inDepartement': 'en Haute-Garonne',
            'ofJobName': 'de steward',
            'jobs': [{'name': 'Aide caviste'}, {'name': 'Aide arboricole'}],
        })

    def test_undefined_project(self) -> None:
        """Undefined project."""

        self.project.ClearField('target_job')
        self._assert_user_receives_focus()

        self.assertEqual('de definir votre projet professionnel', self._variables['ofJobName'])

    @mock.patch.dict(scoring.SCORING_MODELS, _SCORING_MODELS_EXCEPT_JOBBING, clear=True)
    def test_missing_scoring_model(self) -> None:
        """Our scoring model is missing."""

        self._assert_user_receives_focus(should_be_sent=False)

    def test_no_better_market(self) -> None:
        """User is looking for a job where there's no better other jobs."""

        self.project.target_job.job_group.rome_id = 'M1602'
        self.database.local_diagnosis.insert_one({
            '_id': '31:M1602',
            'imt': {'yearlyAvgOffersPer10Candidates': 12},
        })

        self._assert_user_receives_focus(should_be_sent=False)


class JobbingShortTest(campaign_helper.CampaignTestBase):
    """Unit tests for the _get_jobbing_short_vars method."""

    campaign_id = 'jobbing-short'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.frustrations.append(user_profile_pb2.RESUME)

        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.project.opened_strategies.add(strategy_id='diploma-free-job')
        self.project.city.departement_id = '31'
        self.project.city.ClearField('departement_name')
        self.project.city.ClearField('departement_prefix')
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.job_group.rome_id = 'M1601'

        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self.database.local_diagnosis.insert_one({
            '_id': '31:M1601',
            'imt': {'yearlyAvgOffersPer10Candidates': 1},
        })
        self.database.reorient_jobbing.insert_one({
            '_id': '31',
            'departementJobStats': {
                'jobs': [
                    {
                        'romeId': 'A1413',
                        'masculineName': 'Aide caviste',
                        'feminineName': 'Aide caviste',
                        'name': 'Aide caviste',
                        'marketScore': 10,
                    },
                    {
                        'romeId': 'A1401',
                        'feminineName': 'Aide arboricole',
                        'masculineName': 'Aide arboricole',
                        'name': 'Aide arboricole',
                        'marketScore': 3,
                    },
                ],
            },
        })

    def test_basic_mail_blast(self) -> None:
        """Basic usage of a mail blast."""

        self._assert_user_receives_campaign()
        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')

        self._assert_remaining_variables({
            'inDepartement': 'en Haute-Garonne',
            'ofJobName': 'de steward',
            'jobs': [{'name': 'Aide caviste'}, {'name': 'Aide arboricole'}],
        })

    def test_not_started_strategy(self) -> None:
        """User did not started the diploma-free-job strategy."""

        del self.project.opened_strategies[:]
        self._assert_user_receives_focus(should_be_sent=False)

    def test_undefined_project(self) -> None:
        """Undefined project."""

        self.project.ClearField('target_job')
        self._assert_user_receives_campaign()

        self.assertEqual('de definir votre projet professionnel', self._variables['ofJobName'])

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_undefined_project_translation(self) -> None:
        """undefined project with tutoiement (fr@tu locale)."""

        self.user.profile.locale = 'fr@tu'
        self.project.ClearField('target_job')
        self._assert_user_receives_campaign()

        self.assertEqual('de definir ton projet professionnel', self._variables['ofJobName'])

    @mock.patch.dict(scoring.SCORING_MODELS, _SCORING_MODELS_EXCEPT_JOBBING, clear=True)
    def test_missing_scoring_model(self) -> None:
        """Our scoring model is missing."""

        self._assert_user_receives_focus(should_be_sent=False)

    def test_no_better_market(self) -> None:
        """User is looking for a job where there's no better other jobs."""

        self.project.target_job.job_group.rome_id = 'M1602'
        self.database.local_diagnosis.insert_one({
            '_id': '31:M1602',
            'imt': {'yearlyAvgOffersPer10Candidates': 12},
        })

        self._assert_user_receives_focus(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
