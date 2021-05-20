"""Tests for the bob_emploi.frontend.scoring module."""

import collections
import datetime
import json
import numbers
from os import path
import random
import typing
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Type, Union
import unittest
from unittest import mock

from google.protobuf import message
import mongomock
import pyjson5
import rstr

from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import advisor
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import carif
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import scoring_base
from bob_emploi.frontend.server import proto

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')

# TODO(cyrille): Move strategy scorer tests to its own module and re-enable rule below.
# pylint: disable=too-many-lines


def _load_json_to_mongo(database: mongo.NoPiiMongoDatabase, collection: str) -> None:
    """Load a MongoDB collection from a JSON file."""

    with open(path.join(_TESTDATA_FOLDER, collection + '.json')) as json_file:
        json_blob = pyjson5.load(json_file)
    database[collection].insert_many(json_blob)


class ScoringProjectTestCase(unittest.TestCase):
    """Test methods of the ScoringProject class."""

    _db = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)

    def test_string_representation(self) -> None:
        """A scoring project can be represented as a meaningful string."""

        user = user_pb2.User()
        user.profile.gender = user_pb2.MASCULINE
        user.features_enabled.alpha = True
        project = project_pb2.Project(title='Developpeur web a Lyon')
        project_str = str(scoring.ScoringProject(project, user, self._db))
        self.assertIn(str(user.profile), project_str)
        self.assertIn(str(project), project_str)
        self.assertIn(str(user.features_enabled), project_str)

    def test_personal_string(self) -> None:
        """A scoring model string does not show personal identifiers."""

        user = user_pb2.User()
        user.profile.name = 'Cyrille'
        user.features_enabled.alpha = True
        project = project_pb2.Project(project_id='secret-project')
        project_str = str(scoring.ScoringProject(project, user, self._db))
        self.assertNotIn('Cyrille', project_str)
        self.assertNotIn('secret-project', project_str)
        self.assertEqual('Cyrille', user.profile.name)
        self.assertEqual('secret-project', project.project_id)

    def test_jobgroup_info_locale(self) -> None:
        """A scoring project can be represented as a meaningful string."""

        user = user_pb2.User()
        user.profile.locale = 'nl'
        database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        database.job_group_info.insert_many(
            [{'_id': 'A1234', 'name': 'french'}, {'_id': 'nl:A1234', 'name': 'dutch'}])
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')))
        scoring_project = scoring.ScoringProject(project, user, database)
        job_group_info = scoring_project.job_group_info()
        self.assertEqual('dutch', job_group_info.name)

    def test_jobgroup_info_fr_locale(self) -> None:
        """A scoring project can be represented as a meaningful string."""

        user = user_pb2.User()
        user.profile.locale = ''
        database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        database.job_group_info.insert_many(
            [{'_id': 'A1234', 'name': 'french'}, {'_id': 'nl:A1234', 'name': 'dutch'}])
        project = project_pb2.Project(
            target_job=job_pb2.Job(job_group=job_pb2.JobGroup(rome_id='A1234')))
        scoring_project = scoring.ScoringProject(project, user, database)
        job_group_info = scoring_project.job_group_info()
        self.assertEqual('french', job_group_info.name)


class _Persona:
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

    def __init__(self, name: str, user: user_pb2.User) -> None:
        self.name = name
        self._user = user

    @property
    def user(self) -> user_pb2.User:  # pylint: disable=missing-function-docstring
        return self._user

    @property
    def user_profile(self) -> user_pb2.UserProfile:  # pylint: disable=missing-function-docstring
        return self._user.profile

    @property
    def project(self) -> project_pb2.Project:  # pylint: disable=missing-function-docstring
        return self.user.projects[0]

    @property
    def features_enabled(self) -> user_pb2.Features:  # pylint: disable=missing-function-docstring
        return self.user.features_enabled

    @classmethod
    def load_set(cls, filename: str) -> Dict[str, '_Persona']:
        """Load a set of personas from a JSON file."""

        with open(filename) as personas_file:
            personas_json = pyjson5.load(personas_file)
        personas: Dict[str, _Persona] = {}
        for name, blob in personas_json.items():
            user = user_pb2.User()
            assert proto.parse_from_mongo(blob['user'], user.profile)
            if 'featuresEnabled' in blob:
                assert proto.parse_from_mongo(blob['featuresEnabled'], user.features_enabled)
            if 'project' in blob:
                assert proto.parse_from_mongo(blob['project'], user.projects.add())
            if 'projects' in blob:
                for project in blob['projects']:
                    assert proto.parse_from_mongo(project, user.projects.add())
            assert name not in personas
            personas[name] = cls(name, user)
        return personas

    def scoring_project(
            self,
            database: mongo.NoPiiMongoDatabase,
            now: Optional[datetime.datetime] = None) -> scoring.ScoringProject:
        """Creates a new scoring.ScoringProject for this persona."""

        return scoring.ScoringProject(
            project=self.project,
            user=self._user,
            database=database,
            now=now)

    # TODO(cyrille): Add features to clone.
    def clone(self) -> '_Persona':
        """Clone this persona.

        This is useful if you want a slightly modified persona: you clone an
        existing one and then can modify its protobufs without modifying the
        original one.
        """

        user = user_pb2.User()
        user.CopyFrom(self._user)
        return _Persona(name=f'{self.name} cloned', user=user)


_PERSONAS = _Persona.load_set(path.join(_TESTDATA_FOLDER, 'personas.json5'))

_Exception = typing.TypeVar('_Exception', bound=BaseException)


class PersonaTestBase(unittest.TestCase):
    """A base class for tests using personas."""

    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        self.now: Optional[datetime.datetime] = None

    def _scoring_project(
            self,
            # TODO(cyrille): Use Union[_Persona, name, None].
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> scoring.ScoringProject:
        if not persona:
            persona = _PERSONAS[name] if name is not None else self._random_persona()
        return persona.scoring_project(self.database, now=self.now)

    def _score(
            self,
            model: Union[str, scoring.ModelBase, None] = None,
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> float:
        if isinstance(model, str):
            model = scoring.get_scoring_model(model)
        if model is None:  # pragma: no-cover
            raise NotImplementedError(
                f'The model_id {model} is not the ID of any known model')
        return model.score(self._scoring_project(persona, name))

    def _explain(
            self,
            model: Union[str, scoring.ModelBase, None] = None,
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> List[str]:
        if isinstance(model, str):
            model = scoring.get_scoring_model(model)
        if model is None:  # pragma: no-cover
            raise NotImplementedError(
                f'The model_id {model} is not the ID of any known model')
        unused_score, reasons = model.score_and_explain(self._scoring_project(persona, name))
        return reasons

    def _override(
            self,
            model: Union[str, scoring.ModelBase, None] = None,
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> project_pb2.Advice:
        if model is None or isinstance(model, scoring.ModelBase):  # pragma: no-cover
            raise NotImplementedError(
                f'The model {model} has no known attached ID.')
        advice, unused_fields = next(iter(advisor.compute_available_methods(
            self._scoring_project(persona, name),
            [advisor_pb2.AdviceModule(trigger_scoring_model=model, is_ready_for_prod=True)])))
        return advice

    def _assert_score_raises(
            self,
            model: Union[str, scoring.ModelBase],
            exception_type: Type[_Exception],
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> _Exception:
        if not persona:
            persona = _PERSONAS[name] if name is not None else self._random_persona()
        with self.assertRaises(exception_type, msg=f'Fail for "{persona.name}"') as raise_context:
            self._score(model, persona, name)
        return raise_context.exception

    def _random_persona(self) -> _Persona:
        return _PERSONAS[random.choice(list(_PERSONAS))]

    def _clone_persona(self, name: str) -> _Persona:
        return _PERSONAS[name].clone()


class ScoringModelTestBase(PersonaTestBase):
    """Creates a base class for unit tests of a scoring model."""

    model_id: Optional[str] = None
    model: scoring.ModelBase

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        if cls.model_id is None:  # pragma: no-cover
            raise NotImplementedError(f'Add a model_id in "{cls.__name__}"')
        cls._patcher = mock.patch.dict(scoring.SCORING_MODELS, {})  # type: ignore
        cls._patcher.start()  # type: ignore
        model = scoring.get_scoring_model(cls.model_id)
        if model is None:  # pragma: no-cover
            raise NotImplementedError(
                f'The model_id {cls.model_id} is not the ID of any known model')
        cls.model = model

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        cls._patcher.stop()  # type: ignore

    def _score_persona(
            self,
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> float:
        return self._score(self.model, persona, name)

    def _assert_score_persona_raises(
            self,
            exception_type: Type[_Exception],
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> _Exception:
        return self._assert_score_raises(self.model, exception_type, persona, name)

    def _assert_missing_fields_to_score_persona(  # pylint: disable=invalid-name
            self,
            missing_fields: Set[str],
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> None:
        if not persona:
            persona = _PERSONAS[name] if name is not None else self._random_persona()
        error = self._assert_score_persona_raises(
            scoring.NotEnoughDataException, persona=persona, name=name)
        if missing_fields is not None:
            self.assertLessEqual(missing_fields, error.fields, msg=f'Fail for "{persona.name}"')

    def _enforce_search_length_duration(
            self,
            project: project_pb2.Project,
            exact_months: Optional[int] = None, min_months: Optional[int] = None,
            max_months: Optional[int] = None) -> None:
        """Update a project to make sure the search length duration matches some criteria."""

        try:
            default_months = next(
                m for m in (exact_months, min_months, max_months)
                if m is not None)
        except StopIteration as error:
            raise TypeError('One of exact_months, min_months or max_months must be set') from error

        if not project.job_search_has_not_started and project.HasField('job_search_started_at'):
            current_duration = (
                project.created_at.ToDatetime() - project.job_search_started_at.ToDatetime()
            ).days / 30.5
            if (min_months is None or current_duration >= min_months) and \
                    (max_months is None or current_duration <= max_months) and \
                    (exact_months is None or current_duration == exact_months):
                return

        project.job_search_started_at.FromDatetime(
            project.created_at.ToDatetime() - datetime.timedelta(days=30.5 * default_months))


class AdviceScoringModelTestBase(ScoringModelTestBase):
    """Creates a base class for unit tests of scoring models used as advice modules."""

    def _compute_expanded_card_data(
            self,
            persona: Optional[_Persona] = None,
            name: Optional[str] = None) -> message.Message:
        return self.model.get_expanded_card_data(self._scoring_project(persona, name))


class HundredScoringModelTestBase(ScoringModelTestBase):
    """Creates a base class for unit tests of scoring models using the ModelHundredBase."""

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()

    def assert_not_enough_data(self) -> None:
        """Asserts that the scorer chokes with a NotEnoughDataException
        while scoring self.persona."""

        self._assert_score_persona_raises(scoring.NotEnoughDataException, self.persona)

    def assert_good_score(self, score: float, limit: float = 70, msg: Optional[str] = None) \
            -> None:
        """Asserts that the score is considered good (more than limit in percent)."""

        self.assertGreaterEqual(score, limit * 3 / 100, msg)

    def assert_great_score(self, score: float, msg: Optional[str] = None) -> None:
        """Asserts that the score is the best possible."""

        self.assertEqual(score, 3, msg)

    def assert_bad_score(self, score: float, limit: float = 30, msg: Optional[str] = None) \
            -> None:
        """Asserts that the score is considered bad (less than limit in percent).
        Also checks that it is not below 0%."""

        self.assertGreaterEqual(score, 0, msg='A bad score should not be under 0.')
        self.assertLessEqual(score, limit * 3 / 100, msg)

    def assert_worse_score(self, score: float, msg: Optional[str] = None) -> None:
        """Assert that the score is the worse possible (0%)."""

        self.assertEqual(score, 0, msg)


class DefaultScoringModelTestCase(ScoringModelTestBase):
    """Unit test for the default scoring model."""

    model_id = ''

    def test_score(self) -> None:
        """Test the score function."""

        score = self._score_persona(self._random_persona())

        self.assertLessEqual(score, 3)
        self.assertLessEqual(0, score)


@mock.patch(carif.__name__ + '.get_trainings')
class TrainingAdviceScoringModelTestCase(AdviceScoringModelTestBase):
    """Unit test for the training scoring model."""

    model_id = 'advice-training'

    def setUp(self) -> None:
        """Setting up the persona for a test."""

        super().setUp()
        self.persona = self._random_persona().clone()
        self._many_trainings = [
            training_pb2.Training(),
            training_pb2.Training(),
            training_pb2.Training(),
        ]

    def test_forced_for_missing_diploma(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """The user's main diagnostic point is that they're missing a diploma."""

        mock_carif_get_trainings.return_value = []
        self.persona.project.diagnostic.category_id = 'missing-diploma'
        self.assertEqual(3, self._score_persona(self.persona))
        self.assertFalse(
            mock_carif_get_trainings.called, msg=mock_carif_get_trainings.call_args_list)

    def test_low_advice_for_new_de(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """The user just started searching for a job."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.city.departement_id = '35'
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.job_search_started_at.CopyFrom(self.persona.project.created_at)
        if self.persona.project.kind == project_pb2.REORIENTATION:
            self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        self.assertGreater(2, self._score_persona(self.persona))
        mock_carif_get_trainings.assert_called_once_with('A1234', '35')

    def test_three_stars(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """The user has been searching for a job for 3 months."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() -
            datetime.timedelta(days=94))
        project = self.persona.scoring_project(self.database, now=self.now)
        score, explanations = self.model.score_and_explain(project)
        self.assertEqual(3, score)
        self.assertEqual(['vous cherchez depuis 3 mois'], explanations)

    def test_one_month(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """The user has been searching for a job for 1 month."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() -
            datetime.timedelta(days=30.5))
        if self.persona.project.kind == project_pb2.REORIENTATION:
            self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        score = self._score_persona(self.persona)
        self.assertGreater(3, score)
        self.assertLess(0, score)

    def test_reorientation(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """The user is in reorientation."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.kind = project_pb2.REORIENTATION
        self.assertEqual(3, self._score_persona(self.persona))

    def test_no_trainings(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """There are no trainings for this combination."""

        mock_carif_get_trainings.return_value = []
        self.assertEqual(0, self._score_persona(self.persona))

    def test_expanded_card_data(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """Test we get interesting asynchronous data for this advice."""

        mock_carif_get_trainings.return_value = self._many_trainings
        self.persona.project.kind = project_pb2.REORIENTATION
        extra_data = typing.cast(
            training_pb2.Trainings, self._compute_expanded_card_data(self.persona))
        self.assertEqual(3, len(extra_data.trainings))

    def test_uk_expanded_card_data(
            self, unused_mock_carif_get_trainings: mock.MagicMock) -> None:
        """Test the uk training values"""

        patcher = mock.patch(scoring_base.__name__ + '._BOB_DEPLOYMENT', new='uk')
        patcher.start()

        self.database.trainings.insert_one({
            'name': 'UK Training',
            'url': 'http://aspirationtraining.com',
        })
        extra_data = typing.cast(
            training_pb2.Trainings, self._compute_expanded_card_data(self.persona))
        self.assertEqual(1, len(extra_data.trainings))
        training = extra_data.trainings[0]
        self.assertEqual('UK Training', training.name)
        self.assertEqual('http://aspirationtraining.com', training.url)


class ConstantScoreModelTestCase(ScoringModelTestBase):
    """Unit test for the constant scoring model."""

    model_id = 'constant(2)'

    def test_random(self) -> None:
        """Check score on a random persona."""

        persona = self._random_persona()
        self.assertEqual(
            2, self._score_persona(persona), msg=f'Failed for "{persona.name}"')


def persona_lbb_call_mock(project: project_pb2.Project, **unused_kwargs: Any) \
        -> Iterator[Dict[str, str]]:
    """Mocking lbb call to return a specific iterator for a specific job group."""

    if project.target_job.job_group.rome_id == 'M1604':
        return iter([{'headcount_text': '0 salarié'}])
    return iter([{'headcount_text': '500 à 299 salariés'}])


class PersonasTestCase(unittest.TestCase):
    """Tests all scoring models and all personas."""

    @mock.patch(
        companies.__name__ + '.get_lbb_companies', new=persona_lbb_call_mock)
    @mock.patch(carif.__name__ + '.get_trainings')
    def test_run_all(self, mock_carif_get_trainings: mock.MagicMock) -> None:
        """Run all scoring models on all personas."""

        mock_carif_get_trainings.return_value = [
            training_pb2.Training(),
            training_pb2.Training(),
            training_pb2.Training(),
        ]
        database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        _load_json_to_mongo(database, 'associations')
        _load_json_to_mongo(database, 'cities')
        _load_json_to_mongo(database, 'departements')
        _load_json_to_mongo(database, 'hiring_cities')
        _load_json_to_mongo(database, 'job_group_info')
        _load_json_to_mongo(database, 'local_diagnosis')
        _load_json_to_mongo(database, 'online_salons')
        _load_json_to_mongo(database, 'reorient_jobbing')
        _load_json_to_mongo(database, 'reorient_to_close')
        _load_json_to_mongo(database, 'seasonal_jobbing')
        _load_json_to_mongo(database, 'skills_for_future')
        _load_json_to_mongo(database, 'specific_to_job_advice')
        _load_json_to_mongo(database, 'volunteering_missions')

        scores: Dict[str, Dict[str, float]] = \
            collections.defaultdict(lambda: collections.defaultdict(float))
        # Mock the "now" date so that scoring models that are based on time
        # (like "Right timing") are deterministic.
        now = datetime.datetime(2016, 9, 27)
        for model_name in list(scoring.SCORING_MODELS.keys()):
            model = scoring.get_scoring_model(model_name)
            if not model:  # pragma: no-cover
                raise KeyError(f'No scoring model with name "{model_name}".')
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
                    msg=f'while using the model "{model_name}" to score "{name}"')
                self._assert_proper_explanations(
                    explanations, scoring_project,
                    msg=f'while using the model "{model_name}" to explain the score of "{name}"')

        for name in _PERSONAS:
            persona_scores = [
                max(model_scores[name], 0)
                for model_scores in scores.values()]
            self.assertLess(
                1, len(set(persona_scores)),
                msg=f'Persona "{name}" has the same score across all models.')

        model_scores_hashes: Dict[str, Set[str]] = collections.defaultdict(set)
        # A mapping of renamings in progress.
        renamings = {
            'for-exact-experienced(internship)': 'for-exact-experienced(intern)',
        }
        for base_name, target_name in renamings.items():
            self.assertEqual(
                json.dumps(scores.pop(base_name), sort_keys=True),
                json.dumps(scores[target_name], sort_keys=True),
                msg=f'The model "{base_name}" is not consistent with its renaming "{target_name}"')
        for model_name, model_scores in scores.items():
            model = scoring.SCORING_MODELS[model_name]
            if isinstance(model, scoring.ConstantScoreModel):
                continue
            self.assertLess(
                1, len(set(model_scores.values())),
                msg=f'Model "{model_name}" has the same score for all personas.')
            scores_hash = json.dumps(model_scores, sort_keys=True)
            model_scores_hashes[scores_hash].add(model_name)
        models_with_same_score = \
            [models for models in model_scores_hashes.values() if len(models) > 1]
        self.assertFalse(models_with_same_score, msg='Some models always have the same scores')

    def _assert_proper_explanations(
            self,
            explanations: Iterable[str],
            scoring_project: scoring.ScoringProject,
            msg: str) -> None:
        self.assertIsInstance(explanations, list, msg=msg)
        for explanation in explanations:
            self.assertIsInstance(explanation, str, msg=msg)
            try:
                resolved_explanation = scoring_project.populate_template(
                    explanation, raise_on_missing_var=True)
            except ValueError:
                self.fail(msg=msg)
            self.assertNotRegex(resolved_explanation, r'^[A-Z]', msg=msg)

    def test_scoring_model_names(self) -> None:
        """Keep consistency for scoring model names."""

        for model_name in list(scoring.SCORING_MODELS.keys()):
            self.assertNotRegex(
                model_name, r'^[^\(]*_[^\(]*(\(.*)?$',
                msg='Use hyphens in scoring model names instead of underscores, '
                f'"{model_name.replace("_", "-")}"')

    def test_conflicts_with_regexp(self) -> None:
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
                    f'The model "{model_name}" is implemented both by its name and by a regexp.')

            for other_regexp, unused_constructor in scoring.SCORING_MODEL_REGEXPS:
                if other_regexp == regexp:
                    continue
                example = rstr.xeger(regexp)
                self.assertFalse(
                    other_regexp.match(example),
                    msg=f'There is a conflict between two regexps: "{regexp}" and "{other_regexp}" '
                    f'over "{example}"')


class LifeBalanceTestCase(ScoringModelTestBase):
    """Unit tests for the "Work/Life balance" advice."""

    model_id = 'advice-life-balance'

    def test_not_handicaped(self) -> None:
        """The user does not have a disability problem."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = False
        score = self._score_persona(persona)
        self.assertNotEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_handicaped(self) -> None:
        """The user has a handicap."""

        persona = self._random_persona().clone()
        persona.user_profile.has_handicap = True
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')


class AdviceVaeTestCase(ScoringModelTestBase):
    """Unit tests for the "vae" advice."""

    model_id = 'advice-vae'

    def test_experiemented(self) -> None:
        """The user is experimented and think he has enough diplomas."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.EXPERT
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_EXPERIENCE
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_frustrated_by_trainings_and_is_senior(self) -> None:
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
        self.assertGreaterEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_not_matching(self) -> None:
        """The user does not have a diploma problem."""

        persona = self._random_persona().clone()
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_frustrated_no_experience(self) -> None:
        """The user is frustrated by trainings, has no experience and his diploma is unsure."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)
        persona.project.seniority = project_pb2.JUNIOR
        persona.project.training_fulfillment_estimate = project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_has_enough_diplomas(self) -> None:
        """The user is frustrated by trainings but is expert and has enough diplomas."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)
        persona.project.seniority = project_pb2.EXPERT
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')


class AdviceSeniorTestCase(ScoringModelTestBase):
    """Unit tests for the "Senior" advice."""

    model_id = 'advice-senior'

    def test_match_discriminated(self) -> None:
        """The user is over 40 years old and feels discriminated so this should match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth > datetime.date.today().year - 41:
            persona.user_profile.year_of_birth = datetime.date.today().year - 41
        persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_match_old(self) -> None:
        """The user is over 50 years old so the advice should match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth > datetime.date.today().year - 50:
            persona.user_profile.year_of_birth = datetime.date.today().year - 50
        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_no_match(self) -> None:
        """The user is young so the advice should not match."""

        persona = self._random_persona().clone()
        if persona.user_profile.year_of_birth < datetime.date.today().year - 35:
            persona.user_profile.year_of_birth = datetime.date.today().year - 35
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg=f'Failed for "{persona.name}"')


class AdviceLessApplicationsTestCase(ScoringModelTestBase):
    """Unit tests for the "Apply less" advice."""

    model_id = 'advice-less-applications'

    def test_match(self) -> None:
        """The user applies a lot so the advice should match."""

        persona = self._random_persona().clone()
        if persona.project.weekly_applications_estimate != project_pb2.A_LOT and \
                persona.project.weekly_applications_estimate != project_pb2.DECENT_AMOUNT:
            persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')

    def test_no_match(self) -> None:
        """The user does not apply a lot so the advice should not match."""

        persona = self._random_persona().clone()
        if persona.project.weekly_applications_estimate == project_pb2.DECENT_AMOUNT or \
                persona.project.weekly_applications_estimate == project_pb2.A_LOT:
            persona.project.weekly_applications_estimate = project_pb2.SOME
        score = self._score_persona(persona)
        self.assertLessEqual(score, 0, msg=f'Failed for "{persona.name}"')


class AdviceJobBoardsTestCase(ScoringModelTestBase):
    """Unit tests for the "Other Work Environments" advice."""

    model_id = 'advice-job-boards'

    def test_frustrated(self) -> None:
        """Frustrated by not enough offers."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFERS)

        score = self._score_persona(persona)

        self.assertGreaterEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_lot_of_offers(self) -> None:
        """User has many offers already."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]
        persona.project.weekly_offers_estimate = project_pb2.A_LOT

        score = self._score_persona(persona)

        # We do want to show the advice but not pre-select it.
        self.assertEqual(1, score, msg=f'Failed for "{persona.name}"')


class AdviceOtherWorkEnvTestCase(ScoringModelTestBase):
    """Unit tests for the "Other Work Environments" advice."""

    model_id = 'advice-other-work-env'

    def test_no_job_group_info(self) -> None:
        """Does not trigger if we are missing environment data."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'
        self.database.job_group_info.insert_one({'_id': 'M1607'})

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_with_other_structures(self) -> None:
        """Triggers if multiple structures."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'workEnvironmentKeywords': {'structures': ['Kmenistan', 'Key']},
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_with_only_one_structure_and_one_sector(self) -> None:
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
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')


class AdviceSpecificToJobTestCase(ScoringModelTestBase):
    """Unit tests for the "Specicif to Job" advice."""

    model_id = 'advice-specific-to-job'

    def setUp(self) -> None:
        super().setUp()
        self.database.specific_to_job_advice.insert_one({
            'title': 'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            'shortTitle': 'Astuces de boulanger',
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

    def test_not_baker(self) -> None:
        """Does not trigger for non baker."""

        persona = self._random_persona().clone()
        if persona.project.target_job.job_group.rome_id == 'D1102':
            persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_chief_baker(self) -> None:
        """Does not trigger for a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        persona.project.target_job.code_ogr = '12006'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_baker_not_chief(self) -> None:
        """Trigger for a baker that is not a chief baker."""

        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'D1102'
        if persona.project.target_job.code_ogr == '12006':
            persona.project.target_job.code_ogr = '10868'

        score = self._score_persona(persona)
        self.assertEqual(score, 3, msg=f'Failed for "{persona.name}"')


class AdviceBodyLanguageTestCase(ScoringModelTestBase):
    """Unit tests for the "Body Language" advice."""

    model_id = 'advice-body-language'

    def test_frustrated_by_interviews(self) -> None:
        """User is frustrated by their performance in interviews."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.INTERVIEW)

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')

    def test_not_frustrated(self) -> None:
        """User is not frustrated."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg=f'Failed for "{persona.name}"')


class AdviceFollowUpEmailTestCase(ScoringModelTestBase):
    """Unit tests for the "Follow Up" advice."""

    model_id = 'advice-follow-up'

    def test_should_apply_in_person(self) -> None:
        """User is looking for a job that does not use email for applications."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'preferredApplicationMedium': 'APPLY_IN_PERSON',
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assertEqual(score, 0, msg=f'Failed for "{persona.name}"')

    def test_not_frustrated(self) -> None:
        """User is not frustrated."""

        persona = self._random_persona().clone()
        del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)
        self.assertEqual(score, 1, msg=f'Failed for "{persona.name}"')

    def test_frustrated_by_no_answer(self) -> None:
        """User is frustrated by the lack of answers."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.NO_OFFER_ANSWERS)

        score = self._score_persona(persona)
        self.assertEqual(score, 2, msg=f'Failed for "{persona.name}"')


@mock.patch.dict(scoring.SCORING_MODELS, {
    'test-zero': scoring.ConstantScoreModel('0'),
    'test-two': scoring.ConstantScoreModel('2'),
})
class FilterUsingScoreTestCase(unittest.TestCase):
    """Unit tests for the filter_using_score function."""

    dummy_project = scoring.ScoringProject(
        project_pb2.Project(),
        user_pb2.User(),
        mongo.NoPiiMongoDatabase(mongomock.MongoClient().test))

    def test_filter_list_with_no_filters(self) -> None:
        """Filter a list with no filters to apply."""

        filtered = scoring.filter_using_score(range(5), lambda a: [], self.dummy_project)
        self.assertEqual([0, 1, 2, 3, 4], list(filtered))

    def test_filter_list_constant_scorer(self) -> None:
        """Filter a list returning constant scorer."""

        get_scoring_func = mock.MagicMock()
        get_scoring_func.side_effect = [['test-zero'], ['test-two'], ['test-zero']]
        filtered = scoring.filter_using_score(range(3), get_scoring_func, self.dummy_project)
        self.assertEqual([1], list(filtered))

    def test_unknown_filter(self) -> None:
        """Filter an item with an unknown filter."""

        get_scoring_func = mock.MagicMock()
        get_scoring_func.return_value = ['unknown-filter']
        filtered = scoring.filter_using_score([42], get_scoring_func, self.dummy_project)
        self.assertEqual([42], list(filtered))

    def test_multiple_filters(self) -> None:
        """Filter an item with multiple filters."""

        get_scoring_func = mock.MagicMock()
        get_scoring_func.return_value = ['test-two', 'test-zero']
        filtered = scoring.filter_using_score([42], get_scoring_func, self.dummy_project)
        self.assertEqual([], list(filtered))


class TryWithoutDiplomaTestCase(HundredScoringModelTestBase):
    """Unit tests for the "Try without diploma" strategy."""

    model_id = 'strategy-try-without-diploma'

    def test_diploma_stricty_required(self) -> None:
        """User is looking for a job that strictly requires a diploma."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
            'isDiplomaStrictlyRequired': True,
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assert_worse_score(score, msg=f'Failed for "{persona.name}"')

    def test_frustrated_by_no_answer(self) -> None:
        """User is looking for a job that does not strictly require a diploma."""

        self.database.job_group_info.insert_one({
            '_id': 'M1607',
        })
        persona = self._random_persona().clone()
        persona.project.target_job.job_group.rome_id = 'M1607'

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=10, msg=f'Failed for "{persona.name}"')


class GetAlternanceTestCase(HundredScoringModelTestBase):
    """Unit tests for the "Get an alternance contract" strategy."""

    model_id = 'strategy-get-alternance'

    def test_young(self) -> None:
        """User is young."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 29

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=30, msg=f'Failed for "{persona.name}"')

    def test_old(self) -> None:
        """User is not so young."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = datetime.datetime.now().year - 31

        score = self._score_persona(persona)
        self.assert_bad_score(score, limit=30, msg=f'Failed for "{persona.name}"')


class StrategyLikeableJobTestCase(HundredScoringModelTestBase):
    """Unit tests for the "Find a likeable job" strategy."""

    model_id = 'strategy-likeable-job'

    def test_passionate(self) -> None:
        """User is passionate."""

        persona = self._random_persona().clone()
        persona.project.passionate_level = project_pb2.PASSIONATING_JOB

        score = self._score_persona(persona)
        self.assert_worse_score(score, msg=f'Failed for "{persona.name}"')

    def test_not_passionate(self) -> None:
        """User is not very passionate and should try to find a likeable job."""

        persona = self._random_persona().clone()
        persona.project.passionate_level = project_pb2.LIKEABLE_JOB

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=30, msg=f'Failed for "{persona.name}"')

    def test_find_what_you_like_category(self) -> None:
        """User is not very passionate and is in the FWYL category."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'find-what-you-like'
        persona.project.passionate_level = project_pb2.LIKEABLE_JOB

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=30, msg=f'Failed for "{persona.name}"')

    def test_undefined_project_category(self) -> None:
        """User is in the undefined-project category."""

        persona = self._random_persona().clone()
        persona.project.diagnostic.category_id = 'undefined-project'
        persona.project.ClearField('passionate_level')

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=30, msg=f'Failed for "{persona.name}"')


class StrategyForFrustratedTestCase(HundredScoringModelTestBase):
    """Unit tests for the "For frustrated" strategy."""

    model_id = 'strategy-for-frustrated(TRAINING, MOTIVATION)'

    def test_frustrated(self) -> None:
        """User is frustrated by something that matters."""

        persona = self._random_persona().clone()
        persona.user_profile.frustrations.append(user_pb2.TRAINING)

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=15, msg=f'Failed for "{persona.name}"')

    def test_not_frustrated(self) -> None:
        """User is not frustrated byn something that matters."""

        persona = self._random_persona().clone()
        if user_pb2.TRAINING in persona.user_profile.frustrations or\
                user_pb2.MOTIVATION in persona.user_profile.frustrations:
            del persona.user_profile.frustrations[:]

        score = self._score_persona(persona)
        self.assert_bad_score(score, limit=15, msg=f'Failed for "{persona.name}"')


class StrategyInterviewSuccessTestCase(HundredScoringModelTestBase):
    """Unit tests for the "Succeed in interviews" strategy."""

    model_id = 'strategy-interview-success'

    def test_not_searched_for_long(self) -> None:
        """User hasn't been searching for a long time."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=30))

        score = self._score_persona(persona)
        self.assert_bad_score(score, limit=20, msg=f'Failed for "{persona.name}"')

    def test_not_many_interviews(self) -> None:
        """User hasn't had many interviews yet."""

        persona = self._random_persona().clone()
        persona.project.total_interview_count = 2

        score = self._score_persona(persona)
        self.assert_bad_score(score, limit=20, msg=f'Failed for "{persona.name}"')

    def test_interviews_and_long_search(self) -> None:
        """User is not very passionate and is in the FWYL category."""

        persona = self._random_persona().clone()
        persona.project.job_search_started_at.FromDatetime(
            datetime.datetime.now() - datetime.timedelta(days=365))
        persona.project.total_interview_count = 5

        score = self._score_persona(persona)
        self.assert_good_score(score, limit=20, msg=f'Failed for "{persona.name}"')


class TryAlternanceTestCase(ScoringModelTestBase):
    """Unit tests for the "Try alternance" method."""

    model_id = 'advice-try-alternance'

    def test_expert(self) -> None:
        """User is an expert in their field."""

        persona = self._random_persona().clone()
        persona.project.seniority = project_pb2.EXPERT

        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=f'Failed for "{persona.name}"')

    def test_old(self) -> None:
        """User is quite old."""

        persona = self._random_persona().clone()
        persona.user_profile.year_of_birth = datetime.date.today().year - 60

        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=f'Failed for "{persona.name}"')

    def test_already_trained(self) -> None:
        """User is already trained for their job."""

        persona = self._random_persona().clone()
        persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS

        score = self._score_persona(persona)
        self.assertEqual(0, score, msg=f'Failed for "{persona.name}"')

    def test_unemployed_uncertain_about_training(self) -> None:
        """User is unemployed and is uncertain about the necessity of at training."""

        persona = self._random_persona().clone()
        persona.project.training_fulfillment_estimate = project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        persona.project.seniority = project_pb2.JUNIOR
        persona.user_profile.year_of_birth = datetime.date.today().year - 23

        score = self._score_persona(persona)
        self.assertLess(0, score, msg=f'Failed for "{persona.name}"')

    def test_missing_diploma_category(self) -> None:
        """Users are in the missing diploma category."""

        for age in range(18, 70, 5):
            persona = self._random_persona().clone()
            persona.project.diagnostic.category_id = 'missing-diploma'
            persona.user_profile.year_of_birth = datetime.date.today().year - age
            score = self._score_persona(persona)
            self.assertLess(0, score, msg=f'Failed for "{persona.name}" at age {age}:')


if __name__ == '__main__':
    unittest.main()
