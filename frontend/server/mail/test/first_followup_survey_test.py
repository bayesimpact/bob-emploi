"""Tests for the FFS email."""

import datetime
import unittest
from unittest import mock
from urllib import parse

from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server.mail.test import campaign_helper


class FFSCampaignTests(campaign_helper.CampaignTestBase):
    """Unit tests."""

    campaign_id = 'first-followup-survey'

    def setUp(self) -> None:
        super().setUp()
        self.now = datetime.datetime(2022, 2, 18)
        self.user.registered_at.FromDatetime(datetime.datetime(2022, 2, 11))

    @mock.patch(auth_token.__name__ + '.SECRET_SALT', new=b'prod-secret')
    def test_main(self) -> None:
        """Overall test."""

        user_id = self.user.user_id
        self.user.profile.locale = 'fr'
        self.user.profile.name = 'Pascal'
        self.user.projects[0].diagnostic.category_id = 'stuck-market'

        self._assert_user_receives_campaign()

        template_vars = self._variables
        ffs_form_urlstring = template_vars.pop('ffsFormUrl')
        self.assertLessEqual({'baseUrl', 'firstName', 'productName'}, template_vars.keys())
        self.assertEqual('Pascal', template_vars['firstName'])
        self.assertEqual('https://www.bob-emploi.fr', template_vars['baseUrl'])
        self.assertEqual('Bob', template_vars['productName'])
        ffs_form_url = parse.urlparse(ffs_form_urlstring)
        self.assertEqual(
            'https://www.bob-emploi.fr/api/first-followup-survey',
            parse.urlunparse(ffs_form_url[:4] + ('',) + ffs_form_url[5:]))
        ffs_form_args = parse.parse_qs(ffs_form_url.query)
        self.assertEqual({'user', 'token', 'redirect'}, ffs_form_args.keys())
        self.assertEqual([user_id], ffs_form_args['user'])
        auth_token.check_token(user_id, ffs_form_args['token'][0], role='first-followup-survey')
        self.assertEqual(1, len(ffs_form_args['redirect']))
        ffs_redirect = parse.urlparse(ffs_form_args['redirect'][0])
        self.assertEqual(
            'https://www.bob-emploi.fr/first-followup-survey',
            parse.urlunparse(ffs_redirect[:4] + ('',) + ffs_redirect[5:]))
        self.assertEqual({
            'mainChallenge': ['stuck-market'],
            'hl': ['fr'],
            'gender': ['MASCULINE'],
        }, parse.parse_qs(ffs_redirect.query))

    def test_not_nps_answers(self) -> None:
        """Do not send if user answered the NPS already."""

        self.user.net_promoter_score_survey_response.score = 3

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_not_too_recent(self) -> None:
        """Do not send if user registered recently."""

        self.user.registered_at.FromDatetime(datetime.datetime(2022, 2, 15))

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_recent_alpha(self) -> None:
        """Do send if user registered recently if they are in the alpha version."""

        self.user.features_enabled.alpha = True
        self.user.registered_at.FromDatetime(datetime.datetime(2022, 2, 15))

        self._assert_user_receives_campaign(should_be_sent=True)

    def test_not_too_old(self) -> None:
        """Do not send if user registered a while ago."""

        self.user.registered_at.FromDatetime(datetime.datetime(2022, 1, 1))

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_missing_email(self) -> None:
        """Do not send if there's no email address."""

        self.user.profile.email = ''

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_email_if_address_error(self) -> None:
        """Do not send if there's an error in the email address."""

        self.user.profile.email = 'pascal@ corpet.net'

        self._assert_user_receives_campaign(should_be_sent=False)


if __name__ == '__main__':
    unittest.main()
