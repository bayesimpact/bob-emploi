"""Tests for the bob_emploi.frontend.scoring module."""

import collections
import datetime
import json
import numbers
from os import path
import random
import unittest

import mock
import mongomock
import rstr

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import proto

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


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

        name = '{} cloned'.format(self.name)
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
            cls.model_id = model_id
            cls.model = scoring.get_scoring_model(model_id)

        def setUp(self):
            super(_TestCase, self).setUp()
            self.database = mongomock.MongoClient().test
            self.now = None
            self.assertIsInstance(
                self.model, scoring.ModelBase, msg='model ID: "{}".'.format(self.model_id))

        def _score_persona(self, persona=None, name=None):
            if not persona:
                persona = _PERSONAS[name]
            project = persona.scoring_project(self.database, now=self.now)
            return self.model.score(project)

        def _assert_score_persona_raises(self, exception_type, persona=None, name=None):
            if not persona:
                persona = _PERSONAS[name]
            project = persona.scoring_project(self.database, now=self.now)
            with self.assertRaises(exception_type, msg='Fail for "{}"'.format(persona.name)):
                self.model.score(project)

        def _random_persona(self):
            return _PERSONAS[random.choice(list(_PERSONAS))]

        def _clone_persona(self, name):
            return _PERSONAS[name].clone()

    return _TestCase


def HundredScoringModelTestBase(model_id):  # pylint: disable=invalid-name
    """Creates a base class for unit tests of scoring models using the ModelHundredBase."""

    class _TestCase(ScoringModelTestBase(model_id)):

        def setUp(self):
            super(_TestCase, self).setUp()
            self.persona = self._random_persona().clone()

        def assert_not_enough_data(self):
            """Asserts that the scorer chokes with a NotEnoughDataException
            while scoring self.persona."""

            self._assert_score_persona_raises(scoring.NotEnoughDataException, self.persona)

        def assert_good_score(self, score, limit=70, msg=None):
            """Asserts that the score is considered good (more than limit in percent)."""

            self.assertGreaterEqual(score, limit * 3 / 100, msg)

        def assert_great_score(self, score, msg=None):
            """Asserts that the score is the best possible."""

            self.assertEqual(score, 3, msg)

        def assert_bad_score(self, score, limit=30, msg=None):
            """Asserts that the score is considered bad (less than limit in percent).
            Also checks that it is not below 0%."""

            self.assertGreaterEqual(score, 0, msg='A bad score should not be under 0.')
            self.assertLessEqual(score, limit * 3 / 100, msg)

        def assert_worse_score(self, score, msg=None):
            """Assert that the score is the worse possible (0%)."""

            self.assertEqual(score, 0, msg)

    return _TestCase


class DefaultScoringModelTestCase(ScoringModelTestBase('')):
    """Unit test for the default scoring model."""

    def test_score(self):
        """Test the score function."""

        score = self._score_persona(self._random_persona())

        self.assertLessEqual(score, 3)
        self.assertLessEqual(0, score)


class TrainingAdviceScoringModelTestCase(ScoringModelTestBase('advice-training')):
    """Unit test for the training scoring model."""

    def setUp(self):
        """Setting up the persona for a test."""

        super(TrainingAdviceScoringModelTestCase, self).setUp()
        self.persona = self._random_persona().clone()
        self._many_trainings = [
            training_pb2.Training(),
            training_pb2.Training(),
            training_pb2.Training(),
        ]

    @mock.patch(carif.__name__ + '.get_trainings')
    def test_low_advice_for_new_de(self, mock_carif_get_trainings):
        """The user just started searching for a job."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.mobility.city.departement_id = '35'
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.job_search_length_months = 0
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime())
        if self.persona.project.kind == project_pb2.REORIENTATION:
            self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        self.assertGreater(2, self._score_persona(self.persona))
        mock_carif_get_trainings.assert_called_once_with('A1234', '35')

    @mock.patch(carif.__name__ + '.get_trainings')
    def test_three_stars(self, mock_carif_get_trainings):
        """The user has been searching for a job for 3 months."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.job_search_length_months = 3
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=94))
        project = self.persona.scoring_project(self.database, now=self.now)
        score, explanations = self.model.score_and_explain(project)
        self.assertEqual(3, score)
        self.assertEqual(['vous cherchez depuis 3 mois'], explanations)

    @mock.patch(carif.__name__ + '.get_trainings')
    def test_one_month(self, mock_carif_get_trainings):
        """The user has been searching for a job for 1 month."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.job_search_length_months = 1
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=30.5))
        if self.persona.project.kind == project_pb2.REORIENTATION:
            self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        score = self._score_persona(self.persona)
        self.assertGreater(3, score)
        self.assertLess(0, score)

    @mock.patch(carif.__name__ + '.get_trainings')
    def test_reorientation(self, mock_carif_get_trainings):
        """The user is in reorientation."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.kind = project_pb2.REORIENTATION
        self.assertEqual(3, self._score_persona(self.persona))

    @mock.patch(carif.__name__ + '.get_trainings')
    def test_no_trainings(self, mock_carif_get_trainings):
        """There are no trainings for this combination."""

        mock_carif_get_trainings.return_value = []
        self.assertEqual(0, self._score_persona(self.persona))


class ConstantScoreModelTestCase(ScoringModelTestBase('constant(2)')):
    """Unit test for the constant scoring model."""

    def test_random(self):
        """Check score on a random persona."""

        persona = self._random_persona()
        self.assertEqual(
            2, self._score_persona(persona), msg='Failed for "{}"'.format(persona.name))


def persona_lbb_call_mock(project, **unused_kwargs):
    """Mocking lbb call to return a specific iterator for a specific job group."""

    if project.target_job.job_group.rome_id == 'M1604':
        return iter([{'headcount_text': '0 salarié'}])
    return iter([{'headcount_text': '500 à 299 salariés'}])


class PersonasTestCase(unittest.TestCase):
    """Tests all scoring models and all personas."""

    @mock.patch(companies.__name__ + '.get_lbb_companies', new=persona_lbb_call_mock)
    @mock.patch(carif.__name__ + '.get_trainings')
    def test_run_all(self, mock_carif_get_trainings):
        """Run all scoring models on all personas."""

        mock_carif_get_trainings.return_value = [
            training_pb2.Training(),
            training_pb2.Training(),
            training_pb2.Training(),
        ]
        database = mongomock.MongoClient().test
        _load_json_to_mongo(database, 'job_group_info')
        _load_json_to_mongo(database, 'local_diagnosis')
        _load_json_to_mongo(database, 'associations')
        _load_json_to_mongo(database, 'volunteering_missions')
        _load_json_to_mongo(database, 'hiring_cities')
        _load_json_to_mongo(database, 'cities')
        _load_json_to_mongo(database, 'departements')
        _load_json_to_mongo(database, 'seasonal_jobbing')
        _load_json_to_mongo(database, 'specific_to_job_advice')
        _load_json_to_mongo(database, 'reorient_jobbing')
        _load_json_to_mongo(database, 'reorient_to_close')

        scores = collections.defaultdict(lambda: collections.defaultdict(float))
        # Mock the "now" date so that scoring models that are based on time
        # (like "Right timing") are deterministic.
        now = datetime.datetime(2016, 9, 27)
        for model_name in list(scoring.SCORING_MODELS.keys()):
            model = scoring.get_scoring_model(model_name)
            self.assertTrue(model, msg=model_name)
            scores[model_name] = {}
            for name, persona in _PERSONAS.items():
                scoring_project = persona.scoring_project(database, now=now)
                try:
                    score, explanations = model.score_and_explain(scoring_project)
                except scoring.NotEnoughDataException:
                    score = -1
                    explanations = []
                scores[model_name][name] = score
                self.assertIsInstance(
                    scores[model_name][name],
                    numbers.Number,
                    msg='while using the model "{}" to score "{}"'
                    .format(model_name, name))
                self._assert_proper_explanations(
                    explanations, scoring_project,
                    msg='while using the model "{}" to explain the score of "{}"'
                    .format(model_name, name))

        for name in _PERSONAS:
            persona_scores = [
                max(model_scores[name], 0)
                for model_scores in scores.values()]
            self.assertLess(
                1, len(set(persona_scores)),
                msg='Persona "{}" has the same score across all models.'.format(name))

        model_scores_hashes = collections.defaultdict(list)
        for model_name, model_scores in scores.items():
            model = scoring.SCORING_MODELS[model_name]
            if isinstance(model, scoring.ConstantScoreModel):
                continue
            self.assertLess(
                1, len(set(model_scores.values())),
                msg='Model "{}" has the same score for all personas.'.format(model_name))
            scores_hash = json.dumps(model_scores, sort_keys=True)
            model_scores_hashes[scores_hash].append(model_name)
        models_with_same_score = \
            [models for models in model_scores_hashes.values() if len(models) > 1]
        self.assertFalse(models_with_same_score, msg='Some models always have the same scores')

    def _assert_proper_explanations(self, explanations, scoring_project, msg):
        self.assertIsInstance(explanations, list, msg=msg)
        for explanation in explanations:
            self.assertIsInstance(explanation, str, msg=msg)
            try:
                resolved_explanation = scoring_project.populate_template(
                    explanation, raise_on_missing_var=True)
            except ValueError:
                self.fail(msg=msg)
            self.assertNotRegex(resolved_explanation, r'^[A-Z]', msg=msg)

    def test_scoring_model_names(self):
        """Keep consistency for scoring model names."""

        for model_name in list(scoring.SCORING_MODELS.keys()):
            self.assertNotRegex(
                model_name, r'^[^\(]*_[^\(]*(\(.*)?$',
                msg='Use hyphens in scoring model names instead of underscores, "{}"'.format(
                    model_name.replace('_', '-')))

    def test_conflicts_with_regexp(self):
        """Model regexps should not conflict with named scoring models."""

        for regexp, constructor in scoring.SCORING_MODEL_REGEXPS:
            for model_name, model in scoring.SCORING_MODELS.items():
                regexp_match = regexp.match(model_name)
                if not regexp_match:
                    continue
                if isinstance(model, type(constructor(regexp_match.group(1)))):
                    # They both have the same type, most probably it's just a
                    # cache from the regexp.
                    continue
                self.fail(
                    'The model "{}" is implemented both by its name and by a regexp.'
                    .format(model_name))

            for other_regexp, unused_constructor in scoring.SCORING_MODEL_REGEXPS:
                if other_regexp == regexp:
                    continue
                example = rstr.xeger(regexp)
                self.assertFalse(
                    other_regexp.match(example),
                    msg='There is a conflict between two regexps: "{}" and "{}" over "{}"'
                    .format(regexp, other_regexp, example))


class LifeBalanceTestCase(ScoringModelTestBase('advice-life-balance')):
    """Unit tests for the "Work/Life balance" advice."""

    def test_short_searching(self):
        """The user does not have a diploma problem."""

        persona = self._random_persona().clone()
        scoring_project = persona.scoring_project(self.database)
        if persona.project.job_search_length_months > 3:
            persona.project.job_search_length_months = 2
        if scoring_project.get_search_length_at_creation() > 3:
            persona.project.job_search_started_at.FromDatetime(
                persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        persona.user_profile.has_handicap = False
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_handicaped(self):
        """The user has a handicap."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = True
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_long_searching(self):
        """The user does not have a diploma problem."""

        persona = self._random_persona().clone()
        scoring_project = persona.scoring_project(self.database)
        if persona.project.job_search_length_months < 4:
            persona.project.job_search_length_months = 4
        if scoring_project.get_search_length_at_creation() < 4:
            persona.project.job_search_started_at.FromDatetime(
                persona.project.created_at.ToDatetime() - datetime.timedelta(days=122))
        persona.user_profile.has_handicap = False
        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg='Failed for "{}"'.format(persona.name))


class AdviceVaeTestCase(ScoringModelTestBase('advice-vae')):
    """Unit tests for the "vae" advice."""

    def test_experiemented(self):
        """The user is experimented and think he has enough diplomas."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.EXPERT
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_EXPERIENCE
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_frustrated_by_trainings_and_is_senior(self):
        """The user is frustrated by training and is senior."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)
        persona.project.seniority = project_pb2.SENIOR
        # Make sure the user does not have enough diplomas otherwise all the
        # rest is irrelevant.
        if persona.project.training_fulfillment_estimate == project_pb2.ENOUGH_DIPLOMAS:
            persona.project.training_fulfillment_estimate = \
                project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        score = self._score_persona(persona)
        self.assertGreaterEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_not_matching(self):
        """The user does not have a diploma problem."""

        persona = self._random_persona().clone()
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_frustrated_no_experience(self):
        """The user is frustrated by trainings, has no experience and his diploma is unsure."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)
        persona.project.seniority = project_pb2.JUNIOR
        persona.project.training_fulfillment_estimate = project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))

    def test_has_enough_diplomas(self):
        """The user is frustrated by trainings but is expert and has enough diplomas."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)
        persona.project.seniority = project_pb2.EXPERT
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class AdviceSeniorTestCase(ScoringModelTestBase('advice-senior')):
    """Unit tests for the "Senior" advice."""

    def test_match_discriminated(self):
        """The user is over 40 years old and feels discriminated so this should match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth > datetime.date.today().year - 41:
            persona.user_profile.year_of_birth = datetime.date.today().year - 41
        persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_match_old(self):
        """The user is over 50 years old so the advice should match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth > datetime.date.today().year - 50:
            persona.user_profile.year_of_birth = datetime.date.today().year - 50
        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_no_match(self):
        """The user is young so the advice should not match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth < datetime.date.today().year - 35:
            persona.user_profile.year_of_birth = datetime.date.today().year - 35
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class AdviceLessApplicationsTestCase(ScoringModelTestBase('advice-less-applications')):
    """Unit tests for the "Apply less" advice."""

    def test_match(self):
        """The user applies a lot so the advice should match."""

        persona = self._random_persona().clone()
        if persona.project.weekly_applications_estimate != project_pb2.A_LOT and \
                persona.project.weekly_applications_estimate != project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}"'.format(persona.name))

    def test_no_match(self):
        """The user does not apply a lot so the advice should not match."""

        persona = self._random_persona().clone()
        if persona.project.weekly_applications_estimate == project_pb2.DECENT_AMOUNT or \
                persona.project.weekly_applications_estimate == project_pb2.A_LOT:
            persona.project.weekly_applications_estimate = project_pb2.SOME
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg='Failed for "{}"'.format(persona.name))


class AdviceJobBoardsTestCase(ScoringModelTestBase('advice-job-boards')):
    """Unit tests for the "Other Work Environments" advice."""

    def test_frustrated(self):
        """Frustrated by not enough offers."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 2, msg='Failed for "{}"'.format(persona.name))

    def test_lot_of_offers(self):
        """User has many offers already."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.weekly_offers_estimate = project_pb2.A_LOT

        score = self._score_persona(persona)

        # We do want to show the advice but not pre-select it.
        self.assertEqual(1, score, msg='Failed for "{}"'.format(persona.name))

    def test_extra_data(self):
        """Compute extra data."""

        persona = self._random_persona().clone()
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_one({'title': 'Remix Jobs'})
        result = self.model.compute_extra_data(project)
        self.assertTrue(result, msg='Failed for "{}"'.format(persona.name))
        self.assertEqual(
            'Remix Jobs', result.job_board_title, msg='Failedfor "{}"'.format(persona.name))

    def test_filter_data(self):
        """Get the job board with the most filters."""

        persona = self._random_persona().clone()
        persona.project.mobility.city.departement_id = '69'
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_many([
            {'title': 'Remix Jobs'},
            {'title': 'Specialized for me', 'filters': ['for-departement(69)']},
            {'title': 'Specialized NOT for me', 'filters': ['for-departement(31)']},
        ])
        result = self.model.compute_extra_data(project)
        self.assertTrue(result)
        self.assertEqual('Specialized for me', result.job_board_title)

    def test_filter_pole_emploi(self):
        """Never show Pôle emploi,"""

        persona = self._random_persona().clone()
        persona.project.mobility.city.departement_id = '69'
        project = persona.scoring_project(self.database)
        self.database.jobboards.insert_many([
            {'title': 'Pôle emploi', 'isWellKnown': True},
            {'title': 'Remix Jobs'},
        ])
        result = self.model.compute_extra_data(project)
        self.assertTrue(result)
        self.assertEqual('Remix Jobs', result.job_board_title)


class AdviceOtherWorkEnvTestCase(ScoringModelTestBase('advice-other-work-env')):
    """Unit tests for the "Other Work Environments" advice."""

    def test_no_job_group_info(self):
        """Does not trigger if we are missing environment data."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'
        self.database.job_group_info.insert_one({'_id': 'M1607'})

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_with_other_structures(self):
        """Triggers if multiple structures."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'workEnvironmentKeywords': {'structures': ['Kmenistan', 'Key']},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}":'.format(persona.name))

    def test_with_only_one_structure_and_one_sector(self):
        """Only one structure and one sector."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'workEnvironmentKeywords': {
                'structures': ['Kmenistan'],
                'sectors': ['Toise'],
            },
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))


class AdviceWowBakerTestCase(ScoringModelTestBase('advice-wow-baker')):
    """Unit tests for the "Wow Baker" advice."""

    def test_not_baker(self):
        """Does not trigger for non baker."""

        persona = self._random_persona().clone()
        if persona.project.target_job.job_group.rome_id == 'D1102':
            persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_chief_baker(self):
        """Does not trigger for a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        persona.project.target_job.code_ogr = '12006'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_baker_not_chief(self):
        """Does not trigger for a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        if persona.project.target_job.code_ogr == '12006':
            persona.project.target_job.code_ogr = '10868'

        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}":'.format(persona.name))


class AdviceSpecificToJobTestCase(ScoringModelTestBase('advice-specific-to-job')):
    """Unit tests for the "Specicif to Job" advice."""

    def setUp(self):
        super(AdviceSpecificToJobTestCase, self).setUp()
        self.database.specific_to_job_advice.insert_one({
            'title': 'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            'filters': ['for-job-group(D1102)', 'not-for-job(12006)'],
            'cardText':
            'Allez à la boulangerie la veille pour savoir à quelle '
            'heure arrive le chef boulanger.',
            'expandedCardHeader': "Voilà ce qu'il faut faire",
            'expandedCardItems': [
                'Se présenter aux boulangers entre 4h et 7h du matin.',
                'Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin',
                'Contacter les fournisseurs de farine locaux : ils connaissent '
                'tous les boulangers du coin et sauront où il y a des '
                'embauches.',
            ],
        })

    def test_not_baker(self):
        """Does not trigger for non baker."""

        persona = self._random_persona().clone()
        if persona.project.target_job.job_group.rome_id == 'D1102':
            persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_chief_baker(self):
        """Does not trigger for a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        persona.project.target_job.code_ogr = '12006'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_baker_not_chief(self):
        """Trigger for a baker that is not a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        if persona.project.target_job.code_ogr == '12006':
            persona.project.target_job.code_ogr = '10868'

        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg='Failed for "{}":'.format(persona.name))


class AdviceBodyLanguageTestCase(ScoringModelTestBase('advice-body-language')):
    """Unit tests for the "Body Language" advice."""

    def test_frustrated_by_interviews(self):
        """User is frustrated by their performance in interviews."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.INTERVIEW)

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}":'.format(persona.name))

    def test_not_frustrated(self):
        """User is not frustrated."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg='Failed for "{}":'.format(persona.name))


class AdviceFollowUpEmailTestCase(ScoringModelTestBase('advice-follow-up')):
    """Unit tests for the "Follow Up" advice."""

    def test_should_apply_in_person(self):
        """User is looking for a job that does not use email for applications."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'preferredApplicationMedium': 'APPLY_IN_PERSON',
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg='Failed for "{}":'.format(persona.name))

    def test_not_frustrated(self):
        """User is not frustrated."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg='Failed for "{}":'.format(persona.name))

    def test_frustrated_by_no_answer(self):
        """User is frustrated by the lack of answers."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFER_ANSWERS)

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg='Failed for "{}":'.format(persona.name))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
