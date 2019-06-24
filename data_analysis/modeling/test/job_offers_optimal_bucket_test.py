"""Unit tests for the job_offers_optimal_buckets module."""

import collections
import unittest

import pandas

from bob_emploi.data_analysis.modeling import job_offers_optimal_buckets

_TestCase = collections.namedtuple('TestCase', ['name', 'offers', 'expected'])


class BucketsTestCase(unittest.TestCase):
    """Tests for the function computing optimal buckets."""

    def test_apply_bucketize(self) -> None:
        """Basic usage of apply_bucketize."""

        # List of tuple of (experience, expected_labels).
        experiences_expected_labels = [
            _TestCase(
                name='All offers expect 1 year of experience',
                offers=[12 for x in range(20)],
                expected=['[0, 999[' for x in range(20)]),
            _TestCase(
                name='All offers expect no experience',
                offers=[0 for x in range(20)],
                expected=['[0, 999[' for x in range(20)]),
            _TestCase(
                name='Half expect 1 year, half expect 3 years of experience',
                offers=[12 for x in range(10)] + [36 for x in range(10)],
                expected=['[0, 24[' for x in range(10)] + ['[24, 999[' for x in range(10)]),
            _TestCase(
                name='All offers expect more than 8 years of experience',
                offers=[100 for x in range(20)],
                expected=['[0, 999[' for x in range(20)]),
        ]
        for test in experiences_expected_labels:
            bucketize = job_offers_optimal_buckets.create_bucketizer(
                job_offers_optimal_buckets.OPTIMAL_BUCKETS)
            actual = bucketize(pandas.DataFrame({
                'rome_id': ['A' for x in test.offers],
                'annual_minimum_salary': [20000 for x in test.offers],
                'experience_min_duration': test.offers,
            }))
            self.assertEqual(test.expected, actual.exp_bucket.tolist(), msg=test.name)


if __name__ == '__main__':
    unittest.main()
