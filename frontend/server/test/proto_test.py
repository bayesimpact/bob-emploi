"""Unit tests for the bob_emploi.frontend.proto module."""

import datetime
import time
import threading
import unittest
from unittest import mock

from google.protobuf import json_format
import mongomock

from bob_emploi.common.python.test import nowmock
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.test.testdata import test_pb2


class CacheMongoTestCase(unittest.TestCase):
    """Unit tests for the MongoCachedCollection class."""

    def setUp(self) -> None:
        """Set up mock environment."""

        super().setUp()
        self._db = mongo.NoPiiMongoDatabase(
            mongomock.MongoClient().get_database('test'))
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

    def test_db_change(self) -> None:
        """Test that collection cache is busted when the database is changed."""

        first_db = mongo.NoPiiMongoDatabase(
            mongomock.MongoClient('localhost').get_database('test'))
        first_db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'Original content, hopefully cached'},
        )

        self._collection.get_collection(first_db)

        second_db = mongo.NoPiiMongoDatabase(
            mongomock.MongoClient('localhost').get_database('test'))
        second_db.basic.insert_one(
            {'_id': 'A124', 'multipleWords': 'A124', 'name': 'New content in the DB'},
        )
        second_collection = self._collection.get_collection(second_db)

        cache_busted_a124 = second_collection.get('A124')
        assert cache_busted_a124
        self.assertEqual('New content in the DB', cache_busted_a124.name)

    @nowmock.patch()
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

    def test_cache_resists_long_get_values(self) -> None:
        """CachedCollection does not crash on concurrent access."""

        # This test is a bit complex: we want to see what happens when a thread accesses
        # a CachedCollection while another one is already trying to get values.
        #
        # Our _get_values function is blocking for the first thread, but very quick for the second
        # one. Here is the timing:
        #
        # STARTING
        # - start a thread
        #   the thread tries to access the collection and call _get_values
        #   the thread warns the event bus that it's WAITING
        # - meanwhile the main thread waits for the thread above to be waiting
        #   it then tries to access the collection and call _get_values
        #   it should successfully get an answer (before this test it choked on None)
        #   it then warn the thread that it's done using UNBLOCK
        #   it waits for the thread to join (finish its own execution)
        # - the thread is unblocked and finishes quickly.

        events = ['STARTING']

        def _get_values() -> dict[str, int]:
            is_first_thread = len(events) <= 1
            if is_first_thread:
                events.append('WAITING')
                while len(events) < 3:
                    time.sleep(0.001)
            return {'a': 1}

        def _access_collection(collection: proto.CachedCollection[int]) -> None:
            assert collection['a'] == 1

        collection = proto.CachedCollection[int](_get_values)

        self.addCleanup(lambda: events.append('CLEAN UP'))

        thread = threading.Thread(target=_access_collection, args=(collection,))
        thread.start()

        while len(events) < 2:
            time.sleep(0.001)

        self.assertEqual(1, collection['a'])

        events.append('UNBLOCK')
        thread.join(timeout=1)


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
        self._db = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        proto.cache.clear()

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

    @nowmock.patch()
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

    def test_cache_can_be_cleared(self) -> None:
        """Cache can be cleared."""

        self._db.collection.insert_one({
            '_id': 'id',
            'name': 'document',
        })
        fetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert fetched
        self._db.collection.replace_one({}, {'name': 'updated document'})
        proto.cache.clear()
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', 'id')
        assert refetched
        self.assertEqual('updated document', refetched.name)

    def test_cache_is_finite(self) -> None:
        """Only the last cached values are kept."""

        self._db.collection.insert_many([{
            '_id': str(i),
            'name': f'{i}th document',
        } for i in range(1000)])
        for i in range(1000):
            proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', str(i))
        self._db.collection.drop()
        self._db.collection.insert_one({'_id': '0', 'name': 'updated 0th document'})
        refetched = proto.fetch_from_mongo(self._db, test_pb2.Simple, 'collection', '0')
        assert refetched
        self.assertEqual('updated 0th document', refetched.name)


if __name__ == '__main__':
    unittest.main()
