"""Script to remove duplicated users in MongoDB.

A bug in the frontend made it that a user would be created twice in the backend for the same
email address. The first user would stay at revision = 1, where the second one would continue to
work normaly and have a revision incremented each time it's updated.

To run:
docker-compose run --rm -e MONGO_URL="mongodb://frontend-db/test" frontend-flask \
    python bob_emploi/frontend/server/asynchronous/delete_duplicated_users.py
"""

import argparse
import datetime
import logging

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now

_, _DB = mongo.get_connections_from_env()


def delete_duplicated_users(user_collection, from_date, to_date, backup_collection, dry_run=True):
    """Delete extra users that got created in double, with one user being stuck at rev 1."""

    # Get users that are only at revision 1, in case of duplication, it's the ones
    # we want to delete in the pair.
    first_users = list(user_collection.find({
        'revision': 1,
        'profile.email': {'$exists': 1},
        'registeredAt': {'$gt': from_date, '$lt': to_date},
    }))
    first_user_emails = [user['profile']['email'] for user in first_users]
    # Check if there is any other users with the same emails.
    second_users = user_collection.find({
        'revision': {'$gt': 1},
        'profile.email': {'$in': first_user_emails},
    }, projection={'profile.email': 1})
    second_user_emails = {user['profile']['email'] for user in second_users}
    # Get the user that we want to delete.
    duplicated_users = [
        first_user for first_user in first_users
        if first_user['profile']['email'] in second_user_emails
    ]
    for duplicated_user in duplicated_users:
        _delete_user(user_collection, duplicated_user, dry_run, backup_collection)
    logging.info('Deleted %s users', len(duplicated_users))


def _delete_user(user_collection, user, dry_run, backup_collection):
    user_id = user['_id']
    logging.info('Will delete user: %s', user)
    if dry_run:
        logging.info('Delete user "%s"', user_id)
    else:
        backup_collection.insert_one(user)
        user_collection.delete_one({'_id': user_id})  # user


def main(string_args=None):
    """Parse command line arguments and trigger the delete_duplicated_users function."""

    parser = argparse.ArgumentParser(
        description='Synchronize MongoDB client metrics fields from Amplitude')
    parser.add_argument(
        '--registered-from', default='2016',
        help='Consider only users who registered after this date.')
    yesterday = str((now.get() - datetime.timedelta(days=1)).date())
    parser.add_argument(
        '--registered-to', default=yesterday,
        help='Consider only users who registered before this date.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false', help='No dry run really store in DB.')
    parser.add_argument(
        '--backup-collection', required=True,
        help='Name of the collection where to backup users that are deleted from main DB.')

    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')

    delete_duplicated_users(
        _DB.user, from_date=args.registered_from, to_date=args.registered_to,
        dry_run=args.dry_run, backup_collection=_DB.get_collection(args.backup_collection))


if __name__ == '__main__':
    main()  # pragma: no-cover
