"""Unit tests for the bob_emploi.frontend.proto module."""

import datetime
import unittest
from unittest import mock
from urllib import parse

import flask
from google.protobuf import json_format
import mongomock
import werkzeug

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.test.testdata import test_pb2

app = flask.Flask(__name__)

# TODO(pascal): Remove the type ignore once flask has proper typing for decorators.


class DecoratorTestCase(unittest.TestCase):
    """Unit tests for the server's decorator."""

    def test_proto_api(self) -> None:
        """Basic usage of @flask_api."""

        @proto.flask_api(test_pb2.Simple)
        def _func() -> test_pb2.Simple:
            message = test_pb2.Simple()
            message.name = 'A1234'
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      content_type='application/json'):
            self.assertEqual('{\n  "name": "A1234"\n}', _func())

    def test_proto_api_wrong_return(self) -> None:
        """Check that @flask_api enforces the type of the return value."""

        @proto.flask_api(test_pb2.Different)
        def _func() -> test_pb2.Simple:
            message = test_pb2.Simple()
            message.name = 'A1234'
            return message

        self.assertRaises(TypeError, _func)

    def test_proto_api_in_type_post(self) -> None:
        """Check that @flask_api parses the input in a proto."""

        calls = []

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
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

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
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
        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _f(message: test_pb2.Simple) -> test_pb2.Simple:  # pylint: disable=unused-variable
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

        @proto.flask_api(in_type=test_pb2.Simple)
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
        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
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

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      headers=[('Accept', 'application/x-protobuf-base64')],
                                      content_type='application/json'):
            response = _func()  # pylint: disable=no-value-for-parameter
            self.assertEqual('CgVBMTIzNA==', response.get_data(as_text=True).strip())

    def test_proto_api_wire_format_input(self) -> None:
        """Wire format for output of @flask_api."""

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='CgVBMTIzNA==',
                                      content_type='application/x-protobuf-base64'):
            self.assertEqual(
                '{\n  "name": "A1234"\n}', _func())  # pylint: disable=no-value-for-parameter

    def test_proto_api_wire_format_input_errors(self) -> None:
        """Errors with wire format for input of @flask_api."""

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
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

        @proto.flask_api(in_type=test_pb2.Simple, out_type=test_pb2.Simple)
        def _func(message: test_pb2.Simple) -> test_pb2.Simple:
            return message

        with app.test_request_context(method='POST',
                                      data='{"name": "A1234"}',
                                      headers=[('Accept', '*/*')],
                                      content_type='application/json'):
            self.assertEqual(
                '{\n  "name": "A1234"\n}', _func())  # pylint: disable=no-value-for-parameter


class CacheMongoTestCase(unittest.TestCase):
    """Unit tests for the MongoCachedCollection class."""

    def setUp(self) -> None:
        """Set up mock environment."""

        super().setUp()
        self._db = mongomock.MongoClient().get_database('test')
        self._collection: proto.MongoCachedCollection[test_pb2.Simple] = \
            proto.MongoCachedCollection(test_pb2.Simple, 'basic')

    def test_basic(self) -> None:
        """Test basic usage."""

        self._db.basic.insert_many([
            {'_id': 'A123', 'multipleWords': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Job Group 2'},
        ])

        cache = [g for g in self._collection.get_collection(self._db)]

        self.assertEqual(['A123', 'A124'], [g.multiple_words for g in cache])
        self.assertEqual('Job Group 2', cache[1].name)

        # Check that the cached collection handles `a in collection` properly.
        self.assertIn('A123', self._collection.get_collection(self._db))
        self.assertNotIn('Job Group 1', self._collection.get_collection(self._db))

        # Update the collection behind the scene.
        self._db.basic.delete_one({'_id': 'A123'})

        # The cache computed before the change should not have changed even if
        # we call the function again.
        cache = [g for g in self._collection.get_collection(self._db)]
        self.assertEqual(['A123', 'A124'], [g.multiple_words for g in cache])

        self._collection.reset_cache()

        cache = [g for g in self._collection.get_collection(self._db)]
        self.assertEqual(['A124'], [g.multiple_words for g in cache])

    def test_as_dict(self) -> None:
        """Test use with a dict cache."""

        self._db.basic.insert_many([
            {'_id': 'A123', 'multipleWords': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Job Group 2'},
        ])

        cache = self._collection.get_collection(self._db)
        self.assertFalse(cache.is_cached)

        self.assertEqual(set(['A123', 'A124']), set(cache.keys()))
        self.assertTrue(cache.is_cached)

        cache_a124 = cache.get('A124')
        assert cache_a124
        self.assertEqual('Job Group 2', cache_a124.name)

    def test_update_func(self) -> None:
        """Test use with an update function."""

        self._db.basic.insert_many([
            {'_id': 'A123', 'name': 'First one'},
            {'_id': 'A124', 'name': 'Second one'},
        ])

        def _update_func(message: test_pb2.Simple, message_id: str) -> None:
            message.multiple_words = f'{message_id} = {message.name}'

        collection: proto.MongoCachedCollection[test_pb2.Simple] = \
            proto.MongoCachedCollection(test_pb2.Simple, 'basic', update_func=_update_func)
        cache = collection.get_collection(self._db)

        cache_a124 = cache.get('A124')
        assert cache_a124
        self.assertEqual('Second one', cache_a124.name)
        self.assertEqual('A124 = Second one', cache_a124.multiple_words)

    def test_really_caches(self) -> None:
        """Test that collection is actually cached."""

        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.drop()
        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'New content in the DB'},
        )
        cache_a124 = collection.get('A124')
        assert cache_a124
        self.assertEqual('Original content, hopefully cached', cache_a124.name)

    @mock.patch(proto.now.__name__ + '.get')
    def test_time_deprecates_cache(self, mock_now: mock.MagicMock) -> None:
        """Test that after some time, cache is deprecated"""

        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)

        mock_now.return_value = datetime.datetime(2018, 2, 2, 0)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.drop()
        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'New content in the DB'},
        )
        mock_now.return_value = datetime.datetime(2018, 2, 2, 0, 30)
        cache_a124 = collection.get('A124')
        assert cache_a124
        self.assertEqual('Original content, hopefully cached', cache_a124.name)

        mock_now.return_value = datetime.datetime(2018, 2, 2, 2)
        cache_a124 = collection.get('A124')
        assert cache_a124
        self.assertEqual('New content in the DB', cache_a124.name)

    def test_force_deprecated_cache(self) -> None:
        """Test global cache deprecation."""

        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.drop()
        self._db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'New content in the DB'},
        )

        cache_a124 = collection.get('A124')
        assert cache_a124
        self.assertEqual('Original content, hopefully cached', cache_a124.name)

        proto.CachedCollection.update_cache_version()
        cache_a124 = collection.get('A124')
        assert cache_a124
        self.assertEqual('New content in the DB', cache_a124.name)


@mock.patch(proto.__name__ + '._IS_TEST_ENV', new=False)
class ParseFromMongoTestCase(unittest.TestCase):
    """Unit tests for the parse_from_mongo function."""

    @mock.patch('logging.warning', mock.MagicMock)
    def test_unknown_field(self) -> None:
        """Unknown fields do not make the function choke."""

        message = test_pb2.Simple()
        self.assertTrue(proto.parse_from_mongo({'name': 'A123', 'unknownField': 14}, message))
        self.assertEqual('A123', message.name)

    def test_unknown_field_in_test_env(self) -> None:
        """Unknown fields make the function choke in a test environment."""

        message = test_pb2.Simple()
        with mock.patch(proto.__name__ + '._IS_TEST_ENV', new=True):
            with self.assertRaises(json_format.ParseError) as error_context:
                proto.parse_from_mongo({'name': 'A123', 'unknownField': 14}, message)

        self.assertIn('no field named "unknownField"', str(error_context.exception))

    def test_timestamp(self) -> None:
        """Parse correctly Python timestamps."""

        message = test_pb2.Timely()
        now = datetime.datetime.now()
        self.assertTrue(proto.parse_from_mongo({
            'createdAt': now,
            'modifiedAt': [now, now],
        }, message))
        self.assertEqual(now, message.created_at.ToDatetime())
        self.assertEqual(now, message.modified_at[0].ToDatetime())

    @mock.patch(proto.__name__ + '.logging.warning')
    def test_weird_objects(self, mock_warning: mock.MagicMock) -> None:
        """Raises a TypeError when an object is not of the right type."""

        message = test_pb2.Simple()
        self.assertFalse(proto.parse_from_mongo({'name': 123}, message))
        mock_warning.assert_called_once()
        self.assertEqual(
            'Error %s while parsing a JSON dict for proto type %s:\n%s',
            mock_warning.call_args[0][0])
        self.assertEqual(
            'Failed to parse name field: expected string or bytes-like object.',
            str(mock_warning.call_args[0][1]))
        self.assertEqual('Simple', str(mock_warning.call_args[0][2]))
        self.assertEqual("{'name': 123}", str(mock_warning.call_args[0][3]))

    def test_id_field(self) -> None:
        """if an id_field is specified, its value is filled with _id from mongo."""

        message = test_pb2.Simple()
        self.assertTrue(
            proto.parse_from_mongo({'_id': 'Hello', 'multipleWords': '123'}, message, 'name'))
        self.assertEqual('Hello', message.name)


@mock.patch(proto.__name__ + '._IS_TEST_ENV', new=False)
class FetchFromMongoTestCase(unittest.TestCase):
    """Tests for the fetch_from_mongo function."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test
        proto.clear_mongo_fetcher_cache()

    def test_missing_doc(self) -> None:
        """Does not fetch anything if document does not exist."""

        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'unknown', 'any_id')
        self.assertFalse(fetched)

    def test_fetch_document(self) -> None:
        """Fetches a document if it exists."""

        self._db.collection.insert_one({
            '_id': 'id',
            'name': 'document',
        })
        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert fetched
        self.assertEqual('document', fetched.name)

    def test_cache_document(self) -> None:
        """Fetch a document only once if it exists."""

        self._db.collection.insert_one({
            '_id': 'id',
            'name': 'document',
        })
        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert fetched
        self._db.collection.replace_one({}, {'name': 'updated document'})
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        self.assertEqual(fetched, refetched)

    @mock.patch(proto.now.__name__ + '.get')
    def test_cache_has_ttl(self, mock_now: mock.MagicMock) -> None:
        """Cached document has only a short life."""

        mock_now.return_value = datetime.datetime(2018, 12, 19, 12)
        self._db.collection.insert_one({
            '_id': 'id',
            'name': 'document',
        })
        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert fetched
        self._db.collection.replace_one({}, {'name': 'updated document'})
        mock_now.return_value = datetime.datetime(2018, 12, 20)
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert refetched
        self.assertEqual('updated document', refetched.name)

    def cache_can_be_cleared(self) -> None:
        """Cache can be cleared."""

        self._db.collection.insert_one({
            '_id': 'id',
            'name': 'document',
        })
        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert fetched
        self._db.collection.replace_one({}, {'name': 'updated document'})
        proto.clear_mongo_fetcher_cache()
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert refetched
        self.assertEqual('updated document', refetched.name)

    def cache_is_finite(self) -> None:
        """Only the last cached values are kept."""

        self._db.collection.insert_many([{
            '_id': str(i),
            'name': f'{i}th document',
        } for i in range(1000)])
        for i in range(1000):
            proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', str(i))
        self._db.collection.drop()
        self._db.insert_one({'_id': '0', 'name': 'updated 0th document'})
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', '0')
        assert refetched
        self.assertEqual('updated, 0th document', refetched.name)


if __name__ == '__main__':
    unittest.main()
