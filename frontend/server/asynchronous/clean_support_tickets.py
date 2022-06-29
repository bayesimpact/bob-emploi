"""Script to clean guest users from DB."""

import argparse
import logging
from typing import Optional

from bob_emploi.common.python import now
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report


def main(string_args: Optional[list[str]] = None) -> None:
    """Clean all support tickets marked for deletion."""

    user_db = mongo.get_connections_from_env().user_db

    parser = argparse.ArgumentParser(description='Clean support tickets from the database.')
    report.add_report_arguments(parser)

    args = parser.parse_args(string_args)
    if not report.setup_sentry_logging(args):
        return

    instant = proto.datetime_to_json_string(now.get())
    result = user_db.user.update_many(
        {},
        {'$pull': {'supportTickets': {'deleteAfter': {'$lt': instant}}}})
    logging.info('Removed deprecated support tickets for %d users.', result.modified_count)
    clean_result = user_db.user.update_many(
        {'supportTickets': {'$size': 0}},
        {'$unset': {'supportTickets': ''}})
    if clean_result.matched_count:
        logging.info('Removed empty support ticket list for %d users.', clean_result.modified_count)


if __name__ == '__main__':
    main()
