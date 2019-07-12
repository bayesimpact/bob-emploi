"""Tests for filters in the bob_emploi.frontend.scoring module."""

import datetime
import unittest
from unittest import mock

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import companies
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.test import scoring_test


# This is a collection of many small tests, but it's not worth splitting in
# several small modules so we just accept the fact that it's long.
# pylint: disable=too-many-lines


class FilterTestBase(scoring_test.ScoringModelTestBase):
    """A base class for tests for filters."""

    def setUp(self) -> None:
        super().setUp()
        self.persona = self._random_persona().clone()

    def _assert_pass_filter(self) -> None:
        score = self._score_persona(self.persona)
        self.assertGreater(score, 0, msg=f'Failed for "{self.persona.name}"')

    def _assert_fail_filter(self) -> None:
        score = self._score_persona(self.persona)
        self.assertLessEqual(score, 0, msg=f'Failed for "{self.persona.name}"')


class ActiveSearcherFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have started their search."""

    model_id = 'for-active-search'

    def test_active_searcher(self) -> None:
        """Users that have already started their search."""

        if not self.persona.project.HasField('created_at'):
            self.persona.project.created_at.GetCurrentTime()
        self.persona.project.job_search_has_not_started = False
        self._assert_pass_filter()

    def test_not_searcher(self) -> None:
        """Users that have not created their project."""

        self.persona.project.ClearField('created_at')
        self.persona.project.job_search_has_not_started = False
        self._assert_fail_filter()

    def test_inactive_searcher(self) -> None:
        """Users that have not yet started their search."""

        self.persona.project.job_search_has_not_started = True
        self._assert_fail_filter()


class EnoughTrainingFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with sufficient training."""

    model_id = 'for-training-fulfilled'

    def test_enough_training(self) -> None:
        """Users that have sufficient training."""

        self.persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        self._assert_pass_filter()

    def test_not_enough_training(self) -> None:
        """Users that have not sufficient training."""

        self.persona.project.training_fulfillment_estimate = project_pb2.CURRENTLY_IN_TRAINING
        self._assert_fail_filter()


class SingleParentFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for single parents."""

    model_id = 'for-single-parent'

    def test_single_parent(self) -> None:
        """Single parent."""

        self.persona.user_profile.family_situation = user_pb2.SINGLE_PARENT_SITUATION
        self._assert_pass_filter()

    def test_single_parent_old_field(self) -> None:
        """Single parent using the old field."""

        self.persona.user_profile.frustrations.append(user_pb2.SINGLE_PARENT)
        self._assert_pass_filter()

    def test_non_single_parent(self) -> None:
        """Non single parent."""

        del self.persona.user_profile.frustrations[:]
        self.persona.user_profile.family_situation = user_pb2.IN_A_RELATIONSHIP
        self._assert_fail_filter()


class YoungFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for young people."""

    model_id = 'for-young(25)'

    year = datetime.date.today().year

    def test_young_person(self) -> None:
        """Young person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_pass_filter()

    def test_old_person(self) -> None:
        """Old person."""

        self.persona.user_profile.year_of_birth = self.year - 28
        self._assert_fail_filter()


class ApplicantFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have applied for some jobs."""

    model_id = 'for-application(2)'

    def test_had_applied(self) -> None:
        """User have applied three times per week."""

        self.persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        self._assert_pass_filter()

    def test_had_not_applied(self) -> None:
        """User have never applied."""

        self.persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self._assert_fail_filter()

    def test_had_unknown_application(self) -> None:
        """We do not know whether the user has applied."""

        self.persona.project.weekly_applications_estimate = \
            project_pb2.UNKNOWN_NUMBER_ESTIMATE_OPTION
        self._assert_fail_filter()


class InterviewFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have had some interviews."""

    model_id = 'for-many-interviews(2)'

    def test_had_interviews(self) -> None:
        """User have had three interviews."""

        self.persona.project.total_interview_count = 3
        self._assert_pass_filter()

    def test_had_no_interview(self) -> None:
        """User have had no interviews."""

        self.persona.project.total_interview_count = -1
        self._assert_fail_filter()


class ExactInterviewFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have had exactly one interview."""

    model_id = 'for-exact-interview(1)'

    def test_had_interviews(self) -> None:
        """User have had three interviews."""

        self.persona.project.total_interview_count = 3
        self._assert_fail_filter()

    def test_had_one_interview(self) -> None:
        """User have had one interview."""

        self.persona.project.total_interview_count = 1
        self._assert_pass_filter()

    def test_had_no_interview(self) -> None:
        """User have had no interviews."""

        self.persona.project.total_interview_count = -1
        self._assert_fail_filter()


class InterviewSmallRateFilterTestCase(FilterTestBase):
    """Tests for the _ProjectFilter class for users that have had 1 interview in 2 months."""

    model_id = 'for-many-interviews-per-month(0.5)'

    def test_had_interviews(self) -> None:
        """User have had three interviews in two months."""

        self.persona.project.job_search_length_months = 2
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        self.persona.project.total_interview_count = 3
        self._assert_pass_filter()

    def test_had_few_interviews(self) -> None:
        """User have had one interview in two months."""

        self.persona.project.job_search_length_months = 5
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=152.5))
        self.persona.project.total_interview_count = 2
        self._assert_fail_filter()

    def test_had_not_started(self) -> None:
        """User have not started their research."""

        if not self.persona.project.HasField('created_at'):
            self.persona.project.created_at.GetCurrentTime()
        self.persona.project.job_search_length_months = -1
        self.persona.project.job_search_has_not_started = True
        self._assert_fail_filter()


class InterviewRateFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have had >=1 interview per month."""

    model_id = 'for-many-interviews-per-month(1)'

    def test_had_interviews(self) -> None:
        """User have had three interviews in two months."""

        self.persona.project.job_search_length_months = 2
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        self.persona.project.total_interview_count = 3
        self._assert_pass_filter()

    def test_had_few_interviews(self) -> None:
        """User have had one interview in two months."""

        self.persona.project.job_search_length_months = 2
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=61))
        self.persona.project.total_interview_count = 1
        self._assert_fail_filter()

    def test_had_not_started(self) -> None:
        """User have not started their research."""

        if not self.persona.project.HasField('created_at'):
            self.persona.project.created_at.GetCurrentTime()
        self.persona.project.job_search_length_months = -1
        self.persona.project.job_search_has_not_started = True
        self._assert_fail_filter()


class NoInterviewFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users that have had some interviews."""

    model_id = 'for-no-interview'

    def test_had_interviews(self) -> None:
        """User have had three interviews."""

        self.persona.project.total_interview_count = 3
        self._assert_fail_filter()

    def test_had_unknown_interviews(self) -> None:
        """User have had three interviews."""

        self.persona.project.total_interview_count = 0
        self._assert_fail_filter()

    def test_had_no_interview(self) -> None:
        """User have had no interviews."""

        self.persona.project.total_interview_count = -1
        self._assert_pass_filter()


class OldFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for old people."""

    model_id = 'for-old(50)'

    year = datetime.date.today().year

    def test_young_person(self) -> None:
        """Young person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_fail_filter()

    def test_mature_person(self) -> None:
        """Mature person."""

        self.persona.user_profile.year_of_birth = self.year - 45
        self._assert_fail_filter()

    def test_very_old_person(self) -> None:
        """Old person."""

        self.persona.user_profile.year_of_birth = self.year - 60
        self._assert_pass_filter()


class FrustratedOldFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for 50 yo frustrated old people."""

    model_id = 'for-frustrated-old(50)'

    year = datetime.date.today().year

    def test_young_person(self) -> None:
        """Young person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_fail_filter()

    def test_old_person(self) -> None:
        """Old person."""

        self.persona.user_profile.year_of_birth = self.year - 60
        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_not_so_old_frustrated_person(self) -> None:
        """Old and frustrated person."""

        self.persona.user_profile.year_of_birth = self.year - 47
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_fail_filter()

    def test_old_frustrated_person(self) -> None:
        """Old and frustrated person."""

        self.persona.user_profile.year_of_birth = self.year - 60
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_pass_filter()


class OtherFrustratedOldFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for 45 yo frustrated old people."""

    model_id = 'for-frustrated-old(45)'

    year = datetime.date.today().year

    def test_young_person(self) -> None:
        """Young person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        self._assert_fail_filter()

    def test_old_person(self) -> None:
        """Old person."""

        self.persona.user_profile.year_of_birth = self.year - 60
        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_old_frustrated_person(self) -> None:
        """Old and frustrated person."""

        self.persona.user_profile.year_of_birth = self.year - 47
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_pass_filter()


class FrustratedYoungFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for frustrated young people."""

    model_id = 'for-frustrated-young(25)'

    year = datetime.date.today().year

    def test_young_person(self) -> None:
        """Young person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_old_frustrated_person(self) -> None:
        """Old and frustrated person."""

        self.persona.user_profile.year_of_birth = self.year - 60
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_fail_filter()

    def test_young_frustrated_person(self) -> None:
        """Young and frustrated person."""

        self.persona.user_profile.year_of_birth = self.year - 21
        self.persona.user_profile.frustrations.append(user_pb2.AGE_DISCRIMINATION)
        self._assert_pass_filter()


class UnemployedFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for unemployed."""

    model_id = 'for-unemployed'

    def test_lost_quit(self) -> None:
        """User lost or quit their last job."""

        self.persona.user_profile.situation = user_pb2.LOST_QUIT
        self._assert_pass_filter()

    def test_student(self) -> None:
        """Student."""

        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self._assert_pass_filter()

    def test_employed(self) -> None:
        """User has a job."""

        self.persona.user_profile.situation = user_pb2.EMPLOYED
        self._assert_fail_filter()


class EmployedFilterTestCase(FilterTestBase):
    """Unit tests for the BaseFilter class for employed."""

    model_id = 'for-employed'

    def test_first_job(self) -> None:
        """This is the first job for the user."""

        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self.persona.project.kind = project_pb2.FIND_A_FIRST_JOB
        self._assert_fail_filter()

    def test_looking_for_another_job(self) -> None:
        """User is looking for another job (so they already have one)."""

        self.persona.project.kind = project_pb2.FIND_ANOTHER_JOB
        self._assert_pass_filter()

    def test_employed(self) -> None:
        """User has a job."""

        self.persona.user_profile.situation = user_pb2.EMPLOYED
        self._assert_pass_filter()


class NotEmployedAnymoreFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for users that lost or quit their last job."""

    model_id = 'for-not-employed-anymore'

    def test_lost_quit(self) -> None:
        """User lost or quit their last job."""

        self.persona.user_profile.situation = user_pb2.LOST_QUIT
        self._assert_pass_filter()

    def test_student(self) -> None:
        """Student."""

        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self._assert_fail_filter()

    def test_employed(self) -> None:
        """User has a job."""

        self.persona.user_profile.situation = user_pb2.EMPLOYED
        self._assert_fail_filter()


class CompanyCreatorFilterTestCase(FilterTestBase):
    """Unit tests for the BaseFilter class for users who wants to create a company."""

    model_id = 'for-company-creator'

    def test_first_job(self) -> None:
        """This is the first job for the user."""

        self.persona.user_profile.situation = user_pb2.FIRST_TIME
        self.persona.project.kind = project_pb2.FIND_A_FIRST_JOB
        self._assert_fail_filter()

    def test_looking_for_another_job(self) -> None:
        """User wants to create or takeover a company."""

        self.persona.project.kind = project_pb2.CREATE_OR_TAKE_OVER_COMPANY
        self._assert_pass_filter()


class GoodQualificationFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for users that are qualified."""

    model_id = 'for-qualified(bac+3)'

    def test_phd(self) -> None:
        """User has a PhD."""

        self.persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        self._assert_pass_filter()

    def test_bachelor(self) -> None:
        """User has a bachelor degree."""

        self.persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        self._assert_pass_filter()

    def test_no_degree(self) -> None:
        """User has no degree."""

        self.persona.user_profile.highest_degree = job_pb2.NO_DEGREE
        self._assert_fail_filter()

    def test_dut(self) -> None:
        """User has a DUT."""

        self.persona.user_profile.highest_degree = job_pb2.BTS_DUT_DEUG
        self._assert_fail_filter()


class VeryGoodQualificationFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for users that are qualified."""

    model_id = 'for-qualified(bac+5)'

    def test_phd(self) -> None:
        """User has a PhD."""

        self.persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        self._assert_pass_filter()

    def test_bachelor(self) -> None:
        """User has a bachelor degree."""

        self.persona.user_profile.highest_degree = job_pb2.LICENCE_MAITRISE
        self._assert_fail_filter()

    def test_no_degree(self) -> None:
        """User has no degree."""

        self.persona.user_profile.highest_degree = job_pb2.NO_DEGREE
        self._assert_fail_filter()

    def test_dut(self) -> None:
        """User has a DUT."""

        self.persona.user_profile.highest_degree = job_pb2.BTS_DUT_DEUG
        self._assert_fail_filter()


class MediumQualificationFilterTestCase(FilterTestBase):
    """Unit tests for the _UserProfileFilter class for users that are qualified."""

    model_id = 'for-qualified(bac+2)'

    def test_phd(self) -> None:
        """User has a PhD."""

        self.persona.user_profile.highest_degree = job_pb2.DEA_DESS_MASTER_PHD
        self._assert_pass_filter()

    def test_no_degree(self) -> None:
        """User has no degree."""

        self.persona.user_profile.highest_degree = job_pb2.NO_DEGREE
        self._assert_fail_filter()

    def test_dut(self) -> None:
        """User has a DUT."""

        self.persona.user_profile.highest_degree = job_pb2.BTS_DUT_DEUG
        self._assert_pass_filter()


class NegateFilterTestCase(FilterTestBase):
    """Unit tests for the negate filter."""

    model_id = 'not-for-searching-forever'

    def test_just_started(self) -> None:
        """User has just started this project."""

        self.persona.project.job_search_length_months = 1
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=30.5))
        self._assert_pass_filter()

    def test_started_2_years_ago(self) -> None:
        """User has been working on this project for 2 years."""

        self.persona.project.job_search_length_months = 24
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=732))
        self._assert_fail_filter()


class NegateConstantFilterTestCase(FilterTestBase):
    """Unit tests for the negate filter when the negated model has values other than 0 or 3."""

    model_id = 'not-constant(0.5)'

    def test_anyone(self) -> None:
        """Negating a positive score."""

        self._assert_fail_filter()


class NotWorkingNegateFilterTestCase(unittest.TestCase):
    """Unit tests for a negate filter on a non-existing scorer."""

    @mock.patch(scoring.logging.__name__ + '.error')
    def test_cant_create(self, mock_error: mock.MagicMock) -> None:
        """Cannot create a negated filter if the original one does not exist."""

        scoring.get_scoring_model('not-unknown-scorer')
        mock_error.assert_called_once()


class SearchingForeverFilterTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for projects about searching for a looong time."""

    model_id = 'for-searching-forever'

    def test_just_started(self) -> None:
        """User has just started this project."""

        self.persona.project.job_search_length_months = 1
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=30.5))
        self._assert_fail_filter()

    def test_started_2_years_ago(self) -> None:
        """User has been working on this project for 2 years."""

        self.persona.project.job_search_length_months = 24
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=732))
        self._assert_pass_filter()


class JobGroupFilterTestCase(FilterTestBase):
    """Unit tests for the _JobGroupFilter class for projects about M16* job groups."""

    model_id = 'for-job-group(M16)'

    def test_secretary(self) -> None:
        """User is looking for a secretary job."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self._assert_pass_filter()

    def test_data_scientist(self) -> None:
        """User is looking for a data scientist job."""

        self.persona.project.target_job.job_group.rome_id = 'M1403'
        self._assert_fail_filter()


class HighSalaryFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects with expectations above median salary."""

    model_id = 'for-high-salary-expectations'

    def test_high_expectations(self) -> None:
        """User is looking for a secretary job."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '19'
        self.persona.project.min_salary = 22000
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'salary': {'medianSalary': 20000},
        })
        self._assert_pass_filter()

    def test_low_expectations(self) -> None:
        """User is looking for a secretary job."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.persona.project.min_salary = 18000
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'salary': {'medianSalary': 20000},
        })
        self._assert_fail_filter()


class HighMarketStressFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects with low market stress."""

    model_id = 'for-unstressed-market(10/7)'

    def test_low_market_stress(self) -> None:
        """User looking for a job that had 7 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 7,
            }
        })
        self._assert_pass_filter()

    def test_high_market_stress(self) -> None:
        """User looking for a job that had 5 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 5,
            }
        })
        self._assert_fail_filter()

    def test_zero_market_stress(self) -> None:
        """User looking for a job that had no offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': -1,
            }
        })
        self._assert_fail_filter()

    def test_missing_market_stress(self) -> None:
        """User looking for a job where we don't know the number of offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 0,
            }
        })
        self._assert_fail_filter()


class UnstressedMarketFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects with low market stress."""

    model_id = 'for-lower-market-tension(10/3)'

    def test_lower_market_stress(self) -> None:
        """User looking for a job that had 7 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 7,
            }
        })
        self._assert_pass_filter()

    def test_higher_market_stress(self) -> None:
        """User looking for a job that had 6 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            }
        })
        self._assert_fail_filter()

    def test_zero_market_stress(self) -> None:
        """User looking for a job that had no offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': -1,
            }
        })
        self._assert_fail_filter()

    def test_missing_market_stress(self) -> None:
        """User looking for a job where we don't know the number of offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 0,
                'yearlyAvgOffersPer10Candidates': 0,
            }
        })
        self._assert_fail_filter()


class StressedMarketFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects with high market stress."""

    model_id = 'for-stressed-market(10/3)'

    def test_lower_market_stress(self) -> None:
        """User looking for a job that had 7 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 7,
            }
        })
        self._assert_fail_filter()

    def test_higher_market_stress(self) -> None:
        """User looking for a job that had 2 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            }
        })
        self._assert_pass_filter()

    # This should never happen but we test it anyway to be sure it doesn't crash.
    def test_zero_market_stress(self) -> None:
        """User looking for a job that had no offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': -1,
            }
        })
        self._assert_pass_filter()

    def test_missing_market_stress(self) -> None:
        """We're missing info on the user's market."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.persona.project.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1602',
            'imt': {
                'yearlyAvgOffersDenominator': 0,
                'yearlyAvgOffersPer10Candidates': 0,
            }
        })
        self._assert_fail_filter()


class StressedJobFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects with high job stress."""

    model_id = 'for-stressed-job(10/3)'

    def test_lower_job_stress(self) -> None:
        """User looking for a job that had 7 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.job_group_info.insert_one({
            '_id': 'M1601',
            'nationalMarketScore': .7,
        })
        self._assert_fail_filter()

    def test_higher_job_stress(self) -> None:
        """User looking for a job that had 2 offers per 10 candidates."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.database.job_group_info.insert_one({
            '_id': 'M1602',
            'nationalMarketScore': .2,
        })
        self._assert_pass_filter()

    def test_missing_national_score(self) -> None:
        """We're missing info on the user's job's stress."""

        self.persona.project.target_job.job_group.rome_id = 'M1602'
        self.database.job_group_info.delete_one({'_id': 'M1602'})
        self._assert_fail_filter()


class MoreJobOffersFilterTestCase(FilterTestBase):
    """Unit tests for the _BaseFilter class for projects in market with more than 5 offers."""

    model_id = 'for-more-job-offers-locally(5)'

    def test_many_offers(self) -> None:
        """User looking in a market where there are plenty of job offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '69'
        self.database.local_diagnosis.insert_one({
            '_id': '69:M1601',
            'numJobOffersLastYear': 1000,
        })
        self._assert_pass_filter()

    def test_few_offers(self) -> None:
        """User looking in a market where there are very few job offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '69'
        self.database.local_diagnosis.insert_one({
            '_id': '69:M1601',
            'numJobOffersLastYear': 6,
        })
        self._assert_fail_filter()

    def test_just_enough_offers(self) -> None:
        """User looking in a market where there are just enough job offers."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '69'
        self.database.local_diagnosis.insert_one({
            '_id': '69:M1601',
            'numJobOffersLastYear': 16,
        })
        self._assert_pass_filter()

    def test_unknown_offers(self) -> None:
        """User looking in a market but we do not know how many job offers there were."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.city.departement_id = '69'
        self.database.local_diagnosis.insert_one({
            '_id': '69:M1601',
        })
        self._assert_fail_filter()


class ExperienceInDomainTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with previous experience in the domain."""

    model_id = 'for-experience-in-domain'

    def test_high_expectations(self) -> None:
        """User have experience in the domain in which they are searching."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_THIS
        self._assert_pass_filter()

    def test_low_expectations(self) -> None:
        """User does not have experience in the domain in which they are searching."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        self._assert_fail_filter()


class ExperienceInSimilarDomainTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with previous experience in similar domain.
    """

    model_id = 'for-experience-in-similar-domain'

    def test_high_expectations(self) -> None:
        """User have experience in a similar domain to the one in which they are searching."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        self._assert_pass_filter()

    def test_low_expectations(self) -> None:
        """User does not have experience in a similar domain to the one in which they are searching.
        """

        self.persona.project.previous_job_similarity = project_pb2.DONE_THIS
        self._assert_fail_filter()


class NoExperienceInDomainTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with previous experience in the domain."""

    model_id = 'for-first-time-in-job'

    def test_high_expectations(self) -> None:
        """User have experience in the domain in which they are searching or similar."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        self._assert_fail_filter()

    def test_low_expectations(self) -> None:
        """User does not have experience in the domain in which they are searching."""

        self.persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        self._assert_pass_filter()


class MultiJobGroupFilterTestCase(FilterTestBase):
    """Unit tests for the _JobGroupFilter class for projects about L15* or L13* job groups."""

    model_id = 'for-job-group(L15,L13)'

    def test_secretary(self) -> None:
        """User is looking for a secretary job."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self._assert_fail_filter()

    def test_first_job_group(self) -> None:
        """User is looking for a job in the first group of the list."""

        self.persona.project.target_job.job_group.rome_id = 'L1502'
        self._assert_pass_filter()

    def test_second_job_group(self) -> None:
        """User is looking for a job in the second group of the list."""

        self.persona.project.target_job.job_group.rome_id = 'L1302'
        self._assert_pass_filter()


class JobFilterTestCase(FilterTestBase):
    """Unit tests for the _JobFilter class for projects about 12006 job."""

    model_id = 'for-job(12006)'

    def test_chief_baker(self) -> None:
        """User is looking for a chief baker job."""

        self.persona.project.target_job.code_ogr = '12006'
        self._assert_pass_filter()

    def test_prefix(self) -> None:
        """User is looking for a job that starts with the chief baker code."""

        self.persona.project.target_job.code_ogr = '120060'
        self._assert_fail_filter()


class FrustrationFilterTestCase(FilterTestBase):
    """Unit tests for the FrustrationFilter class for projects about INTERVIEW frustration."""

    model_id = 'for-frustrated(INTERVIEW)'

    def test_frustrated_user(self) -> None:
        """User is frustrated by their interviews."""

        self.persona.user_profile.frustrations.append(user_pb2.INTERVIEW)
        self._assert_pass_filter()

    def test_not_frustrated(self) -> None:
        """User has no frustration."""

        self.persona.user_profile.ClearField('frustrations')
        self._assert_fail_filter()


class UnknownFrustrationFilterTestCase(unittest.TestCase):
    """Unit test for the FrustrationFilter class for projects about a
    frustration that does not exist."""

    @mock.patch(scoring.logging.__name__ + '.error')
    def test_inexistant_frustration(self, mock_error: mock.MagicMock) -> None:
        """Cannot make scoring model for inexistant frustration."""

        self.assertFalse(scoring.get_scoring_model('for-frustrated(INEXISTANT)'))
        mock_error.assert_called_once()


class DepartementFilterTestCase(FilterTestBase):
    """Unit tests for the _DepartementFilter class for projects about département 31."""

    model_id = 'for-departement(31)'

    def test_toulouse(self) -> None:
        """User is looking for a job in Toulouse."""

        self.persona.project.city.departement_id = '31'
        self._assert_pass_filter()

    def test_lyon(self) -> None:
        """User is looking for a job in Lyon."""

        self.persona.project.city.departement_id = '69'
        self._assert_fail_filter()


class MultiDepartementFilterTestCase(FilterTestBase):
    """Unit tests for the _DepartementFilter class for projects about multiple départements."""

    model_id = 'for-departement(31, 69)'

    def test_toulouse(self) -> None:
        """User is looking for a job in Toulouse."""

        self.persona.project.city.departement_id = '31'
        self._assert_pass_filter()

    def test_lyon(self) -> None:
        """User is looking for a job in Lyon."""

        self.persona.project.city.departement_id = '69'
        self._assert_pass_filter()

    def test_paris(self) -> None:
        """User is looking for a job in Paris."""

        self.persona.project.city.departement_id = '75'
        self._assert_fail_filter()


class FilterApplicationComplexityTestCase(FilterTestBase):
    """Unit tests for the _ApplicationComplexityFilter class."""

    model_id = 'for-complex-application'

    def test_special_complexity(self) -> None:
        """User is in a job with a special complexity."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.job_group_info.insert_one({
            '_id': 'M1601', 'applicationComplexity': 'SPECIAL_APPLICATION_PROCESS'})
        self._assert_fail_filter()

    def test_complex_application(self) -> None:
        """User is in a job with a complex application process."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.database.job_group_info.insert_one({
            '_id': 'M1601', 'applicationComplexity': 'COMPLEX_APPLICATION_PROCESS'})
        self._assert_pass_filter()


class FilterActiveExperimentTestCase(FilterTestBase):
    """Unit tests for the _ActiveExperimentFilter class."""

    model_id = 'for-active-experiment(lbb_integration)'

    def test_in_control(self) -> None:
        """User is in the control group."""

        self.persona.features_enabled.lbb_integration = user_pb2.CONTROL
        self._assert_fail_filter()

    def test_not_in_experiment(self) -> None:
        """User is not in the experiment at all."""

        self.persona.features_enabled.ClearField('lbb_integration')
        self._assert_fail_filter()

    def test_in_experiment(self) -> None:
        """User is in the experiment."""

        self.persona.features_enabled.lbb_integration = user_pb2.ACTIVE
        self._assert_pass_filter()


class FilterActiveUnknownExperimentTestCase(unittest.TestCase):
    """Unit tests for the _ActiveExperimentFilter class when experiment does not exist."""

    @mock.patch(scoring.logging.__name__ + '.error')
    def test_unknown_field(self, mock_error: mock.MagicMock) -> None:
        """Tries to create a filter based on an experiment that does not exist."""

        self.assertFalse(scoring.get_scoring_model('for-active-experiment(unknown)'))
        mock_error.assert_called_once()

    @mock.patch(scoring.logging.__name__ + '.error')
    def test_wrong_type_field(self, mock_error: mock.MagicMock) -> None:
        """Tries to create a filter based on a field that is not a binary experiment."""

        self.assertFalse(scoring.get_scoring_model('for-active-experiment(alpha)'))
        mock_error.assert_called_once()


class FilterGoodOverallScoreTestCase(FilterTestBase):
    """Unit tests for the for-good-overall-score filter."""

    model_id = 'for-good-overall-score(50)'

    def test_low_score(self) -> None:
        """Low score."""

        self.persona.project.diagnostic.overall_score = 30
        self._assert_fail_filter()

    def test_high_score(self) -> None:
        """High score."""

        self.persona.project.diagnostic.overall_score = 90
        self._assert_pass_filter()


class FilterGoodNetworkScoreTestCase(FilterTestBase):
    """Unit tests for the for-network(3) filter."""

    model_id = 'for-network(3)'

    def test_lower_network_estimation(self) -> None:
        """User only has a medium network."""

        self.persona.project.network_estimate = 2
        self._assert_fail_filter()

    def test_high_score(self) -> None:
        """User only has a good network."""

        self.persona.project.network_estimate = 3
        self._assert_pass_filter()


class FilterPassionateLevelTestCase(FilterTestBase):
    """Unit tests for the for-passionate-level(LIFE_GOAL_JOB) filter."""

    model_id = 'for-passionate(LIFE_GOAL_JOB)'

    def test_not_really_passionate(self) -> None:
        """User only likes their job."""

        self.persona.project.passionate_level = project_pb2.LIKEABLE_JOB
        self._assert_fail_filter()

    def test_passionate(self) -> None:
        """User is really fond of their job."""

        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        self._assert_pass_filter()


class UnknownPassionateFilterTestCase(unittest.TestCase):
    """Unit test for the PassionateFilter class for projects about a
    passionate level that does not exist."""

    @mock.patch(scoring.logging.__name__ + '.error')
    def test_inexistant_passionate(self, mock_error: mock.MagicMock) -> None:
        """Cannot make scoring model for inexistant passionate level."""

        self.assertFalse(scoring.get_scoring_model('for-passionate(INEXISTANT)'))
        mock_error.assert_called_once()


class FilterShortSearchTestCase(FilterTestBase):
    """Unit tests for the for-short-search(-3) filter."""

    model_id = 'for-short-search(-3)'

    def test_just_started(self) -> None:
        """User has just started this project."""

        self.persona.project.job_search_length_months = 1
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=30.5))
        self._assert_pass_filter()

    def test_started_2_years_ago(self) -> None:
        """User has been working on this project for 2 years."""

        self.persona.project.job_search_length_months = 24
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=732))
        self._assert_fail_filter()


class LongAccumulatedSearcherFilterTestCase(FilterTestBase):
    """Unit tests for the BaseFilter class for users that have searched a lot, considering their
    availability to search (ie employment status)."""

    model_id = 'for-long-accumulated-search(2)'

    def test_not_started(self) -> None:
        """User hasn't started on their project yet."""

        self.persona.project.job_search_has_not_started = True
        self.persona.project.job_search_length_months = -1
        if not self.persona.project.HasField('created_at'):
            self.persona.project.created_at.GetCurrentTime()
        self._assert_fail_filter()

    def test_just_started(self) -> None:
        """User has just started this project."""

        self.persona.project.job_search_length_months = 1
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=30.5))
        self._assert_fail_filter()

    def test_started_2_years_ago(self) -> None:
        """User has been working on this project for 2 years."""

        self.persona.project.job_search_length_months = 24
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=732))
        self._assert_pass_filter()

    def test_started_5_months_ago_employed(self) -> None:
        """User is currently employed, but has been working on this project for 5 months."""

        self.persona.project.kind = project_pb2.FIND_ANOTHER_JOB
        self.persona.project.job_search_length_months = 5
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=153))
        self._assert_fail_filter()


class RuralAreaFilterTestCase(FilterTestBase):
    """Unit tests for users living in a rural area."""

    model_id = 'for-rural-area-inhabitant'

    def test_rural_area_inhabitant(self) -> None:
        """User is living in a rural area (urban score == -1)."""

        self.persona.project.city.urban_score = -1
        self._assert_pass_filter()

    def test_urban_area_inhabitant(self) -> None:
        """User is living in Paris (urban score == 8)."""

        self.persona.project.city.urban_score = 8
        self._assert_fail_filter()


class LBBFilterTestCase(FilterTestBase):
    """Unit tests for the _LBBFilter class."""

    model_id = 'for-recruiting-sector'

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    def test_big_company_recruiting(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Test that big companies return pass the filter."""

        mock_get_lbb_companies.return_value = iter([
            {'headcount_text': '0 salarié'},
            {'headcount_text': '500 à 999 salariés'},
        ])
        self._assert_pass_filter()

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    def test_medium_companies_recruiting(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Test that multiple medium companies pass the filter."""

        mock_get_lbb_companies.return_value = iter([
            {'headcount_text': '250 à 499 salariés'},
            {'headcount_text': '250 à 499 salariés'},
        ])
        self._assert_pass_filter()

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    def test_companies_not_recruiting(self, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Test that companies not recruiting does not pass the filter."""

        mock_get_lbb_companies.return_value = iter([
            {'headcount_text': '1 ou 2 salariés'},
            {'headcount_text': '1 ou 2 salariés'},
        ])
        self._assert_fail_filter()

    @mock.patch(companies.__name__ + '.get_lbb_companies')
    @mock.patch(companies.logging.__name__ + '.warning')
    def test_failed_lbb_response_parsing(
            self, mock_log_warning: mock.MagicMock, mock_get_lbb_companies: mock.MagicMock) -> None:
        """Test that companies not recruiting does not pass the filter."""

        mock_get_lbb_companies.return_value = iter([
            {'name': 'bad', 'headcount_text': 'moins de 10 salariés'},
            {'headcount_text': '990 ou 1990 salariés'},
        ])
        self._assert_pass_filter()
        mock_log_warning.assert_called()


class ContractTypeFilterTestCase(FilterTestBase):
    """Unit tests for the _ContractTypeFilter class."""

    model_id = 'for-most-likely-short-contract'

    def test_recruiting_through_cdi(self) -> None:
        """Test that main contract CDI does not pass the filter."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 54,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 30,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                    {
                        'percentSuggested': 14,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 2,
                        'contractType': 'INTERIM',
                    }
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self._assert_fail_filter()

    def test_recruiting_through_cdd(self) -> None:
        """Test that main contract short CDD passes the filter."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 54,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                    {
                        'percentSuggested': 30,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 14,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 2,
                        'contractType': 'INTERIM',
                    }
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self._assert_pass_filter()

    def test_recruiting_through_cdds(self) -> None:
        """Test that compounded short contract are over 50% passes the filter."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 30,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 28,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                    {
                        'percentSuggested': 23,
                        'contractType': 'INTERIM',
                    },
                    {
                        'percentSuggested': 19,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    }
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self._assert_pass_filter()


class NarrowContractSearchTestCase(FilterTestBase):
    """Unit tests for the filter on narrow search on contract types."""

    model_id = 'for-narrow-contract-search'

    def test_no_data(self) -> None:
        """Fails if we don't have info on the market."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': []
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self._assert_fail_filter()

    def test_main_employment_type(self) -> None:
        """User is asking for the main kind of contract."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 60,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 40,
                        'contractType': 'INTERIM',
                    },
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self.persona.project.employment_types.append(job_pb2.CDI)
        self._assert_fail_filter()

    def test_minor_employment_type(self) -> None:
        """User is asking for a kind of contract which is minor in market."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 60,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 40,
                        'contractType': 'INTERIM',
                    },
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        del self.persona.project.employment_types[:]
        self.persona.project.employment_types.append(job_pb2.INTERIM)
        self._assert_pass_filter()

    def test_several_minor_employment_types(self) -> None:
        """User is asking for several types of contract, which make a majority."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 45,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 30,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 25,
                        'contractType': 'INTERIM',
                    },
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        self.persona.project.employment_types.extend([job_pb2.CDD_OVER_3_MONTHS, job_pb2.INTERIM])
        self._assert_fail_filter()

    def test_several_too_minor_employment_types(self) -> None:
        """User is asking for several types of contract, which still make a minority."""

        self.database.job_group_info.insert_one({
            '_id': 'A1204',
            'requirements': {
                'contractTypes': [
                    {
                        'percentSuggested': 45,
                        'contractType': 'CDI',
                    },
                    {
                        'percentSuggested': 30,
                        'contractType': 'CDD_OVER_3_MONTHS',
                    },
                    {
                        'percentSuggested': 15,
                        'contractType': 'CDD_LESS_EQUAL_3_MONTHS',
                    },
                    {
                        'percentSuggested': 10,
                        'contractType': 'INTERIM',
                    },
                ]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1204'
        del self.persona.project.employment_types[:]
        self.persona.project.employment_types.extend([job_pb2.CDD_OVER_3_MONTHS, job_pb2.INTERIM])
        self._assert_pass_filter()


class OffersEvolutionFilterTestCase(FilterTestBase):
    """Unit tests for the filter on evolution of offers."""

    model_id = 'for-evolution-of-offers(+10%)'

    def test_negative_evolution(self) -> None:
        """Test that a market which is not recruiting more than before fails the filter."""

        self.database.local_diagnosis.insert_one({
            '_id': '69:M1403',
            'job_offers_change': -5
        })
        self.persona.project.target_job.job_group.rome_id = 'M1403'
        self.persona.project.city.departement_id = '69'
        self._assert_fail_filter()

    def test_not_much_evolution(self) -> None:
        """Test that a market which is not recruiting much more than before fails the filter."""

        self.database.local_diagnosis.insert_one({
            '_id': '69:M1403',
            'job_offers_change': 5
        })
        self.persona.project.target_job.job_group.rome_id = 'M1403'
        self.persona.project.city.departement_id = '69'
        self._assert_fail_filter()

    def test_good_evolution(self) -> None:
        """Test that a market which is recruiting much more than before passes the filter."""

        self.database.local_diagnosis.insert_one({
            '_id': '69:M1403',
            'job_offers_change': 15
        })
        self.persona.project.target_job.job_group.rome_id = 'M1403'
        self.persona.project.city.departement_id = '69'
        self._assert_pass_filter()


class InterimFilterTestCase(FilterTestBase):
    """Unit tests for the filter on interim employement type."""

    model_id = 'for-very-short-contract'

    def test_interim(self) -> None:
        """Test that a user willing to do interim passes the filter."""

        self.persona.project.employment_types.append(job_pb2.INTERIM)
        self._assert_pass_filter()

    def test_not_interim(self) -> None:
        """Test that a user unwilling to do interim fails the filter."""

        try:
            self.persona.project.employment_types.remove(job_pb2.INTERIM)
        except ValueError:
            # Persona is already not interested in INTERIM.
            pass
        self._assert_fail_filter()


class GoodScorerTestCase(FilterTestBase):
    """Unit tests for the filter on good score for a given scorer."""

    model_id = 'for-good-score(network-score)'

    def test_with_good_score(self) -> None:
        """Test that a good enough score passes the filter."""

        # This makes a 60% score.
        self.persona.project.network_estimate = 2
        self._assert_pass_filter()

    def test_with_bad_score(self) -> None:
        """Test that a bad score fails the filter."""

        self.persona.project.network_estimate = 1
        self._assert_fail_filter()

    def test_unscored(self) -> None:
        """Test that no score fails the filter."""

        self.persona.project.network_estimate = 0
        self._assert_fail_filter()


class BadScorerTestCase(FilterTestBase):
    """Unit tests for the filter on bad score for a given scorer."""

    model_id = 'for-bad-score(network-score)'

    def test_with_good_score(self) -> None:
        """Test that a good enough score fails the filter."""

        # This makes a 60% score.
        self.persona.project.network_estimate = 2
        self._assert_fail_filter()

    def test_with_bad_score(self) -> None:
        """Test that a bad score passes the filter."""

        self.persona.project.network_estimate = 1
        self._assert_pass_filter()

    def test_unscored(self) -> None:
        """Test that no score fails the filter."""

        self.persona.project.network_estimate = 0
        self._assert_fail_filter()


class LongTermMomFilterTestCase(FilterTestBase):
    """Tests for the for-long-term-mom filter."""

    model_id = 'for-long-term-mom'

    def test_frustrated_woman(self) -> None:
        """A woman frustrated by her stay-at-homeness passes the filter."""

        self.persona.user_profile.gender = user_pb2.FEMININE
        self.persona.user_profile.frustrations.append(user_pb2.STAY_AT_HOME_PARENT)
        self._assert_pass_filter()

    def test_not_frustrated(self) -> None:
        """A person not frustrated by their stay-at-homeness fails the filter."""

        del self.persona.user_profile.frustrations[:]
        self._assert_fail_filter()

    def test_not_woman(self) -> None:
        """A man fails the filter."""

        self.persona.user_profile.gender = user_pb2.MASCULINE
        self._assert_fail_filter()


class DriverFilterTestCase(FilterTestBase):
    """Tests for users that have a driving license."""

    model_id = 'for-driver'

    def test_has_no_license(self) -> None:
        """User does not have a driving license."""

        self.persona.user_profile.has_car_driving_license = user_pb2.FALSE
        del self.persona.user_profile.driving_licenses[:]
        self._assert_fail_filter()

    def test_has_motorcycle_driving_license(self) -> None:
        """User has a driving license in the list of licenses."""

        self.persona.user_profile.driving_licenses.append(job_pb2.MOTORCYCLE)
        self._assert_pass_filter()

    def test_has_car_driving_license(self) -> None:
        """User has car driving license."""

        self.persona.user_profile.has_car_driving_license = user_pb2.TRUE
        self._assert_pass_filter()


class LowMobilityTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with low but existant mobility."""

    model_id = 'for-low-mobility(departement)'

    def test_medium_mobility(self) -> None:
        """User is willing to move in the region."""

        self.persona.project.area_type = geo_pb2.REGION
        self._assert_pass_filter()

    def test_no_mobility(self) -> None:
        """User is not willing to move outside the city."""

        self.persona.project.area_type = geo_pb2.CITY
        self._assert_fail_filter()


class MediumMobilityTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with medium mobility."""

    model_id = 'for-medium-mobility(region)'

    def test_medium_mobility(self) -> None:
        """User is willing to move in the region."""

        self.persona.project.area_type = geo_pb2.REGION
        self._assert_pass_filter()

    def test_low_mobility(self) -> None:
        """User is not willing to move outside the departement."""

        self.persona.project.area_type = geo_pb2.DEPARTEMENT
        self._assert_fail_filter()


class HighMobilityTestCase(FilterTestBase):
    """Unit tests for the _ProjectFilter class for users with high mobility."""

    model_id = 'for-high-mobility(country)'

    def test_high_mobility(self) -> None:
        """User is willing to move in the region."""

        self.persona.project.area_type = geo_pb2.WORLD
        self._assert_pass_filter()

    def test_medium_mobility(self) -> None:
        """User is not willing to move outside the region."""

        self.persona.project.area_type = geo_pb2.REGION
        self._assert_fail_filter()


class NoRequiredDiplomasTestCase(FilterTestBase):
    """Unit tests for the filter for-no-required-diploma."""

    model_id = 'for-no-required-diploma'

    def test_bac_required(self) -> None:
        """User looks for a job which needs a Baccalauréat"""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [{
                    'name': 'Bac',
                    'percentRequired': 10,
                }]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self._assert_fail_filter()

    def test_cap_required(self) -> None:
        """User looks for a job which needs a CAP"""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [{
                    'name': 'CAP',
                    'percentRequired': 20,
                }]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self._assert_fail_filter()

    def test_bac_suggested(self) -> None:
        """User looks for a job where a Baccalauréat could be useful."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [{
                    'name': 'Bac',
                    'percentSuggested': 10,
                }]
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self._assert_pass_filter()


class VeryFrustratedTestCase(FilterTestBase):
    """Unit tests for the for-very-frustrated(5) filter."""

    model_id = 'for-very-frustrated(5)'

    def not_frustrated(self) -> None:
        """User has no frustrations."""

        del self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.custom_frustrations[:]
        self._assert_fail_filter()

    def not_much_frustrated(self) -> None:
        """User has few frustrations."""

        frustrations = self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.custom_frustrations[:]
        self.persona.user_profile.frustrations.extend(frustrations[:2])
        self._assert_fail_filter()

    def not_much_frustrated_custom(self) -> None:
        """User has few frustrations, which are custom."""

        del self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.custom_frustrations[:]
        self.persona.user_profile.custom_frustrations.extend(
            ['la politique du gouvernement', 'le coût de la vie'])
        self._assert_fail_filter()

    def much_frustrated(self) -> None:
        """User has a lot of frustrations."""

        self.persona.user_profile.frustrations.extend([
            user_pb2.NO_OFFERS, user_pb2.MOTIVATION, user_pb2.ATYPIC_PROFILE,
            user_pb2.AGE_DISCRIMINATION, user_pb2.SINGLE_PARENT])
        self._assert_pass_filter()

    def buggy_frustrated(self) -> None:
        """User has a lot of the same frustration."""

        del self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.custom_frustrations[:]
        self.persona.user_profile.frustrations.extend([
            user_pb2.NO_OFFERS, user_pb2.NO_OFFERS, user_pb2.NO_OFFERS, user_pb2.NO_OFFERS,
            user_pb2.NO_OFFERS])
        self._assert_fail_filter()

    def much_customly_frustrated(self) -> None:
        """User has a lot of custom frustrations."""

        self.persona.user_profile.custom_frustrations.extend([
            'la famille', 'les transports', 'la fatigue', 'la télé', 'le terrorisme'])
        self._assert_pass_filter()

    def buggy_customly_frustrated(self) -> None:
        """User has the same custom frustration several times."""

        del self.persona.user_profile.frustrations[:]
        del self.persona.user_profile.custom_frustrations[:]
        self.persona.user_profile.custom_frustrations.extend([
            'la famille', 'la famille', 'la famille', 'la famille', 'la famille'])
        self._assert_fail_filter()

    def much_frustrated_custom_or_not(self) -> None:
        """User has both custom and prepared frustrations."""

        self.persona.user_profile.frustrations.extend([user_pb2.NO_OFFERS, user_pb2.MOTIVATION])
        self.persona.user_profile.custom_frustrations.extend([
            'la famille', 'les transports', 'la fatigue'])
        self._assert_pass_filter()


if __name__ == '__main__':
    unittest.main()
