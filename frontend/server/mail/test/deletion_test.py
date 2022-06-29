"""Tests for the deletion emails."""

import datetime
import unittest

from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper


class DeleteOldUsersVarsTestCase(campaign_helper.CampaignTestBase):
    """Test of old user deletion email campaign variables."""

    campaign_id = 'account-deletion-notice'

    def setUp(self) -> None:
        super().setUp()
        self.user.profile.gender = user_profile_pb2.FEMININE
        self.user.profile.name = 'Nathalie'

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=800))

        self._assert_user_receives_campaign()
        self._assert_has_logged_url()
        self._assert_has_default_vars(first_name='Nathalie', gender='FEMININE')

        self._assert_remaining_variables({})

    def test_recent_user(self) -> None:
        """Check that we never send to a recent user."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=60))

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_recent_use(self) -> None:
        """User has an old account, with recent use."""

        self.user.registered_at.FromDatetime(datetime.datetime.now() - datetime.timedelta(days=800))
        self.user.requested_by_user_at_date.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=80))

        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
