"""Unit tests for the bob_emploi.frontend.proto module."""

import datetime
import unittest
from urllib import parse

import flask
import mock
import mongomock

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import job_pb2

app = flask.Flask(__name__)  # pylint: disable=invalid-name


class DecoratorTestCase(unittest.TestCase):
    """Unit tests for the server's decorator."""

    def test_proto_api(self):
        """Basic usage of @flask_api."""

        @proto.flask_api(job_pb2.JobGroup)
        def _func():
            job = job_pb2.JobGroup()
            job.rome_id = 'A1234'
            return job

        self.assertEqual('{\n  "romeId": "A1234"\n}', _func())

    def test_proto_api_wrong_return(self):
        """Check that @flask_api enforces the type of the return value."""

        @proto.flask_api(job_pb2.Job)
        def _func():
            job = job_pb2.JobGroup()
            job.rome_id = 'A1234'
            return job

        self.assertRaises(TypeError, _func)

    def test_proto_api_in_type_post(self):
        """Check that @flask_api parses the input in a proto."""

        calls = []

        @proto.flask_api(in_type=job_pb2.JobGroup, out_type=job_pb2.JobGroup)
        def _func(job_group):
            calls.append(job_group)
            return job_group

        with app.test_request_context(method='POST',
                                      data='{"romeId": "A1234"}',
                                      content_type='application/json'):
            _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [job_group.rome_id for job_group in calls])

    def test_proto_api_in_type_get(self):
        """Check that @flask_api parses the input in a proto."""

        calls = []

        @proto.flask_api(in_type=job_pb2.JobGroup, out_type=job_pb2.JobGroup)
        def _func(job_group):
            calls.append(job_group)
            return job_group

        query_string = 'data={}'.format(parse.quote('{"romeId": "A1234"}'))
        with app.test_request_context(method='GET', query_string=query_string,
                                      content_type='application/json'):
            _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [job_group.rome_id for job_group in calls])

    def test_proto_api_wrong_field_in_type(self):
        """Check that a wrong field in proto raises a 422 error (not a 5xx)."""

        test_app = app.test_client()
        calls = []

        @app.route('/wrong_field', methods=['POST'])
        @proto.flask_api(in_type=job_pb2.JobGroup, out_type=job_pb2.JobGroup)
        def _func(job_group):  # pylint: disable=unused-variable
            calls.append(job_group)
            return job_group

        response = test_app.post(
            '/wrong_field', data='{"nonExistentField": "A1234"}',
            content_type='application/json')

        self.assertEqual(422, response.status_code)
        self.assertIn(
            '&quot;JobGroup&quot; has no field named '
            '&quot;nonExistentField&quot;',
            response.get_data(as_text=True))
        self.assertFalse(calls)

    def test_proto_api_no_out_type(self):
        """Check that @flask_api can work without an out_type."""

        calls = []

        @proto.flask_api(in_type=job_pb2.JobGroup)
        def _func(job_group):
            calls.append(job_group)
            return job_group.rome_id + r' \o/'

        with app.test_request_context(method='POST',
                                      data='{"romeId": "A1234"}',
                                      content_type='application/json'):
            result = _func()  # pylint: disable=no-value-for-parameter

        self.assertEqual(['A1234'], [job_group.rome_id for job_group in calls])
        self.assertEqual(r'A1234 \o/', result)


class CacheMongoTestCase(unittest.TestCase):
    """Unit tests for the MongoCachedCollection class."""

    def setUp(self):
        """Set up mock environment."""

        super(CacheMongoTestCase, self).setUp()
        self._db = mongomock.MongoClient().get_database('test')
        self._collection = proto.MongoCachedCollection(job_pb2.JobGroup, 'basic')

    def test_basic(self):
        """Test basic usage."""

        self._db.basic.insert_many([
            {'_id': 'A123', 'romeId': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Job Group 2'},
        ])

        cache = [g for g in self._collection.get_collection(self._db)]

        self.assertEqual(['A123', 'A124'], [g.rome_id for g in cache])
        self.assertEqual('Job Group 2', cache[1].name)

        # Check that the cached collection handles `a in collection` properly.
        self.assertIn('A123', self._collection.get_collection(self._db))
        self.assertNotIn('Job Group 1', self._collection.get_collection(self._db))

        # Update the collection behind the scene.
        self._db.basic.delete_one({'_id': 'A123'})

        # The cache computed before the change should not have changed even if
        # we call the function again.
        cache = [g for g in self._collection.get_collection(self._db)]
        self.assertEqual(['A123', 'A124'], [g.rome_id for g in cache])

        self._collection.reset_cache()

        cache = [g for g in self._collection.get_collection(self._db)]
        self.assertEqual(['A124'], [g.rome_id for g in cache])

    def test_as_dict(self):
        """Test use with a dict cache."""

        self._db.basic.insert_many([
            {'_id': 'A123', 'romeId': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Job Group 2'},
        ])

        cache = self._collection.get_collection(self._db)

        self.assertEqual(set(['A123', 'A124']), set(cache.keys()))
        self.assertEqual('Job Group 2', cache.get('A124').name)

    def test_really_caches(self):
        """Test that collection is actually cached."""

        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.remove({})
        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'New content in the DB'},
        )
        self.assertEqual('Original content, hopefully cached', collection.get('A124').name)

    @mock.patch(proto.now.__name__ + '.get')
    def test_time_deprecates_cache(self, mock_now):
        """Test that after some time, cache is deprecated"""

        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)

        mock_now.return_value = datetime.datetime(2018, 2, 2, 0)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.remove({})
        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'New content in the DB'},
        )
        mock_now.return_value = datetime.datetime(2018, 2, 2, 0, 30)
        self.assertEqual('Original content, hopefully cached', collection.get('A124').name)

        mock_now.return_value = datetime.datetime(2018, 2, 2, 2)
        self.assertEqual('New content in the DB', collection.get('A124').name)

    def test_force_deprecated_cache(self):
        """Test global cache deprecation."""

        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Original content, hopefully cached'},
        )

        collection = self._collection.get_collection(self._db)
        self.assertEqual(set(['A124']), set(collection.keys()))

        self._db.basic.remove({})
        self._db.basic.insert_one(
            {'_id': 'A124', 'romeId': 'A124', 'name': 'New content in the DB'},
        )

        self.assertEqual('Original content, hopefully cached', collection.get('A124').name)

        proto.CachedCollection.update_cache_version()
        self.assertEqual('New content in the DB', collection.get('A124').name)


@mock.patch(proto.__name__ + '._IS_TEST_ENV', new=False)
class ParseFromMongoTestCase(unittest.TestCase):
    """Unit tests for the parse_from_mongo function."""

    def test_unknown_field(self):
        """Unknown fields do not make the function choke."""

        job_group = job_pb2.JobGroup()
        self.assertTrue(proto.parse_from_mongo({'romeId': 'A123', 'unknownField': 14}, job_group))
        self.assertEqual('A123', job_group.rome_id)

    def test_timestamp(self):
        """Parse correctly Python timestamps."""

        action = action_pb2.Action()
        now = datetime.datetime.now()
        self.assertTrue(proto.parse_from_mongo({'createdAt': now}, action))
        self.assertEqual(now, action.created_at.ToDatetime())

    @mock.patch(proto.__name__ + '.logging.warning')
    def test_weird_objects(self, mock_warning):
        """Raises a TypeError when an object is not of the right type."""

        job_group = job_pb2.JobGroup()
        self.assertFalse(proto.parse_from_mongo({'romeId': 123}, job_group))
        mock_warning.assert_called_once()
        self.assertEqual(
            'Error %s while parsing a JSON dict for proto type %s:\n%s',
            mock_warning.call_args[0][0])
        self.assertEqual(
            'Failed to parse romeId field: expected string or bytes-like object.',
            str(mock_warning.call_args[0][1]))
        self.assertEqual('JobGroup', str(mock_warning.call_args[0][2]))
        self.assertEqual("{'romeId': 123}", str(mock_warning.call_args[0][3]))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
