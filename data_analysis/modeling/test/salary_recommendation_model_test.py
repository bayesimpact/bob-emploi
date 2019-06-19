"""Unit tests for the salary_recommendation_model module."""

import unittest

import collections

import pandas

from bob_emploi.data_analysis.modeling import salary_recommendation_model

_RecoScore = collections.namedtuple('RecoScore', ['from_salary', 'gained_offers'])
_RecoCDF = collections.namedtuple('RecoCDF', ['from_salary', 'salary_decrease'])
_SalariesExpectedReco = collections.namedtuple(
    'SalariesExpectedReco', ['test_name', 'salaries', 'expected_reco'])


class BucketsTestCase(unittest.TestCase):
    """Tests for function that computes a salary recommendation based on the CDF."""

    def test_compute_recommendation_cdf(self) -> None:
        """Compute recommendations on salary using CDF"""

        # List of namedtuples of (test_name, salary, expected reco).
        salaries_expected_recos = [
            _SalariesExpectedReco(
                test_name='same salary for all job offers (cdf)',
                salaries=[20000 for x in range(10)],
                expected_reco=[
                    _RecoCDF(from_salary=20000.0, salary_decrease='no better alternative')]),
            _SalariesExpectedReco(
                test_name='two different salaries (cdf)',
                salaries=[20000 for x in range(5)] + [25000 for x in range(5)],
                expected_reco=[
                    _RecoCDF(from_salary=20000.0, salary_decrease='no better alternative'),
                    _RecoCDF(from_salary=20202.0202020202,
                             salary_decrease='1percent_salary_decrease'),
                    _RecoCDF(from_salary=20408.163265306124,
                             salary_decrease='2percent_salary_decrease'),
                    _RecoCDF(from_salary=20618.556701030928,
                             salary_decrease='3percent_salary_decrease'),
                    _RecoCDF(from_salary=20833.333333333336,
                             salary_decrease='4percent_salary_decrease'),
                    _RecoCDF(from_salary=21052.63157894737,
                             salary_decrease='5percent_salary_decrease'),
                    _RecoCDF(from_salary=21276.595744680853,
                             salary_decrease='6percent_salary_decrease'),
                    _RecoCDF(from_salary=21505.376344086024,
                             salary_decrease='7percent_salary_decrease'),
                    _RecoCDF(from_salary=21739.130434782608,
                             salary_decrease='8percent_salary_decrease'),
                    _RecoCDF(from_salary=21978.021978021978,
                             salary_decrease='9percent_salary_decrease'),
                    _RecoCDF(from_salary=22222.222222222223,
                             salary_decrease='10percent_salary_decrease'),
                    _RecoCDF(from_salary=25000.0, salary_decrease='no better alternative')
                ])
        ]
        # We test each namedtuples of (test_name, salary, expected reco).
        for test_name, salary, expected_reco in salaries_expected_recos:
            best_reco_as_list = salary_recommendation_model.compute_recommendation_cdf(
                pandas.DataFrame({
                    'rome_id': ['A'] * 10,
                    'annual_minimum_salary': salary,
                    'exp_bucket': ['[0, 999['] * 10
                })
            )
            # Assert that found reco are equal to expected reco.
            self.assertEqual(best_reco_as_list, expected_reco, msg=test_name)

    def test_compute_reco_score(self) -> None:
        """Compute recommendations on salary using a score"""

        # List of namedtuples of (test_name, salary, expected reco).
        salaries_expected_recos = [
            _SalariesExpectedReco(
                test_name='same salary for all job offers (score)',
                salaries=[20000 for x in range(10)],
                expected_reco=[_RecoScore(from_salary=20000, gained_offers=0)]),
            _SalariesExpectedReco(
                test_name='two different salaries (score)',
                salaries=[20000 for x in range(5)] + [25000 for x in range(5)],
                expected_reco=[
                    _RecoScore(from_salary=20000.0, gained_offers=0.0),
                    _RecoScore(from_salary=25000.0, gained_offers=1.0)]),
            _SalariesExpectedReco(
                test_name='three different salaries and one outlier (score)',
                salaries=[17000 for x in range(2)] + [20000 for x in range(7)] + [50000],
                expected_reco=[
                    _RecoScore(from_salary=17000.0, gained_offers=0.0),
                    _RecoScore(from_salary=20000.0, gained_offers=0.25),
                    _RecoScore(from_salary=50000.0, gained_offers=7.0)])
        ]
        # We test each namedtuples of (test_name, salary, expected reco).
        for test_name, salary, expected_reco in salaries_expected_recos:
            best_reco_as_list = salary_recommendation_model.compute_recommendation_score(
                pandas.DataFrame({
                    'rome_id': ['A'] * 10,
                    'annual_minimum_salary': salary,
                    'exp_bucket': ['[0, 999['] * 10
                })
            )
            # Assert that found reco are equal to expected reco.
            self.assertEqual(best_reco_as_list, expected_reco, msg=test_name)


if __name__ == '__main__':
    unittest.main()
