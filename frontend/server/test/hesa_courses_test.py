"""Tests for the bob_emploi.frontend.carif module."""

from os import path
import unittest

import requests_mock

from bob_emploi.frontend.server import hesa_courses


@requests_mock.mock()
class CarifTestCase(unittest.TestCase):
    """Unit tests for the carif module."""

    _hesa_json_response: str

    @classmethod
    def setUpClass(cls) -> None:
        courses_file_name = path.join(path.dirname(__file__), 'testdata/hesa_courses.json')
        with open(courses_file_name, encoding='utf-8') as courses_file:
            cls._hesa_json_response = courses_file.read()

    def test_get_trainings(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Basic usage of get_trainings for UK."""

        mock_requests.get(
            'http://api.lmiforall.org.uk/api/v1/hesa/courses/3113', text=self._hesa_json_response)

        trainings = hesa_courses.get_trainings('3113')

        self.assertEqual(
            [
                '(H3) Mechanical engineering',
                '(H4) Aerospace engineering',
            ],
            [t.name for t in trainings])

    def test_error_code(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Error 500 on lmiforall."""

        mock_requests.get(
            'http://api.lmiforall.org.uk/api/v1/hesa/courses/3113',
            status_code=500,
            text=self._hesa_json_response)

        trainings = hesa_courses.get_trainings('3113')

        self.assertEqual([], trainings)

    def test_empty_response(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Missing text when calling lmiforall."""

        mock_requests.get('http://api.lmiforall.org.uk/api/v1/hesa/courses/4242', text='')

        trainings = hesa_courses.get_trainings('4242')

        self.assertEqual([], trainings)


if __name__ == '__main__':
    unittest.main()
