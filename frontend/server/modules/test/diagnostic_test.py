"""Unit tests for the diagnostic module."""

import datetime
import unittest

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.test import scoring_test
from bob_emploi.frontend.server.test import filters_test


class SearchLengthScoringModelTestCase(
        scoring_test.HundredScoringModelTestBase('search-length-score')):
    """Unit test for the "search-length-score" scoring model."""

    def test_searching_forever(self):
        """User has been searching for 20 months."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=600))
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_searching_for_long_time(self):
        """User has been searching for 11 months."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=335))
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_searching_just_started(self):
        """User has been searching for 15 days."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=15))
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_search_not_started(self):
        """User has not started their research thus the metric should be disabled."""

        self.persona.project.job_search_has_not_started = True
        self.assert_not_enough_data()

    def test_missing_search_start_info(self):
        """User has no info for search start."""

        self.persona.project.ClearField('job_search_started_at')
        self.assert_not_enough_data()


class InterviewRateScoringModelTestCase(
        scoring_test.HundredScoringModelTestBase('interview-rate-score')):
    """Unit test for the "interview-rate-score" scoring model."""

    def test_lot_of_interviews(self):
        """User has been searching for 8 months and has done a lot of interviews."""

        self.persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        self.persona.project.total_interview_count = 80
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=244))
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_low_interviews(self):
        """User has been searching for 8 months and has done few interviews."""

        self.persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        self.persona.project.total_interview_count = 2
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=244))
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_missing_interviews(self):
        """User has missing info for interviews."""

        self.persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        self.persona.project.total_interview_count = -1
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=41))
        self.assert_not_enough_data()

    def test_low_applications(self):
        """User has done few applications, thus we don't expect that much interviews."""

        self.persona.project.weekly_applications_estimate = project_pb2.DECENT_AMOUNT
        self.persona.project.total_interview_count = 2
        self.persona.project.job_search_has_not_started = False
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=244))
        self.persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self.assert_not_enough_data()

    def test_search_not_started(self):
        """User has not started their research thus the metric should be disabled."""

        self.persona.project.job_search_has_not_started = True
        self.assert_not_enough_data()

    def test_missing_search_start_info(self):
        """User has no info for search start."""

        self.persona.project.ClearField('job_search_started_at')
        self.assert_not_enough_data()


class TooManyApplicationsScoringModelTestCase(
        scoring_test.HundredScoringModelTestBase('too-many-applications-score')):
    """Unit test for the "weekly-application-score" scoring model."""

    def test_lot_of_applications(self):
        """User has done a lot of applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_applications_estimate = project_pb2.A_LOT
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_low_applications(self):
        """User has done few applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        self.assert_not_enough_data()

    def test_search_not_started(self):
        """User has not started their research thus the metric should be disabled."""

        self.persona.project.job_search_has_not_started = True
        self.assert_not_enough_data()

    def test_missing_applications(self):
        """User has no info for applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_offers_estimate = project_pb2.A_LOT
        self.persona.project.weekly_applications_estimate\
            = project_pb2.UNKNOWN_NUMBER_ESTIMATE_OPTION
        self.assert_not_enough_data()


class TooFewApplicationsScoringModelTestCase(
        scoring_test.HundredScoringModelTestBase('too-few-applications-score')):
    """Unit test for the "weekly-application-score" scoring model."""

    def test_lot_of_applications(self):
        """User has done a lot of applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_applications_estimate = project_pb2.A_LOT
        self.assert_not_enough_data()

    def test_low_applications(self):
        """User has done few applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_applications_estimate = project_pb2.LESS_THAN_2
        score = self._score_persona(self.persona)
        # For this scorer the lowest valid score is 0.9.
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_search_not_started(self):
        """User has not started their research thus the metric should be disabled."""

        self.persona.project.job_search_has_not_started = True
        self.assert_not_enough_data()

    def test_missing_applications(self):
        """User has no info for applications."""

        self.persona.project.job_search_has_not_started = False
        self.persona.project.weekly_offers_estimate = project_pb2.A_LOT
        self.persona.project.weekly_applications_estimate\
            = project_pb2.UNKNOWN_NUMBER_ESTIMATE_OPTION
        self.assert_not_enough_data()


class TrainingFullfillmentScoringModelTest(
        scoring_test.HundredScoringModelTestBase('training-fullfillment-score')):
    """Unit test for the scoring model on the training fullfillment."""

    def test_unknown(self):
        """Test that people with unknown fullfillment aren't scored."""

        self.persona.project.training_fulfillment_estimate = \
            project_pb2.UNKNOWN_TRAINING_FULFILLMENT
        self.assert_not_enough_data()

    def test_unsure(self):
        """Test that people that are unsure get the worse score."""

        self.persona.project.training_fulfillment_estimate = \
            project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_with_diplomas(self):
        """Test that people with enough diplomas have greatest score."""

        self.persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))


class RequiredDiplomasScoringModelTest(
        scoring_test.HundredScoringModelTestBase('required-diplomas-score')):
    """Unit test for the scoring model on required diplomas."""

    def test_unknown(self):
        """Test that jobs without known required diplomas aren't scored."""

        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.assert_not_enough_data()

    def test_required_diploma(self):
        """Test that unsure people with one really necessary diploma have the worst possible score.
        """

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [
                    {
                        'name': 'Bac+2',
                        'percentSuggested': 19,
                        'percentRequired': 100
                    }
                ],
            },
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.training_fulfillment_estimate = \
            project_pb2.TRAINING_FULFILLMENT_NOT_SURE

        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_with_diplomas(self):
        """Test that people with enough diplomas aren't scored."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [
                    {
                        'name': 'Bac+2',
                        'percentSuggested': 19,
                        'percentRequired': 100
                    }
                ],
            },
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        self.assert_not_enough_data()

    def test_with_unimportant_diploma(self):
        """Test that job groups with only unimportant diploma(s) have a good score."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [
                    {
                        'name': 'Bac+2',
                        'percentSuggested': 19,
                        'percentRequired': 30
                    }
                ],
            },
        })
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self.persona.project.training_fulfillment_estimate = \
            project_pb2.TRAINING_FULFILLMENT_NOT_SURE
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail for "{}"'.format(self.persona.name))


class MarketStressScoringModelTest(
        scoring_test.HundredScoringModelTestBase('market-stress-score')):
    """Unit test for the scoring model on job market stress."""

    def test_missing(self):
        """Test that users looking for jobs with missing market stress information aren't scored."""

        self.persona.project.target_job.job_group.rome_id = 'M1601XXX'
        self.persona.project.mobility.city.departement_id = '19'
        self.assert_not_enough_data()

    def test_tight_market(self):
        """Test that users looking for jobs with high offers have the greatest score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 15,
            }
        })
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_no_offers(self):
        """Test that users looking for jobs with low offers have a bad score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 0,
            }
        })
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_low_offers(self):
        """Test that users looking for jobs with low offers have a bad score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 2,
            }
        })
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_with_incomplete_market_info(self):
        """Test that users looking for jobs with incomplete market info aren't scored."""

        self.persona.project.target_job.job_group.rome_id = 'M1601XX'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601XX',
            'imt': {
                'yearlyAvgOffersPer10Candidates': 3,
            }
        })
        self.assert_not_enough_data()


class ReturnToEmploymentScoringModelTest(
        scoring_test.HundredScoringModelTestBase('return-to-employment-score')):
    """Unit test for the scoring model on return to employment duration."""

    def test_unknown(self):
        """Test that persona with missing job local stats aren't scored."""

        self.persona.project.mobility.city.departement_id = '00'
        self.assert_not_enough_data()

    def test_worse_return_to_employment(self):
        """Test that persona with more than 12 months return to employment has the worse score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'unemployment_duration': {'days': 412},
        })
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail of "{}"'.format(self.persona.name))

    def test_bad_return_to_employment(self):
        """Test that persona with long return to employment has a bad score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'unemployment_duration': {'days': 230},
        })
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail of "{}"'.format(self.persona.name))

    def test_good_return_to_employment(self):
        """Test that persona with short return to employment has a good score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'unemployment_duration': {'days': 34},
        })
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail of "{}"'.format(self.persona.name))


class JobOfTheFutureScoringModelTest(
        scoring_test.HundredScoringModelTestBase('job-of-the-future')):
    """Unit test for the scoring model on job is future proof."""

    def test_no_data(self):
        """No growth data."""

        self.assert_not_enough_data()

    def test_job_of_the_past(self):
        """User is targeting a job of the past."""

        self.persona.project.target_job.job_group.rome_id = 'A7890'
        self.database.job_group_info.insert_one({
            '_id': 'A7890',
            'growth20122022': -.16,
        })
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail of "{}"'.format(self.persona.name))

    def test_job_of_the_future(self):
        """User is targeting a job of the future."""

        self.persona.project.target_job.job_group.rome_id = 'A7890'
        self.database.job_group_info.insert_one({
            '_id': 'A7890',
            'growth20122022': .30,
        })
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail of "{}"'.format(self.persona.name))

    def test_job_of_the_present(self):
        """User is targeting a job of the present."""

        self.persona.project.target_job.job_group.rome_id = 'A7890'
        self.database.job_group_info.insert_one({
            '_id': 'A7890',
            'growth20122022': .2,
        })
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail of "{}"'.format(self.persona.name))


class NetworkScoringModelTest(
        scoring_test.HundredScoringModelTestBase('network-score')):
    """Unit test for the scoring model on network quality."""

    def test_no_data(self):
        """No network estimation available."""

        self.persona.project.network_estimate = -1
        self.assert_not_enough_data()

    def test_bad_score(self):
        """Users estimate they have weak network."""

        self.persona.project.network_estimate = 1
        score = self._score_persona(self.persona)
        self.assert_bad_score(score, msg='Fail of "{}"'.format(self.persona.name))

    def test_good_score(self):
        """Users estimate they have strong network."""

        self.persona.project.network_estimate = 3
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail of "{}"'.format(self.persona.name))


class OffersChangeScoringModelTest(
        scoring_test.HundredScoringModelTestBase('offers-change-score')):
    """Unit test for the scoring model on job offers change."""

    def test_offers_highly_increasing(self):
        """Test that users looking for jobs where offers highly increase have the greatest score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'jobOffersChange': 12,
            'numJobOffersPreviousYear': 100,
            'numJobOffersLastYear': 112,
        })
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_offers_decreasing(self):
        """Test that users looking for jobs with decreasing offers have the worse score."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'jobOffersChange': -10,
            'numJobOffersPreviousYear': 100,
            'numJobOffersLastYear': 90,
        })
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_with_low_offers(self):
        """Test that users looking for jobs low offers across a year aren't scored."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'jobOffersChange': 10,
            'numJobOffersPreviousYear': 1,
            'numJobOffersLastYear': 2,
        })
        self.assert_not_enough_data()


class PassionateLevelScoringModelTest(
        scoring_test.HundredScoringModelTestBase('job-passionate-score')):
    """Unit test for the scoring model on users passionate about their job."""

    def test_passionate_is_good(self):
        """Test that passionate users have greatest score."""

        self.persona.project.passionate_level = project_pb2.LIFE_GOAL_JOB
        score = self._score_persona(self.persona)
        self.assert_great_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_unknown(self):
        """Test that users without passionate level aren't scored."""

        self.persona.project.passionate_level = project_pb2.UNKNOWN_PASSION_LEVEL
        self.assert_not_enough_data()

    def test_no_passion_is_no_good(self):
        """Test that users without passion aren't well scored."""

        self.persona.project.passionate_level = project_pb2.ALIMENTARY_JOB
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))


class FrustrationTimeManagementScoringModelTest(
        scoring_test.HundredScoringModelTestBase('frustration-time-managment-scorer')):
    """Unit test for the scoring model on users frustrated by their time management."""

    def test_frustrated_is_bad(self):
        """Test that frustrated users have worse score."""

        self.persona.user_profile.frustrations.append(user_pb2.TIME_MANAGEMENT)
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_not_frustrated_is_neutral(self):
        """Test that not frustrated users aren't scored."""

        del self.persona.user_profile.frustrations[:]
        self.assert_not_enough_data()


class JobSimilarityScoringModelTest(
        scoring_test.HundredScoringModelTestBase('job-similarity-score')):
    """Unit test for the scoring model on users with similar job experience."""

    def test_same_is_good(self):
        """Users with experience in job have good score."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_THIS
        score = self._score_persona(self.persona)
        self.assert_good_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_frustrated_similar_is_good(self):
        """Users with similar experience and frustrated by atypic profile."""

        self.persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        self.persona.user_profile.frustrations.append(user_pb2.ATYPIC_PROFILE)
        score = self._score_persona(self.persona)
        self.assert_good_score(score, limit=.6, msg='Fail for "{}"'.format(self.persona.name))

    def test_no_similar_is_bad(self):
        """Users without any similar experience aren't well scored."""

        self.persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        score = self._score_persona(self.persona)
        self.assert_worse_score(score, msg='Fail for "{}"'.format(self.persona.name))

    def test_unknown_not_scored(self):
        """Users without job similarity aren't scored."""

        self.persona.project.previous_job_similarity = project_pb2.UNKNOWN_PROJECT_EXPERIENCE
        self.assert_not_enough_data()


class HiringNeedScoringModelTest(
        scoring_test.HundredScoringModelTestBase('hiring-difficulty-score')):
    """Unit test for the scoring model on difficult hiring for a given job."""

    def test_not_enough_data(self):
        """A job without BMO cannot be scored."""

        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        self.assert_not_enough_data()

    def test_difficult_is_good(self):
        """A job where hiring is difficult is a good thing."""

        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'bmo': {
                'percentDifficult': 95,
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        score = self._score_persona(self.persona)
        self.assert_good_score(score)

    def test_not_difficult_is_bad(self):
        """A job where hiring is not difficult gives a bad score."""

        self.database.local_diagnosis.insert_one({
            '_id': '19:M1601',
            'bmo': {
                'percentDifficult': 5,
            }
        })
        self.persona.project.target_job.job_group.rome_id = 'M1601'
        self.persona.project.mobility.city.departement_id = '19'
        score = self._score_persona(self.persona)
        self.assert_bad_score(score)


class DiagnosticEmptyFilterTest(
        filters_test.FilterTestBase('for-empty-diagnostic(PROFILE_DIAGNOSTIC)')):
    """Unit test for the filter with empty diagnostic profile submetric."""

    def test_empty_diagnostic(self):
        """Users without a diagnostic should pass the filter."""

        self.persona.project.ClearField('diagnostic')
        self._assert_pass_filter()

    def test_empty_profile_diagnostic(self):
        """Users without a profile diagnostic should pass the filter."""

        self.persona.project.ClearField('diagnostic')
        project = self.persona.project.diagnostic.sub_diagnostics.add()
        project.topic = diagnostic_pb2.PROJECT_DIAGNOSTIC
        self._assert_pass_filter()

    def test_non_empty_profile_diagnostic(self):
        """Users with a profile diagnostic should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        self._assert_fail_filter()


class DiagnosticRedFilterTest(
        filters_test.FilterTestBase('for-bad-diagnostic(PROFILE_DIAGNOSTIC)')):
    """Unit test for the filter with bad score for diagnostic profile submetric."""

    def test_empty_diagnostic(self):
        """Users without a diagnostic should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        self._assert_fail_filter()

    def test_good_score_profile_diagnostic(self):
        """Users with a profile diagnostic with good score should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 90
        self._assert_fail_filter()

    def test_bad_score_profile_diagnostic(self):
        """Users with a profile diagnostic should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 30
        self._assert_pass_filter()


class DiagnosticGreenFilterTest(
        filters_test.FilterTestBase('for-good-diagnostic(PROFILE_DIAGNOSTIC)')):
    """Unit test for the filter with good score for diagnostic profile submetric."""

    def test_empty_diagnostic(self):
        """Users without a diagnostic should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        self._assert_fail_filter()

    def test_good_score_profile_diagnostic(self):
        """Users with a profile diagnostic with good score should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 30
        self._assert_fail_filter()

    def test_bad_score_profile_diagnostic(self):
        """Users with a profile diagnostic should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 90
        self._assert_pass_filter()


class CountDiagnosticFilterTest(
        filters_test.FilterTestBase('for-good-diagnostic-submetrics(+4)')):
    """Unit test for the filter with good score for diagnostic profile submetric."""

    def test_one_good_diagnostic(self):
        """Users with only one submetric should fail the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 70
        self._assert_fail_filter()

    def test_four_good_diagnostics(self):
        """Users with four good diagnostics should pass the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROJECT_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.MARKET_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.JOB_SEARCH_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        profile.score = 20
        self._assert_pass_filter()

    def test_five_good_diagnostics(self):
        """Users with four good diagnostics should pass the filter."""

        self.persona.project.ClearField('diagnostic')
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROFILE_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.PROJECT_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.MARKET_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.JOB_SEARCH_DIAGNOSTIC
        profile.score = 90
        profile = self.persona.project.diagnostic.sub_diagnostics.add()
        profile.topic = diagnostic_pb2.JOB_OF_THE_FUTURE_DIAGNOSTIC
        profile.score = 90
        self._assert_pass_filter()


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
