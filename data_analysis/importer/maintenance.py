"""Maintenance tasks for the various imports.

It checks the integrity of the various collections and their correspondance
with the server code. For instance it checks that all scoring models defined in
the code are used at least once in one of the collections.

Run it regularly with the command:
    docker-compose run --rm data-analysis-prepare \
        importer/maintenance.py mongodb://frontend-db/test
"""

# TODO(pascal): Send the results to slack.
import argparse
import logging
import re
import os
import typing
from typing import ItemsView, Iterable, Iterator, Optional, Set, Tuple

from airtable import airtable
import pymongo
import requests
import tqdm

from bob_emploi.data_analysis.importer import importers
from bob_emploi.data_analysis.importer import import_status
from bob_emploi.common.python import checker
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.server import scoring

_AIRTABLE_BASE_ID = 'appXmyc7yYj0pOcae'
# See the result at https://airtable.com/tblJYesuqUHrcISMe
_AIRTABLE_USED_VARIABLES_TABLE = 'tblJYesuqUHrcISMe'


class _MongoField(typing.NamedTuple):
    collection: str
    field_name: str


_USERS_INDICES = {
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


class MongoReference(typing.NamedTuple):
    """A reference to a specific value in a mongo record."""

    collection: str
    field_name: str
    field_value: str
    record_id: str


def _iterate_all_records(
        mongo_db: pymongo.database.Database,
        mongo_fields: Iterable[_MongoField], field_type: str) -> Iterator[MongoReference]:
    db_collections = set(mongo_db.list_collection_names())
    for collection, field_name in mongo_fields:
        if collection not in db_collections:
            logging.error('The collection "%s" does not exist.', collection)
            continue
        records = mongo_db.get_collection(collection).\
            find({field_name: {'$exists': True}}, {field_name: 1})
        has_at_least_one_field = False
        has_at_least_one_value = False

        for record in records:
            field_value = record[field_name]
            has_at_least_one_field = True
            if not field_value:
                continue
            has_at_least_one_value = True
            yield MongoReference(collection, field_name, field_value, record['_id'])

        if not has_at_least_one_field:
            logging.error('The collection "%s" has no field "%s".', collection, field_name)
            continue

        if not has_at_least_one_value:
            logging.error(
                'The collection "%s" has no %ss in its field "%s"',
                collection, field_type, field_name)


def _iterate_translations_templates(mongo_db: pymongo.database.Database) \
        -> Iterator[MongoReference]:
    if 'translations' not in set(mongo_db.list_collection_names()):
        logging.error('The database doe not contains any "translations" collection.')
        return
    for record in mongo_db.translations.find({}):
        record.pop('_id')
        string = record.pop('string')
        for lang, translation in record.items():
            if isinstance(translation, str) and '%' in translation:
                yield MongoReference('translations', lang, translation, string)


def _is_application_internal_url(url: str) -> bool:
    return url.startswith('/')


def check_scoring_models(mongo_db: pymongo.database.Database) -> None:
    """Check that all scoring models are valid and warn on unused ones."""

    scoring_model_fields = \
        _list_formatted_fields(import_status.get_importers().items(), options_pb2.SCORING_MODEL_ID)

    used_scoring_models = set()
    records = list(_iterate_all_records(mongo_db, scoring_model_fields, 'scoring model'))
    for collection, unused_field, field_value, record_id in tqdm.tqdm(records):
        if isinstance(field_value, list):
            field_values = field_value
        else:
            field_values = [field_value]
        for scoring_model in field_values:
            if not scoring.get_scoring_model(scoring_model):
                logging.error(
                    'Unknown scoring model "%s" in the collection "%s", record "%s".',
                    scoring_model, collection, record_id)
            used_scoring_models.add(scoring_model)

    # TODO(cyrille): Also check SCORING_MODEL_REGEXPS.
    unused_scoring_models = scoring.SCORING_MODELS.keys() - used_scoring_models
    for scoring_model in unused_scoring_models:
        logging.warning('Scoring model unused: %s', scoring_model)


# TODO(cyrille): Deal with fields from proto which are unused in some collections.
def _list_formatted_fields(
        all_importers: ItemsView[str, importers.Importer],
        field_format: 'options_pb2.StringFormat.V') -> Iterator[_MongoField]:
    for collection_name, importer in all_importers:
        if not importer.proto_type:
            continue
        for field in importer.proto_type.DESCRIPTOR.fields_by_name.values():
            field_string_formats = field.GetOptions().Extensions[options_pb2.string_format]
            if field_format in field_string_formats:
                yield _MongoField(collection_name, field.camelcase_name)


class _UrlSiteChecker:
    """A class to check that websites are still up."""

    def __init__(self) -> None:
        self._checked: dict[str, Optional[str]] = {}
        self._valid_url_checker = checker.UrlChecker()

    def _check(self, url: str) -> Optional[str]:
        try:
            self._valid_url_checker.check_value(url, 'fr')
        except ValueError:
            return 'Malformed URL'

        try:
            res = requests.get(url, headers=_HTTP_HEADERS)
            if res.status_code != 200:
                return f'HTTP Error {res.status_code} while trying to access the URL'
        except requests.exceptions.SSLError:
            # When I checked, they were all false positives.
            pass
        except Exception as exception:  # pylint: disable=broad-except
            return f'Error {type(exception).__name__} while trying to access the URL'

        return None

    def check_url(self, url: str, reason: str) -> None:
        """Check that an URL is valid and is linking to an existing website."""

        if _is_application_internal_url(url):
            return

        if url in self._checked:
            result = self._checked[url]
        else:
            result = self._check(url)
            self._checked[url] = result

        if not result:
            return

        logging.error('%s %s:\n%s', result, reason, url)


def check_urls(mongo_db: pymongo.database.Database) -> None:
    """Check that all links are valid."""

    url_fields = _list_formatted_fields(
        import_status.get_importers().items(), options_pb2.URL_FORMAT)
    url_checker = _UrlSiteChecker()

    records = list(_iterate_all_records(mongo_db, url_fields, 'link'))
    for collection, unused_field, url, record_id in tqdm.tqdm(records):
        url_checker.check_url(url, f' of record "{record_id}" in collection "{collection}"')


def _get_variables_from(template: str) -> Set[str]:
    if '%' not in template:
        return set()
    # pylint: disable=protected-access
    pattern = re.compile('|'.join(scoring.scoring_base._TEMPLATE_VARIABLES.keys()))
    return set(pattern.findall(template))


def check_template_variables(mongo_db: pymongo.database.Database) -> None:
    """Check that all template variables are defined and well used."""

    airtable_api_key = os.getenv('AIRTABLE_API_KEY')
    airtable_client: Optional[airtable.Airtable] = None
    airtable_keys: Optional[dict[Tuple[str, str], str]] = None
    if airtable_api_key:
        airtable_client = airtable.Airtable(_AIRTABLE_BASE_ID, airtable_api_key)
        # This list all (origin, variable) pairs in the Airtable table,
        # and return the relevant record, for possible update.
        airtable_keys = {
            (record['fields']['origin'], record['fields']['variable']): record['id']
            for record in airtable_client.iterate(_AIRTABLE_USED_VARIABLES_TABLE)}
    else:
        logging.warning(
            "AIRTABLE_API_KEY is not set. The used variables won't be uploaded to airtable.")
    template_checker = checker.MissingTemplateVarsChecker()
    unused_vars = set(scoring.scoring_base._TEMPLATE_VARIABLES.keys())  # pylint: disable=protected-access
    template_fields = _list_formatted_fields(
        import_status.get_importers().items(), options_pb2.SCORING_PROJECT_TEMPLATE)

    # TODO(cyrille): Also check strings from server.
    records = list(_iterate_all_records(mongo_db, template_fields, 'template')) + \
        list(_iterate_translations_templates(mongo_db))
    for collection, field_name, template, record_id in tqdm.tqdm(records):
        try:
            template_checker.check_value(template, 'fr')
        except ValueError as err:
            logging.error('%s in record "%s" from collection "%s"', err, record_id, collection)
        template_variables = _get_variables_from(template)
        unused_vars -= template_variables
        if not airtable_client:
            continue
        origin = f'{collection}:{record_id}:{field_name}'
        for variable in template_variables:
            airtable_record = {
                'origin': origin,
                'template': template,
                'variable': variable,
            }
            if not airtable_client or airtable_keys is None:
                continue
            try:
                airtable_client.update(
                    _AIRTABLE_USED_VARIABLES_TABLE,
                    airtable_keys[origin, variable], airtable_record)
            except KeyError:
                airtable_client.create(_AIRTABLE_USED_VARIABLES_TABLE, airtable_record)
    if unused_vars:
        logging.error('There were some unused variables:\n%s', ', '.join(unused_vars))


def ensure_users_indices(mongo_db: pymongo.database.Database) -> None:
    """Ensure that indices exist on relevant collections."""

    db_collections = set(mongo_db.list_collection_names())
    for collection, field in _USERS_INDICES:
        if collection not in db_collections:
            logging.error('The collection "%s" does not exist.', collection)
            continue
        mongo_db.get_collection(collection).create_index([(field, pymongo.ASCENDING)])


def main(string_args: Optional[list[str]] = None) -> None:
    """Handle all maintenance tasks."""

    parser = argparse.ArgumentParser(
        description='Maintenance script for databases.')
    parser.add_argument(
        '--deployment', nargs=3, action='append',
        help='Deployment name and mongo URLs for deployment-specific databases (data, then users).')
    parser.add_argument(
        '--checks', action='append',
        choices=['indices', 'scoring-models', 'URLs', 'template-variables'])
    args = parser.parse_args(string_args)
    for deployment, mongo_url, users_mongo_url in args.deployment:
        logging.info('Running maintenance on deployment "%s".', deployment)
        if not args.checks or 'indices' in args.checks:
            if users_mongo_url.isupper():
                users_mongo_url = os.getenv(users_mongo_url)
            users_db = pymongo.MongoClient(users_mongo_url).get_database()
            ensure_users_indices(users_db)

        if mongo_url.isupper():
            mongo_url = os.getenv(mongo_url)
        mongo_db = pymongo.MongoClient(mongo_url).get_database()
        if not args.checks or 'scoring-models' in args.checks:
            check_scoring_models(mongo_db)
        if not args.checks or 'URLs' in args.checks:
            check_urls(mongo_db)
        if not args.checks or 'template-variables' in args.checks:
            check_template_variables(mongo_db)


if __name__ == '__main__':
    main()
