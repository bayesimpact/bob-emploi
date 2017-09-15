# encoding: utf-8
"""Import Status tool tests."""
import datetime
import logging
import re
import unittest

import mock
import mongomock
import termcolor

from bob_emploi.frontend.api import job_pb2
from bob_emploi.importer import import_status


def _strip_colors(text):
    return re.sub(r'\x1b\[\d+m', '', text)


class _AnyColorText(object):

    def __init__(self, text):
        self.text = _strip_colors(str(text))

    def __eq__(self, other_text):
        if not isinstance(other_text, str):
            return False
        return self.text == _strip_colors(other_text)


class ImportStatusBasicTests(unittest.TestCase):
    """Basic tests."""

    def setUp(self):
        """Set up."""
        self.mongo_db = mongomock.MongoClient('test').get_database('test')

    @mock.patch(logging.__name__ + '.info')
    def test_details_importer_missing(self, mock_log_info):
        """Test missing importer."""
        import_status.print_single_importer(None, 'foo', 'url')
        mock_log_info.assert_any_call(
            'Collection details - unknown collection (%s)',
            termcolor.colored('foo', 'red'))

    @mock.patch(logging.__name__ + '.info')
    def test_details_no_import_needed(self, mock_log_info):
        """Test no import needed."""
        importer = import_status.Importer(
            name='no import needed', command='', is_imported=False,
            proto_type=None, key=None)
        import_status.print_single_importer(importer, 'no-import-needed', 'url')
        mock_log_info.assert_any_call(
            'No import needed for %s',
            termcolor.colored('no-import-needed', 'green'))

    @mock.patch(logging.__name__ + '.info')
    def test_details_basic_usage(self, mock_log_info):
        """Basic usage."""
        importer = import_status.Importer(
            name='with command',
            command='run this',
            is_imported=True,
            proto_type=None, key=None)
        import_status.print_single_importer(importer, 'foo', 'url')
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'with command',
            'foo',
            'run this \\\n            --mongo_url "url" --mongo_collection "foo"\n')

    def test_collection_diff(self):
        """Calculate the difference between mongo collections and importers."""
        self.mongo_db.create_collection('missing-in-importers')
        self.mongo_db.create_collection('in-both')
        importers = {
            'no-import-needed': import_status.Importer(
                name='no import needed', command='', is_imported=False,
                proto_type=None, key=None),
            'missing-in-db-importer': import_status.Importer(
                name='missing in db', command='', is_imported=True,
                proto_type=None, key=None),
            'in-both': import_status.Importer(
                name='in both', command='', is_imported=True,
                proto_type=None, key=None)
        }
        diff = import_status.compute_collections_diff(importers, self.mongo_db)
        self.assertEqual(
            set(['missing-in-db-importer']), set(diff.collection_missing))
        self.assertEqual(
            set(['missing-in-importers']), set(diff.importer_missing))
        self.assertEqual(set(['in-both']), set(diff.imported))

    def test_collection_meta(self):
        """Test basic usage of getting collection meta information."""
        two_days_ago = datetime.datetime.now() - datetime.timedelta(days=2)
        self.mongo_db.create_collection('meta').insert_one({
            '_id': 'test_collection',
            'updated_at': two_days_ago,
        })
        meta_info = import_status.get_meta_info(self.mongo_db)
        self.assertEqual(
            two_days_ago, meta_info['test_collection']['updated_at'])

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.pymongo', autospec=mongomock)
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'missing-in-db-importer': import_status.Importer(
            name='missing in db', command='', is_imported=True,
            proto_type=None, key=None),
        'in-both': import_status.Importer(
            name='in both', command='', is_imported=True,
            proto_type=None, key=None),
        'in-both-with-meta': import_status.Importer(
            name='in both with meta', command='', is_imported=True,
            proto_type=job_pb2.JobGroup, key=None),
        'in-both-not-needed': import_status.Importer(
            name='in both not needed', command='', is_imported=False,
            proto_type=None, key=None)
        })
    def test_main_function(self, pymongo_mock, mock_log_info):
        """Basic usage."""
        client = mongomock.MongoClient('mongodb://test_url/test_db')
        pymongo_mock.MongoClient.return_value = client

        mongo_db = client.get_database('test_db')
        mongo_db.create_collection('missing-in-importers')
        mongo_db.create_collection('in-both')
        mongo_db.create_collection('in-both-with-meta')
        two_days_ago = datetime.datetime.now() - datetime.timedelta(days=2)
        mongo_db.meta.insert_one({
            '_id': 'in-both-with-meta',
            'updated_at': two_days_ago,
        })
        mongo_db.create_collection('in-both-not-needed')

        import_status.main('mongodb://test_url/test_db')
        mock_log_info.assert_any_call(
            '%s collection%s without importers:', _AnyColorText('1'), ' is')
        mock_log_info.assert_any_call(
            '%s collection%s not imported yet:', _AnyColorText('1'), ' is')
        mock_log_info.assert_any_call(
            'Status report on imported collections (%d):', 3)
        mock_log_info.assert_any_call(
            '\t%s - %s - %s',
            _AnyColorText('in-both-not-needed'),
            _AnyColorText('in both not needed'),
            termcolor.colored('No import needed', 'green'))
        mock_log_info.assert_any_call(
            '\t%s - %s - %s',
            _AnyColorText('in-both'),
            _AnyColorText('in both'),
            termcolor.colored('Metainformation missing', 'red'))
        mock_log_info.assert_any_call(
            '\t%s - %s - %s',
            _AnyColorText('in-both-with-meta'),
            _AnyColorText('in both with meta (JobGroup)'),
            _AnyColorText('last import: %s' % two_days_ago))

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.pymongo', autospec=mongomock)
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            command='my-long-command',
            is_imported=True,
            proto_type=None, key=None),
        })
    def test_display_command(self, pymongo_mock, mock_log_info):
        """Display the command to import a missing collection."""
        client = mongomock.MongoClient('mongodb://test_url/test_db')
        pymongo_mock.MongoClient.return_value = client

        import_status.main('mongodb://test_url/test_db')
        mock_log_info.assert_any_call(
            '%s collection%s not imported yet:', _AnyColorText('1'), ' is')
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'Collection name', 'collection_id',
            'my-long-command \\\n'
            '            --mongo_url "mongodb://test_url/test_db" '
            '--mongo_collection "collection_id"\n')

    def test_command_on_one_line(self):
        """Checks that all importers command are on one line."""
        for name, importer in import_status.IMPORTERS.items():
            self.assertTrue(
                bool(importer.command) == importer.is_imported,
                msg='Conflicts in command and is_imported field for %s' % name)
            if not importer.command:
                continue

            command_lines = importer.command.split('\n')
            for line in command_lines[:-1]:
                self.assertTrue(
                    line.endswith('\\'),
                    msg='A command line for importer "%s" does not end with "\\":\n%s'
                    % (name, line))


if __name__ == '__main__':
    unittest.main()
