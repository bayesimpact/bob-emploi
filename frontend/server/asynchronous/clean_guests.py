"""Script to clean guest users from DB."""

import argparse
import datetime
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report


_, _DB, _ = mongo.get_connections_from_env()


def clean_guest_users(database: pymongo.database.Database, to_date: str, dry_run: bool = True) \
        -> Tuple[int, int]:
    """Clean guest users who registered before a given date."""

    users = database.user.find({
        'deletedAt': None,
        'hasAccount': {'$ne': True},
        'registeredAt': {'$lt': to_date},
    })
    num_users_cleaned = 0
    num_errors = 0
    for user in users:
        if dry_run:
            logging.info('Cleaning guest user "%s"', str(user['_id']))
            num_users_cleaned += 1
        elif _clean_guest_user(database, user):
            num_users_cleaned += 1
        else:
            num_errors += 1
    return num_users_cleaned, num_errors


def _clean_guest_user(user_db: pymongo.database.Database, user: Dict[str, Any]) -> bool:
    user_proto = proto.create_from_mongo(user, user_pb2.User, 'user_id')
    assert user_proto

    return auth.delete_user(user_proto, user_db)


def main(string_args: Optional[List[str]] = None) -> None:
    """Parse command line arguments and trigger the clean_guest_users function."""

    parser = argparse.ArgumentParser(description='Clean guests user from the database.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
    registered_to_group = parser.add_mutually_exclusive_group()
    registered_to_group.add_argument(
        '--registered-to', help='Consider only users who registered before \
        this date.')
    registered_to_group.add_argument(
        '--registered-to-days-ago', default=7, type=int,
        help='Consider only users who registered more than N days ago.')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false', help='No dry run really store in DB.')

    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO')
    if not args.dry_run and not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return
    if args.registered_to:
        to_date = args.registered_to
    else:
        to_date = (now.get() - datetime.timedelta(days=args.registered_to_days_ago))\
            .strftime('%Y-%m-%dT%H:%M:%S')

    logging.info(
        'Cleaned %d users and got %d errors', *clean_guest_users(_DB, to_date, args.dry_run))


if __name__ == '__main__':
    main()
