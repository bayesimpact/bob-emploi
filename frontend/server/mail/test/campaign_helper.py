"""Helper module to create tests for emailing campaigns."""

import datetime
import json
import os
import random
import re
import typing
from typing import Any, Literal, Mapping, Optional, Pattern, Union
import unittest
from unittest import mock
from urllib import parse

from google.protobuf import json_format
import mongomock
import pymongo

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import focus
from bob_emploi.frontend.server.mail import mail_blast
from bob_emploi.frontend.server.mail.templates import mailjet_templates
from bob_emploi.frontend.server.test import mailjetmock


class CampaignTestBase(unittest.TestCase):
    """Base class for unit tests of a campaign."""

    # Need to be overriden in subclasses.
    campaign_id = ''

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        if not cls.campaign_id:
            raise NotImplementedError(f'The class "{cls.__name__}" is missing a campaign_id')
        if cls.campaign_id not in mailjet_templates.MAP:
            raise NotImplementedError(f'The campaign ID "{cls.campaign_id}" is not valid')

    def setUp(self) -> None:
        super().setUp()

        cache.clear()
        patcher = mongomock.patch(['mydata.com', 'myprivatedata.com'])
        patcher.start()
        self.addCleanup(patcher.stop)
        env_patcher = mock.patch.dict(os.environ, values={
            'MONGO_URL': 'mongodb://mydata.com/test',
            'USERS_MONGO_URL': 'mongodb://myprivatedata.com/user_test',
        })
        env_patcher.start()
        self.addCleanup(env_patcher.stop)
        self.addCleanup(mongo.cache.clear)
        self.database = mongo.NoPiiMongoDatabase(
            pymongo.MongoClient('mongodb://mydata.com/test').test)
        self._user_database = pymongo.MongoClient('mongodb://myprivatedata.com/user_test').user_test

        # TODO(cyrille): Use this to mock time whenever necessary.
        self.now: Optional[datetime.datetime] = None
        # Default values that shouldn't be expected, and should be overridden when necessary.
        user_name = 'Patrick'
        user_email = 'patrick@bayes.org'
        user_user_id = f'{random.randrange(16**24):024x}'
        user_registration_date = datetime.datetime.now() - datetime.timedelta(days=90)
        # TODO(cyrille): Replace these values by personas.
        self.user = user_pb2.User(user_id=user_user_id)
        self.user.registered_at.FromDatetime(user_registration_date)
        self.user.profile.gender = user_profile_pb2.MASCULINE
        self.user.profile.name = user_name
        self.user.profile.email = user_email
        self.user.profile.year_of_birth = 1990
        self.project = self.user.projects.add()
        self.project.project_id = '0'
        self.project.target_job.masculine_name = 'Coiffeur'
        self.project.target_job.feminine_name = 'Coiffeuse'
        self.project.target_job.name = 'Coiffeur / Coiffeuse'
        self.project.target_job.code_ogr = '123456'
        self.project.target_job.job_group.rome_id = 'B1234'
        self.project.target_job.job_group.name = 'Coiffure'
        self.project.network_estimate = 1
        self.project.city.city_id = '69003'
        self.project.city.name = 'Lyon'
        self.project.city.departement_id = '69'
        self.project.city.departement_prefix = 'dans le '
        self.project.city.departement_name = 'Rhône'
        self.project.city.region_id = '84'
        self.project.city.region_name = 'Auvergne-Rhône-Alpes'

        self._variables: dict[str, Any] = {}
        self._from: dict[str, Any] = {}

    @mock.patch(mail_blast.auth_token.__name__ + '.SECRET_SALT', new=b'prod-secret')
    @mailjetmock.patch()
    def _assert_user_receives_campaign(
            self, should_be_sent: bool = True, blast_from: Optional[str] = None,
            blast_to: Optional[str] = None, extra_args: Optional[list[str]] = None) -> None:
        json_user = json_format.MessageToDict(self.user)
        json_user['_id'] = mongomock.ObjectId(json_user.pop('userId'))
        self._user_database.user.insert_one(json_user)
        year = self.user.registered_at.ToDatetime().year
        if self.now:
            now_patcher = nowmock.patch(new=mock.MagicMock(return_value=self.now))
            now_patcher.start()
            self.addCleanup(now_patcher.stop)
        mail_blast.main([
            self.campaign_id,
            'send',
            '--disable-sentry',
            '--registered-from',
            blast_from or str(year),
            '--registered-to',
            blast_to or str(year + 1),
            '--log-reason-on-error',
        ] + (extra_args or []))
        all_sent_messages = mailjetmock.get_all_sent_messages()
        if not should_be_sent:
            self.assertFalse(all_sent_messages)
            return
        self.assertEqual(1, len(all_sent_messages), msg=all_sent_messages)
        self.assertEqual(self.campaign_id, all_sent_messages[0].properties['CustomCampaign'])
        self._variables = all_sent_messages[0].properties['Variables']
        self._from = all_sent_messages[0].properties['From']
        self.assertEqual(self._from['Name'], self._variables.pop('senderName'))

        # Test that variables used in the template are populated.
        template_id = str(all_sent_messages[0].properties['TemplateID'])
        template_path = campaign.get_campaign_folder(
            typing.cast(mailjet_templates.Id, self.campaign_id))
        self.assertTrue(template_path, msg=f'No template for campaign "{self.campaign_id}"')
        assert template_path
        vars_filename = os.path.join(template_path, 'vars-example.json')
        with open(vars_filename, 'r', encoding='utf-8') as vars_file:
            template_vars = json.load(vars_file).keys()
        for template_var in template_vars:
            self.assertIn(
                template_var, self._variables,
                msg=f'Template error for campaign {self.campaign_id}, see '
                f'https://app.mailjet.com/template/{template_id}/build')

    @mock.patch(mail_blast.auth_token.__name__ + '.SECRET_SALT', new=b'prod-secret')
    @mailjetmock.patch()
    def _assert_user_receives_focus(self, should_be_sent: bool = True) -> None:
        json_user = json_format.MessageToDict(self.user)
        json_user['_id'] = mongomock.ObjectId(json_user.pop('userId'))
        self._user_database.user.insert_one(json_user)
        focus.main([
            'send',
            '--disable-sentry',
            '--restrict-campaigns',
            self.campaign_id,
        ])
        all_sent_messages = mailjetmock.get_all_sent_messages()
        if not should_be_sent:
            self.assertFalse(all_sent_messages)
            return
        self.assertEqual(1, len(all_sent_messages), msg=all_sent_messages)
        self.assertEqual(self.campaign_id, all_sent_messages[0].properties['CustomCampaign'])
        self._variables = all_sent_messages[0].properties['Variables']
        self._from = all_sent_messages[0].properties['From']
        self.assertEqual(self._from['Name'], self._variables.pop('senderName'))

    def _assert_regex_field(self, field: str, regex: Union[str, Pattern[str]]) \
            -> None:
        try:
            field_value = self._variables.pop(field)
        except KeyError:
            self.fail(f'Variables do not contain field "{field}":\n{self._variables}')
        self.assertRegex(field_value, regex)

    def _assert_url_field(
            self, field: str, url: str, **args_matcher: Union[str, Pattern[str]]) \
            -> None:
        try:
            field_value = self._variables.pop(field)
        except KeyError:
            self.fail(f'Variables do not contain field "{field}"\n{self._variables}')
        if not args_matcher:
            self.assertEqual(url, field_value)
            return
        self.assertEqual(url, field_value[:len(url)], msg=field_value)
        self.assertEqual('?', field_value[len(url):len(url) + 1], msg=field_value)
        args = parse.parse_qs(field_value[len(url) + 1:])
        for key, matcher in args_matcher.items():
            self.assertIn(key, args, msg=field_value)
            msg = f'For key {key} of {field_value}'
            if isinstance(matcher, str):
                self.assertEqual(matcher, args[key][0], msg=msg)
            else:
                self.assertRegex(args[key][0], matcher, msg=msg)
        self.assertFalse(
            args.keys() - args_matcher.keys(), msg='Not all URL arguments are accounted for')

    def _assert_has_unsubscribe_url(
            self, field: str = 'unsubscribeLink',
            **kwargs: Union[str, Pattern[str]]) \
            -> None:
        if self.user.profile.locale:
            kwargs['hl'] = kwargs.get('hl', self.user.profile.locale)
        self._assert_url_field(
            field, 'https://www.bob-emploi.fr/unsubscribe.html',
            auth=re.compile(r'^\d+\.[a-f0-9]+$'),
            user=self.user.user_id,
            **kwargs)

    def _assert_has_status_update_link(self, field: str = 'statusUpdateLink') -> None:
        self._assert_url_field(
            field, 'https://www.bob-emploi.fr/statut/mise-a-jour',
            user=self.user.user_id,
            token=re.compile(r'\d+\.[a-f0-9]+'),
            gender=user_profile_pb2.Gender.Name(self.user.profile.gender),
            hl=self.user.profile.locale or 'fr',
            employed=str(self.project.kind == project_pb2.FIND_ANOTHER_JOB) or 'False')

    def _assert_has_logged_url(self, field: str = 'loginUrl', path: str = '') -> None:
        self._assert_url_field(
            field, f'https://www.bob-emploi.fr{path}',
            userId=self.user.user_id,
            authToken=re.compile(r'\d+\.[a-f0-9]+$'))

    def _assert_has_default_vars(
            self,
            first_name: Optional[str] = None,
            gender: Optional[Literal['MASCULINE', 'FEMININE']] = None,
    ) -> None:
        self._assert_url_field('baseUrl', 'https://www.bob-emploi.fr')
        self.assertEqual(first_name or 'Patrick', self._variables.pop('firstName'))
        self.assertEqual(gender or 'MASCULINE', self._variables.pop('gender'))
        self.assertEqual('Bob', self._variables.pop('productName'))
        self.assertEqual(
            'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1.png',
            self._variables.pop('productLogoUrl'))
        self.assertEqual('#faf453', self._variables.pop('highlightColor'))
        self._assert_has_unsubscribe_url()

    def _assert_remaining_variables(self, variables: dict[str, Any]) -> None:
        self.assertEqual(variables, self._variables)

    def _assert_sender_name(self, sender_name: str) -> None:
        try:
            _sender_name = self._from.pop('Name')
        except KeyError:
            self.fail(f'From does not contain field "Name"\n{self._from}')
        self.assertEqual(sender_name, _sender_name)

    def _assert_all_template_variables(self, variables: Mapping[str, str]) -> None:
        """Checks that the variables have all the keys needed for the given campaign."""

        vars_file_path = os.path.join(mailjet_templates.PATH, self.campaign_id, 'vars-example.json')
        with open(vars_file_path, encoding='utf-8') as vars_file:
            template_vars = json.load(vars_file).keys()
        self.assertFalse(
            template_vars - set(variables.keys()),
            msg='Some variables from the email are not given')
