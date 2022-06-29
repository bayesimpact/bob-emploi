"""Tests for the bob_emploi.importer.fhs_salaries module."""

import typing
from typing import Optional, Union
import unittest
from unittest import mock

from bob_emploi.data_analysis.importer import fhs_salaries


class _SalaryTest(typing.NamedTuple):
    name: str
    SALMT: Union[float, str]
    SALUNIT: str
    expect_annual: float
    bucket_low: Optional[float]
    bucket_high: Optional[float]


SALARY_TESTS = [
    _SalaryTest(
        name='Typical annual value',
        SALMT=17650.1,
        SALUNIT='A',
        expect_annual=17650.1,
        bucket_low=17600,
        bucket_high=17800),
    _SalaryTest(
        name='Typical monthly value',
        SALMT=2031.1,
        SALUNIT='M',
        expect_annual=2031.1 * 12,
        bucket_low=24200,
        bucket_high=24400),
    _SalaryTest(
        name='Typical hourly value',
        SALMT=25.102,
        SALUNIT='H',
        expect_annual=25.102 * 35 * 52,
        bucket_low=45000,
        bucket_high=46000),
    _SalaryTest(
        name='Zero',
        SALMT=0.0,
        SALUNIT='H',
        expect_annual=0,
        bucket_low=0,
        bucket_high=0),
    _SalaryTest(
        name='Very very small',
        SALMT=0.1,
        SALUNIT='A',
        expect_annual=0.1,
        bucket_low=0,
        bucket_high=100),
    _SalaryTest(
        name='Bogus salary unit -- interpret as annual',
        SALMT=100.0,
        SALUNIT='X',
        expect_annual=100.0,
        bucket_low=None,
        bucket_high=None),
    _SalaryTest(
        name='Unparseable salary amount - interpret as zero salary',
        SALMT='foobar',
        SALUNIT='A',
        expect_annual=0.0,
        bucket_low=None,
        bucket_high=None),
]


# TODO(pascal): Harmonize how we cope with tqdm in tests.
@mock.patch('tqdm.tqdm', lambda iterable: iterable)
class FHSSalariesTestCase(unittest.TestCase):
    """Unit tests for the FHS salaries helper functions."""

    def test_compute_annual_salary(self) -> None:
        """Unit tests for compute_annual_salary function."""

        for test in SALARY_TESTS:
            salary = fhs_salaries.compute_annual_salary(
                test.SALMT, test.SALUNIT)
            self.assertAlmostEqual(salary, test.expect_annual, msg=test.name)

    def test_bucketize_salary(self) -> None:
        """Unit tests for bucketize_salary function."""

        for test in SALARY_TESTS:
            if test.bucket_low is None:
                continue
            low, high = fhs_salaries.bucketize_salary({
                'SALMT': test.SALMT, 'SALUNIT': test.SALUNIT})
            self.assertEqual(low, test.bucket_low, msg=test.name)
            self.assertEqual(high, test.bucket_high, msg=test.name)

    def test_job_seeker_criteria(self) -> None:
        """Basic usage of the job_seeker_criteria function."""

        criteria = fhs_salaries.job_seeker_criteria({
            'ROME': 'N4101',
            'DEPCOM': '44055',
            'SALMT': 17650.1,
            'SALUNIT': 'A'})
        self.assertEqual(('N4101', '44', 'A', 17600, 17800), criteria)


if __name__ == '__main__':
    unittest.main()
