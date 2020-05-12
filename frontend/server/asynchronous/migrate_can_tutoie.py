"""
Script to migrate users from can_tutoie to locale.
TODO(cyrille): Clean-up once run on prod database.
"""

import logging
import os

from bson import objectid
import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous import report

_, _DB, _ = mongo.get_connections_from_env()


def main(
        database: pymongo.database.Database,
        dry_run: bool = True, disable_sentry: bool = False) -> None:
    """Migrate users"""

    logging.basicConfig(level='INFO')
    if not dry_run and not disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    users = database.user.find(
        {'profile.canTutoie': {'$exists': True}},
        {'profile.canTutoie': 1, 'profile.locale': 1})

    count = 0
    for json_user in users:
        user = proto.create_from_mongo(json_user, user_pb2.User, 'user_id')
        if not user:
            logging.error('An error occurred while converting user %s', json_user.get('_id'))
            continue
        locale = scoring.get_user_locale(user.profile)
        updater = {
            '$unset': {'profile.canTutoie': ''},
            '$set': {'profile.locale': locale},
        }
        if locale == 'fr':
            # No need to keep it in database.
            updater['$unset']['profile.locale'] = ''
            del updater['$set']
        if not dry_run:
            database.user.update_one({'_id': objectid.ObjectId(user.user_id)}, updater)
        count += 1

    logging.info('Updated canTutoie and locale field for %d users', count)


if __name__ == '__main__':
    main(_DB, not os.getenv('NO_DRY_RUN'))
