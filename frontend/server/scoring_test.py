"""Tests for the bob_emploi.frontend.scoring module."""
import datetime
import json
import numbers
from os import path
import random
import unittest

import mock
import mongomock

from bob_emploi.frontend import scoring
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')

# TODO(pascal): Split this file and remove the line below.
# pylint: disable=too-many-lines


def _load_json_to_mongo(database, collection):
    """Load a MongoDB collection from a JSON file."""
    with open(path.join(_TESTDATA_FOLDER, collection + '.json')) as json_file:
        json_blob = json.load(json_file)
    database[collection].insert_many(json_blob)


class _Persona(object):
    """A preset user and project.

    Do not modify the proto of a persona in a test unless you have just
    created/cloned it, otherwise your modifications will impact all the future
    use of the personas. As we only load the personas once during the module
    load, please consider them as constants.

    Attributes:
        name: a keyword that references this persona in our tests.
        user_profile: a UserProfile protobuf defining their profile
        project: a Project protobuf defining their main project.
    """

    def __init__(self, name, user_profile, project, features_enabled=None):
        self.name = name
        self.user_profile = user_profile
        self.project = project
        self.features_enabled = features_enabled or user_pb2.Features()

    @classmethod
    def load_set(cls, filename):
        """Load a set of personas from a JSON file."""
        with open(filename) as personas_file:
            personas_json = json.load(personas_file)
        personas = {}
        for name, blob in personas_json.items():
            user_profile = user_pb2.UserProfile()
            assert proto.parse_from_mongo(blob['user'], user_profile)
            features_enabled = user_pb2.Features()
            if 'featuresEnabled' in blob:
                assert proto.parse_from_mongo(blob['featuresEnabled'], features_enabled)
            project = project_pb2.Project()
            assert proto.parse_from_mongo(blob['project'], project)
            assert name not in personas
            personas[name] = cls(
                name, user_profile=user_profile, project=project, features_enabled=features_enabled)
        return personas

    def scoring_project(self, database, now=None):
        """Creates a new scoring.ScoringProject for this persona."""
        return scoring.ScoringProject(
            project=self.project,
            user_profile=self.user_profile,
            features_enabled=self.features_enabled,
            database=database,
            now=now)

    def clone(self):
        """Clone this persona.

        This is useful if you want a slightly modified persona: you clone an
        existing one and then can modify its protobufs without modifying the
        original one.
        """
        name = '%s cloned' % self.name
        user_profile = user_pb2.UserProfile()
        user_profile.CopyFrom(self.user_profile)
        project = project_pb2.Project()
        project.CopyFrom(self.project)
        return _Persona(name=name, user_profile=user_profile, project=project)


_PERSONAS = _Persona.load_set(path.join(_TESTDATA_FOLDER, 'personas.json'))


def ScoringModelTestBase(model_id):  # pylint: disable=invalid-name
    """Creates a base class for unit tests of a scoring model."""

    class _TestCase(unittest.TestCase):

        @classmethod
        def setUpClass(cls):
            super(_TestCase, cls).setUpClass()
            cls.model = scoring.get_scoring_model(model_id)

        def setUp(self):
            super(_TestCase, self).setUp()
            self.database = mongomock.MongoClient().test

        def _score_persona(self, persona=None, name=None):
            if not persona:
                persona = _PERSONAS[name]
            project = persona.scoring_project(self.database)
            return self.model.score(project).score

        def _assert_score_for_empty_project(self, expected):
            score = self._score_persona(name='empty')
            self.assertEqual(expected, score)

        def _random_persona(self):
            return _PERSONAS[random.choice(list(_PERSONAS))]

    return _TestCase


class DefaultScoringModelTestCase(ScoringModelTestBase('')):
    """Unit test for the default scoring model."""

    def test_score(self):
        """Test the score function."""
        score = self._score_persona(self._random_persona())

        self.assertLessEqual(score, 3)
        self.assertLessEqual(0, score)


class UseYourNetworkScoringModelTestCase(ScoringModelTestBase('chantier-use-network')):
    """Unit test for the "Use your network" scoring model."""

    def test_score_empty_user(self):
        """Score an empty project.

        In general we can recommend pushing your network but if the user did
        not tell us specifically we should not push it too high (score ~1).
        """
        self._assert_score_for_empty_project(1)

    def test_score_strong_network(self):
        """Score a project with a strong network.

        The user told us they have a strong network: let's use it (should score
        higher than 3), especially if the market they are in is packed.
        """
        persona = _PERSONAS['empty'].clone()
        persona.project.network_estimate = 5
        persona.project.mobility.city.departement_id = '69'
        persona.project.target_job.code_ogr = '1234'
        self.database.local_diagnosis.insert_one({
            '_id': '69:1234',
            'yearlyAvgOffersPer10Openings': 1,
            'yearlyAvgOffersDenominator': 10})

        score = self._score_persona(persona)

        self.assertLessEqual(5, score)


class LearnMoreAboutJobScoringModelTestCase(ScoringModelTestBase('chantier-about-job')):
    """Unit test for the "Learn more about the job" scoring model."""

    model_id = 'chantier-about-job'

    def test_score_empty_user(self):
        """With unknown data we do not want to show the chantier."""
        self._assert_score_for_empty_project(0)

    def test_score_newbie(self):
        """Show it if user has never done this job."""
        persona = _PERSONAS['empty'].clone()
        persona.project.previous_job_similarity = project_pb2.NEVER_DONE

        score = self._score_persona(persona)

        self.assertLess(1, score)

    def test_score_passive_newbie(self):
        """Show it higher if user has never done this job and is passive."""
        persona = _PERSONAS['empty'].clone()
        persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        persona.project.job_search_length_months = -1

        score = self._score_persona(persona)

        self.assertLess(2, score)


class ConstantScoreModelTestCase(ScoringModelTestBase('constant(2)')):
    """Unit test for the constant scoring model."""

    def test_random(self):
        """Check score on a random persona."""
        persona = self._random_persona()
        self.assertEqual(2, self._score_persona(persona), msg='Failed for "%s"' % persona.name)


class MobilityWithoutMoveScoringModelTestCase(ScoringModelTestBase(
        'chantier-mobility-without-move(dep)')):
    """Unit test for the "Mobility Without Move" scoring model."""

    def setUp(self):
        super(MobilityWithoutMoveScoringModelTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.mobility.area_type = geo_pb2.CITY
        self.persona.project.mobility.city.city_id = '69123'
        self.persona.project.mobility.city.departement_id = '69'
        self.persona.project.mobility.city.region_id = '84'
        if self.persona.user_profile.geographical_flexibility == user_pb2.ABSOLUTELY_NOT:
            self.persona.user_profile.geographical_flexibility = user_pb2.IF_NEEDED

    def test_easy_market(self):
        """User has already a very nice outlook locally."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 80,
                },
            },
            {
                '_id': 'd69:A1234',
                'unemploymentDuration': {
                    'days': 5,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertEqual(0, score, msg='Fail for "%s"' % self.persona.name)

    def test_should_commute_longer(self):
        """User should really try to commute for a bit longer."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 180,
                },
            },
            {
                '_id': 'd69:A1234',
                'unemploymentDuration': {
                    'days': 20,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertGreater(score, 2, msg='Fail for "%s"' % self.persona.name)

    def test_should_commute_longer_but_not_flexible(self):
        """User should really try to commute for a bit longer but does not want to."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 180,
                },
            },
            {
                '_id': 'd69:A1234',
                'unemploymentDuration': {
                    'days': 20,
                },
            },
        ])
        self.persona.user_profile.geographical_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 0, msg='Fail for "%s"' % self.persona.name)

    def test_no_benefits_for_long_commute(self):
        """Outlook is not much better at the département level."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 180,
                },
            },
            {
                '_id': 'd69:A1234',
                'unemploymentDuration': {
                    'days': 180,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 0, msg='Fail for "%s"' % self.persona.name)


class RelocateScoringModelTestCase(ScoringModelTestBase('chantier-relocate(fra)')):
    """Unit test for the "Relocate" scoring model."""

    def setUp(self):
        super(RelocateScoringModelTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.mobility.area_type = geo_pb2.CITY
        self.persona.project.mobility.city.city_id = '69123'
        self.persona.project.mobility.city.departement_id = '69'
        self.persona.project.mobility.city.region_id = '84'
        self.persona.user_profile.geographical_flexibility = user_pb2.IF_NEEDED

    def test_easy_market(self):
        """User is already quite OK."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 170,
                },
            },
            {
                '_id': 'A1234',
                'unemploymentDuration': {
                    'days': 5,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertEqual(0, score, msg='Fail for "%s"' % self.persona.name)

    def test_should_move(self):
        """User should really try to go for a move."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 370,
                },
            },
            {
                '_id': 'A1234',
                'unemploymentDuration': {
                    'days': 20,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertGreater(score, 2, msg='Fail for "%s"' % self.persona.name)

    def test_should_move_but_does_not_want(self):
        """User should really try to go for a move but does not want to."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 370,
                },
            },
            {
                '_id': 'A1234',
                'unemploymentDuration': {
                    'days': 20,
                },
            },
        ])
        self.persona.user_profile.geographical_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 0, msg='Fail for "%s"' % self.persona.name)

    def test_almost_no_benefits_for_moving(self):
        """Outlook is not much better at the country level."""
        self.database.fhs_local_diagnosis.insert_many([
            {
                '_id': '69123:A1234',
                'unemploymentDuration': {
                    'days': 300,
                },
            },
            {
                '_id': 'A1234',
                'unemploymentDuration': {
                    'days': 290,
                },
            },
        ])

        score = self._score_persona(self.persona)
        self.assertLessEqual(score, .1, msg='Fail for "%s"' % self.persona.name)


class PersonasTestCase(unittest.TestCase):
    """Tests all scoring models and all personas."""

    def test_run_all(self):
        """Run all scoring models on all personas."""
        database = mongomock.MongoClient().test
        _load_json_to_mongo(database, 'job_group_info')
        _load_json_to_mongo(database, 'fhs_local_diagnosis')
        _load_json_to_mongo(database, 'local_diagnosis')
        scores = {}
        # Mock the "now" date so that scoring models that are based on time
        # (like "Right timing") are deterministic.
        now = datetime.datetime(2016, 9, 27)
        for model_name, model in scoring.SCORING_MODELS.items():
            self.assertTrue(model, msg=model_name)
            scores[model_name] = {}
            for name, persona in _PERSONAS.items():
                scores[model_name][name] = model.score(
                    persona.scoring_project(database, now=now)).score
                self.assertIsInstance(
                    scores[model_name][name],
                    numbers.Number,
                    msg='while using the model "%s" to score "%s"'
                    % (model_name, name))

        for name in _PERSONAS:
            persona_scores = [
                max(scores[model_name][name], 0)
                for model_name in scoring.SCORING_MODELS]
            self.assertLess(
                1, len(set(persona_scores)),
                msg='Persona "%s" has the same score across all models.' % name)

        for model_name, model_scores in scores.items():
            model = scoring.SCORING_MODELS[model_name]
            if isinstance(model, scoring.ConstantScoreModel):
                continue
            # TODO(pascal): Remove when we use a scoring model generator.
            if isinstance(model, scoring.JobGroupFilter):
                continue
            self.assertLess(
                1, len(set(model_scores.values())),
                msg='Model "%s" has the same score for all personas.' % model_name)


class ObtainDrivingLicenseTestCase(ScoringModelTestBase('chantier-driving-license(B)')):
    """Unit test for the "Obtain Driving License" scoring model."""

    def _ensure_not_excluded(self, persona):
        if persona.project.mobility.city.departement_id == '75':
            persona.project.mobility.city.departement_id = '39'
        del persona.user_profile.frustrations[:]
        del persona.user_profile.driving_licenses[:]
        if persona.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.training_flexibility = user_pb2.IF_NEEDED

    def test_license_required(self):
        """> 33% when license is required."""
        persona = self._random_persona().clone()
        self._ensure_not_excluded(persona)
        persona.project.target_job.job_group.rome_id = 'K2109'
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 50,
                    'percentRequired': 50,
                }],
            },
        })

        project = persona.scoring_project(self.database)
        job_offers_increase = self.model.score(project).additional_job_offers
        self.assertGreaterEqual(job_offers_increase, 33, msg='Failed for "%s"' % persona.name)

    def test_license_weekly_required(self):
        """< 10% when license is required."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2109'
        self._ensure_not_excluded(persona)
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 50,
                    'percentRequired': 20,
                }],
            },
        })

        project = persona.scoring_project(self.database)
        job_offers_increase = self.model.score(project).additional_job_offers
        self.assertGreaterEqual(job_offers_increase, 1, msg='Failed for "%s"' % persona.name)
        self.assertLessEqual(job_offers_increase, 39, msg='Failed for "%s"' % persona.name)

    def test_not_willing(self):
        """0 when user does not want to train."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2109'
        self._ensure_not_excluded(persona)
        del persona.user_profile.driving_licenses[:]
        persona.user_profile.training_flexibility = user_pb2.ABSOLUTELY_NOT
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 50,
                    'percentRequired': 50,
                }],
            },
        })

        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_user_has_license_already(self):
        """0 when user already has this license."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2109'
        self._ensure_not_excluded(persona)
        persona.user_profile.driving_licenses.append(job_pb2.CAR)
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 6,
                    'percentRequired': 49,
                }],
            },
        })

        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_handicaped(self):
        """0 when user is handicaped."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2109'
        self._ensure_not_excluded(persona)
        persona.user_profile.frustrations.append(user_pb2.HANDICAPED)
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 6,
                    'percentRequired': 49,
                }],
            },
        })

        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_parisian(self):
        """0 when user is searching in Paris."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'K2109'
        self._ensure_not_excluded(persona)
        persona.project.mobility.city.departement_id = '75'
        persona.project.mobility.area_type = geo_pb2.CITY
        self.database.job_group_info.insert_one({
            '_id': 'K2109',
            'requirements': {
                'drivingLicenses': [{
                    'drivingLicense': 'CAR',
                    'name': 'Permis B - Véhicule léger',
                    'percentSuggested': 6,
                    'percentRequired': 49,
                }],
            },
        })

        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)


class ImproveCVScoringModelTestCase(ScoringModelTestBase('chantier-resume')):
    """Unit tests for the "Improve your CV/Cover letter" chantier."""

    def test_frustrated(self):
        """User is frustrated by their resume."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.RESUME)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_rock_star(self):
        """User has done a lot of interviews."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 1
        persona.project.total_interviews_estimate = project_pb2.A_LOT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_normal_user(self):
        """Normal user."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 8
        persona.project.total_interviews_estimate = project_pb2.SOME

        score = self._score_persona(persona)

        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)


class FightGenderDiscriminationScoringModelTestCase(
        ScoringModelTestBase('chantier-gender-discriminations')):
    """Unit tests for the "Fight gender wage discriminations" chantier."""

    def test_frustrated_woman(self):
        """Woman is frustrated by gender discriminations."""
        persona = self._random_persona().clone()
        persona.user_profile.gender = user_pb2.FEMININE
        persona.user_profile.frustrations.append(user_pb2.SEX_DISCRIMINATION)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_frustrated_man(self):
        """Frustrated man: we do not have any actions for this, so do not show."""
        persona = self._random_persona().clone()
        persona.user_profile.gender = user_pb2.MASCULINE
        persona.user_profile.frustrations.append(user_pb2.SEX_DISCRIMINATION)

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_macho(self):
        """Man."""
        persona = self._random_persona().clone()
        persona.user_profile.gender = user_pb2.MASCULINE

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)


class ImproveInterviewScoringModelTestCase(ScoringModelTestBase('chantier-interview')):
    """Unit tests for the "Improve your interview skills" chantier."""

    def test_frustrated(self):
        """Frustrated by interviews."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.INTERVIEW)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_no_interviews_specified(self):
        """Did not specify number of interviews done."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.total_interviews_estimate = project_pb2.UNKNOWN_NUMBER_ESTIMATE_OPTION

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_never_got_an_interview(self):
        """User never got an interview in 1.5 years."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.total_interviews_estimate = project_pb2.LESS_THAN_2
        persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        persona.project.job_search_length_months = 18

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class ImproveOrganizationScoringModelTestCase(ScoringModelTestBase('chantier-organize')):
    """Unit tests for the "Stay on top of my organization" chantier."""

    def test_frustrated(self):
        """Frustrated by time management."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TIME_MANAGEMENT)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_newbie(self):
        """User just started searching."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 2

        score = self._score_persona(persona)

        self.assertLessEqual(score, 2, msg='Failed for "%s"' % persona.name)

    def test_long_time_job_seeker(self):
        """User has been looking for ages."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 24

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class StandOutFromCompetitionScoringModelTestCase(ScoringModelTestBase('chantier-stand-out')):
    """Unit tests for the "Stand out from the competition" chantier."""

    def test_no_applications_yet(self):
        """User does not send many applications yet."""
        persona = self._random_persona().clone()
        persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_many_applications(self):
        """User sends a decent amount of applications."""
        persona = self._random_persona().clone()
        persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_send_some_applications(self):
        """User sends some applications weekly."""
        persona = self._random_persona().clone()
        persona.project.weekly_applications_estimate = project_pb2.SOME

        score = self._score_persona(persona)

        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)


class SpontaneousApplicationScoringModelTestCase(
        ScoringModelTestBase('chantier-spontaneous-application')):
    """Unit tests for the "Send spontaneous applications" chantier."""

    def test_not_frustrated(self):
        """User is not frustrated."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_just_started_searching(self):
        """User has just started searching."""
        persona = self._random_persona().clone()
        persona.project.job_search_length_months = 1

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_frustrated_and_searched_for_a_long_time(self):
        """User gets frustrated and has been searching for a long time."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)
        persona.project.job_search_length_months = 8

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class StayMotivatedScoringModelTestCase(ScoringModelTestBase('chantier-stay-motivated')):
    """Unit tests for the "Stay motivated" chantier."""

    def test_frustrated(self):
        """Frustrated by motivation."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.MOTIVATION)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_newbie(self):
        """User just started searching."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 2

        score = self._score_persona(persona)

        self.assertLessEqual(score, 2, msg='Failed for "%s"' % persona.name)

    def test_long_time_job_seeker(self):
        """User has been looking for ages."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 24

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class ShowcaseAtypicalScoringModelTestCase(ScoringModelTestBase('chantier-atypical-profile')):
    """Unit tests for the "Showcase your atypical profile" chantier."""

    def test_frustrated(self):
        """Frustrated by an atypical profile."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.ATYPIC_PROFILE)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_long_time_job_seeker(self):
        """User has been looking for ages."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.job_search_length_months = 24

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)


class GetMoreOffersScoringModelTestCase(ScoringModelTestBase('chantier-get-more-offers')):
    """Unit tests for the "Showcase your atypical profile" chantier."""

    def test_frustrated(self):
        """Frustrated by not enough offers."""
        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_lot_of_offers(self):
        """User has many offers already."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.weekly_offers_estimate = project_pb2.A_LOT

        score = self._score_persona(persona)

        # We do want to show the chantier but not pre-select it.
        self.assertLessEqual(score, 0.1, msg='Failed for "%s"' % persona.name)
        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)

    def test_some_offers(self):
        """User has only few offers per week."""
        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.weekly_offers_estimate = project_pb2.SOME

        score = self._score_persona(persona)

        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)
        self.assertLess(score, 3, msg='Failed for "%s"' % persona.name)


class JobDiscoveryScoringModelTestCase(ScoringModelTestBase('chantier-job-discovery')):
    """Unit tests for the "Discover jobs close to yours" chantier."""

    def test_targeting_a_new_job(self):
        """User is already exploring another job."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'A1234'
        persona.user_profile.latest_job.job_group.rome_id = 'B5678'

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_exploring_a_new_job(self):
        """User is in an exploratory mode."""
        persona = self._random_persona().clone()
        persona.project.intensity = project_pb2.PROJECT_FIGURING_INTENSITY

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 10, msg='Failed for "%s"' % persona.name)

    def test_scared_user(self):
        """User is afraid of trying anything new."""
        persona = self._random_persona().clone()
        persona.project.intensity = project_pb2.PROJECT_NORMALLY_INTENSE
        persona.project.target_job.job_group.rome_id = (
            persona.user_profile.latest_job.job_group.rome_id)
        persona.user_profile.professional_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_adventurous_user(self):
        """User is OK to try a new job."""
        persona = self._random_persona().clone()
        persona.project.intensity = project_pb2.PROJECT_NORMALLY_INTENSE
        persona.project.target_job.job_group.rome_id = (
            persona.user_profile.latest_job.job_group.rome_id)
        persona.user_profile.professional_flexibility = user_pb2.YES

        score = self._score_persona(persona)

        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)
        self.assertLess(score, 3, msg='Failed for "%s"' % persona.name)


class SubsidizedContractScoringModelTestCase(ScoringModelTestBase('chantier-subsidized-contract')):
    """Unit tests for the "Learn about subsidized contracts" chantier."""

    def test_just_started(self):
        """User just started searching."""
        persona = self._random_persona().clone()
        persona.project.job_search_length_months = 3

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_senior(self):
        """User is senior in their role but they've bee searching for a long time."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.SENIOR
        persona.project.job_search_length_months = 20

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 2, msg='Failed for "%s"' % persona.name)

    def test_junior_searching_for_ages(self):
        """User is junior in their job and cannot find for a while."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.JUNIOR
        persona.project.job_search_length_months = 20

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 2, msg='Failed for "%s"' % persona.name)


class InternationalJobsScoringModelTestCase(ScoringModelTestBase('chantier-international')):
    """Unit tests for the "International Jobs" chantier."""

    def test_wont_move(self):
        """User does not want to move."""
        persona = self._random_persona().clone()
        persona.user_profile.geographical_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_does_not_speak_english(self):
        """User does not speak english well."""
        persona = self._random_persona().clone()
        persona.user_profile.english_level_estimate = 1

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_english_speaker_ready_to_move(self):
        """User speaks English fluently and is ready to move."""
        persona = self._random_persona().clone()
        persona.user_profile.geographical_flexibility = user_pb2.YES
        persona.user_profile.english_level_estimate = 3

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_english_speaker_ready_to_go_international(self):
        """User speaks English fluently and wants to go abroad."""
        persona = self._random_persona().clone()
        persona.user_profile.geographical_flexibility = user_pb2.YES
        persona.user_profile.english_level_estimate = 3
        persona.project.mobility.area_type = geo_pb2.WORLD

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 5, msg='Failed for "%s"' % persona.name)


class ProfessionnalisationScoringModelTestCase(ScoringModelTestBase(
        'chantier-professionnalisation')):
    """Unit tests for the "Professionnalisation Contract" chantier."""

    def test_intern(self):
        """User is an intern."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.INTERNSHIP
        if persona.user_profile.situation == user_pb2.IN_TRAINING:
            persona.user_profile.situation = user_pb2.LOST_QUIT
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_expert(self):
        """User is an expert."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.EXPERT
        if persona.user_profile.situation == user_pb2.IN_TRAINING:
            persona.user_profile.situation = user_pb2.LOST_QUIT
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED

        score = self._score_persona(persona)

        self.assertLessEqual(score, 1, msg='Failed for "%s"' % persona.name)
        self.assertGreater(score, 0, msg='Failed for "%s"' % persona.name)

    def test_intern_in_training(self):
        """User is an intern in training."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.INTERNSHIP
        persona.user_profile.situation = user_pb2.IN_TRAINING

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)


class ApprentissageScoringModelTestCase(ScoringModelTestBase('chantier-apprentissage')):
    """Unit tests for the "Apprentissage Contract" chantier scoring model."""

    def test_in_training(self):
        """User is already in training."""
        persona = self._random_persona().clone()
        persona.user_profile.situation = user_pb2.IN_TRAINING

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_not_flexible(self):
        """User does not want weird contracts."""
        persona = self._random_persona().clone()
        persona.user_profile.contract_type_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_40_years_old(self):
        """User is 40 years old."""
        persona = self._random_persona().clone()
        year = datetime.date.today().year
        persona.user_profile.year_of_birth = year - 40

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_already_worked_5_years(self):
        """User has already worked 5 years in this job."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.INTERMEDIARY

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_perfect_target(self):
        """User is THE target for apprentissage."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.JUNIOR
        persona.user_profile.situation = user_pb2.FIRST_TIME
        persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED
        year = datetime.date.today().year
        persona.user_profile.year_of_birth = year - 22

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class FreelanceScoringModelTestCase(ScoringModelTestBase('chantier-freelance')):
    """Unit tests for the "Freelance" chantier scoring model."""

    def test_not_flexible(self):
        """User does not want to change their contract type."""
        persona = self._random_persona().clone()
        persona.user_profile.contract_type_flexibility = user_pb2.ABSOLUTELY_NOT

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_flexible_expert(self):
        """User is an expert and ready to try another contract type."""
        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.EXPERT
        persona.user_profile.contract_type_flexibility = user_pb2.YES

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)


class AcceptContractTypeScoringModelTestCase(ScoringModelTestBase('chantier-contract-type(CDD)')):
    """Unit tests for the "Fallback to CDD" chantier."""

    def test_cdd_required(self):
        """Job where all offers are CDDs."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        del persona.project.employment_types[:]
        persona.project.employment_types.append(job_pb2.CDI)
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 40,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 60,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                ],
            },
        })

        score = self._score_persona(persona)

        # All job offers are in CDD: user should certainly be open to that
        # contract type and the score for this chantier should be 3 or above.
        self.assertGreaterEqual(score, 3, msg='Failed for "%s"' % persona.name)

    def test_cdd_required_but_already_targeted(self):
        """Job where all offers are CDDs but project is already for a CDD."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        persona.project.employment_types.append(job_pb2.CDD)
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 40,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 60,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                ],
            },
        })

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)

    def test_cdd_useless(self):
        """Job where no offers are CDDs."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        del persona.project.employment_types[:]
        persona.project.employment_types.append(job_pb2.CDI)
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 100,
                        'contractType': 'CDI',
                    },
                ],
            },
        })

        score = self._score_persona(persona)

        self.assertLessEqual(score, 0, msg='Failed for "%s"' % persona.name)


class OfficeToolsScoringTestCase(ScoringModelTestBase('chantier-office-tools')):
    """Unit tests for the "Master Office Tools" chantier."""

    def test_no_training(self):
        """User does not want to train."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'officeSkills': [
                    {
                        'percentSuggested': 80,
                        'officeSkillsLevel': 2,
                    },
                ],
            },
        })
        persona.user_profile.training_flexibility = user_pb2.ABSOLUTELY_NOT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_office_noob(self):
        """User has never used Office."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'officeSkills': [
                    {
                        'percentSuggested': 80,
                        'officeSkillsLevel': 2,
                    },
                ],
            },
        })
        if persona.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.training_flexibility = user_pb2.IF_NEEDED
        persona.user_profile.office_skills_estimate = 1

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertGreaterEqual(additional_offers, 400, msg='Failed for "%s"' % persona.name)

    def test_office_expert(self):
        """User is an expert of Office."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        self.database.job_group_info.insert_one({
            '_id': 'I1202',
            'requirements': {
                'officeSkills': [
                    {
                        'percentSuggested': 80,
                        'officeSkillsLevel': 2,
                    },
                ],
            },
        })
        persona.user_profile.office_skills_estimate = 3

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_office_not_needed(self):
        """The job does not require the use of Office at all."""
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'I1202'
        if persona.user_profile.training_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.training_flexibility = user_pb2.IF_NEEDED
        persona.user_profile.office_skills_estimate = 1

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)


class PartTimeScoringTestCase(ScoringModelTestBase('chantier-part-time')):
    """Unit tests for the "Try a Part Time Job" chantier."""

    def test_not_flexible(self):
        """User does not want to try other types of contract."""
        persona = self._random_persona().clone()
        persona.user_profile.contract_type_flexibility = user_pb2.ABSOLUTELY_NOT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_already_part_time(self):
        """User already accepts part-time jobs."""
        persona = self._random_persona().clone()
        persona.project.workloads.append(project_pb2.PART_TIME)

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_basic_user(self):
        """User should try a part-time job."""
        persona = self._random_persona().clone()
        del persona.project.workloads[:]
        persona.project.workloads.append(project_pb2.FULL_TIME)
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertGreater(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_not_so_random(self):
        """The model should be consistant about scoring."""
        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        other_persona = persona.clone()
        other_project = other_persona.scoring_project(self.database)
        other_additional_offers = self.model.score(other_project).additional_job_offers

        self.assertEqual(additional_offers, other_additional_offers)


class ImproveEnglishScoringTestCase(ScoringModelTestBase('chantier-english')):
    """Unit tests for the "Improve your English" chantier."""

    def test_not_flexible(self):
        """User does not want to train."""
        persona = self._random_persona().clone()
        persona.user_profile.training_flexibility = user_pb2.ABSOLUTELY_NOT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_already_fluent(self):
        """User already speaks English fluently."""
        persona = self._random_persona().clone()
        persona.user_profile.english_level_estimate = 3

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_basic_user(self):
        """User should try to learn English."""
        persona = self._random_persona().clone()
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED
        if persona.user_profile.english_level_estimate >= 3:
            persona.user_profile.english_level_estimate = 2

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertGreater(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_not_so_random(self):
        """The model should be consistant about scoring."""
        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        other_persona = persona.clone()
        other_project = other_persona.scoring_project(self.database)
        other_additional_offers = self.model.score(other_project).additional_job_offers

        self.assertEqual(additional_offers, other_additional_offers)


class TrainingScoringTestCase(ScoringModelTestBase('chantier-training')):
    """Unit tests for the "Plan a Training" chantier."""

    def test_not_flexible(self):
        """User does not want to train."""
        persona = self._random_persona().clone()
        persona.user_profile.training_flexibility = user_pb2.ABSOLUTELY_NOT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_already_certified(self):
        """User already has all required certifications."""
        persona = self._random_persona().clone()
        persona.project.diploma_fulfillment_estimate = project_pb2.FULFILLED

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_basic_user(self):
        """User should try to train."""
        persona = self._random_persona().clone()
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED
        if persona.project.diploma_fulfillment_estimate == project_pb2.FULFILLED:
            persona.user_profile.diploma_fulfillment_estimate = project_pb2.FULFILLMENT_NOT_SURE
        if persona.user_profile.situation == user_pb2.IN_TRAINING:
            persona.user_profile.situation = user_pb2.LOST_QUIT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertGreater(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_in_training(self):
        """User is already in training."""
        persona = self._random_persona().clone()
        if persona.user_profile.contract_type_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.contract_type_flexibility = user_pb2.IF_NEEDED
        if persona.project.diploma_fulfillment_estimate == project_pb2.FULFILLED:
            persona.user_profile.diploma_fulfillment_estimate = project_pb2.FULFILLMENT_NOT_SURE
        persona.user_profile.situation = user_pb2.IN_TRAINING

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_not_so_random(self):
        """The model should be consistant about scoring."""
        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        other_persona = persona.clone()
        other_project = other_persona.scoring_project(self.database)
        other_additional_offers = self.model.score(other_project).additional_job_offers

        self.assertEqual(additional_offers, other_additional_offers)


class ReduceSalaryScoringTestCase(ScoringModelTestBase('chantier-reduce-salary')):
    """Unit tests for the "Reduce your Salary Expectation" chantier."""

    def test_not_flexible(self):
        """User does not want to reduce their salary."""
        persona = self._random_persona().clone()
        persona.user_profile.salary_requirement_flexibility = user_pb2.ABSOLUTELY_NOT

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_no_salary_expectations(self):
        """User does not have any salary expectations."""
        persona = self._random_persona().clone()
        persona.project.min_salary = 0

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertLessEqual(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_basic_user(self):
        """User should try to reduce their salary."""
        persona = self._random_persona().clone()
        if persona.user_profile.salary_requirement_flexibility == user_pb2.ABSOLUTELY_NOT:
            persona.user_profile.salary_requirement_flexibility = user_pb2.IF_NEEDED
        if persona.project.min_salary == 0:
            persona.project.min_salary = 35000

        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        self.assertGreater(additional_offers, 0, msg='Failed for "%s"' % persona.name)

    def test_not_so_random(self):
        """The model should be consistant about scoring."""
        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        additional_offers = self.model.score(project).additional_job_offers

        other_persona = persona.clone()
        other_project = other_persona.scoring_project(self.database)
        other_additional_offers = self.model.score(other_project).additional_job_offers

        self.assertEqual(additional_offers, other_additional_offers)


def _random_scoring_project():
    return scoring.ScoringProject(
        project=project_pb2.Project(
            project_id='%x-%x' % (random.randrange(0x1000), random.randrange(0x1000))),
        user_profile=user_pb2.UserProfile(),
        features_enabled=user_pb2.Features(),
        database=mongomock.MongoClient().test)


class ChooseBestChantiers(unittest.TestCase):
    """Unit tests for the choose_best_chantiers."""

    @classmethod
    def setUpClass(cls):
        """Test setup."""
        super(ChooseBestChantiers, cls).setUpClass()
        scoring.SCORING_MODELS['test-zero'] = scoring.ConstantScoreModel(0)
        scoring.SCORING_MODELS['test-minus-one'] = scoring.ConstantScoreModel(-1)
        scoring.SCORING_MODELS['test-one'] = scoring.ConstantScoreModel(1)
        scoring.SCORING_MODELS['test-two'] = scoring.ConstantScoreModel(2)
        scoring.SCORING_MODELS['test-three'] = scoring.ConstantScoreModel(3)

    def test_no_chantiers(self):
        """Check that the function does not crash with an empty list."""
        scorer = scoring.score_chantiers([], _random_scoring_project())
        best = scorer.get_best_chantiers(5)
        self.assertEqual([], best)

    def test_empty_scoring_models(self):
        """Check that the empty scoring model's result is not cached."""
        # The empty scoring model should give a different random number on each
        # call. We had a bug earlier where all chantiers would be scored the
        # same so we would get either all of them (7 chantiers) or none (0
        # chantiers).
        num_best_per_draw = []
        for unused_i in range(40):
            scorer = scoring.score_chantiers(
                [chantier_pb2.Chantier()] * 7, _random_scoring_project())
            best = scorer.get_best_chantiers(7, min_score=1.5)
            num_best_per_draw.append(len(best))
        self.assertLess(2, len(set(num_best_per_draw)), num_best_per_draw)

    def test_filter_zero(self):
        """Check that chantiers scoring 0 or below are dropped."""
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='foo', scoring_model='test-zero'),
            chantier_pb2.Chantier(title='blah', scoring_model='test-minus-one'),
            chantier_pb2.Chantier(title='bar', scoring_model='test-three'),
        ], None)
        best = scorer.get_best_chantiers(5)
        self.assertEqual(['bar'], [t.chantier.title for t in best])

    @mock.patch(scoring.__name__ + '.logging.warning')
    def test_unknown_scoring_model(self, mock_warning):
        """Check that the function does not crash with an unknown model."""
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='foo', scoring_model='test-unknown-scoring-model'),
        ], None)
        best = scorer.get_best_chantiers(5)
        self.assertEqual(['foo'], [t.chantier.title for t in best])
        mock_warning.assert_called_with(
            'Scoring model "%s" unknown, falling back to default.',
            'test-unknown-scoring-model')

    @mock.patch(scoring.__name__ + '.logging.warning')
    def test_unknown_negated_scoring_model(self, mock_warning):
        """Check that the function does not crash with a negated unknown model."""
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='foo', scoring_model='not-test-unknown-scoring-model'),
        ], None)
        best = scorer.get_best_chantiers(5)
        self.assertEqual(['foo'], [t.chantier.title for t in best])
        mock_warning.assert_called_with(
            'Scoring model "%s" unknown, falling back to default.',
            'not-test-unknown-scoring-model')

    def test_rank_before_cutting(self):
        """Check that the best chantiers are chosen."""
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='foo', scoring_model='test-three'),
            chantier_pb2.Chantier(title='blah', scoring_model='test-two'),
            chantier_pb2.Chantier(title='bar', scoring_model='test-three'),
        ], None)
        best = scorer.get_best_chantiers(2)
        self.assertEqual(set(['foo', 'bar']), set(t.chantier.title for t in best))

    def test_integration(self):
        """Real check on a fixed persona."""
        database = mongomock.MongoClient().test
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='About Job', scoring_model='chantier-about-job'),
            chantier_pb2.Chantier(title='Apply More', scoring_model='constant(2)'),
            chantier_pb2.Chantier(
                title='Use Your Network',
                scoring_model='chantier-use-network'),
        ], _PERSONAS['empty'].scoring_project(database))
        best = scorer.get_best_chantiers(2)
        self.assertEqual(['Apply More', 'Use Your Network'], [t.chantier.title for t in best])

    def test_cache_score_min(self):
        """Check that min_score param does not get cached."""
        scorer = scoring.score_chantiers([
            chantier_pb2.Chantier(title='foo', scoring_model='test-two'),
            chantier_pb2.Chantier(title='bar', scoring_model='test-three'),
        ], None)
        best = scorer.get_best_chantiers(5, min_score=2.5)
        self.assertEqual(['bar'], [t.chantier.title for t in best])

        all_chantiers = scorer.get_best_chantiers(5, min_score=0)
        self.assertEqual(['bar', 'foo'], [t.chantier.title for t in all_chantiers])


class GroupTargetsTestCase(unittest.TestCase):
    """Unit tests for computing the chantiers groups targets."""

    def setUp(self):
        super(GroupTargetsTestCase, self).setUp()
        self._database = mongomock.MongoClient().test
        self._persona = _PERSONAS[random.choice(list(_PERSONAS))].clone()

    def test_score_blue_really_needed(self):
        """Test the target for blue chantiers."""
        self._persona.project.weekly_applications_estimate = project_pb2.A_LOT
        self._persona.project.total_interviews_estimate = project_pb2.SOME
        self._persona.project.job_search_length_months = 24
        scorer = scoring.score_chantiers([], self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        blue_target = targets[chantier_pb2.IMPROVE_SUCCESS_RATE]
        self.assertGreaterEqual(blue_target, 10, msg='Failed for "%s"' % self._persona.name)

    def test_score_blue_when_just_started(self):
        """Test the target for blue chantiers when user just started searching."""
        self._persona.project.job_search_length_months = 2
        scorer = scoring.score_chantiers([], self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        blue_target = targets[chantier_pb2.IMPROVE_SUCCESS_RATE]
        self.assertGreaterEqual(blue_target, 5, msg='Failed for "%s"' % self._persona.name)

    def test_score_blue_not_needed(self):
        """Test the target for blue chantiers."""
        self._persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self._persona.project.total_interviews_estimate = project_pb2.LESS_THAN_2
        self._persona.project.job_search_length_months = 3
        scorer = scoring.score_chantiers([], self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        blue_target = targets[chantier_pb2.IMPROVE_SUCCESS_RATE]
        self.assertLessEqual(blue_target, 4, msg='Failed for "%s"' % self._persona.name)

    def test_score_green(self):
        """Test the target for green chantiers."""
        self._persona.project.mobility.city.city_id = '69123'
        self._persona.project.target_job.job_group.rome_id = 'A1234'
        self._database.fhs_local_diagnosis.insert_one({
            '_id': '69123:A1234',
            'unemploymentDuration': {
                'days': 80,
            },
        })
        scorer = scoring.score_chantiers([], self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        green_target = targets[chantier_pb2.UNLOCK_NEW_LEADS]
        self.assertGreaterEqual(green_target, 2, msg='Failed for "%s"' % self._persona.name)
        self.assertLessEqual(green_target, 3, msg='Failed for "%s"' % self._persona.name)

    def test_score_red_tons_of_offers(self):
        """Test the target for red chantiers."""
        self._persona.project.mobility.city.departement_id = '69'
        self._persona.project.target_job.job_group.rome_id = 'A1234'
        self._database.recent_job_offers.insert_one({
            '_id': '69:A1234',
            'numAvailableJobOffers': 240,
        })

        scorer = scoring.score_chantiers(
            [
                chantier_pb2.Chantier(
                    chantier_id='a', scoring_model='constant(2)',
                    kind=chantier_pb2.INCREASE_AVAILABLE_OFFERS),
            ] * 5 + [
                chantier_pb2.Chantier(
                    chantier_id='c', scoring_model='constant(2)',
                    kind=chantier_pb2.IMPROVE_SUCCESS_RATE),
            ] * 10,
            self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        red_target = targets[chantier_pb2.INCREASE_AVAILABLE_OFFERS]
        self.assertLessEqual(red_target, 0, msg='Failed for "%s"' % self._persona.name)

    def test_score_red_not_many_offers(self):
        """Test the target for red chantiers."""
        self._persona.project.mobility.city.departement_id = '69'
        self._persona.project.target_job.job_group.rome_id = 'A1234'
        self._database.recent_job_offers.insert_one({
            '_id': '69:A1234',
            'numAvailableJobOffers': 32,
        })

        scorer = scoring.score_chantiers(
            [
                chantier_pb2.Chantier(
                    chantier_id='a', scoring_model='constant(2)',
                    kind=chantier_pb2.INCREASE_AVAILABLE_OFFERS),
            ] * 5 + [
                chantier_pb2.Chantier(
                    chantier_id='c', scoring_model='constant(2)',
                    kind=chantier_pb2.IMPROVE_SUCCESS_RATE),
            ] * 10,
            self._persona.scoring_project(self._database))
        targets = scorer.get_group_targets()
        red_target = targets[chantier_pb2.INCREASE_AVAILABLE_OFFERS]
        # User gets 5 chantier that could make them +20% each, so in total they
        # could get +100%. However the max is 32, so it means they have access
        # to 16 job offers for now. As the target is 24, they need a +50%
        # increase which translates in 5 target points.
        self.assertEqual(5, red_target, msg='Failed for "%s"' % self._persona.name)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
