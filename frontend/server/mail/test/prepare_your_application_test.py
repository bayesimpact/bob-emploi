"""Unit tests for the Improve CV mail module."""

import unittest

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper


class PrepareYourApplicationTest(campaign_helper.CampaignTestBase):
    """Unit tests for the _get_prepare_your_application_vars method."""

    campaign_id = 'prepare-your-application'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

    def test_basic_mail_blast(self) -> None:
        """Basic usage of a mail blast."""

        self._assert_user_receives_campaign()

    def test_basic_focus(self) -> None:
        """Basic usage of focus."""

        self._assert_user_receives_focus()

    def test_not_frustrated(self) -> None:
        """Not frustrated."""

        del self.user.profile.frustrations[:]
        del self.project.advices[:]

        self._assert_user_receives_focus()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self.assertFalse(self._variables.pop('hasInterviewFrustration'))
        self.assertFalse(self._variables.pop('hasSelfConfidenceFrustration'))
        self._assert_has_logged_url('loginUrl', '/projet/0')
        self._assert_remaining_variables({
            'deepLinkMotivationEmailUrl': '',
        })

    def test_frustrated(self) -> None:
        """Frustrated about everything."""

        self.user.profile.frustrations.append(user_pb2.SELF_CONFIDENCE)
        self.user.profile.frustrations.append(user_pb2.INTERVIEW)
        self.project.advices.add(advice_id='motivation-email')

        self._assert_user_receives_focus()

        self._assert_has_default_vars()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self.assertEqual('True', self._variables.pop('hasInterviewFrustration'))
        self.assertEqual('True', self._variables.pop('hasSelfConfidenceFrustration'))
        self._assert_has_logged_url('loginUrl', '/projet/0')
        self._assert_has_logged_url(
            'deepLinkMotivationEmailUrl',
            '/projet/0/methode/motivation-email'
        )
        self._assert_remaining_variables({})


if __name__ == '__main__':
    unittest.main()
