"""Tests for the activation-email blast."""

import datetime
import unittest

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.mail.test import campaign_helper


class ActivationTestCase(campaign_helper.CampaignTestBase):
    """Tests for the activation-email blast."""

    campaign_id = 'activation-email'

    def setUp(self) -> None:
        super().setUp()

        self.maxDiff = None  # pylint: disable=invalid-name

        self.now = datetime.datetime(2020, 12, 3)

        self.project.actions.add(
            action_id='commute', title='Commute', status=action_pb2.ACTION_CURRENT)
        self.project.actions.add(
            action_id='sing', title='Be bop a lula', status=action_pb2.ACTION_CURRENT)

        self.user.registered_at.FromDatetime(datetime.datetime(2020, 12, 2))

    def test_basic(self) -> None:
        """Basic usage."""

        self.user.profile.coaching_email_frequency = email_pb2.EMAIL_ONCE_A_MONTH
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.project.job_search_started_at.FromDatetime(datetime.datetime(2020, 6, 1))
        self.project.target_job.masculine_name = 'Juriste'
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.seniority = project_pb2.SENIOR

        self._assert_user_receives_campaign()

        self._assert_has_default_vars()

        self._assert_has_logged_url('loginUrl', '')
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })

        actions = self._variables.pop('actions')
        self.assertEqual(
            ['Be bop a lula', 'Commute'],
            sorted(action.get('title') for action in actions))

        virality_template = self._variables.pop('viralityTemplate')
        self.assertIn('mailto:?body=Salut%2C%0A%0A', virality_template)
        self.assertIn('subject=%C3%87a+m%27a+fait+penser+%C3%A0+toi', virality_template)

        self._assert_remaining_variables({
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
            'date': '03 décembre 2020',
            'firstTeamMember': 'Tabitha',
            'isActionPlanCompleted': False,
            'isCoachingEnabled': 'True',
            'numActions': 2,
            'numberTeamMembers': 12,
            'numberUsers': '270\xa0000',
            'ofJob': 'de juriste',
            'teamMembers':
                'Paul, John, Pascal, Sil, Cyrille, Flo, Nicolas, Florian, Lillie, Benjamin, Émilie',
        })

    def test_aready_sent(self) -> None:
        """Do not send it twice."""

        self.user.emails_sent.add(campaign_id='activation-email')

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_actions(self) -> None:
        """Do not send it until we get some actions."""

        del self.project.actions[:]

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_old_user(self) -> None:
        """Do not send it for old users."""

        # One month ago.
        self.user.registered_at.FromDatetime(datetime.datetime(2020, 11, 2))

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_old_user_recent_action_pan(self) -> None:
        """Send it to old users if they've recently created an action plan."""

        # One month ago.
        self.user.registered_at.FromDatetime(datetime.datetime(2020, 11, 2))
        # Yesterday.
        self.project.action_plan_started_at.FromDatetime(datetime.datetime(2020, 12, 2))

        self._assert_user_receives_campaign()


if __name__ == '__main__':
    unittest.main()
