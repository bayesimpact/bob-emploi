"""Script to populate departement prefix for old users."""

import logging
import os

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import geo_pb2

_DEPARTEMENTS = proto.MongoCachedCollection(geo_pb2.Departement, 'departements')

# For a dry run we do not modify the database.
DRY_RUN = not bool(os.getenv('NODRY_RUN'))
if DRY_RUN:
    logging.getLogger().setLevel(logging.INFO)

_DB, _USER_DB = mongo.get_connections_from_env()


def main():
    """Populate departement prefix for users that don't already have one."""

    query = {
        'projects': {
            '$elemMatch': {
                'mobility.city.departementId': {'$exists': True},
                'mobility.city.departementPrefix': {'$exists': False},
            }
        }
    }
    user_count = 0
    for user_in_db in _USER_DB.user.find(query):
        user_id = user_in_db.pop('_id')
        user = user_pb2.User()
        if not proto.parse_from_mongo(user_in_db, user):
            logging.warning('Impossible to parse user %s', user_id)
            continue

        departement_ids = [project.mobility.city.departement_id for project in user.projects]

        try:
            departement_prefixes = [
                _DEPARTEMENTS.get_collection(_DB)[dep_id].prefix for dep_id in departement_ids]
        except KeyError:
            logging.warning(
                'User %s has at least one invalid departement ID %s.',
                user_id,
                ', '.join(departement_ids))
            continue

        modifs = {
            '$set': {
                'projects.{}.mobility.city.departementPrefix'.format(i): dep_prefix
                for i, dep_prefix in enumerate(departement_prefixes)},
        }
        if not DRY_RUN:
            _USER_DB.user.update_one(
                {'_id': user_id},
                modifs,
                upsert=False
            )
        else:
            logging.info('Prefix populated for user %s)', user_id)
        user_count += 1

    logging.warning('User modified:\n%s', user_count)


if __name__ == '__main__':
    main()  # pragma: no cover
