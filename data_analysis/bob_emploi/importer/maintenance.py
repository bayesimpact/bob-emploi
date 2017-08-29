"""Maintenance tasks for the various imports.

It checks the integrity of the various collections and their correspondance
with the server code. For instance it checks that all scoring models defined in
the code are used at least once in one of the collections.

Run it regularly with the command:
    docker-compose run --rm data-analysis-prepare \
        bob_emploi/frontend/asynchronous/maintenance.py mongodb://frontend-db/test
"""
# TODO(pascal): Run it automatically (weekly ?) and send the results to slack.
import collections
import logging
import sys

import pymongo

from bob_emploi.frontend import scoring

_MongoField = collections.namedtuple('MongoField', ['collection', 'field_name'])

_SCORING_MODEL_FIELDS = {
    _MongoField('advice_modules', 'triggerScoringModel'),
    _MongoField('tip_templates', 'filters'),
    _MongoField('jobboards', 'filters'),
    _MongoField('associations', 'filters'),
    _MongoField('application_tips', 'filters'),
}


def check_scoring_models(mongo_db):
    """Check that all scoring models are valid and warn on unused ones."""
    used_scoring_models = set()
    for collection, field_name in _SCORING_MODEL_FIELDS:
        records = mongo_db.get_collection(collection).\
            find({field_name: {'$exists': True}}, {field_name: 1})
        if not records.count():
            logging.error('The collection "%s" has no field "%s".', collection, field_name)
            continue
        has_scoring_models = False

        for record in records:
            field_value = record[field_name]
            if not field_value:
                continue
            elif isinstance(field_value, list):
                field_values = field_value
            else:
                field_values = [field_value]
            for scoring_model in field_values:
                if not scoring.get_scoring_model(scoring_model):
                    logging.error(
                        'Unknown scoring model "%s" in the collection "%s", record "%s".',
                        scoring_model, collection, record['_id'])
                used_scoring_models.add(scoring_model)
                has_scoring_models = True

        if not has_scoring_models:
            logging.error(
                'The collection "%s" has no scoring models in its field "%s"',
                collection, field_name)

    unused_scoring_models = scoring.SCORING_MODELS.keys() - used_scoring_models
    for scoring_model in unused_scoring_models:
        logging.warning('Scoring model unused: %s', scoring_model)


def main(mongo_url):
    """Handle all maintenance tasks."""
    mongo_db = pymongo.MongoClient(mongo_url).get_default_database()
    check_scoring_models(mongo_db)


if __name__ == '__main__':
    main(*sys.argv[1:])
