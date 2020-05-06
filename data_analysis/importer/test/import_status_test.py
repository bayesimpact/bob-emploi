"""Import Status tool tests."""

import datetime
import json
import logging
import re
import subprocess
from typing import Any, Dict, List
import unittest
from unittest import mock

import mongomock
import pymongo
import termcolor

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer import import_status

_FAKE_MONGO_URL = 'mongodb://test_url/test_db'


def _strip_colors(text: str) -> str:
    return re.sub(r'\x1b\[\d+m', '', text)


class _AnyColorText(object):

    def __init__(self, text: str) -> None:
        self.text = _strip_colors(str(text))

    def __eq__(self, other_text: Any) -> bool:
        return isinstance(other_text, str) and self.text == _strip_colors(other_text)

    def __repr__(self) -> str:
        return f'AnyColorText({self.text})'


@mock.patch(import_status.__name__ + '._MONGO_URL', _FAKE_MONGO_URL)
class ImportStatusBasicTests(unittest.TestCase):
    """Basic tests."""

    def setUp(self) -> None:
        """Set up."""

        patcher = mongomock.patch(_FAKE_MONGO_URL)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.mongo_db = pymongo.MongoClient(_FAKE_MONGO_URL).get_database()

    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    @mongomock.patch(('test_url',))
    def test_details_importer_missing(self) -> None:
        """Test missing importer."""

        # This is the SystemExit from argparse getting a bad argument.
        with self.assertRaises(SystemExit):
            import_status.main(['unknown_collection'])

    @mock.patch(logging.__name__ + '.info')
    def test_details_no_import_needed(self, mock_log_info: mock.MagicMock) -> None:
        """Test no import needed."""

        importer = import_status.Importer(
            name='no import needed', script=None, args=None, is_imported=False,
            run_every=None, proto_type=None, key=None, has_pii=False)
        import_status.print_single_importer(importer, 'no-import-needed', 'url', [])
        mock_log_info.assert_any_call(
            'No import needed for %s',
            termcolor.colored('no-import-needed', 'green'))

    @mock.patch(logging.__name__ + '.info')
    def test_details_basic_usage(self, mock_log_info: mock.MagicMock) -> None:
        """Basic usage."""

        importer = import_status.Importer(
            name='with command',
            script='run', args={'this': 'value'},
            is_imported=True, run_every=None,
            proto_type=None, key=None, has_pii=False)
        import_status.print_single_importer(importer, 'foo', 'url', [])
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'with command',
            'foo',
            'docker-compose run --rm -e MONGO_URL=url data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/importer/run.py \\\n'
            '    --this "value" \\\n    --mongo_collection "foo"\n')

    def test_collection_diff(self) -> None:
        """Calculate the difference between mongo collections and importers."""

        self.mongo_db.create_collection('missing-in-importers')
        self.mongo_db.create_collection('in-both')
        self.mongo_db.create_collection('in-both.2018-12-12_57ccf5b6d9be6')
        self.mongo_db.create_collection('old-collection.2018-12-12_57ccf5b6d9be6')
        importers = {
            'no-import-needed': import_status.Importer(
                name='no import needed', script=None, args=None, is_imported=False,
                run_every=None, proto_type=None, key=None, has_pii=False),
            'missing-in-db-importer': import_status.Importer(
                name='missing in db', script=None, args=None, is_imported=True,
                run_every=None, proto_type=None, key=None, has_pii=False),
            'in-both': import_status.Importer(
                name='in both', script=None, args=None, is_imported=True,
                run_every=None, proto_type=None, key=None, has_pii=False)
        }
        diff = import_status.compute_collections_diff(importers, self.mongo_db)
        self.assertEqual({'missing-in-db-importer'}, set(diff.collection_missing))
        self.assertEqual({'missing-in-importers'}, set(diff.importer_missing))
        self.assertEqual({'in-both'}, set(diff.imported))

    def test_collection_meta(self) -> None:
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

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'missing-in-db-importer': import_status.Importer(
            name='missing in db', script=None, args=None, is_imported=True,
            run_every=None, proto_type=None, key=None, has_pii=False),
        'in-both': import_status.Importer(
            name='in both', script=None, args=None, is_imported=True,
            run_every=None, proto_type=None, key=None, has_pii=False),
        'in-both-with-meta': import_status.Importer(
            name='in both with meta', script=None, args=None, is_imported=True,
            run_every=None, proto_type=job_pb2.JobGroup, key=None, has_pii=False),
        'in-both-not-needed': import_status.Importer(
            name='in both not needed', script=None, args=None, is_imported=False,
            run_every=None, proto_type=None, key=None, has_pii=False)
    })
    def test_main_function(self, mock_log_info: mock.MagicMock) -> None:
        """Basic usage."""

        self.mongo_db.create_collection('missing-in-importers')
        self.mongo_db.create_collection('in-both')
        self.mongo_db.create_collection('in-both-with-meta')
        two_days_ago = (datetime.datetime.now() - datetime.timedelta(days=2)).replace(microsecond=0)
        self.mongo_db.meta.insert_one({
            '_id': 'in-both-with-meta',
            'updated_at': two_days_ago,
        })
        self.mongo_db.create_collection('in-both-not-needed')

        import_status.main([])
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
            _AnyColorText(f'last import: {two_days_ago}'))

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'non-personal': import_status.Importer(
            name='non personal', script=None, args=None, is_imported=True,
            run_every=None, proto_type=None, key=None, has_pii=False),
        'personal': import_status.Importer(
            name='personal', script=None, args=None, is_imported=True,
            run_every=None, proto_type=None, key=None, has_pii=True),
        'personal-no-import': import_status.Importer(
            name='personal not imported', script=None, args=None, is_imported=False,
            run_every=None, proto_type=None, key=None, has_pii=True)
    })
    def test_personal_database(self, mock_log_info: mock.MagicMock) -> None:
        """Check division between personal/non personal databases."""

        self.mongo_db.create_collection('non-personal')
        self.mongo_db.create_collection('personal')
        self.mongo_db.create_collection('personal-no-import')

        import_status.main([])
        mock_log_info.assert_any_call(
            '%s collection%s without importers:', _AnyColorText('1'), ' is')
        # Although non-personal is imported, it should not be as it's a Personal database.
        mock_log_info.assert_any_call(
            'The collection%s with missing importer%s: %s\n',
            '', ' is', _AnyColorText("{'non-personal'}"))

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_display_command(self, mock_log_info: mock.MagicMock) -> None:
        """Display the command to import a missing collection."""

        import_status.main([])
        mock_log_info.assert_any_call(
            '%s collection%s not imported yet:', _AnyColorText('1'), ' is')
        mock_log_info.assert_any_call(
            'To import "%s" in "%s", run:\n%s',
            'Collection name', 'collection_id',
            'docker-compose run --rm -e MONGO_URL=mongodb://test_url/test_db'
            ' data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/importer/my-script-name.py \\\n'
            '    --mongo_collection "collection_id"\n')

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
        'not_displayed': import_status.Importer(
            name='Unimportant name',
            script='other-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_display_command_for_specific_collection(self, mock_log_info: mock.MagicMock) -> None:
        """Display the command to import a specific collection."""

        self.mongo_db.create_collection('not_displayed')
        self.mongo_db.create_collection('collection_id')

        import_status.main(['collection_id'])
        mock_log_info.assert_called_once_with(
            'To import "%s" in "%s", run:\n%s',
            'Collection name', 'collection_id',
            'docker-compose run --rm -e MONGO_URL=mongodb://test_url/test_db'
            ' data-analysis-prepare \\\n'
            '    python bob_emploi/data_analysis/importer/my-script-name.py \\\n'
            '    --mongo_collection "collection_id"\n')

    def test_command_on_one_line(self) -> None:
        """Checks that all importers command are on one line."""

        for name, importer in import_status.IMPORTERS.items():
            self.assertTrue(
                bool(importer.script) == importer.is_imported,
                msg=f'Conflicts in script and is_imported field for {name}')
            if not importer.script:
                continue

            self.assertNotIn(importer.script, '\n', msg=name)
            if importer.args:
                for key, value in importer.args.items():
                    self.assertNotIn(key, '\n', msg=name)
                    self.assertNotIn(value, '\n', msg=f'Importer "{name}", arg "{key}"')

    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={'custom_importer_flag': 'value for custom flag'},
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_run_importer(self, mock_subprocess_run: mock.MagicMock) -> None:
        """Run the command to import a collection."""

        import_status.main(['--run', 'collection_id'])
        mock_subprocess_run.assert_called_once_with([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--custom_importer_flag', 'value for custom flag',
            '--mongo_collection', 'collection_id'], stderr=subprocess.PIPE, check=True)

    @mock.patch(logging.__name__ + '.error')
    @mock.patch(import_status.subprocess.__name__ + '.run', )
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_run_importer_fails(
            self, mock_subprocess_run: mock.MagicMock, mock_log_error: mock.MagicMock) -> None:
        """Run the command to import a collection."""

        mock_subprocess_run.side_effect = subprocess.CalledProcessError(
            2, ['the command'], stderr=b'the error')
        import_status.main(['--run', 'collection_id'])
        mock_subprocess_run.assert_called_once_with([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--mongo_collection', 'collection_id'], stderr=subprocess.PIPE, check=True)
        mock_log_error.assert_any_call(
            'Could not import "%s":\nCommand run: %s\nError: %s',
            'collection_id',
            'the command',
            'the error')

    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={'custom_importer_flag': 'value for custom flag'},
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
        'other_collection_id': import_status.Importer(
            name='Other collection name',
            script='other-script-name',
            args={'custom_importer_flag': 'other value for custom flag'},
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_run_multiple_importers(self, mock_subprocess_run: mock.MagicMock) -> None:
        """Run the commands to import multiple collections."""

        import_status.main([
            '--run', 'collection_id',
            '--run', 'other_collection_id',
        ])
        self.assertEqual(2, mock_subprocess_run.call_count)
        mock_subprocess_run.assert_any_call([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--custom_importer_flag', 'value for custom flag',
            '--mongo_collection', 'collection_id'], stderr=subprocess.PIPE, check=True)
        mock_subprocess_run.assert_any_call([
            'python', '/work/bob_emploi/data_analysis/importer/other-script-name.py',
            '--custom_importer_flag', 'other value for custom flag',
            '--mongo_collection', 'other_collection_id'], stderr=subprocess.PIPE, check=True)

    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={'custom_importer_flag': 'value for custom flag'},
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_run_importer_with_extra_args(self, mock_subprocess_run: mock.MagicMock) -> None:
        """Run the command to import a collection with extra args forwarded."""

        import_status.main(['--run', 'collection_id', '--no_diff'])
        mock_subprocess_run.assert_called_once_with([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--custom_importer_flag', 'value for custom flag',
            '--mongo_collection', 'collection_id', '--no_diff'], stderr=subprocess.PIPE, check=True)

    @mock.patch(logging.__name__ + '.info')
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={
                'needed_data': 'data/my_target',
            },
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_run_importer_with_make_target(
            self, mock_subprocess_run: mock.MagicMock, mock_log_info: mock.MagicMock) -> None:
        """Run the command to import a collection with a target to be made."""

        import_status.main(['--make_data', '--run', 'collection_id'])
        mock_subprocess_run.assert_any_call(
            ['make', 'data/my_target'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            check=True)
        mock_subprocess_run.assert_any_call([
            'python', '/work/bob_emploi/data_analysis/importer/my-script-name.py',
            '--needed_data', 'data/my_target',
            '--mongo_collection', 'collection_id'], stderr=subprocess.PIPE, check=True)
        mock_log_info.assert_any_call(
            'To make the data file(s) needed by %s importer, run:\n%s',
            'Collection name',
            'make \\\n'
            '    data/my_target\n')

    @mock.patch(logging.__name__ + '.error')
    @mock.patch(import_status.subprocess.__name__ + '.run')
    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args={
                'needed_data': 'data/my_target',
            },
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    def test_importer_with_make_target_fails(
            self, mock_subprocess_run: mock.MagicMock, mock_log_error: mock.MagicMock) -> None:
        """Run the command to import a collection with a target to be made."""

        fake_command = [
            'python', 'my-folder/my-script.py', '--long-argument', 'value',
            '--other-arg', 'other-value']
        mock_subprocess_run.side_effect = subprocess.CalledProcessError(
            2, fake_command, stderr=b'the error')
        import_status.main(['--make_data', '--run', 'collection_id'])
        mock_subprocess_run.assert_called_once_with(
            ['make', 'data/my_target'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            check=True)
        mock_log_error.assert_any_call(
            'Could not make "%s":\nCommand run: %s\nError: %s',
            'data/my_target',
            'python my-folder/my-script.py --long-argument value \\\n    --other-arg other-value',
            'the error')

    @mock.patch(logging.__name__ + '.info', new=mock.MagicMock())
    def test_main_unknown_extra_args(self) -> None:
        """Unknown arg."""

        with self.assertRaises(SystemExit):
            import_status.main(['--no_diff'])

    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    @mock.patch(logging.__name__ + '.info')
    def test_revert_import(self, mock_log_info: mock.MagicMock) -> None:
        """Reverting a collection for which there is an archive."""

        self.mongo_db.collection_id.insert_many([{'_id': i} for i in range(10)])
        self.mongo_db.get_collection('collection_id.2019-03-20_5784037a837ed').insert_many([
            {'_id': i} for i in range(10, 20)])
        self.mongo_db.get_collection('collection_id.2019-03-18_45830e7a865fa').insert_many([
            {'_id': i} for i in range(20, 30)])
        import_status.main(['--revert', 'collection_id'])
        mock_log_info.assert_called_with(
            'Reverting collection "%s" to version from %s…', 'collection_id', '2019-03-20')
        self.assertEqual(
            list(range(10, 20)), [doc['_id'] for doc in self.mongo_db.collection_id.find({})])
        self.assertNotIn(
            'collection_id.2019-03-20_5784037a837ed', self.mongo_db.list_collection_names())

    @mock.patch(import_status.__name__ + '.IMPORTERS', new={
        'collection_id': import_status.Importer(
            name='Collection name',
            script='my-script-name',
            args=None,
            is_imported=True,
            run_every=None,
            proto_type=None, key=None, has_pii=False),
    })
    @mock.patch(logging.__name__ + '.error')
    def test_revert_missing_archive(self, mock_log_error: mock.MagicMock) -> None:
        """Do nothing when reverting a collection without archive."""

        self.mongo_db.collection_id.insert_many([{'_id': i} for i in range(10)])
        import_status.main(['--revert', 'collection_id'])
        mock_log_error.assert_called_once()
        self.assertIn('collection_id', mock_log_error.call_args[0])
        self.assertEqual(
            list(range(10)), [doc['_id'] for doc in self.mongo_db.collection_id.find({})])


class ImportStatusSyncTests(unittest.TestCase):
    """Test that importers are sync with schedule tasks."""

    def _get_task_scheduling(self, rules: List[Dict[str, Any]], directory: str) -> Dict[str, str]:
        scheduled_tasks = {}
        for rule in rules:
            schedule_expression = rule.get('ScheduleExpression')
            if not schedule_expression:
                continue
            rule_file = rule.get('Name')
            if not rule_file:
                continue
            with open(f'{directory}{rule_file}.json') as rule_json:
                rule_content = json.load(rule_json)
            rule_type = rule_content['Targets'][0]['Id']
            if rule_type != 'import':
                continue
            importer_name = rule_content['Targets'][0]['Input'][
                'containerOverrides'][0]['command'][3]
            scheduled_tasks[importer_name] = schedule_expression
        return scheduled_tasks

    def test_schedule_time(self) -> None:
        """Check sync between schedule time in tasks and import_status"""

        importers = import_status.IMPORTERS
        scheduled_tasks_dir = 'bob_emploi/frontend/release/scheduled-tasks/'
        with open(f'{scheduled_tasks_dir}index.json') as index_json:
            rules = json.load(index_json)
        scheduled_tasks = self._get_task_scheduling(rules.get('Rules', []), scheduled_tasks_dir)

        importers_schedule = {
            importer_name: f'rate({importer.run_every})'
            for importer_name, importer in importers.items()
            if importer.run_every
        }
        self.assertEqual(scheduled_tasks, importers_schedule)

    def test_rule_names(self) -> None:
        """Check sync between ARN and rule names in scheduled tasks."""

        scheduled_tasks_dir = 'bob_emploi/frontend/release/scheduled-tasks/'
        with open(f'{scheduled_tasks_dir}index.json') as index_json:
            rules = json.load(index_json)
        for rule in rules.get('Rules', []):
            schedule_expression = rule.get('ScheduleExpression')
            if not schedule_expression:
                continue
            rule_name = rule.get('Name')
            self.assertTrue(rule_name, 'The rule has no name.')
            self.assertTrue(
                rule.get('Arn').endswith(f'/{rule_name}'),
                'The Amazon Ressource Name and the rule name are different.')


@mock.patch(import_status.__name__ + '._MONGO_URL', _FAKE_MONGO_URL)
@mock.patch.dict(import_status.IMPORTERS, {})
class ImportStatusPluginTest(unittest.TestCase):
    """Test the plugin interface."""

    @mock.patch('logging.info')
    def test_plugin_relative_module(self, mock_log_info: mock.MagicMock) -> None:
        """Plug-in a relative module."""

        import_status.main(['--plugin', '.test.test_plugin', 'plugged-in'])
        mock_log_info.assert_called_once()
        self.assertIn(_AnyColorText('plugged-in'), mock_log_info.call_args[0])

    @mock.patch('logging.info')
    def test_plugin_absolute_module(self, mock_log_info: mock.MagicMock) -> None:
        """Plug-in an absolute module."""

        import_status.main(
            ['--plugin', 'bob_emploi.data_analysis.importer.test.test_plugin', 'plugged-in'])
        mock_log_info.assert_called_once()
        self.assertIn(_AnyColorText('plugged-in'), mock_log_info.call_args[0])

    @mock.patch('logging.info')
    def test_plugin_update(self, mock_log_info: mock.MagicMock) -> None:
        """Plug-in can update existing importers."""

        import_status.main(['--plugin', '.test.test_plugin', 'job_group_info'])
        mock_log_info.assert_called_once()
        self.assertTrue(
            any('some-script.py' in arg for arg in mock_log_info.call_args[0]),
            msg=mock_log_info.call_args[0])

    def test_unknown_plugin(self) -> None:
        """Plugin a missing module."""

        with self.assertRaises(ModuleNotFoundError):
            import_status.main(
                ['--plugin', 'bob_emploi.data_analysis.importer.test.not_a_plugin', 'plugged-in'])


if __name__ == '__main__':
    unittest.main()
