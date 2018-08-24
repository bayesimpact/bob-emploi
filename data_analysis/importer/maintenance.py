"""Maintenance tasks for the various imports.

It checks the integrity of the various collections and their correspondance
with the server code. For instance it checks that all scoring models defined in
the code are used at least once in one of the collections.

Run it regularly with the command:
    docker-compose run --rm data-analysis-prepare \
        importer/maintenance.py mongodb://frontend-db/test
"""

# TODO(pascal): Run it automatically (weekly ?) and send the results to slack.
import collections
import logging
import sys

import pymongo
import requests
import tqdm

from bob_emploi.frontend.server import scoring

_MongoField = collections.namedtuple('MongoField', ['collection', 'field_name'])

_INDICES = {
    _MongoField('helper', 'email'),
    _MongoField('user', 'hashedEmail'),
    _MongoField('user', 'facebookId'),
    _MongoField('user', 'googleId'),
    _MongoField('user', 'peConnectId'),
    _MongoField('user', 'linkedInId'),
}

_SCORING_MODEL_FIELDS = {
    _MongoField('advice_modules', 'triggerScoringModel'),
    _MongoField('application_tips', 'filters'),
    _MongoField('associations', 'filters'),
    _MongoField('contact_lead', 'filters'),
    _MongoField('diagnostic_sentences', 'filters'),
    _MongoField('events', 'filters'),
    _MongoField('jobboards', 'filters'),
    _MongoField('tip_templates', 'filters'),
}

# TODO(cyrille): Add recently added url fields.
_URL_FIELDS = {
    _MongoField('associations', 'link'),
    _MongoField('jobboards', 'link'),
    _MongoField('tip_templates', 'link'),
}

# Some websites return error codes when no header is set.
_HTTP_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36')
}


def _iterate_all_records(mongo_db, mongo_fields, field_type):
    db_collections = set(mongo_db.collection_names())
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


def _is_application_internal_url(url):
    return url.startswith('/')


def check_scoring_models(mongo_db):
    """Check that all scoring models are valid and warn on unused ones."""

    used_scoring_models = set()
    records = list(_iterate_all_records(mongo_db, _SCORING_MODEL_FIELDS, 'scoring model'))
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


def check_urls(mongo_db):
    """Check that all links are valid."""

    records = list(_iterate_all_records(mongo_db, _URL_FIELDS, 'link'))
    for url, record, collection in tqdm.tqdm(records):
        if _is_application_internal_url(url):
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


def ensure_indices(mongo_db):
    """Ensure that indices exist on relevant collections."""

    db_collections = set(mongo_db.collection_names())
    for collection, field in _INDICES:
        if collection not in db_collections:
            logging.error('The collection "%s" does not exist.', collection)
            continue
        mongo_db.get_collection(collection).create_index({field: 1})


def main(mongo_url):
    """Handle all maintenance tasks."""

    mongo_db = pymongo.MongoClient(mongo_url).get_default_database()
    ensure_indices(mongo_db)
    check_scoring_models(mongo_db)
    check_urls(mongo_db)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
