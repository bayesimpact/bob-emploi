"""Unit tests for the spontaneous campaigns."""

import json
import os
import unittest
from unittest import mock

from bob_emploi.frontend.server.mail.test import campaign_helper

_FAKE_TRANSLATIONS_FILE = os.path.join(
    os.path.dirname(__file__), '../../test/testdata/translations.json')


class ResearchTest(campaign_helper.CampaignTestBase):
    """Test for the bob-resarch-recruit campaign."""

    campaign_id = 'bob-research-recruit'

    def test_basic(self) -> None:
        """Basic usage."""

        self._assert_user_receives_campaign()
        self._assert_has_default_vars()

    @mock.patch.dict(os.environ, {'RESEARCH_TARGET_USERS': 'NOT a JSON'})
    def test_fail_on_bad_json(self) -> None:
        """Fails on bad json."""

        with self.assertRaises(json.decoder.JSONDecodeError):
            self._assert_user_receives_campaign()

    @mock.patch.dict(os.environ, {'RESEARCH_TARGET_USERS': '34'})
    def test_fail_on_bad_type_json(self) -> None:
        """Fails on json not containing the proper type."""

        with self.assertRaises(TypeError):
            self._assert_user_receives_campaign()

    @mock.patch.dict(os.environ, {'RESEARCH_TARGET_USERS': '{"profile.yearOfBirth": 1982}'})
    def test_target(self) -> None:
        """Sends to a user that is in the target."""

        self.user.profile.year_of_birth = 1982
        self._assert_user_receives_campaign()

    @mock.patch.dict(os.environ, {'RESEARCH_TARGET_USERS': '{"profile.yearOfBirth": 1982}'})
    def test_off_target(self) -> None:
        """Sends to a user that is not in the target."""

        self.user.profile.year_of_birth = 1984
        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
