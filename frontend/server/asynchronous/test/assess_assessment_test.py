"""Unit tests for the module assess_assessment."""

import datetime
import io
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.server.asynchronous import assess_assessment


class AssessAssessmentTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(assess_assessment.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch(
        assess_assessment.now.__name__ + '.get',
        new=mock.MagicMock(return_value=datetime.datetime(2017, 11, 16)))
    @mock.patch(assess_assessment.diagnostic.__name__ + '.diagnose')
    def test_main(self, mock_diagnose: mock.MagicMock) -> None:
        """Test the assessment of diagnostic."""

        full_diagnostic = diagnostic_pb2.Diagnostic(overall_score=10, text='Successful text')
        full_diagnostic.sub_diagnostics.extend([
            diagnostic_pb2.SubDiagnostic(
                score=1, text='1', topic=diagnostic_pb2.MARKET_DIAGNOSTIC),
            diagnostic_pb2.SubDiagnostic(
                score=2, text='2', topic=diagnostic_pb2.PROJECT_DIAGNOSTIC),
            diagnostic_pb2.SubDiagnostic(
                score=3, text='3', topic=diagnostic_pb2.PROFILE_DIAGNOSTIC),
        ])

        no_overall_score = diagnostic_pb2.Diagnostic(text='Successful text')
        no_overall_score.sub_diagnostics.extend(full_diagnostic.sub_diagnostics)

        no_overall_text = diagnostic_pb2.Diagnostic(overall_score=10)
        no_overall_text.sub_diagnostics.extend(full_diagnostic.sub_diagnostics)

        missing_sub_diagnostic = diagnostic_pb2.Diagnostic(overall_score=10, text='Successful text')
        missing_sub_diagnostic.sub_diagnostics.extend(full_diagnostic.sub_diagnostics[:2])

        mock_diagnose.side_effect = [
            (full_diagnostic, []),
            (no_overall_score, []),
            (no_overall_text, [1, 3]),
            (missing_sub_diagnostic, []),
            (full_diagnostic, None),
        ]

        self._db.use_case.insert_many([
            {
                'poolName': '2017-10-11_test',
                'title': 'Successful',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-10-11_00',
                'indexInPool': 0,
                'poolName': '2017-10-11',
                'title': 'Successful',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-11-11_01',
                'indexInPool': 1,
                'poolName': '2017-11-11',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-11-11_02',
                'indexInPool': 2,
                'poolName': '2017-11-11',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-11-11_03',
                'indexInPool': 3,
                'poolName': '2017-11-11',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-11-11_04',
                'indexInPool': 4,
                'poolName': '2017-11-11',
                'user_data': {
                    'projects': [{}],
                },
            },
            {
                '_id': '2017-11-11_05',
                'indexInPool': 5,
                'poolName': '2017-11-11',
                'user_data': {
                    'projects': [{}],
                },
            },
        ])

        out = io.StringIO()
        assess_assessment.main(['-d', '7', '-e', '1'], out=out)
        result = out.getvalue().split('\n')
        self.assertEqual('5 use cases tested', result.pop(0))
        self.assertEqual('1 use case successfully assessed', result.pop(0))
        self.assertEqual('Success rate: 20.0%', result.pop(0))
        empty_row = result.pop()
        self.assertFalse(empty_row)
        example = result.pop()
        expected_examples_url = [
            '/eval/2017-11-11_01?poolName=2017-11-11',
            '/eval/2017-11-11_02?poolName=2017-11-11',
            '/eval/2017-11-11_03?poolName=2017-11-11',
            '/eval/2017-11-11_04?poolName=2017-11-11',
        ]
        self.assertTrue(any(
            relative_url in example for relative_url in expected_examples_url), msg=example)
        example_missing_fields = result.pop()
        self.assertTrue(example_missing_fields.startswith('Missing field'))
        expected_missing_fields = [
            '"text: sentence 3"',
            '"subdiagnostic: PROFILE_DIAGNOSTIC"',
            '"score"',
            '"overall"',
        ]
        self.assertTrue(any(
            missing_field in example_missing_fields
            for missing_field in expected_missing_fields), msg=example_missing_fields)
        self.assertEqual('Example of 1 failed use case:', result.pop())


if __name__ == '__main__':
    unittest.main()
