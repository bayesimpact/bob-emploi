"""Import Status tool tests."""

import datetime
import logging
import re
import unittest
from unittest import mock

import mongomock
import pymongo
import termcolor

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer import import_status


def _strip_colors(text):
    return re.sub(r'\x1b\[\d+m', '', text)


class _AnyColorText(object):

    def __init__(self, text):
        self.text = _strip_colors(str(text))

    def __eq__(self, other_text):
        return isinstance(other_text, str) and self.text == _strip_colors(other_text)

    def __repr__(self):
        return 'AnyColorText({})'.format(self.text)


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
            name='no import needed', script=None, args=None, is_imported=False,
            proto_type=None, key=None, has_pii=False)
        import_status.print_single_importer(importer, 'no-import-needed', 'url')
        mock_log_info.assert_any_call(
            'No import needed for %s',
            termcolor.colored('no-import-needed', 'green'))

    @mock.patch(logging.__name__ + '.info')
    def test_details_basic_usage(self, mock_log_info):
        """Basic usage."""

        importer = import_status.Importer(
            name='with command',
            script='run', args={'this': 'value'},
            is_imported=True,
            proto_type=None, key=None, has_pii=False)
        import_status.print_single_importer(importer, 'foo', 'url')
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'with command',
            'foo',
            'docker-compose run --rm data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/importer/run.py \\\n'
            '    --this "value" \\\n    --mongo_url "url" \\\n    --mongo_collection "foo"\n')

    def test_collection_diff(self):
        """Calculate the difference between mongo collections and importers."""

        self.mongo_db.create_collection('missing-in-importers')
        self.mongo_db.create_collection('in-both')
        importers = {
            'no-import-needed': import_status.Importer(
                name='no import needed', script=None, args=None, is_imported=False,
                proto_type=None, key=None, has_pii=False),
            'missing-in-db-importer': import_status.Importer(
                name='missing in db', script=None, args=None, is_imported=True,
                proto_type=None, key=None, has_pii=False),
            'in-both': import_status.Importer(
                name='in both', script=None, args=None, is_imported=True,
                proto_type=None, key=None, has_pii=False)
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
        self.assertLessEqual(
            two_days_ago.replace(microsecond=0),
            meta_info['test_collection']['updated_at'])
        self.assertGreaterEqual(
            two_days_ago + datetime.timedelta(seconds=1),
            meta_info['test_collection']['updated_at'])

    @mongomock.patch(('test_url',))
    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'missing-in-db-importer': import_status.Importer(
            name='missing in db', script=None, args=None, is_imported=True,
            proto_type=None, key=None, has_pii=False),
        'in-both': import_status.Importer(
            name='in both', script=None, args=None, is_imported=True,
            proto_type=None, key=None, has_pii=False),
        'in-both-with-meta': import_status.Importer(
            name='in both with meta', script=None, args=None, is_imported=True,
            proto_type=job_pb2.JobGroup, key=None, has_pii=False),
        'in-both-not-needed': import_status.Importer(
            name='in both not needed', script=None, args=None, is_imported=False,
            proto_type=None, key=None, has_pii=False)
        })
    def test_main_function(self, mock_log_info):
        """Basic usage."""

        client = pymongo.MongoClient('mongodb://test_url/test_db')

        mongo_db = client.get_database('test_db')
        mongo_db.create_collection('missing-in-importers')
        mongo_db.create_collection('in-both')
        mongo_db.create_collection('in-both-with-meta')
        two_days_ago = (datetime.datetime.now() - datetime.timedelta(days=2)).replace(microsecond=0)
        mongo_db.meta.insert_one({
            '_id': 'in-both-with-meta',
            'updated_at': two_days_ago,
        })
        mongo_db.create_collection('in-both-not-needed')

        import_status.main(['mongodb://test_url/test_db'])
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
            _AnyColorText('last import: {}'.format(two_days_ago)))

    @mongomock.patch(('test_url',))
    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'non-personal': import_status.Importer(
            name='non personal', script=None, args=None, is_imported=True,
            proto_type=None, key=None, has_pii=False),
        'personal': import_status.Importer(
            name='personal', script=None, args=None, is_imported=True,
            proto_type=None, key=None, has_pii=True),
        'personal-no-import': import_status.Importer(
            name='personal not imported', script=None, args=None, is_imported=False,
            proto_type=None, key=None, has_pii=True)
        })
    def test_personal_database(self, mock_log_info):
        """Check division between personal/non personal databases."""

        client = pymongo.MongoClient('mongodb://test_url/test_db')

        mongo_db = client.get_database('test_db')
        mongo_db.create_collection('non-personal')
        mongo_db.create_collection('personal')
        mongo_db.create_collection('personal-no-import')

        import_status.main(['mongodb://test_url/test_db'])
        mock_log_info.assert_any_call(
            '%s collection%s without importers:', _AnyColorText('1'), ' is')
        # Although non-personal is imported, it should not be as it's a Personal database.
        mock_log_info.assert_any_call(
            'The collection%s with missing importer%s: %s\n',
            '', ' is', _AnyColorText("{'non-personal'}"))

    @mongomock.patch(('test_url',))
    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            proto_type=None, key=None, has_pii=False),
        })
    def test_display_command(self, mock_log_info):
        """Display the command to import a missing collection."""

        import_status.main(['mongodb://test_url/test_db'])
        mock_log_info.assert_any_call(
            '%s collection%s not imported yet:', _AnyColorText('1'), ' is')
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'Collection name', 'collection_id',
            'docker-compose run --rm data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/importer/my-script-name.py \\\n'
            '    --mongo_url "mongodb://test_url/test_db" \\\n'
            '    --mongo_collection "collection_id"\n')

    def test_command_on_one_line(self):
        """Checks that all importers command are on one line."""

        for name, importer in import_status.IMPORTERS.items():
            self.assertTrue(
                bool(importer.script) == importer.is_imported,
                msg='Conflicts in script and is_imported field for {}'.format(name))
            if not importer.script:
                continue

            self.assertNotIn(importer.script, '\n', msg=name)
            if importer.args:
                for key, value in importer.args.items():
                    self.assertNotIn(key, '\n', msg=name)
                    self.assertNotIn(value, '\n', msg='Importer "{}", arg "{}"'.format(name, key))

    @mongomock.patch(('test_url',))
    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={'custom_importer_flag': 'value for custom flag'},
            is_imported=True,
            proto_type=None, key=None, has_pii=False),
        })
    def test_run_importer(self, mock_subprocess_run):
        """Run the command to import a collection."""

        import_status.main(['mongodb://test_url/test_db', '--run', 'collection_id'])
        mock_subprocess_run.assert_called_once_with([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--custom_importer_flag', 'value for custom flag',
            '--mongo_url', 'mongodb://test_url/test_db',
            '--mongo_collection', 'collection_id',
        ])

    @mongomock.patch(('test_url',))
    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={'custom_importer_flag': 'value for custom flag'},
            is_imported=True,
            proto_type=None, key=None, has_pii=False),
        'other_collection_id': import_status.Importer(
            name='Other collection name',
            script='other-script-name',
            args={'custom_importer_flag': 'other value for custom flag'},
            is_imported=True,
            proto_type=None, key=None, has_pii=False),
        })
    def test_run_multiple_importers(self, mock_subprocess_run):
        """Run the commands to import multiple collections."""

        import_status.main([
            'mongodb://test_url/test_db',
            '--run', 'collection_id',
            '--run', 'other_collection_id',
        ])
        self.assertEqual(2, mock_subprocess_run.call_count)
        mock_subprocess_run.assert_any_call([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--custom_importer_flag', 'value for custom flag',
            '--mongo_url', 'mongodb://test_url/test_db',
            '--mongo_collection', 'collection_id',
        ])
        mock_subprocess_run.assert_any_call([
            'python', '/work/bob_emploi/data_analysis/importer/other-script-name.py',
            '--custom_importer_flag', 'other value for custom flag',
            '--mongo_url', 'mongodb://test_url/test_db',
            '--mongo_collection', 'other_collection_id',
        ])


if __name__ == '__main__':
    unittest.main()
