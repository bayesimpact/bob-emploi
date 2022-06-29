"""Unit tests for the bob_emploi.frontend.proto_flask module."""

import typing
import unittest
from urllib import parse

import flask
import werkzeug

from bob_emploi.frontend.server import proto_flask
from bob_emploi.frontend.server.test.testdata import test_pb2

app = flask.Flask(__name__)


class DecoratorTestCase(unittest.TestCase):
    """Unit tests for the server's decorator."""

    def test_proto_api(self) -> None:
        """Basic usage of @flask_api."""

        @proto_flask.api(test_pb2.Simple)
        def _func() -> test_pb2.Simple:
            message = test_pb2.Simple()
            message.name = 'A1234'
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      content_type='application/json'):
            self.assertEqual('{\n  "name": "A1234"\n}', _func().get_data(as_text=True))

    def test_proto_api_wrong_return(self) -> None:
        """Check that @flask_api enforces the type of the return value."""

        @proto_flask.api(test_pb2.Different)
        def _func() -> test_pb2.Different:
            message = test_pb2.Simple()
            message.name = 'A1234'
            return typing.cast(test_pb2.Different, message)

        self.assertRaises(TypeError, _func)

    def test_proto_api_in_type_post(self) -> None:
        """Check that @flask_api parses the input in a proto."""

        calls = []

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            calls.append(message)
            return message

        with app.test_request_context(method='POST',
                                      data='{"multipleWords": "A1234"}',
                                      content_type='application/json'):
            _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [message.multiple_words for message in calls])

    def test_proto_api_in_type_get(self) -> None:
        """Check that @flask_api parses the input in a proto."""

        calls = []

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            calls.append(message)
            return message

        query_string = 'data=' + parse.quote('{"multipleWords": "A1234"}')
        with app.test_request_context(method='GET', query_string=query_string,
                                      content_type='application/json'):
            _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [message.multiple_words for message in calls])

    def test_proto_api_wrong_field_in_type(self) -> None:
        """Check that a wrong field in proto raises a 422 error (not a 5xx)."""

        test_app = app.test_client()
        calls = []

        @app.route('/wrong_field', methods=['POST'])
        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _f(message: test_pb2.Simple) -> test_pb2.Simple:
            calls.append(message)
            return message

        response = test_app.post(
            '/wrong_field', data='{"nonExistentField": "A1234"}',
            content_type='application/json')

        self.assertEqual(422, response.status_code)
        self.assertIn(
            '&quot;bayes.bob.test.Simple&quot; has no field named '
            '&quot;nonExistentField&quot;',
            response.get_data(as_text=True))
        self.assertFalse(calls)

    def test_proto_api_no_out_type(self) -> None:
        """Check that @flask_api can work without an out_type."""

        calls = []

        @proto_flask.api(in_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> str:
            calls.append(message)
            return message.name + r' \o/'

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      content_type='application/json'):
            result = _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [message.name for message in calls])
        self.assertEqual(r'A1234 \o/', result)

    def test_proto_api_unicode_error(self) -> None:
        """Check that @flask_api does not choke too hard on a unicode error."""

        test_app = app.test_client()
        calls = []

        @app.route('/wrong_encoding', methods=['POST'])
        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _unused_pass_through(message: test_pb2.Simple) -> test_pb2.Simple:
            calls.append(message)
            return message

        response = test_app.post(
            '/wrong_encoding', data=b'{"name" : "Fer \xe0 repasser"}',
            content_type='application/json')

        self.assertEqual(422, response.status_code)
        self.assertFalse(calls)

    def test_proto_api_wire_format_output(self) -> None:
        """Wire format for output of @flask_api."""

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      headers=[('Accept', 'application/x-protobuf-base64')],
                                      content_type='application/json'):
            response = _func()  # pylint: disable=no-value-for-parameter
            assert not isinstance(response, str)
            assert not isinstance(response, tuple)
            self.assertEqual('CgVBMTIzNA==', response.get_data(as_text=True).strip())

    def test_proto_api_wire_format_input(self) -> None:
        """Wire format for output of @flask_api."""

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='CgVBMTIzNA==',
                                      content_type='application/x-protobuf-base64'):
            response = _func()  # pylint: disable=no-value-for-parameter
            self.assertEqual('{\n  "name": "A1234"\n}', response.get_data(as_text=True))

    def test_proto_api_wire_format_input_errors(self) -> None:
        """Errors with wire format for input of @flask_api."""

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      # Broken base64 string.
                                      data='gVBMTIzNA==',
                                      content_type='application/x-protobuf-base64'):
            with self.assertRaises(werkzeug.exceptions.UnprocessableEntity):
                _func()  # pylint: disable=no-value-for-parameter

        with app.test_request_context(method='POST',
                                      # 'abcd' encoded in base64.
                                      data='YWJjZA==',
                                      content_type='application/x-protobuf-base64'):
            with self.assertRaises(werkzeug.exceptions.UnprocessableEntity):
                _func()  # pylint: disable=no-value-for-parameter

    def test_proto_api_default_format_output(self) -> None:
        """The default format for output of @flask_api json."""

        @proto_flask.api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      headers=[('Accept', '*/*')],
                                      content_type='application/json'):
            self.assertEqual(
                '{\n  "name": "A1234"\n}', _func().get_data(as_text=True))  # pylint: disable=no-value-for-parameter


if __name__ == '__main__':
    unittest.main()
