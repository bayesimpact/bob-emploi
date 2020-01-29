"""Unit tests for the Improve CV mail module."""

import datetime
import re
import unittest
from unittest import mock

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test


class ImproveCvTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the _get_improve_cv_vars method."""

    campaign_id = 'improve-cv'

    def setUp(self) -> None:
        super().setUp()

        self.user.profile.frustrations.append(user_pb2.RESUME)

        self.user.profile.gender = user_pb2.MASCULINE
        self.user.profile.name = 'Patrick'
        self.user.profile.coaching_email_frequency = user_pb2.EMAIL_ONCE_A_MONTH

    def test_basic_mail_blast(self) -> None:
        """Basic usage of a mail blast."""

        self._assert_user_receives_campaign()

    def test_not_frustrated(self) -> None:
        """Basic usage."""

        del self.user.profile.frustrations[:]

        self._assert_user_receives_focus(should_be_sent=False)

    @mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2019, 8, 15))
    def test_basic_focus(self) -> None:
        """Basic usage."""

        self.user.registered_at.FromDatetime(datetime.datetime(2019, 6, 1))
        self.project.advices.add().advice_id = 'improve-resume'

        self._assert_user_receives_focus()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        self._assert_has_logged_url('loginUrl')
        self._assert_has_logged_url('deepLinkAdviceUrl', '/projet/0/methode/improve-resume')

        self._assert_remaining_variables({
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'hasExperience': '',
            'isSeptember': '',
        })

    @mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2019, 9, 15))
    def test_first_job_in_september(self) -> None:
        """User is looking for its first job in September."""

        self.user.registered_at.FromDatetime(datetime.datetime(2019, 6, 1))
        self.project.kind = project_pb2.FIND_A_FIRST_JOB

        self._assert_user_receives_focus()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        base_url = f'https://www.bob-emploi.fr?userId={self.user.user_id}'
        self._assert_regex_field(
            'loginUrl', rf'^{re.escape(base_url)}&authToken=\d+\.[a-f0-9]+$')

        self._assert_remaining_variables({
            'deepLinkAdviceUrl': '',
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'hasExperience': 'False',
            'isSeptember': 'True',
        })

    @mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2019, 9, 15))
    def test_antoher_job_in_september(self) -> None:
        """User is looking for another job in September."""

        self.user.registered_at.FromDatetime(datetime.datetime(2019, 6, 1))
        self.project.kind = project_pb2.FIND_ANOTHER_JOB

        self._assert_user_receives_focus()

        self._assert_has_unsubscribe_link()
        self._assert_has_unsubscribe_url('changeEmailSettingsUrl', **{
            'coachingEmailFrequency': 'EMAIL_ONCE_A_MONTH',
        })
        self._assert_has_status_update_link('statusUpdateUrl')
        base_url = f'https://www.bob-emploi.fr?userId={self.user.user_id}'
        self._assert_regex_field(
            'loginUrl', rf'^{re.escape(base_url)}&authToken=\d+\.[a-f0-9]+$')

        self._assert_remaining_variables({
            'deepLinkAdviceUrl': '',
            'firstName': 'Patrick',
            'gender': 'MASCULINE',
            'hasExperience': 'True',
            'isSeptember': 'True',
        })


if __name__ == '__main__':
    unittest.main()
