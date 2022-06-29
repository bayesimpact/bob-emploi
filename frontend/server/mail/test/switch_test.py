"""Unit tests for the Switch mail module."""

import datetime
import unittest

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper


class SwitchVarsTestCase(campaign_helper.CampaignTestBase):
    """Unit tests for the switch-grant focus email."""

    campaign_id = 'switch-grant'

    def setUp(self) -> None:
        super().setUp()

        self.now = datetime.datetime(2020, 9, 21)
        self.user.profile.year_of_birth = 1982
        self.project.seniority = project_pb2.EXPERT
        self.project.kind = project_pb2.FIND_A_NEW_JOB

        # TODO(cyrille): Move tests on firstName and gender to a test on get_default_variables.
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()

        self._assert_has_unsubscribe_url(field='changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link(field='statusUpdateUrl')

        self._assert_remaining_variables({
            'isConverting': '',
        })

    def test_very_young(self) -> None:
        """User is very young."""

        self.user.profile.year_of_birth = 2002

        self._assert_user_receives_campaign(False)

    def test_junior(self) -> None:
        """User is new in their job."""

        self.project.seniority = project_pb2.JUNIOR

        self._assert_user_receives_campaign(False)

    def test_reorientation(self) -> None:
        """User wants to convert."""

        self.project.kind = project_pb2.REORIENTATION

        self._assert_user_receives_campaign()

        self.assertTrue(self._variables.get('isConverting'))


if __name__ == '__main__':
    unittest.main()
