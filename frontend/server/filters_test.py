"""Tests for filters in the bob_emploi.frontend.scoring module."""
import datetime
import unittest

import mock

from bob_emploi.frontend import scoring
from bob_emploi.frontend import scoring_test
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


def _FilterTestBase(model_id):  # pylint: disable=invalid-name
    class _TestCase(scoring_test.ScoringModelTestBase(model_id)):

        def setUp(self):
            super(_TestCase, self).setUp()
            self.persona = self._random_persona().clone()

        def _assert_pass_filter(self):
            score = self._score_persona(self.persona)
            self.assertGreater(score, 0, msg='Failed for "%s"' % self.persona.name)

        def _assert_fail_filter(self):
            score = self._score_persona(self.persona)
            self.assertLessEqual(score, 0, msg='Failed for "%s"' % self.persona.name)

    return _TestCase


class SingleParentFilterTestCase(_FilterTestBase('for-single-parent')):
    """Unit tests for the _UserProfileFilter class for single parents."""

    def test_single_parent(self):
        """Single parent."""
        self.persona.user_profile.family_situation = user_pb2.SINGLE_PARENT_SITUATION
        self._assert_pass_filter()

    def test_single_parent_old_field(self):
        """Single parent using the old field."""
        self.persona.user_profile.frustrations.append(user_pb2.SINGLE_PARENT)
        self._assert_pass_filter()

    def test_non_single_parent(self):
        """Non single parent."""
        del self.persona.user_profile.frustrations[:]
        self.persona.user_profile.family_situation = user_pb2.IN_A_RELATIONSHIP
        self._assert_fail_filter()


class YoungFilterTestCase(_FilterTestBase('for-young(25)')):
    """Unit tests for the _UserProfileFilter class for young people."""

    year = datetime.date.today().year

    def test_young_person(self):
        """Young person."""
        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_pass_filter()

    def test_old_person(self):
        """Old person."""
        self.persona.user_profile.year_of_birth = self.year - 28
        self._assert_fail_filter()


class OldFilterTestCase(_FilterTestBase('for-old(50)')):
    """Unit tests for the _UserProfileFilter class for old people."""

    year = datetime.date.today().year

    def test_young_person(self):
        """Young person."""
        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_fail_filter()

    def test_mature_person(self):
        """Mature person."""
        self.persona.user_profile.year_of_birth = self.year - 45
        self._assert_fail_filter()

    def test_very_old_person(self):
        """Old person."""
        self.persona.user_profile.year_of_birth = self.year - 60
        self._assert_pass_filter()


class FrustratedOldFilterTestCase(_FilterTestBase('for-frustrated-old(50)')):
    """Unit tests for the _UserProfileFilter class for frustrated old people."""

    year = datetime.date.today().year

    def test_young_person(self):
        """Young person."""
        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_fail_filter()

    def test_old_person(self):
        """Old person."""
        self.persona.user_profile.year_of_birth = self.year - 60
        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_old_frustrated_person(self):
        """Old and frustrated person."""
        self.persona.user_profile.year_of_birth = self.year - 60
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_pass_filter()


class FrustratedYoungFilterTestCase(_FilterTestBase('for-frustrated-young(25)')):
    """Unit tests for the _UserProfileFilter class for frustrated young people."""

    year = datetime.date.today().year

    def test_young_person(self):
        """Young person."""
        self.persona.user_profile.year_of_birth = self.year - 21
        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_old_frustrated_person(self):
        """Old and frustrated person."""
        self.persona.user_profile.year_of_birth = self.year - 60
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_fail_filter()

    def test_young_frustrated_person(self):
        """Young and frustrated person."""
        self.persona.user_profile.year_of_birth = self.year - 21
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_pass_filter()


class UnemployedFilterTestCase(_FilterTestBase('for-unemployed')):
    """Unit tests for the _UserProfileFilter class for unemployed."""

    def test_lost_quit(self):
        """User lost or quit their last job."""
        self.persona.user_profile.situation = user_pb2.LOST_QUIT
        self._assert_pass_filter()

    def test_student(self):
        """Student."""
        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self._assert_pass_filter()

    def test_employed(self):
        """User has a job."""
        self.persona.user_profile.situation = user_pb2.EMPLOYED
        self._assert_fail_filter()


class NotEmployedAnymoreFilterTestCase(_FilterTestBase('for-not-employed-anymore')):
    """Unit tests for the _UserProfileFilter class for users that lost or quit their last job."""

    def test_lost_quit(self):
        """User lost or quit their last job."""
        self.persona.user_profile.situation = user_pb2.LOST_QUIT
        self._assert_pass_filter()

    def test_student(self):
        """Student."""
        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self._assert_fail_filter()

    def test_employed(self):
        """User has a job."""
        self.persona.user_profile.situation = user_pb2.EMPLOYED
        self._assert_fail_filter()


class QualifiedFilterTestCase(_FilterTestBase('for-qualified(bac+3)')):
    """Unit tests for the _UserProfileFilter class for users that are qualified."""

    def test_phd(self):
        """User has a PhD."""
        self.persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        self._assert_pass_filter()

    def test_no_degree(self):
        """User has no degree."""
        self.persona.user_profile.highest_degree = job_pb2.NO_DEGREE
        self._assert_fail_filter()

    def test_dut(self):
        """User has a DUT."""
        self.persona.user_profile.highest_degree = job_pb2.BTS_DUT_DEUG
        self._assert_fail_filter()


class DiscoveryFilterTestCase(_FilterTestBase('for-discovery')):
    """Unit tests for the _ProjectFilter class for projects about discovering a job."""

    def test_discovering(self):
        """Project is about discovering."""
        self.persona.project.intensity = project_pb2.PROJECT_FIGURING_INTENSITY
        self._assert_pass_filter()

    def test_normally_intense(self):
        """Project is about finding a job."""
        self.persona.project.intensity = project_pb2.PROJECT_NORMALLY_INTENSE
        self._assert_fail_filter()


class NegateFilterTestCase(_FilterTestBase('not-for-discovery')):
    """Unit tests for the negate filter about discovering a job."""

    def test_discovering(self):
        """Project is about discovering."""
        self.persona.project.intensity = project_pb2.PROJECT_FIGURING_INTENSITY
        self._assert_fail_filter()

    def test_normally_intense(self):
        """Project is about finding a job."""
        self.persona.project.intensity = project_pb2.PROJECT_NORMALLY_INTENSE
        self._assert_pass_filter()


class SearchingForeverFilterTestCase(_FilterTestBase('for-searching-forever')):
    """Unit tests for the _ProjectFilter class for projects about searching for a looong time."""

    def test_just_started(self):
        """User has just started this project."""
        self.persona.project.job_search_length_months = 1
        self._assert_fail_filter()

    def test_started_2_years_ago(self):
        """User has been working on this project for 2 years."""
        self.persona.project.job_search_length_months = 24
        self._assert_pass_filter()


class JobGroupFilterTestCase(_FilterTestBase('for-job-group(M16)')):
    """Unit tests for the _JobGroupFilter class for projects about M16* job groups."""

    def test_secretary(self):
        """User is looking for a secretary job."""
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self._assert_pass_filter()

    def test_data_scientist(self):
        """User is looking for a data scientist job."""
        self.persona.project.target_job.job_group.rome_id = 'M1403'
        self._assert_fail_filter()


class MultiJobGroupFilterTestCase(_FilterTestBase('for-job-group(L15,L13)')):
    """Unit tests for the _JobGroupFilter class for projects about L15* or L13* job groups."""

    def test_secretary(self):
        """User is looking for a secretary job."""
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self._assert_fail_filter()

    def test_first_job_group(self):
        """User is looking for a job in the first group of the list."""
        self.persona.project.target_job.job_group.rome_id = 'L1502'
        self._assert_pass_filter()

    def test_second_job_group(self):
        """User is looking for a job in the second group of the list."""
        self.persona.project.target_job.job_group.rome_id = 'L1302'
        self._assert_pass_filter()


class DepartementFilterTestCase(_FilterTestBase('for-departement(31)')):
    """Unit tests for the _DepartementFilter class for projects about département 31."""

    def test_toulouse(self):
        """User is looking for a job in Toulouse."""
        self.persona.project.mobility.city.departement_id = '31'
        self._assert_pass_filter()

    def test_lyon(self):
        """User is looking for a job in Lyon."""
        self.persona.project.mobility.city.departement_id = '69'
        self._assert_fail_filter()


class MultiDepartementFilterTestCase(_FilterTestBase('for-departement(31, 69)')):
    """Unit tests for the _DepartementFilter class for projects about multiple départements."""

    def test_toulouse(self):
        """User is looking for a job in Toulouse."""
        self.persona.project.mobility.city.departement_id = '31'
        self._assert_pass_filter()

    def test_lyon(self):
        """User is looking for a job in Lyon."""
        self.persona.project.mobility.city.departement_id = '69'
        self._assert_pass_filter()

    def test_paris(self):
        """User is looking for a job in Paris."""
        self.persona.project.mobility.city.departement_id = '75'
        self._assert_fail_filter()


class FilterApplicationComplexityTestCase(_FilterTestBase('for-complex-application')):
    """Unit tests for the _ApplicationComplexityFilter class."""

    def test_special_complexity(self):
        """User is in a job with a special complexity."""
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.job_group_info.insert_one({
            '_id': 'M1601', 'applicationComplexity': 'SPECIAL_APPLICATION_PROCESS'})
        self._assert_fail_filter()

    def test_complex_application(self):
        """User is in a job with a complex application process."""
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.job_group_info.insert_one({
            '_id': 'M1601', 'applicationComplexity': 'COMPLEX_APPLICATION_PROCESS'})
        self._assert_pass_filter()


class FilterActiveExperimentTestCase(_FilterTestBase('for-active-experiment(lbb_integration)')):
    """Unit tests for the _ActiveExperimentFilter class."""

    def test_in_control(self):
        """User is in the control group."""
        self.persona.features_enabled.lbb_integration = user_pb2.CONTROL
        self._assert_fail_filter()

    def test_not_in_experiment(self):
        """User is not in the experiment at all."""
        self.persona.features_enabled.ClearField('lbb_integration')
        self._assert_fail_filter()

    def test_in_experiment(self):
        """User is in the experiment."""
        self.persona.features_enabled.lbb_integration = user_pb2.ACTIVE
        self._assert_pass_filter()


class FilterActiveUnknownExperimentTestCase(_FilterTestBase('for-active-experiment(unknown)')):
    """Unit tests for the _ActiveExperimentFilter class when experiment does not exist."""

    def test_any_persona(self):
        """Experiment does not exist."""
        self._assert_fail_filter()

    @classmethod
    def tearDownClass(cls):
        super(FilterActiveUnknownExperimentTestCase, cls).tearDownClass()
        del scoring.SCORING_MODELS[cls.model_id]


class FilterUsingScoreTestCase(unittest.TestCase):
    """Unit tests for the filter_using_score function."""

    @classmethod
    def setUpClass(cls):
        """Test setup."""
        super(FilterUsingScoreTestCase, cls).setUpClass()
        scoring.SCORING_MODELS['test-zero'] = scoring.ConstantScoreModel(0)
        scoring.SCORING_MODELS['test-two'] = scoring.ConstantScoreModel(2)

    def test_filter_list_with_no_filters(self):
        """Filter a list with no filters to apply."""
        filtered = scoring.filter_using_score(range(5), lambda a: [], None)
        self.assertEqual([0, 1, 2, 3, 4], list(filtered))

    def test_filter_list_constant_scorer(self):
        """Filter a list returning constant scorer."""
        get_scoring_func = mock.MagicMock()
        get_scoring_func.side_effect = [['test-zero'], ['test-two'], ['test-zero']]
        filtered = scoring.filter_using_score(range(3), get_scoring_func, None)
        self.assertEqual([1], list(filtered))

    def test_unknown_filter(self):
        """Filter an item with an unknown filter."""
        get_scoring_func = mock.MagicMock()
        get_scoring_func.return_value = ['unknown-filter']
        filtered = scoring.filter_using_score([42], get_scoring_func, None)
        self.assertEqual([42], list(filtered))

    def test_multiple_filters(self):
        """Filter an item with multiple filters."""
        get_scoring_func = mock.MagicMock()
        get_scoring_func.return_value = ['test-two', 'test-zero']
        filtered = scoring.filter_using_score([42], get_scoring_func, None)
        self.assertEqual([], list(filtered))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
