"""Unit tests for the bob_emploi.lib.mongo module."""

import datetime
import unittest
from os import path
import tempfile

import json
import mock
import mongomock
import pymongo
import gflags

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import user_pb2


def _my_importer_func(arg1):
    """A basic importer.

    Args:
        arg1: doc for the first arg.

    Returns:
        a single value to import.
    """

    return [{'arg1': arg1, 'dummy': 2}]


class ImporterMainTestCase(unittest.TestCase):
    """Unit tests for the importer_main function."""

    @mock.patch(mongo.__name__ + '.Importer', autospec=mongo.Importer)
    def test_importer_main(self, mongo_mock):
        """Test of basic usage of the importer_main function."""

        mongo_mock.return_value = mock.MagicMock()
        mongo.importer_main(
            _my_importer_func, 'my-collection',
            ['foo', '--arg1', 'Value of arg1'],
            flag_values=gflags.FlagValues())

        import_in_collection = mongo_mock.return_value.import_in_collection
        self.assertTrue(import_in_collection.called)
        call_args = import_in_collection.call_args[0]
        self.assertEqual([{'arg1': 'Value of arg1', 'dummy': 2}], call_args[0])
        self.assertEqual('my-collection', call_args[1])

    @mock.patch(mongo.__name__ + '.Importer', autospec=mongo.Importer)
    def test_importer_filter_ids(self, mongo_mock):
        """Test of the filter_ids flag."""

        def richer_importer_func():
            """An importer with many outputs."""

            return list({'_id': 'foo-{:02d}'.format(i), 'value': i} for i in range(20))

        mongo_mock.return_value = mock.MagicMock()
        mongo.importer_main(
            richer_importer_func, 'my-collection',
            ['foo', '--filter_ids', 'foo-.2'],
            flag_values=gflags.FlagValues())

        import_in_collection = mongo_mock.return_value.import_in_collection
        self.assertTrue(import_in_collection.called)
        call_args = import_in_collection.call_args[0]
        self.assertEqual(
            [{'_id': 'foo-02', 'value': 2}, {'_id': 'foo-12', 'value': 12}],
            call_args[0])
        self.assertEqual('my-collection', call_args[1])

    @mock.patch(mongo.__name__ + '.Importer', autospec=mongo.Importer)
    def test_importer_main_no_args(self, unused_pymongo):
        """Test the importer_main without args."""

        self.assertRaises(
            gflags.IllegalFlagValue, mongo.importer_main,
            _my_importer_func, 'my-collection', ['foo'],
            flag_values=gflags.FlagValues())

    @mock.patch(mongo.__name__ + '.Importer', autospec=mongo.Importer)
    def test_importer_main_no_args_but_default(self, mongo_mock):
        """Test the importer_main without args but with default value."""

        def import_func(arg1='default value'):
            """Foo."""

            return [{'dummy': 2, 'arg1': arg1}]

        mongo_mock.return_value = mock.MagicMock()
        mongo.importer_main(
            import_func, 'my-collection', ['foo'],
            flag_values=gflags.FlagValues())
        import_in_collection = mongo_mock.return_value.import_in_collection
        self.assertTrue(import_in_collection.called)
        call_args = import_in_collection.call_args[0]
        self.assertEqual([{'arg1': 'default value', 'dummy': 2}], call_args[0])

    @mock.patch(mongo.__name__ + '.pymongo', autospec=mongomock)
    def test_importer_main_with_input_file(self, pymongo_mock):
        """Test that the import_func doesn't get called with an input file."""

        mock_importer_func = mock.MagicMock(spec=_my_importer_func)

        def importer_func():
            """Foo."""

            mock_importer_func()

        client = mongomock.MongoClient('mongodb://mongo-url/test')
        pymongo_mock.MongoClient.return_value = client
        testdata_dir = path.join(path.dirname(__file__), 'testdata')
        json_path = path.join(testdata_dir, 'import_dummy_data.json')
        mongo.importer_main(
            importer_func, 'my_collection',
            ['', '--from_json', json_path],
            flag_values=gflags.FlagValues())
        self.assertFalse(mock_importer_func.called)
        self.assertEqual(1, len(list(client.test.my_collection.find())))

    @mock.patch(mongo.__name__ + '.Importer', autospec=mongo.Importer)
    def test_importer_main_with_output_file(self, mongo_mock):
        """Test that data gets written to file instead of DB when file given."""

        out_path = tempfile.mktemp()
        mongo.importer_main(
            _my_importer_func, 'my-collection',
            ['', '--to_json', out_path, '--arg1', 'arg1 test value'],
            flag_values=gflags.FlagValues())
        import_in_collection = mongo_mock.return_value.import_in_collection
        self.assertFalse(import_in_collection.called)
        with open(out_path) as json_file:
            json_content = json_file.read()
            self.assertEqual(
                [{'arg1': 'arg1 test value', 'dummy': 2}],
                json.loads(json_content))
            self.assertTrue(json_content.endswith('\n'))


class ParseArgsDocTestCase(unittest.TestCase):
    """Unit tests for parse_args_doc function."""

    def test_parse_args_doc(self):
        """Test the basic usage of the parse_args_doc function."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is.
        when: When it happened.
        where: Where it happened.

    Returns:
        whatever: this is not a real func.
    ''')
        self.assertEqual({
            'what': 'What it is.',
            'when': 'When it happened.',
            'where': 'Where it happened.'}, args_doc)

    def test_parse_args_doc_return_contiguous(self):
        """Test parse_args_doc when a section is contiguous to the Args one."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is.
    Returns:
        whatever: this is not a real func.
    ''')
        self.assertEqual({'what': 'What it is.'}, args_doc)

    def test_parse_args_doc_multiple_colons(self):
        """Test parse_args_doc when an arg's documentation contains a colon."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is: now that's interesting.
    ''')
        self.assertEqual(
            {'what': "What it is: now that's interesting."}, args_doc)

    def test_parse_args_doc_ignore_wrong_format(self):
        """Test parse_args_doc when one arg's doc has the wrong format."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is.
        past, What it was.
        future: What it will be.
    ''')
        self.assertEqual(
            {'what': 'What it is.', 'future': 'What it will be.'},
            args_doc)

    def test_parse_args_doc_long_lines(self):
        """Test parse_args_doc when one arg's doc is on multiple lines."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is. Even though this documentation could be quite small we
            have decided to make it quite long so that it would fit on multiple
            lines: now that's the case!
        short: A short doc.
    ''')
        self.assertEqual({
            'what':
                'What it is. Even though this documentation could be '
                'quite small we have decided to make it quite long so that '
                "it would fit on multiple lines: now that's the case!",
            'short': 'A short doc.'}, args_doc)

    def test_parse_args_doc_no_args_section(self):
        """Test parse_args_doc when there is no Args section."""

        args_doc = mongo.parse_args_doc('''Description of function.''')
        self.assertEqual({}, args_doc)

    def test_parse_args_doc_empty_args_section(self):
        """Test parse_args_doc when the Args section is empty."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
    what: What it is.
    Returns: nothing.
    ''')
        self.assertEqual({}, args_doc)

    def test_parse_args_doc_empty_args_section_because_end(self):
        """Test parse_args_doc when Args section is empty and the last one."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
    ''')
        self.assertEqual({}, args_doc)


class ImporterTestCase(unittest.TestCase):
    """Unit tests for the Importer class."""

    def setUp(self):
        """Set up for each test: prepare the importer."""

        super(ImporterTestCase, self).setUp()
        self.flag_values = gflags.FlagValues()
        self.importer = mongo.Importer(self.flag_values)
        self.patcher = mock.patch(
            pymongo.__name__ + '.MongoClient', autospec=mongomock.MongoClient)
        self.mock_client = self.patcher.start()
        self.db_client = mongomock.MongoClient('mongodb://my-db-client-url/test')
        self.mock_client.return_value = self.db_client

    def tearDown(self):
        """Tear down each test."""

        super(ImporterTestCase, self).setUp()
        self.patcher.stop()

    def test_import_in_collection(self):
        """Test basic usage."""

        self.flag_values(['', '--mongo_url', 'mongodb://my-db_client-url/test'])
        before = datetime.datetime.now()
        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')
        after = datetime.datetime.now()

        self.mock_client.assert_called_with('mongodb://my-db_client-url/test')
        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))
        meta = self.db_client.test.meta.find_one({'_id': 'my_collec'})
        self.assertLessEqual(before - datetime.timedelta(seconds=1), meta['updated_at'])
        self.assertLessEqual(meta['updated_at'], after + datetime.timedelta(seconds=1))

    def test_import_in_collection_with_previous_conflicting_data(self):
        """Test usage with data already there that conflicts."""

        old_times = datetime.datetime(2015, 11, 1)
        self.db_client.test.my_collec.insert_one({'_id': 'Foo'})
        self.db_client.test.meta.insert_one(
            {'_id': 'my_collec', 'updated_at': old_times})

        self.flag_values(['', '--mongo_url', 'mongodb://my-db_client-url/test'])
        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')

        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))
        meta = self.db_client.test.meta.find_one({'_id': 'my_collec'})
        self.assertGreater(meta['updated_at'], old_times)

    def test_import_in_collection_with_previous_data(self):
        """Test usage with data already there."""

        self.db_client.test.my_collec.insert_one({'_id': 'Previous data'})

        self.flag_values(['', '--mongo_url', 'my-db_client-url'])
        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')

        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))

    def test_import_in_collection_failing_with_previous_data(self):
        """Test usage with data already there but import fails."""

        self.db_client.test.my_collec.insert_one({'_id': 'Previous data'})

        self.flag_values(['', '--mongo_url', 'my-db_client-url'])
        self.assertRaises(
            # TODO(pascal): revert to pymongo.errors.PyMongoError once
            # https://github.com/mongomock/mongomock/issues/312 is fixed.
            Exception,
            self.importer.import_in_collection,
            [{'_id': 'Foo'}, {'_id': 'Bar'}, {'_id': 'Foo'}],
            'my_collec')

        self.assertEqual(
            set(['Previous data']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))


class ProtoTestCase(unittest.TestCase):
    """Unit tests for proto functions."""

    def test_collection_to_proto_mapping(self):
        """Basic usage of collection_to_proto_mapping function."""

        protos = dict(mongo.collection_to_proto_mapping([
            {'_id': '75056', 'userId': 'Pascal'},
            {'_id': '69123', 'userId': 'Stephan'},
        ], user_pb2.User))

        self.assertEqual(['69123', '75056'], sorted(protos.keys()))
        self.assertEqual('Pascal', protos['75056'].user_id)
        self.assertEqual('Stephan', protos['69123'].user_id)

    def test_collection_to_proto_mapping_dupes(self):
        """Use of duplicates in the collection."""

        iterator = mongo.collection_to_proto_mapping([
            {'_id': '75056', 'userId': 'Pascal'},
            {'_id': '75056', 'userId': 'Pascal'},
        ], user_pb2.User)

        next(iterator)
        self.assertRaises(KeyError, next, iterator)

    def test_collection_to_proto_mapping_wrong_field(self):
        """Use of unknown proto field in a dict."""

        iterator = mongo.collection_to_proto_mapping([
            {'_id': '75056', 'unkownField': 'Pascal'},
        ], user_pb2.User)
        self.assertRaises(mongo.json_format.ParseError, next, iterator)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
