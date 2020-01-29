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
        profile = user_pb2.UserProfile(gender=user_pb2.FEMININE, can_tutoie=True, locale='fr@tu')
        status_update_link = campaign.get_status_update_link(user_id, profile)
        base_url = f'https://www.bob-emploi.fr/statut/mise-a-jour?user={user_id}'
        self.assertRegex(
            status_update_link,
            rf'^{re.escape(base_url)}&token=\d+\.[a-f0-9]+&gender=FEMININE&'
            'can_tutoie=true&hl=fr%40tu$')

    def test_create_logged_url(self) -> None:
        """Test the create logged url function."""

        user_id = '02499e64387edfcc2ab7a948'
        base_url = f'https://www.bob-emploi.fr/project/0/wow-baker?userId={user_id}'
        regex = re.compile(rf'^{re.escape(base_url)}&authToken=(\d+\.[a-f0-9]+)$')
        logged_url = campaign.create_logged_url(user_id, '/project/0/wow-baker')
        self.assertRegex(logged_url, regex)

        match_token = regex.match(logged_url)
        assert match_token
        token = match_token.group(1)
        self.assertTrue(auth.check_token(user_id, token, role='auth'))

    def test_started_months_ago(self) -> None:
        """Test the search_started_months_ago function."""

        now = datetime.datetime.now()

        project = project_pb2.Project()
        self.assertEqual(-1, campaign.job_search_started_months_ago(project, now))

        project.job_search_started_at.FromDatetime(now - datetime.timedelta(days=61))
        self.assertEqual(2, campaign.job_search_started_months_ago(project, now))

    def test_get_deep_link_advice(self) -> None:
        """Test the deep link."""

        project = project_pb2.Project()
        project.project_id = '0'
        project.advices.add().advice_id = 'improve-cv'

        deep_link = campaign.get_deep_link_advice('my-user-id', project, 'improve-cv')

        self.assertRegex(
            deep_link,
            '^' + re.escape('https://www.bob-emploi.fr/projet/0/methode/improve-cv?'),
        )

    def test_get_deep_link_missing_advice(self) -> None:
        """Test the deep link."""

        project = project_pb2.Project()
        project.project_id = '0'
        project.advices.add().advice_id = 'improve-interview'

        deep_link = campaign.get_deep_link_advice('my-user-id', project, 'improve-cv')

        self.assertFalse(deep_link)

    def test_get_template_folder(self) -> None:
        """Test the get_template_folder function."""

        self.assertEqual(None, campaign.get_template_folder('random'))
        self.assertEqual(
            '/work/bob_emploi/frontend/server/asynchronous/mail/templates/spontaneous',
            campaign.get_template_folder('212606'))


if __name__ == '__main__':
    unittest.main()
