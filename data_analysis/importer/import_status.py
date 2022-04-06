"""A tool to check the status of our imports to the DB.

Background information: http://go/pe:import-status

The second, and optional, parameter is to get details on a certain collection.

Make sure you have mongo url set it in your environment as MONGO_URL.
Run it with:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/import_status.py \
        [collection_name]
Note that if you want to run the importer directly, you have to specify the
MONGO_URL environment variable, e.g.
    docker-compose run --rm -e MONGO_URL="mongodb://frontend-db/test" \
        data-analysis-prepare \
        python bob_emploi/data_analysis/importer/import_status.py \
        [collection_name]
"""

import argparse
import collections
import logging
import os
import re
import subprocess
import typing
from typing import Any, Optional, Set

import pymongo
import sentry_sdk
from sentry_sdk.integrations import logging as sentry_logging
import termcolor

from bob_emploi.data_analysis.importer import deployments
# Importers should be accessed from the get_importers function, not from importers.
from bob_emploi.data_analysis.importer import importers

_DEFAULT_DEPLOYMENT = os.getenv('BOB_DEPLOYMENT', 'fr')


_ARCHIVE_NAME_MATCH = re.compile(r'\.\d{4}-\d\d-\d\d_[0-9a-f]{4,16}$')

# Get mongo URL from the environment.
_MONGO_URL = os.getenv('MONGO_URL') or ''

# Get sentry dsn from the environment.
_SENTRY_DSN = os.getenv('SENTRY_DSN') or ''


class _CollectionsDiff(typing.NamedTuple):
    collection_missing: Set[str]
    importer_missing: Set[str]
    imported: Set[str]


_MAINTENANCE_COLLECTIONS = {'meta', 'system.indexes', 'objectlabs-system'}

_ImportersType = dict[str, importers.Importer]


def get_importers(deployment: str = _DEFAULT_DEPLOYMENT) -> _ImportersType:
    """Get the list of all importers for a given deployment."""

    return deployments.get_importers(deployment)


def is_personal_database(collection_names: Set[str], all_importers: _ImportersType) -> bool:
    """Determines if this is a database with PII collections or not."""

    imported = collection_names & all_importers.keys()
    # We consider a DB to be personal if at least 2 collections are personal,
    # that way we can detect when a personal collection landed wrongly in a
    # non-personal database.
    return sum(1 for name in imported if all_importers[name].has_pii) > 1


def _is_archive(collection_name: str) -> bool:
    return bool(_ARCHIVE_NAME_MATCH.search(collection_name))


def compute_collections_diff(
        all_importers: _ImportersType, db_client: pymongo.database.Database) -> _CollectionsDiff:
    """Determine which collections have been imported and which are missing."""

    collection_names = {
        name for name in db_client.list_collection_names()
        if name not in _MAINTENANCE_COLLECTIONS and not _is_archive(name)
    }
    is_personal = is_personal_database(collection_names, all_importers)
    personal_safe_importers = {
        key: importer for key, importer in all_importers.items()
        if importer.has_pii == is_personal
    }

    importers_to_import = {
        key for key, importer in personal_safe_importers.items() if importer.is_imported
    }
    return _CollectionsDiff(
        collection_missing=importers_to_import - collection_names,
        importer_missing=collection_names - personal_safe_importers.keys(),
        imported=collection_names & personal_safe_importers.keys(),
    )


def get_meta_info(db_client: pymongo.database.Database) -> dict[str, dict[str, Any]]:
    """Get meta information for a specific collection."""

    meta_collection = db_client.meta.find()
    return {meta['_id']: meta for meta in meta_collection}


def _plural(count: int) -> str:
    return ' is' if count == 1 else 's are'


def _bold(value: Any) -> str:
    return termcolor.colored(str(value), 'white', attrs=['bold'])


def print_single_importer(
        importer: importers.Importer, collection_name: str, extra_args: list[str]) -> None:
    """Show detailed information for a single importer."""

    if not importer.is_imported:
        logging.info('No import needed for %s', termcolor.colored(collection_name, 'green'))
        return

    data_targets = list(_get_importer_targets(importer))
    if data_targets:
        make_command = ' \\\n    '.join(['make'] + data_targets) + '\n'
        logging.info(
            'To make the data file(s) needed by %s importer, run:\n%s',
            importer.name, make_command)

    args = collections.OrderedDict(importer.args or {})
    args['mongo_collection'] = collection_name
    command = ' \\\n    '.join(
        [
            'docker-compose run --rm -e MONGO_URL="<your mongo URL>" data-analysis-prepare',
            f'python bob_emploi/data_analysis/importer/{importer.script}.py',
        ] + [f'--{key} "{value}"' for key, value in args.items() if value] + extra_args
    ) + '\n'

    logging.info(
        'To import "%s" in "%s", run:\n%s',
        importer.name, collection_name, command)


def _get_importer_targets(importer: importers.Importer) -> Set[str]:
    if not importer.args:
        return set()

    return {target for target in importer.args.values() if target and target.startswith('data/')}


def _show_command(cmd: list[str]) -> str:
    res = ''
    row = ''
    for arg in cmd:
        row += arg + ' '
        if len(row) > 40 and not arg.startswith('--'):
            row += '\\\n    '
            res += row
            row = ''
    return (res + row).strip()


def _log_subprocess_output(pipe: bytes) -> None:
    for line in pipe.splitlines():  # b'\n'-separated lines
        logging.info('%r', line.decode('utf-8'))


def _make_data_targets(importer: importers.Importer) -> bool:
    data_targets = list(_get_importer_targets(importer))
    if not data_targets:
        return True
    logging.info('Making data targets…')
    try:
        process = subprocess.run(
            ['make'] + data_targets, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
        if process.stdout:
            _log_subprocess_output(process.stdout)
    except subprocess.CalledProcessError as err:
        logging.error(
            'Could not make "%s":\nCommand run: %s\nError: %s',
            ', '.join(data_targets),
            _show_command(err.cmd),
            (err.stderr or err.stdout).decode('utf-8'))
        return False
    logging.info('Data targets made.')
    return True


def _revert_collection(collection_name: str, database: pymongo.database.Database) -> None:
    archived_collections = sorted((
        name for name in database.list_collection_names()
        if _is_archive(name) and name.startswith(collection_name)), reverse=True)
    if not archived_collections:
        logging.error(
            'No archived version of collection "%s" found, cannot revert.', collection_name)
        return
    name_length = len(collection_name)
    archive = archived_collections[0]
    archive_date = archive[name_length + 1:name_length + 11]
    logging.info('Reverting collection "%s" to version from %s…', collection_name, archive_date)
    database[archive].rename(collection_name, dropTarget=True)


def _run_importer(
        importer: importers.Importer, collection_name: str, extra_args: list[str]) -> None:

    args = collections.OrderedDict(importer.args or {})
    args['mongo_collection'] = collection_name
    if importer.run_every:
        args['run_every'] = importer.run_every

    logging.info('Running importer…')
    try:
        subprocess.run(
            ['python', os.path.join(os.path.dirname(__file__), f'{importer.script}.py')] +
            [arg for key, value in args.items() if value for arg in (f'--{key}', value)] +
            extra_args, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError as err:
        logging.error(
            'Could not import "%s":\nCommand run: %s\nError: %s',
            collection_name,
            _show_command(err.cmd),
            err.stderr.decode('utf-8'))


def _warn_unknown_collection(collection_name: str, all_importers: _ImportersType) -> None:
    logging.info(
        'Collection details - unknown collection (%s). Should be one of:\n  %s',
        termcolor.colored(collection_name, 'red'), '\n  '.join(sorted(all_importers.keys())))


def _print_report(
        db_client: pymongo.database.Database, extra_args: list[str],
        all_importers: _ImportersType) -> None:
    diff = compute_collections_diff(all_importers, db_client)

    n_collections_missing = len(diff.collection_missing)
    logging.info(
        '%s collection%s not imported yet:',
        _bold(n_collections_missing), _plural(n_collections_missing))
    if diff.collection_missing:
        logging.info(
            'The missing collection%s: %s\n',
            _plural(n_collections_missing),
            termcolor.colored(str(diff.collection_missing), 'red'))
        for missing_collection in diff.collection_missing:
            importer = all_importers[missing_collection]
            print_single_importer(importer, missing_collection, extra_args)

    n_importers_missing = len(diff.importer_missing)
    logging.info(
        '%s collection%s without importers:',
        _bold(n_importers_missing), _plural(n_importers_missing))
    if diff.importer_missing:
        logging.info(
            'The collection%s with missing importer%s: %s\n',
            's' if n_importers_missing > 1 else '',
            _plural(n_importers_missing),
            termcolor.colored(str(diff.importer_missing), 'red'))

    logging.info(
        'Status report on imported collections (%d):',
        len(diff.imported))
    meta_info = get_meta_info(db_client)
    for collection_name in sorted(diff.imported):
        importer = all_importers[collection_name]
        if not importer.is_imported:
            status = termcolor.colored('No import needed', 'green')
        elif collection_name in meta_info:
            status = termcolor.colored(
                f'last import: {meta_info[collection_name]["updated_at"]}',
                'green')
        else:
            status = termcolor.colored('Metainformation missing', 'red')
        logging.info(
            '\t%s - %s - %s',
            _bold(collection_name),
            str(importer),
            status)

    logging.info('Please remember to import the other deployments if needed.')


class _Registerable(typing.Protocol):
    def register(self) -> None:
        """Register this element."""

        ...


def main(string_args: Optional[list[str]] = None) -> None:
    """Print a report on which collections have been imported."""

    if not _MONGO_URL:
        logging.info('Database is missing')
        return

    all_deployments = set(deployments.list_all_deployments())

    deployment_parser = argparse.ArgumentParser(
        add_help=False,
        description='Specify for which deployment you want to import',
        exit_on_error=False)
    plugin_action = deployment_parser.add_argument(
        '--plugin', help='[DEPRECATED] Use --deployment or BOB_DEPLOYMENT env var.', nargs='?')
    deployment_parser.add_argument(
        '--deployment', help='Name of the deployment you want to import to.',
        default=_DEFAULT_DEPLOYMENT, choices=all_deployments)
    deployment_args, main_args = deployment_parser.parse_known_args(string_args)
    if deployment_args.plugin:
        raise argparse.ArgumentError(
            plugin_action, '--plugin is deprecated, use --deployment or BOB_DEPLOYMENT env var.')
    all_importers = get_importers(deployment_args.deployment)

    parser = argparse.ArgumentParser(
        description='Print a report on which collections have been imported',
        exit_on_error=False)
    # Unused, but needed for help.
    parser.add_argument(
        '--deployment', help='Name of the deployment you want to import to.',
        default=_DEFAULT_DEPLOYMENT, choices=all_deployments)

    main_action = parser.add_mutually_exclusive_group()
    collection_names = sorted(all_importers.keys())
    main_action.add_argument(
        'collection_name', help='Name of the collection to specifically display', nargs='?',
        choices=collection_names)
    main_action.add_argument(
        '--run', action='append', help='Run the command to import the collection specified',
        choices=collection_names)
    main_action.add_argument(
        '--revert', action='append', help='Return the specified collection to its previous state.',
        choices=collection_names)

    parser.add_argument(
        '--make_data', action='store_true', help='Run the make rule to retrieve the needed data.')
    args, unknown_args = parser.parse_known_args(main_args)
    if unknown_args and not args.run:
        raise argparse.ArgumentError(None, f'Unknown args: {unknown_args}')

    db_client = pymongo.MongoClient(_MONGO_URL).get_database()

    if args.collection_name:
        try:
            print_single_importer(
                all_importers[args.collection_name], args.collection_name, unknown_args)
        except KeyError:
            _warn_unknown_collection(args.collection_name, all_importers)
        return

    for collection_name in (args.run or []):
        try:
            importer = all_importers[collection_name]
            print_single_importer(importer, collection_name, unknown_args)
            if not args.make_data or _make_data_targets(importer):
                _run_importer(importer, collection_name, unknown_args)
        except KeyError:
            _warn_unknown_collection(collection_name, all_importers)

    for collection_name in (args.revert or []):
        if collection_name in all_importers:
            _revert_collection(collection_name, db_client)
        else:
            _warn_unknown_collection(collection_name, all_importers)

    if not args.revert and not args.run:
        _print_report(db_client, unknown_args, all_importers)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    if _SENTRY_DSN:
        # Setup logging basic's config first so that we also get basic logging to STDERR.
        # TODO(sil): Add info on which release version we are on.
        # TODO(pascal): Fix when https://github.com/getsentry/sentry-python/issues/1081 is solved.
        sentry_sdk.init(  # pylint: disable=abstract-class-instantiated
            dsn=_SENTRY_DSN,
            integrations=[
                sentry_logging.LoggingIntegration(level=logging.INFO, event_level=logging.WARNING)]
        )
    main()
