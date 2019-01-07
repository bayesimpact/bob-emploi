"""Tests for the bob_emploi.frontend.server.asynchronous.mail.campaign module."""

import datetime
import re
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server.asynchronous.mail import campaign


class CampaignHelperFunctionTestCase(unittest.TestCase):
    """A class to test helper functions in campaign module."""

    def test_status_update_link(self) -> None:
        """Test the status update function."""

        user_id = '02499e64387edfcc2ab7a948'
        profile = user_pb2.UserProfile(gender=user_pb2.FEMININE, can_tutoie=True)
        status_update_link = campaign.get_status_update_link(user_id, profile)
        self.assertRegex(
            status_update_link,
            r'^{}&token=\d+\.[a-f0-9]+&gender=FEMININE&can_tutoie=true$'.format(re.escape(
                'https://www.bob-emploi.fr/statut/mise-a-jour?user={}'
                .format(user_id))))

    def test_create_logged_url(self) -> None:
        """Test the create logged url function."""

        user_id = '02499e64387edfcc2ab7a948'
        regex = re.compile(r'^{}&authToken=(\d+\.[a-f0-9]+)$'.format(re.escape(
            'https://www.bob-emploi.fr/project/0/wow-baker?user={}'
            .format(user_id))))
        logged_url = campaign.create_logged_url(user_id, '/project/0/wow-baker')
        self.assertRegex(logged_url, regex)

        match_token = regex.match(logged_url)
        assert match_token
        token = match_token.group(1)
        self.assertTrue(auth.check_token(user_id, token, role='auth'))

    def test_started_months_ago(self) -> None:
        """Test the search_started_months_ago function."""

        project = project_pb2.Project()
        self.assertEqual(-1, campaign.job_search_started_months_ago(project))

        project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=61))
        self.assertEqual(2, campaign.job_search_started_months_ago(project))


if __name__ == '__main__':
    unittest.main()
