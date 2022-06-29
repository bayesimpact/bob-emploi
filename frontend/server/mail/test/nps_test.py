"""Tests for the NPS email."""

import unittest
from unittest import mock
from urllib import parse

from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server.mail.test import campaign_helper

_USER_PENDING_NPS_DICT = {
    'profile': {
        'name': 'Pascal',
        'lastName': 'Corpet',
        'email': 'pascal@bayes.org',
    },
    'registeredAt': '2018-01-22T10:00:00Z',
    'projects': [{
        'title': 'Project Title',
    }],
}


class NPSCampaignTests(campaign_helper.CampaignTestBase):
    """Unit tests."""

    campaign_id = 'nps'

    @mock.patch(auth_token.__name__ + '.SECRET_SALT', new=b'prod-secret')
    def test_main(self) -> None:
        """Overall test."""

        user_id = self.user.user_id
        self.user.profile.locale = 'fr'
        self.user.profile.name = 'Pascal'

        self._assert_user_receives_campaign()

        template_vars = self._variables
        nps_form_urlstring = template_vars.pop('npsFormUrl')
        self.assertLessEqual({'baseUrl', 'firstName', 'productName'}, template_vars.keys())
        self.assertEqual('Pascal', template_vars['firstName'])
        self.assertEqual('https://www.bob-emploi.fr', template_vars['baseUrl'])
        self.assertEqual('Bob', template_vars['productName'])
        nps_form_url = parse.urlparse(nps_form_urlstring)
        self.assertEqual(
            'https://www.bob-emploi.fr/api/nps',
            parse.urlunparse(nps_form_url[:4] + ('',) + nps_form_url[5:]))
        nps_form_args = parse.parse_qs(nps_form_url.query)
        self.assertEqual({'user', 'token', 'redirect'}, nps_form_args.keys())
        self.assertEqual([user_id], nps_form_args['user'])
        auth_token.check_token(user_id, nps_form_args['token'][0], role='nps')
        self.assertEqual(['https://www.bob-emploi.fr/retours?hl=fr'], nps_form_args['redirect'])

    def test_no_incomplete(self) -> None:
        """Do not send if project is not complete."""

        self.project.is_incomplete = True

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
