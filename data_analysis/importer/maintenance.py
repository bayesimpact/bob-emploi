"""Maintenance tasks for the various imports.

It checks the integrity of the various collections and their correspondance
with the server code. For instance it checks that all scoring models defined in
the code are used at least once in one of the collections.

Run it regularly with the command:
    docker-compose run --rm data-analysis-prepare \
        importer/maintenance.py mongodb://frontend-db/test
"""

# TODO(pascal): Run it automatically (weekly ?) and send the results to slack.
import logging
import re
import sys
import typing
from typing import Any, Dict, ItemsView, Iterable, Iterator, Set, Tuple

import pymongo
import requests
import tqdm

from bob_emploi.data_analysis.importer import import_status
from bob_emploi.data_analysis.lib import checker
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import scoring_base


class _MongoField(typing.NamedTuple):
    collection: str
    field_name: str


_INDICES = {
    _MongoField('helper', 'email'),
    _MongoField('user', 'hashedEmail'),
    _MongoField('user', 'facebookId'),
    _MongoField('user', 'googleId'),
    _MongoField('user', 'peConnectId'),
    _MongoField('user', 'linkedInId'),
    _MongoField('user', 'supportTickets.ticketId'),
}

# Some websites return error codes when no header is set.
_HTTP_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36')
}


def _iterate_all_records(
        mongo_db: pymongo.database.Database,
        mongo_fields: Iterable[_MongoField], field_type: str) \
        -> Iterator[Tuple[str, Dict[str, Any], str]]:
    db_collections = set(mongo_db.list_collection_names())
    for collection, field_name in mongo_fields:
        if collection not in db_collections:
            logging.error('The collection "%s" does not exist.', collection)
            continue
        records = mongo_db.get_collection(collection).\
            find({field_name: {'$exists': True}}, {field_name: 1})
        if not records.count():
            logging.error('The collection "%s" has no field "%s".', collection, field_name)
            continue
        has_at_least_one_field = False

        for record in records:
            field_value = record[field_name]
            if not field_value:
                continue
            has_at_least_one_field = True
            yield field_value, record, collection

        if not has_at_least_one_field:
            logging.error(
                'The collection "%s" has no %ss in its field "%s"',
                collection, field_type, field_name)


def _is_application_internal_url(url: str) -> bool:
    return url.startswith('/')


def check_scoring_models(mongo_db: pymongo.database.Database) -> None:
    """Check that all scoring models are valid and warn on unused ones."""

    scoring_model_fields = \
        _list_formatted_fields(import_status.IMPORTERS.items(), options_pb2.SCORING_MODEL_ID)

    used_scoring_models = set()
    records = list(_iterate_all_records(mongo_db, scoring_model_fields, 'scoring model'))
    for field_value, record, collection in tqdm.tqdm(records):
        if isinstance(field_value, list):
            field_values = field_value
        else:
            field_values = [field_value]
        for scoring_model in field_values:
            if not scoring.get_scoring_model(scoring_model):
                logging.error(
                    'Unknown scoring model "%s" in the collection "%s", record "%s".',
                    scoring_model, collection, record['_id'])
            used_scoring_models.add(scoring_model)

    unused_scoring_models = scoring.SCORING_MODELS.keys() - used_scoring_models
    for scoring_model in unused_scoring_models:
        logging.warning('Scoring model unused: %s', scoring_model)


# TODO(cyrille): Deal with fields from proto which are unused in some collections.
def _list_formatted_fields(
        importers: ItemsView[str, import_status.Importer],
        field_format: options_pb2.StringFormat) -> Iterator[_MongoField]:
    for collection_name, importer in importers:
        if not importer.proto_type:
            continue
        for field in importer.proto_type.DESCRIPTOR.fields_by_name.values():
            field_string_formats = field.GetOptions().Extensions[options_pb2.string_format]
            if field_format in field_string_formats:
                yield _MongoField(collection_name, field.camelcase_name)


def check_urls(mongo_db: pymongo.database.Database) -> None:
    """Check that all links are valid."""

    url_fields = _list_formatted_fields(import_status.IMPORTERS.items(), options_pb2.URL_FORMAT)
    url_checker = checker.UrlChecker()

    records = list(_iterate_all_records(mongo_db, url_fields, 'link'))
    for url, record, collection in tqdm.tqdm(records):
        if _is_application_internal_url(url):
            continue
        try:
            url_checker.check_value(url)
        except ValueError:
            logging.error(
                'Malformed URL in record "%s" in collection "%s":\n%s',
                record.get('_id'), collection, url)
            continue
        try:
            res = requests.get(url, headers=_HTTP_HEADERS)
            if res.status_code != 200:
                logging.error(
                    'HTTP Error %d while trying to access the URL of the record "%s" '
                    'in collection "%s":\n%s',
                    res.status_code, record.get('_id'), collection, url)
        except requests.exceptions.SSLError:
            # When I checked, they were all false positives.
            pass
        except Exception as exception:  # pylint: disable=broad-except
            logging.error(
                'Error %s while trying to access the URL of the record "%s" '
                'in collection "%s":\n%s',
                type(exception).__name__, record.get('_id'), collection, url)


def _get_variables_from(template: str) -> Set[str]:
    if '%' not in template:
        return set()
    # pylint: disable=protected-access
    pattern = re.compile('|'.join(scoring_base._TEMPLATE_VARIABLES.keys()))
    return set(pattern.findall(template))


def check_template_variables(mongo_db: pymongo.database.Database) -> None:
    """Check that all template variables are defined and well used."""

    template_checker = checker.MissingTemplateVarsChecker()
    unused_vars = set(scoring_base._TEMPLATE_VARIABLES.keys())  # pylint: disable=protected-access
    template_fields = _list_formatted_fields(
        import_status.IMPORTERS.items(), options_pb2.SCORING_PROJECT_TEMPLATE)

    records = list(_iterate_all_records(mongo_db, template_fields, 'template'))
    for template, record, collection in tqdm.tqdm(records):
        try:
            template_checker.check_value(template)
        except ValueError as err:
            logging.error('%s in record "%s" from collection "%s"', err, record['_id'], collection)
        unused_vars -= _get_variables_from(template)
    if unused_vars:
        logging.error('There were some unused variables:\n%s', ', '.join(unused_vars))


def ensure_indices(mongo_db: pymongo.database.Database) -> None:
    """Ensure that indices exist on relevant collections."""

    db_collections = set(mongo_db.list_collection_names())
    for collection, field in _INDICES:
        if collection not in db_collections:
            logging.error('The collection "%s" does not exist.', collection)
            continue
        mongo_db.get_collection(collection).create_index({field: 1})


def main(mongo_url: str) -> None:
    """Handle all maintenance tasks."""

    mongo_db = pymongo.MongoClient(mongo_url).get_database()
    ensure_indices(mongo_db)
    check_scoring_models(mongo_db)
    check_urls(mongo_db)
    check_template_variables(mongo_db)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
