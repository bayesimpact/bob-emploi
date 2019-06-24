"""Tests for categories in the bob_emploi.frontend.scoring module."""

import datetime
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.test import filters_test


class FindWhatYouLikeTestCase(filters_test.FilterTestBase):
    """Tests for the category filter for users that should find what they like."""

    model_id = 'category-find-what-you-like'

    def setUp(self) -> None:
        super().setUp()
        # This job market is competitive enough.
        self.database.local_diagnosis.insert_one({
            '_id': '31:A1234',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 5,
            }
        })

    # TODO(cyrille): Consider moving in FilterTestBase.
    def _set_persona_age(self, age: int) -> None:
        self.persona.user_profile.year_of_birth = datetime.datetime.now().year - age

    def _set_job_search_length(self, months: float) -> None:
        self.persona.project.job_search_started_at.FromDatetime(
            self.persona.project.created_at.ToDatetime() - datetime.timedelta(days=months * 30.5))

    def _set_competitive_market(self) -> None:
        self.persona.project.city.departement_id = '31'
        self.persona.project.target_job.job_group.rome_id = 'A1234'

    def test_happy_fail(self) -> None:
        """User happy with their job doesn't fall in this category."""

        self.persona.project.passionate_level = project_pb2.PASSIONATING_JOB
        self._assert_fail_filter()

    def test_unstressed_market(self) -> None:
        """User in a market with many opportunities doesn't fall in this category."""

        self.database.local_diagnosis.insert_one({
            '_id': '69:A1234',
            'imt': {
                'yearlyAvgOffersDenominator': 10,
                'yearlyAvgOffersPer10Candidates': 8,
            }
        })
        self.persona.project.city.departement_id = '69'
        self.persona.project.target_job.job_group.rome_id = 'A1234'
        self._assert_fail_filter()

    def test_young_experienced(self) -> None:
        """Young experienced user doesn't fall in this category."""

        self._set_persona_age(25)
        self.persona.project.seniority = project_pb2.SENIOR
        self._assert_fail_filter()

    def test_old_already_done(self) -> None:
        """Older user with some related experience fails."""

        self._set_persona_age(35)
        self.persona.project.previous_job_similarity = project_pb2.DONE_SIMILAR
        self._assert_fail_filter()

    def test_old_with_long_search(self) -> None:
        """Older user that have been searching for some time fails."""

        self._set_persona_age(35)
        self._set_job_search_length(months=7)
        self._assert_fail_filter()

    def test_old_unemployed_with_medium_search(self) -> None:
        """Older user that have been searching actively for some time fails."""

        self._set_persona_age(35)
        self._set_job_search_length(months=4)
        if self.persona.project.kind == project_pb2.FIND_ANOTHER_JOB:
            self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        self._assert_fail_filter()

    def test_young_inexperienced(self) -> None:
        """Young inexperienced user may pass."""

        self._set_persona_age(25)
        self._set_competitive_market()
        self.persona.project.passionate_level = project_pb2.LIKEABLE_JOB
        self.persona.project.seniority = project_pb2.JUNIOR
        self._assert_pass_filter()

    def test_old_changing_job(self) -> None:
        """Old user trying a new job without being passionate may pass."""

        self._set_persona_age(35)
        self._set_competitive_market()
        self._set_job_search_length(months=1.5)
        self.persona.project.passionate_level = project_pb2.LIKEABLE_JOB
        self.persona.project.kind = project_pb2.REORIENTATION
        self._assert_pass_filter()

    def test_old_never_done_job(self) -> None:
        """Old user trying a job without any previous experience may pass."""

        self._set_persona_age(35)
        self._set_competitive_market()
        self._set_job_search_length(months=1.5)
        self.persona.project.passionate_level = project_pb2.LIKEABLE_JOB
        self.persona.project.previous_job_similarity = project_pb2.NEVER_DONE
        self._assert_pass_filter()


class MissingDiplomaTestCase(filters_test.FilterTestBase):
    """Tests for the category filter for users that should find what they like."""

    model_id = 'category-missing-diploma'

    def setUp(self) -> None:
        super().setUp()
        # This job group needs a diploma.
        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [{
                    'name': 'Bac+2',
                    'percentRequired': 50,
                }],
            },
        })
        # This job gorup needs no diploma.
        self.database.job_group_info.insert_one({
            '_id': 'B5678',
            'requirements': {'diplomas': []},
        })

    def _set_persona_age(self, age: int) -> None:
        self.persona.user_profile.year_of_birth = datetime.datetime.now().year - age

    def _set_job_group(self, is_diploma_required: bool) -> None:
        self.persona.project.target_job.job_group.rome_id = \
            'A1234' if is_diploma_required else 'B5678'

    def test_no_required_diploma(self) -> None:
        """User that don't require a diploma doesn't fall in this category."""

        self._set_job_group(is_diploma_required=False)
        self._assert_fail_filter()

    def test_already_got_diploma(self) -> None:
        """User with all the needed diplomas doesn't fall in this category."""

        self.persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_DIPLOMAS
        self._assert_fail_filter()

    def test_almost_got_diploma(self) -> None:
        """User currently getting the needed diplomas doesn't fall in this category."""

        self.persona.project.training_fulfillment_estimate = project_pb2.CURRENTLY_IN_TRAINING
        self._assert_fail_filter()

    def test_creator(self) -> None:
        """Company creator doesn't fall in this category."""

        self.persona.project.kind = project_pb2.CREATE_OR_TAKE_OVER_COMPANY
        self._assert_fail_filter()

    def test_old_experienced(self) -> None:
        """Older user with much related experience fails."""

        self._set_persona_age(50)
        self.persona.project.seniority = project_pb2.EXPERT
        self._assert_fail_filter()

    def test_young_experienced_missing_diplomas(self) -> None:
        """Experienced user needing diplomas is in this category."""

        self._set_job_group(is_diploma_required=True)
        self.persona.project.training_fulfillment_estimate = project_pb2.ENOUGH_EXPERIENCE
        self.persona.project.kind = project_pb2.FIND_A_NEW_JOB
        self._set_persona_age(49)
        self._assert_pass_filter()


if __name__ == '__main__':
    unittest.main()