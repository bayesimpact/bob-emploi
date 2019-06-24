"""Tests for the bob_emploi.lib.fhs module."""

import collections
import datetime
import typing
import unittest
from unittest import mock

from bob_emploi.data_analysis.lib import fhs

# Jobseeker criteria provided per unemployment period.
_JobseekerCriteria = collections.namedtuple('JobseekerCriteria', [
    'jobseeker_unique_id',
    'code_rome',
    'departement',
    'gender'])


class FhsTestCase(unittest.TestCase):
    """Unit tests for FHS functions."""

    @mock.patch(fhs.__name__ + '.migration_helpers.flatten_iterator')
    def test_job_seeker_iterator(self, mock_flatten_iterator: mock.MagicMock) -> None:
        """Basic usage of job_seeker_iterator."""

        def _flatten_iterator(filename: str) -> typing.Iterator[typing.Dict[str, typing.Any]]:
            if '/de.csv' in filename:
                return iter([
                    {
                        'IDX': '1',
                        'ROME': 'foo',
                        'DATINS': datetime.date(2015, 12, 1),
                        '__file__': filename.replace('*', 'Reg01'),
                    },
                    {
                        'IDX': '15',
                        'ROME': 'foo',
                        'DATINS': datetime.date(2015, 12, 1),
                        '__file__': filename.replace('*', 'Reg01'),
                    },
                    {
                        'IDX': '2',
                        'ROME': 'foo',
                        'DATINS': datetime.date(2015, 12, 1),
                        '__file__': filename.replace('*', 'Reg21'),
                    },
                ])
            if '/e0.csv' in filename:
                return iter([
                    {
                        'IDX': '1',
                        'HOURS': 42,
                        'MOIS': '201510',
                        '__file__': filename.replace('*', 'Reg01'),
                    },
                    {
                        'IDX': '1',
                        'HOURS': 43,
                        'MOIS': '201510',
                        '__file__': filename.replace('*', 'Reg01'),
                    },
                    {
                        'IDX': '2',
                        'HOURS': 27,
                        'MOIS': '201510',
                        '__file__': filename.replace('*', 'Reg21'),
                    },
                ])
            raise ValueError('Called with "{}"'.format(filename))
        mock_flatten_iterator.side_effect = _flatten_iterator

        seekers = list(
            fhs.job_seeker_iterator('/folder/path/', tables=('de', 'e0')))
        data = [j._data for j in seekers]  # pylint: disable=protected-access
        self.assertEqual([
            {
                'de': [{
                    'IDX': '1',
                    'ROME': 'foo',
                    'DATINS': datetime.date(2015, 12, 1),
                    '__file__': '/folder/path/Reg01/de.csv',
                }],
                'e0': [
                    {
                        'IDX': '1',
                        'HOURS': 42,
                        'MOIS': '201510',
                        '__file__': '/folder/path/Reg01/e0.csv',
                    },
                    {
                        'IDX': '1',
                        'HOURS': 43,
                        'MOIS': '201510',
                        '__file__': '/folder/path/Reg01/e0.csv',
                    },
                ],
            },
            {
                'de': [{
                    'IDX': '15',
                    'ROME': 'foo',
                    'DATINS': datetime.date(2015, 12, 1),
                    '__file__': '/folder/path/Reg01/de.csv',
                }],
                'e0': [],
            },
            {
                'de': [{
                    'IDX': '2',
                    'ROME': 'foo',
                    'DATINS': datetime.date(2015, 12, 1),
                    '__file__': '/folder/path/Reg21/de.csv',
                }],
                'e0': [{
                    'IDX': '2',
                    'HOURS': 27,
                    'MOIS': '201510',
                    '__file__': '/folder/path/Reg21/e0.csv',
                }],
            },
        ], data)

    def test_job_seeker_key_idx(self) -> None:
        """Test of the IDX property of key created by job_seeker_key."""

        key = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '47',
        })
        self.assertEqual('47', str(key.IDX))

    def test_job_seeker_key_equality_across_tables(self) -> None:
        """Test that job_seeker_key creates equal keys across 2 FHS tables."""

        key_de = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '47',
        })
        key_e0 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/e0_ech201512.csv',
            'IDX': '47',
        })
        self.assertEqual(key_de, key_e0)

    def test_job_seeker_key_increasing(self) -> None:
        """Test that job_seeker_key creates increasing keys."""

        key_1 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '1',
        })
        key_2 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '2',
        })
        self.assertLess(key_1, key_2)

    def test_job_seeker_key_increasing_integers(self) -> None:
        """Test that job_seeker_key creates increasing keys for integers."""

        key_2 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '2',
        })
        key_15 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '15',
        })
        self.assertLess(key_2, key_15)

    def test_job_seeker_key_increasing_regions(self) -> None:
        """Test that job_seeker_key creates increasing keys across regions."""

        key_15_reg01 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg01/de_ech201512.csv',
            'IDX': '15',
        })
        key_2_reg02 = fhs.job_seeker_key({
            '__file__': '/folder/path/FHS 201512/Reg02/de_ech201512.csv',
            'IDX': '2',
        })
        self.assertLess(key_15_reg01, key_2_reg02)

    def test_extract_departement_id(self) -> None:
        """Basic usage of extract_departement_id."""

        departement_id = fhs.extract_departement_id('31555')
        self.assertEqual('31', departement_id)

    def test_extract_departement_id_oversee(self) -> None:
        """Test extract_departement_id on an oversee locality."""

        departement_id = fhs.extract_departement_id('97613')
        self.assertEqual('976', departement_id)


# TODO: Add more unit tests.


StateAtDateTestCase = collections.namedtuple(
    'TestCase', ['name', 'date', 'expect'])


class JobSeekerTestCase(unittest.TestCase):
    """Unit tests for the JobSeeker class."""

    def test_unemployment_a_periods(self) -> None:
        """Basic usage of unemployment_a_periods."""

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [{
                'DATINS': datetime.date(2015, 5, 1),
                'DATANN': datetime.date(2015, 5, 22),
                'CATREGR': '1',
            }],
            'e0': [],
        })
        periods = job_seeker.unemployment_a_periods()
        self.assertEqual(
            fhs.DateIntervals([(
                datetime.date(2015, 5, 1), datetime.date(2015, 5, 22),
                {'DATINS': datetime.date(2015, 5, 1),
                 'DATANN': datetime.date(2015, 5, 22),
                 'CATREGR': '1'})]),
            periods)

    def test_unemployment_a_periods_switching_to_b(self) -> None:
        """unemployment_a_periods when job seeker starts partial work."""

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [{
                'DATINS': datetime.date(2015, 5, 1),
                'DATANN': datetime.date(2015, 12, 22),
                'CATREGR': '1',
            }],
            'e0': [{'MOIS': '201510'}, {'MOIS': '201511'}, {'MOIS': '201512'}],
        })
        periods = job_seeker.unemployment_a_periods()
        self.assertEqual(
            fhs.DateIntervals([(
                datetime.date(2015, 5, 1), datetime.date(2015, 10, 1),
                {'DATINS': datetime.date(2015, 5, 1),
                 'DATANN': datetime.date(2015, 10, 1),
                 'CATREGR': '1',
                 'MOTANN': fhs.CancellationReason.STARTING_PART_TIME_WORK})]),
            periods)

    def test_unemployment_a_periods_useless_change(self) -> None:
        """unemployment_a_periods whith a change from CATREGR 1 to 2."""

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [
                {
                    'DATINS': datetime.date(2015, 5, 1),
                    'DATANN': datetime.date(2015, 12, 22),
                    'CATREGR': '1',
                    'MOTINS': 'aaa',
                    'MOTANN': 'bbb',
                },
                {
                    'DATINS': datetime.date(2015, 12, 22),
                    'DATANN': datetime.date(2015, 12, 31),
                    'CATREGR': '2',
                    'MOTINS': 'ccc',
                    'MOTANN': 'ddd',
                },
            ],
            'e0': [],
        })
        periods = job_seeker.unemployment_a_periods()
        self.assertEqual(
            fhs.DateIntervals([(
                datetime.date(2015, 5, 1), datetime.date(2015, 12, 31),
                {'DATINS': datetime.date(2015, 5, 1),
                 'DATANN': datetime.date(2015, 12, 31),
                 'CATREGR': '2',
                 'MOTINS': 'aaa',
                 'MOTANN': 'ddd'})]),
            periods)

    def test_unemployment_a_periods_switching_to_e(self) -> None:
        """unemployment_a_periods when job seeker starts a training."""

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [
                {
                    'DATINS': datetime.date(2015, 5, 1),
                    'DATANN': datetime.date(2015, 12, 22),
                    'CATREGR': '1',
                },
                {
                    'DATINS': datetime.date(2015, 12, 22),
                    'DATANN': datetime.date(2015, 12, 31),
                    'CATREGR': '5',
                },
            ],
            'e0': [],
        })
        periods = job_seeker.unemployment_a_periods()
        self.assertEqual(
            fhs.DateIntervals([(
                datetime.date(2015, 5, 1), datetime.date(2015, 12, 22),
                {'DATINS': datetime.date(2015, 5, 1),
                 'DATANN': datetime.date(2015, 12, 22),
                 'CATREGR': '1'})]),
            periods)

    def test_unemployment_a_periods_mistakenly_kicked_out(self) -> None:
        """unemployment_a_periods with a mistaken kick-out.

        Frequently some job seeker forget the required monthly updated of
        their data, or do not show up at a mandatory meeting with their
        counselor. When that happens Pôle Emploi kicks them out of their
        register (and stop the allowance). Usually the job seeker would then
        re-register very quickly to get their allowance back.

        We identify periods where a job seeker left the unemployment system
        for a short period, and treat such gaps as if they had never left.
        """

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [
                {
                    'DATINS': datetime.date(2015, 5, 1),
                    'DATANN': datetime.date(2015, 7, 31),
                    'CATREGR': '1',
                    'MOTINS': 'aaa',
                    'MOTANN': 'bbb',
                },
                {
                    'DATINS': datetime.date(2015, 8, 12),
                    'DATANN': datetime.date(2015, 10, 31),
                    'CATREGR': '1',
                    'MOTINS': 'ccc',
                    'MOTANN': 'ddd',
                },
                {
                    'DATINS': datetime.date(2015, 11, 13),
                    'DATANN': None,
                    'CATREGR': '1',
                    'MOTINS': 'eee',
                    'MOTANN': 'fff',
                },
            ],
            'e0': [],
        })
        # The first two periods should be merged, but not the last one.
        periods = job_seeker.unemployment_a_periods(cover_holes_up_to=12)
        self.assertEqual(
            fhs.DateIntervals([
                (datetime.date(2015, 5, 1), datetime.date(2015, 10, 31),
                 {'DATINS': datetime.date(2015, 5, 1),
                  'DATANN': datetime.date(2015, 10, 31),
                  'CATREGR': '1',
                  'MOTINS': 'aaa',
                  'MOTANN': 'ddd'}),
                (datetime.date(2015, 11, 13), None,
                 {'DATINS': datetime.date(2015, 11, 13),
                  'DATANN': None,
                  'CATREGR': '1',
                  'MOTINS': 'eee',
                  'MOTANN': 'fff'})]),
            periods)
        self.assertEqual(
            fhs.Period(
                datetime.date(2015, 5, 1), datetime.date(2015, 10, 31),
                {'DATINS': datetime.date(2015, 5, 1),
                 'DATANN': datetime.date(2015, 10, 31),
                 'CATREGR': '1',
                 'MOTINS': 'aaa',
                 'MOTANN': 'ddd'}),
            periods.first_contiguous_period())

    def test_state_at_date(self) -> None:
        """Basic usages of state_at_date."""

        job_seeker = fhs.JobSeeker(1, '01', {
            'de': [
                {
                    'DATINS': datetime.date(2015, 5, 1),
                    'DATANN': datetime.date(2015, 5, 22),
                    'CATREGR': '1',
                    'ROME': 'H1234',
                },
                {
                    'DATINS': datetime.date(2015, 6, 1),
                    'DATANN': datetime.date(2015, 6, 22),
                    'CATREGR': '1',
                    'ROME': 'A1001',
                },
            ],
        })
        first_state = {
            'DATINS': datetime.date(2015, 5, 1),
            'DATANN': datetime.date(2015, 5, 22),
            'CATREGR': '1',
            'ROME': 'H1234',
        }
        tests = [
            StateAtDateTestCase(
                name='In the middle',
                date=datetime.date(2015, 5, 10),
                expect=first_state),
            StateAtDateTestCase(
                name='Before unemployment',
                date=datetime.date(2014, 5, 10),
                expect=None),
            StateAtDateTestCase(
                name='After unemployment',
                date=datetime.date(2016, 5, 10),
                expect=None),
            StateAtDateTestCase(
                name='Between 2 unemployment periods',
                date=datetime.date(2015, 5, 30),
                expect=None),
            StateAtDateTestCase(
                name='First day of unemployment',
                date=datetime.date(2015, 5, 1),
                expect=first_state),
            StateAtDateTestCase(
                name='First day of employment',
                date=datetime.date(2015, 5, 22),
                expect=None),
        ]
        for test in tests:
            state = job_seeker.state_at_date(test.date)
            self.assertEqual(test.expect, state, msg=test.name)

    def test_get_rome_per_period(self) -> None:
        """Basic usages of get_rome_per_period."""

        now = datetime.date(2015, 12, 1)
        job_seeker = fhs.JobSeeker(1, '21', {
            'de': [
                {
                    'IDX': '1.0',
                    'DATINS': datetime.date(2013, 5, 1),
                    'DATANN': datetime.date(2013, 5, 22),
                    'CATREGR': '1',
                    'ROME': 'H1234',
                    'DEPCOM': 'Here',
                    'MOTINS': 'aaa',
                    'SEXE': '1',
                },
                {
                    'IDX': '1.0',
                    'DATINS': datetime.date(2015, 6, 1),
                    'DATANN': datetime.date(2015, 6, 22),
                    'CATREGR': '1',
                    'ROME': 'A1001',
                    'DEPCOM': 'There',
                    'MOTINS': 'aaa',
                    'SEXE': '1',
                },
            ],
            'rome': [
                {
                    'IDX': '1.0',
                    'JOURDV': datetime.date(2013, 5, 1),
                    'JOURFV': datetime.date(2013, 5, 10),
                    'ROME': 'N1234',
                }
            ]
        })

        periods = list(job_seeker.get_rome_per_period(12, 'abc', now))
        self.assertEqual(
            [
                _JobseekerCriteria(
                    jobseeker_unique_id='1_21',
                    code_rome='N1234',
                    departement=None,
                    gender=None,
                ),
                _JobseekerCriteria(
                    jobseeker_unique_id='1_21',
                    code_rome='H1234',
                    departement='Here',
                    gender='1',
                ),
                _JobseekerCriteria(
                    jobseeker_unique_id='1_21',
                    code_rome='A1001',
                    departement='There',
                    gender='1',
                )
            ],
            periods)

    def test_get_training_periods(self) -> None:
        """Basic usages of all_training_periods."""

        job_seeker = fhs.JobSeeker(1, '21', {
            'de': [
                {
                    'IDX': '1.0',
                    'DATINS': datetime.date(2013, 5, 1),
                    'DATANN': datetime.date(2013, 5, 22),
                    'CATREGR': '1',
                    'ROME': 'H1234',
                    'DEPCOM': 'Here',
                    'MOTINS': 'aaa',
                    'SEXE': '1',
                },
                {
                    'IDX': '1.0',
                    'DATINS': datetime.date(2015, 5, 1),
                    'DATANN': datetime.date(2015, 5, 22),
                    'CATREGR': '1',
                    'ROME': 'B1234',
                    'DEPCOM': 'There',
                    'MOTINS': 'aaa',
                    'SEXE': '1',
                }
            ],
            'p2': [
                {
                    'IDX': '1.0',
                    'P2DATDEB': datetime.date(2013, 5, 25),
                    'P2DATFIN': datetime.date(2013, 5, 30),
                    'FORMACOD': '42745',
                    'OBJFORM': '1',
                    'P2NIVFOR': 1,
                },
                {
                    'IDX': '1.0',
                    'P2DATDEB': datetime.date(2016, 5, 1),
                    'P2DATFIN': datetime.date(2016, 5, 10),
                    'FORMACOD': '31685',
                    'OBJFORM': 'A',
                    'P2NIVFOR': 2,
                }
            ]
        })

        periods = job_seeker.all_training_periods()
        expected_periods = fhs.DateIntervals([
            (
                datetime.date(2013, 5, 25),
                datetime.date(2013, 5, 30),
                {
                    'IDX': '1.0',
                    'P2DATDEB': datetime.date(2013, 5, 25),
                    'P2DATFIN': datetime.date(2013, 5, 30),
                    'FORMACOD': '42745',
                    'OBJFORM': '1',
                    'ROME': 'H1234',
                    'DEPCOM': 'Here',
                    'P2NIVFOR': 1,
                }
            ),
            (
                datetime.date(2016, 5, 1),
                datetime.date(2016, 5, 10),
                {
                    'IDX': '1.0',
                    'P2DATDEB': datetime.date(2016, 5, 1),
                    'P2DATFIN': datetime.date(2016, 5, 10),
                    'FORMACOD': '31685',
                    'OBJFORM': 'A',
                    'ROME': 'B1234',
                    'DEPCOM': 'There',
                    'P2NIVFOR': 2,
                }
            ),

        ])

        self.assertEqual(expected_periods, periods)


if __name__ == '__main__':
    unittest.main()
