"""Unit tests for the bob_emploi.frontend.proto module."""
import datetime
import unittest
from urllib import parse

import flask
import mongomock

from bob_emploi.frontend import proto
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

        with app.test_request_context(method='GET',
                                      query_string='data=%s' % parse.quote('{"romeId": "A1234"}'),
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
    """Unit tests for the cache_mongo_collection function."""

    def setUp(self):
        """Set up mock environment."""
        super(CacheMongoTestCase, self).setUp()
        self._db = mongomock.MongoClient().get_database('test')

    def test_basic(self):
        """Test basic usage."""
        self._db.basic.insert_many([
            {'_id': 'A123', 'romeId': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Job Group 2'},
        ])

        cache = []
        proto.cache_mongo_collection(self._db.basic.find, cache, job_pb2.JobGroup)

        self.assertEqual(['A123', 'A124'], [g.rome_id for g in cache])
        self.assertEqual('A123', cache[0].rome_id)
        self.assertEqual('Job Group 2', cache[1].name)

        # Update the collection behind the scene.
        self._db.basic.delete_one({'_id': 'A123'})

        # The cache computed before the change should not have changed even if
        # we call the function again.
        proto.cache_mongo_collection(self._db.basic.find, cache, job_pb2.JobGroup)
        self.assertEqual(['A123', 'A124'], [g.rome_id for g in cache])

        # If the function is called with an empty cache it gets populated with
        # the updated values.
        cache2 = []
        proto.cache_mongo_collection(self._db.basic.find, cache2, job_pb2.JobGroup)
        self.assertEqual(['A124'], [g.rome_id for g in cache2])

    def test_as_dict(self):
        """Test use with a dict cache."""
        self._db.basic.insert_many([
            {'_id': 'A123', 'romeId': 'A123', 'name': 'Job Group 1'},
            {'_id': 'A124', 'romeId': 'A124', 'name': 'Job Group 2'},
        ])

        cache = {}
        proto.cache_mongo_collection(self._db.basic.find, cache, job_pb2.JobGroup)

        self.assertEqual(set(['A123', 'A124']), set(cache))
        self.assertEqual('Job Group 2', cache['A124'].name)


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

    def test_weird_objects(self):
        """Raises a TypeError when an object is not proto compatible."""
        job_group = job_pb2.JobGroup()
        self.assertRaises(
            TypeError,
            proto.parse_from_mongo,
            # self is a TestCase which is not compatible with any proto type.
            {'testCase': self},
            job_group)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
