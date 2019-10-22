"""Unit tests for the bob_emploi.lib.mongo module."""

import argparse
import datetime
import io
import json
from os import path
import tempfile
import typing
from typing import Any, Dict, List
import unittest
from unittest import mock

import mongomock
import pymongo

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import user_pb2


def _my_importer_func(arg1: Any) -> List[Dict[str, Any]]:
    """A basic importer.

    Args:
        arg1: doc for the first arg.

    Returns:
        a single value to import.
    """

    return [{'arg1': arg1, 'dummy': 2}]


@mock.patch(mongo.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
@mock.patch('builtins.input', new=mock.MagicMock(return_value='Y'))
@mock.patch(mongo.__name__ + '._MONGO_URL', 'mongodb://localhost/test')
class ImporterMainTestCase(unittest.TestCase):
    """Unit tests for the importer_main function."""

    def setUp(self) -> None:
        super().setUp()
        self.output = io.StringIO()
        patcher = mongomock.patch()
        patcher.start()
        self.addCleanup(patcher.stop)

        self.db_client = pymongo.MongoClient('mongodb://localhost/test')
        for collection in self.db_client.test.list_collection_names():
            self.db_client.test.drop_collection(collection)

    def test_importer_main(self) -> None:
        """Test of basic usage of the importer_main function."""

        mongo.importer_main(
            _my_importer_func, 'my-collection',
            ['--arg1', 'Value of arg1'],
            out=self.output)

        self.assertEqual(
            ['meta', 'my-collection'], sorted(self.db_client.test.list_collection_names()))
        self.assertEqual(1, self.db_client.test['my-collection'].count_documents({}))
        value = self.db_client.test['my-collection'].find_one()
        assert value
        del value['_id']
        self.assertEqual({'arg1': 'Value of arg1', 'dummy': 2}, value)

    def test_importer_filter_ids(self) -> None:
        """Test of the filter_ids flag."""

        def richer_importer_func() -> List[Dict[str, Any]]:
            """An importer with many outputs."""

            return list({'_id': f'foo-{i:02d}', 'value': i} for i in range(20))

        mongo.importer_main(
            richer_importer_func, 'my-collection',
            ['--filter_ids', 'foo-.2'],
            out=self.output)

        self.assertEqual(
            [{'_id': 'foo-02', 'value': 2}, {'_id': 'foo-12', 'value': 12}],
            list(self.db_client.test['my-collection'].find()))

    def test_importer_main_no_args(self) -> None:
        """Test the importer_main without args."""

        with self.assertRaises(SystemExit):
            mongo.importer_main(
                _my_importer_func, 'my-collection',
                ['foo'],
                out=self.output)

    def test_importer_main_no_args_but_default(self) -> None:
        """Test the importer_main without args but with default value."""

        def import_func(arg1: str = 'default value') -> List[Dict[str, Any]]:
            """Foo."""

            return [{'dummy': 2, 'arg1': arg1}]

        mongo.importer_main(
            import_func, 'my-collection',
            [],
            out=self.output)

        value = self.db_client.test['my-collection'].find_one()
        assert value
        del value['_id']
        self.assertEqual({'arg1': 'default value', 'dummy': 2}, value)

    def test_importer_main_with_input_file(self) -> None:
        """Test that the import_func doesn't get called with an input file."""

        def importer_func() -> List[Dict[str, Any]]:  # pragma: no-cover
            """Foo."""

            self.fail('Should not be called')
            return []

        testdata_dir = path.join(path.dirname(__file__), 'testdata')
        json_path = path.join(testdata_dir, 'import_dummy_data.json')
        mongo.importer_main(
            importer_func, 'my_collection',
            ['--from_json', json_path],
            out=self.output)
        self.assertEqual(1, len(list(self.db_client.test.my_collection.find())))

    def test_importer_main_with_output_file(self) -> None:
        """Test that data gets written to file instead of DB when file given."""

        out_path = tempfile.mktemp()
        mongo.importer_main(
            _my_importer_func, 'my-collection',
            ['--to_json', out_path, '--arg1', 'arg1 test value'],
            out=self.output)

        with open(out_path) as json_file:
            json_content = json_file.read()
            self.assertEqual(
                [{'arg1': 'arg1 test value', 'dummy': 2}],
                json.loads(json_content))
            self.assertTrue(json_content.endswith('\n'))

        self.assertEqual(0, len(list(self.db_client.test['my-collection'].find())))


class ParseArgsDocTestCase(unittest.TestCase):
    """Unit tests for parse_args_doc function."""

    def test_parse_args_doc(self) -> None:
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

    def test_parse_args_doc_return_contiguous(self) -> None:
        """Test parse_args_doc when a section is contiguous to the Args one."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is.
    Returns:
        whatever: this is not a real func.
    ''')
        self.assertEqual({'what': 'What it is.'}, args_doc)

    def test_parse_args_doc_multiple_colons(self) -> None:
        """Test parse_args_doc when an arg's documentation contains a colon."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
        what: What it is: now that's interesting.
    ''')
        self.assertEqual(
            {'what': "What it is: now that's interesting."}, args_doc)

    def test_parse_args_doc_ignore_wrong_format(self) -> None:
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

    def test_parse_args_doc_long_lines(self) -> None:
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

    def test_parse_args_doc_no_args_section(self) -> None:
        """Test parse_args_doc when there is no Args section."""

        args_doc = mongo.parse_args_doc('''Description of function.''')
        self.assertEqual({}, args_doc)

    def test_parse_args_doc_empty_args_section(self) -> None:
        """Test parse_args_doc when the Args section is empty."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
    what: What it is.
    Returns: nothing.
    ''')
        self.assertEqual({}, args_doc)

    def test_parse_args_doc_empty_args_section_because_end(self) -> None:
        """Test parse_args_doc when Args section is empty and the last one."""

        args_doc = mongo.parse_args_doc('''Description of function.

    Args:
    ''')
        self.assertEqual({}, args_doc)


@mock.patch('builtins.input', new=mock.MagicMock(return_value='Y'))
@mock.patch(mongo.tqdm.__name__ + '.tqdm', new=lambda iterable: iterable)
@mock.patch(mongo.__name__ + '._MONGO_URL', 'mongodb://my-db_client-url/test')
class ImporterTestCase(unittest.TestCase):
    """Unit tests for the Importer class."""

    def setUp(self) -> None:
        """Set up for each test: prepare the importer."""

        super().setUp()
        flag_values = argparse.Namespace()
        flag_values.mongo_collection = ''
        flag_values.chunk_size = 10000
        flag_values.always_accept_diff = False
        flag_values.report_to_slack = False
        self.output = io.StringIO()
        self.importer = mongo.Importer(flag_values, out=self.output)
        patcher = mongomock.patch(('my-db_client-url',))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.db_client = pymongo.MongoClient('mongodb://my-db_client-url/test')

    def test_import_in_collection(self) -> None:
        """Test basic usage."""

        before = datetime.datetime.now()
        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')
        after = datetime.datetime.now()

        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))
        meta = self.db_client.test.meta.find_one({'_id': 'my_collec'})
        assert meta
        self.assertLessEqual(before - datetime.timedelta(seconds=1), meta['updated_at'])
        self.assertLessEqual(meta['updated_at'], after + datetime.timedelta(seconds=1))

    def test_import_in_collection_with_previous_conflicting_data(self) -> None:
        """Test usage with data already there that conflicts."""

        old_times = datetime.datetime(2015, 11, 1)
        self.db_client.test.my_collec.insert_one({'_id': 'Foo'})
        self.db_client.test.meta.insert_one(
            {'_id': 'my_collec', 'updated_at': old_times})

        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')

        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))
        meta = self.db_client.test.meta.find_one({'_id': 'my_collec'})
        assert meta
        self.assertGreater(meta['updated_at'], old_times)

    @mock.patch(
        mongo.__name__ + '._GET_NOW',
        new=mock.MagicMock(return_value=datetime.datetime(2018, 9, 28)))
    def test_import_in_collection_with_previous_data(self) -> None:
        """Test usage with data already there."""

        self.db_client.test.my_collec.insert_one({'_id': 'Previous data'})

        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], 'my_collec')

        self.assertEqual(
            set(['Foo', 'Bar']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))

        daily_archives = [
            name for name in self.db_client.test.list_collection_names()
            if name.startswith('my_collec.2018-09-28')
        ]
        self.assertEqual(1, len(daily_archives), msg=self.db_client.test.list_collection_names())
        self.assertEqual(
            [{'_id': 'Previous data'}],
            list(self.db_client.test[daily_archives[0]].find()))

    def test_import_in_collection_failing_with_previous_data(self) -> None:
        """Test usage with data already there but import fails."""

        self.db_client.test.my_collec.insert_one({'_id': 'Previous data'})

        self.assertRaises(
            pymongo.errors.PyMongoError,
            self.importer.import_in_collection,
            [{'_id': 'Foo'}, {'_id': 'Bar'}, {'_id': 'Foo'}],
            'my_collec')

        self.assertEqual(
            set(['Previous data']),
            set(c['_id'] for c in self.db_client.test.my_collec.find()))

    def test_import_show_diff(self) -> None:
        """Test showing the diff with previous data."""

        patcher = mock.patch('builtins.input')
        mock_input = patcher.start()
        self.addCleanup(patcher.stop)

        self.db_client.test.my_collec.insert_many([
            {'_id': 'a', 'field1': 3},
            {'_id': 'b', 'field1': 42},
            {'_id': 'c', 'field1': 5},
        ])

        mock_input.return_value = 'N'

        self.importer.import_in_collection(
            [
                {'_id': 'a', 'field1': 3},
                {'_id': 'b', 'field1': 2018},
                {'_id': 'd', 'field1': 5},
            ], 'my_collec')

    def test_import_skip_diff_with_flag(self) -> None:
        """Test skipping the diff if the always_accept_diff flag is given."""

        patcher = mock.patch('builtins.input')
        mock_input = patcher.start()
        self.addCleanup(patcher.stop)

        self.db_client.test.my_collec.insert_many([
            {'_id': 'a', 'field1': 3},
            {'_id': 'b', 'field1': 42},
            {'_id': 'c', 'field1': 5},
        ])

        # The question is never asked, however we want to make sure we answer
        # No if it is.
        mock_input.return_value = 'N'

        self.importer.flag_values.always_accept_diff = True
        self.importer.import_in_collection(
            [
                {'_id': 'a', 'field1': 3},
                {'_id': 'b', 'field1': 2018},
                {'_id': 'd', 'field1': 5},
            ], 'my_collec')

        doc_b = self.db_client.test.my_collec.find_one({'_id': 'b'})
        assert doc_b
        self.assertEqual(2018, doc_b['field1'])
        output = self.output.getvalue()
        self.assertEqual('Inserting all 3 objects at once.', output.strip())

    @mock.patch(mongo.__name__ + '.requests.post')
    @mock.patch(
        mongo.__name__ + '._SLACK_IMPORT_URL', 'https://slack.example.com/webhook')
    def test_import_and_report(self, mock_post: mock.MagicMock) -> None:
        """Test sending slack report when importing."""

        collection_name = 'my_collec'
        self.importer.flag_values.mongo_collection = collection_name
        self.importer.flag_values.report_to_slack = True
        self.importer.import_in_collection(
            [{'_id': 'Foo'}, {'_id': 'Bar'}], collection_name)

        mock_post.assert_called_once_with(
            'https://slack.example.com/webhook',
            json={
                'attachments': [{
                    'mrkdwn_in': ['text'],
                    'title': 'Automatic import of my_collec',
                    'text': 'Inserting all 2 objects at once.\n'
                }],
            },
        )
        output = self.output.getvalue()
        self.assertEqual('Inserting all 2 objects at once.', output.strip())

    @mock.patch(mongo.__name__ + '._GET_NOW')
    def test_import_in_collection_archives(self, mock_now: mock.MagicMock) -> None:
        """Test archives management."""

        self.db_client.test.my_collec.insert_one({'_id': 'Previous data'})

        # Day 1: import twice.
        mock_now.return_value = datetime.datetime(2018, 9, 28)
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-28 1st attempt'}], 'my_collec')
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-28 2nd attempt'}], 'my_collec')

        # Day 2: import twice.
        mock_now.return_value = datetime.datetime(2018, 9, 29)
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-29 1st attempt'}], 'my_collec')
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-29 2nd attempt'}], 'my_collec')

        # Day 3: import three times.
        mock_now.return_value = datetime.datetime(2018, 9, 30)
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-30 1st attempt'}], 'my_collec')
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-30 2nd attempt'}], 'my_collec')
        self.importer.import_in_collection(
            [{'_id': 'Data for 2018-09-30 3rd attempt'}], 'my_collec')

        # Check current data
        self.assertEqual(
            [{'_id': 'Data for 2018-09-30 3rd attempt'}],
            list(self.db_client.test.my_collec.find()))

        # Check list of archives.
        archive_names = sorted(
            name for name in self.db_client.test.list_collection_names()
            if name.startswith('my_collec.')
        )
        prefixes = [name[:len('my_collec.YYYY-MM-DD_')] for name in archive_names]
        self.assertEqual(
            [
                'my_collec.2018-09-29_',
                'my_collec.2018-09-30_',
                'my_collec.2018-09-30_',
                'my_collec.2018-09-30_',
            ], prefixes, msg=archive_names)
        self.assertEqual(
            [
                'Data for 2018-09-29 1st attempt',
                'Data for 2018-09-29 2nd attempt',
                'Data for 2018-09-30 1st attempt',
                'Data for 2018-09-30 2nd attempt',
            ],
            [
                typing.cast(Dict[str, Any], self.db_client.test[name].find_one())['_id']
                for name in archive_names
            ])


class ProtoTestCase(unittest.TestCase):
    """Unit tests for proto functions."""

    def test_collection_to_proto_mapping(self) -> None:
        """Basic usage of collection_to_proto_mapping function."""

        protos = dict(mongo.collection_to_proto_mapping([
            {'_id': '75056', 'userId': 'Pascal'},
            {'_id': '69123', 'userId': 'Stephan'},
        ], user_pb2.User))

        self.assertEqual(['69123', '75056'], sorted(protos.keys()))
        self.assertEqual('Pascal', protos['75056'].user_id)
        self.assertEqual('Stephan', protos['69123'].user_id)

    def test_collection_to_proto_mapping_dupes(self) -> None:
        """Use of duplicates in the collection."""

        iterator = mongo.collection_to_proto_mapping([
            {'_id': '75056', 'userId': 'Pascal'},
            {'_id': '75056', 'userId': 'Pascal'},
        ], user_pb2.User)

        next(iterator)
        self.assertRaises(KeyError, next, iterator)

    def test_collection_to_proto_mapping_wrong_field(self) -> None:
        """Use of unknown proto field in a dict."""

        iterator = mongo.collection_to_proto_mapping([
            {'_id': '75056', 'unkownField': 'Pascal'},
        ], user_pb2.User)
        self.assertRaises(mongo.json_format.ParseError, next, iterator)


if __name__ == '__main__':
    unittest.main()
