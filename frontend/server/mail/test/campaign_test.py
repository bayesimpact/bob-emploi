"""Tests for the bob_emploi.frontend.server.mail.campaign module."""

import datetime
import json
import os
import re
import unittest
from urllib import parse

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.test import base_test


class CampaignHelperFunctionTestCase(unittest.TestCase):
    """A class to test helper functions in campaign module."""

    def test_status_update_link(self) -> None:
        """Test the status update function."""

        user_id = '02499e64387edfcc2ab7a948'
        profile = user_profile_pb2.UserProfile(gender=user_profile_pb2.FEMININE, locale='fr@tu')
        projects = [project_pb2.Project(kind=project_pb2.FIND_ANOTHER_JOB)]
        user = user_pb2.User(user_id=user_id, profile=profile, projects=projects)
        status_update_link = campaign.get_status_update_link(user)
        base_url = 'https://www.bob-emploi.fr/statut/mise-a-jour?'
        params = 'employed=True&gender=FEMININE&hl=fr%40tu'
        self.assertRegex(
            status_update_link,
            rf'^{re.escape(base_url)}{params}&token=\d+\.[a-f0-9]+&user={user_id}$')

    def test_status_update_link_not_employed(self) -> None:
        """Test the status update function with user not already in job."""

        user_id = '02499e64387edfcc2ab7a948'
        profile = user_profile_pb2.UserProfile(gender=user_profile_pb2.FEMININE, locale='fr@tu')
        projects = [project_pb2.Project(kind=project_pb2.REORIENTATION)]
        user = user_pb2.User(user_id=user_id, profile=profile, projects=projects)
        status_update_link = campaign.get_status_update_link(user)
        base_url = 'https://www.bob-emploi.fr/statut/mise-a-jour?'
        params = 'employed=False&gender=FEMININE&hl=fr%40tu'
        self.assertRegex(
            status_update_link,
            rf'^{re.escape(base_url)}{params}&token=\d+\.[a-f0-9]+&user={user_id}$')

    def test_create_logged_url(self) -> None:
        """Test the create logged url function."""

        user_id = '02499e64387edfcc2ab7a948'
        base_url = 'https://www.bob-emploi.fr/project/0/wow-baker?'
        regex = re.compile(rf'^{re.escape(base_url)}authToken=(\d+\.[a-f0-9]+)&userId={user_id}$')
        logged_url = campaign.create_logged_url(user_id, '/project/0/wow-baker')
        self.assertRegex(logged_url, regex)

        match_token = regex.match(logged_url)
        assert match_token
        token = match_token.group(1)
        self.assertTrue(auth_token.check_token(user_id, token, role='auth'))

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

    def test_get_campaign_folder(self) -> None:
        """Test the test_get_campaign_folder function."""

        campaign_folder = campaign.get_campaign_folder('focus-spontaneous')
        self.assertTrue(
            campaign_folder.endswith('templates/focus-spontaneous'), msg=campaign_folder)
        self.assertTrue(os.path.isfile(os.path.join(campaign_folder, 'headers.json')))


class CampaignIntegrationTestCase(base_test.ServerTestCase):
    """A class to test the campaign module integrated with the Bob server."""

    def test_logged_url(self) -> None:
        """Test that logged URL allows for actual authentication."""

        user_id = self.create_user_with_token()[0]
        logged_url = campaign.create_logged_url(user_id, '/foo')
        params = parse.parse_qs(parse.urlparse(logged_url).query)
        self.assertEqual([user_id], params['userId'])
        [token] = params['authToken']

        response = self.app.post(
            '/api/user/authenticate',
            data=json.dumps({'userId': user_id, 'authToken': token}),
            content_type='application/json')

        auth_response = self.json_from_response(response)
        user_id = auth_response['authenticatedUser']['userId']


if __name__ == '__main__':
    unittest.main()
