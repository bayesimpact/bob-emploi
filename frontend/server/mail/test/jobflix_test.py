"""Tests for the FFS email."""

import datetime
import os
import unittest
from unittest import mock

from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.server import product
from bob_emploi.frontend.server.mail.test import campaign_helper


class JobflixInviteCampaignTests(campaign_helper.CampaignTestBase):
    """Unit tests."""

    campaign_id = 'jobflix-invite'

    def setUp(self) -> None:
        super().setUp()
        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_MAXIMUM

    def test_main(self) -> None:
        """Overall test."""

        self._assert_user_receives_focus()

        template_vars = self._variables
        self.assertEqual('Jobflix', template_vars.pop('sideProductName'))
        self.assertEqual(
            'https://www.jobflix.app?utm_source=bob&utm_medium=email',
            template_vars.pop('sideProductUrl'))
        self._assert_has_unsubscribe_url()

    def test_uk_vars(self) -> None:
        """Update jobflix name and vars for the UK."""

        uk_server_config = (
            '{"baseUrl": "https://uk.hellobob.com", '
            '"plugins":{"jobflix":{"productName":"T-Pro","productUrl":"/orientation"}}}')
        with mock.patch.dict(os.environ, {'SERVER_CONFIG': uk_server_config}):
            product.bob.load_from_env()
            self.addCleanup(product.bob.load_from_env)

            self._assert_user_receives_focus()

            template_vars = self._variables
            self.assertEqual('T-Pro', template_vars.pop('sideProductName'))
            self.assertEqual(
                'https://uk.hellobob.com/orientation?utm_source=bob&utm_medium=email',
                template_vars.pop('sideProductUrl'))


class JobflixFirstEvalCampaignTests(campaign_helper.CampaignTestBase):
    """Unit tests."""

    campaign_id = 'jobflix-first-eval'

    def test_main(self) -> None:
        """Overall test."""

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_jobflix_user(self) -> None:
        """Do not send to Joblix users if they haven't received the first email."""

        self.project.opened_strategies.add(strategy_id='upskilling')

        self._assert_user_receives_campaign()


class JobflixFirstEvalRemindersCampaignTests(campaign_helper.CampaignTestBase):
    """Unit tests."""

    campaign_id = 'jobflix-first-eval-reminder'

    def test_main(self) -> None:
        """Overall test."""

        self.now = datetime.datetime(2022, 3, 17)
        self.user.emails_sent.add(campaign_id='jobflix-first-eval')

        self._assert_user_receives_campaign()

        self.assertEqual('jeudi 24 mars', self._variables['closingDate'])

    def test_jobflix_user_no_first_campaign(self) -> None:
        """Do not send to Joblix users if they haven't received the first email."""

        self.project.opened_strategies.add(strategy_id='upskilling')

        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
