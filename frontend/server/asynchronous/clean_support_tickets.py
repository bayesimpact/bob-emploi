"""Script to clean guest users from DB."""

import argparse
import logging
import os
from typing import List, Optional

from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report

_, _DB, _ = mongo.get_connections_from_env()


def main(string_args: Optional[List[str]] = None) -> None:
    """Clean all support tickets marked for deletion."""

    parser = argparse.ArgumentParser(description='Clean support tickets from the database.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')

    args = parser.parse_args(string_args)
    logging.basicConfig(level='INFO')
    if not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    instant = proto.datetime_to_json_string(now.get())
    result = _DB.user.update_many(
        {},
        {'$pull': {'supportTickets': {'deleteAfter': {'$lt': instant}}}})
    logging.info('Removed deprecated support tickets for %d users.', result.modified_count)
    clean_result = _DB.user.update_many(
        {'supportTickets': {'$size': 0}},
        {'$unset': {'supportTickets': ''}})
    if clean_result.matched_count:
        logging.info('Removed empty support ticket list for %d users.', clean_result.modified_count)


if __name__ == '__main__':
    main()
