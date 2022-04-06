"""Script to clean inactive and guest users from DB.
    Guests accounts are deleted after 1 week without interacting.
    While signed in users' accounts are deleted after 2 years of inactivity (mail or app).
    Note that signed in users should have received a notification email at least
    1 week before deletion.
    More on the design here:
    https://docs.google.com/document/d/13Dc6Ysgn_qgNA1EgS3gKujwl-HQ_dw-omovsmY_VETA
"""

import argparse
import datetime
import logging
from typing import Optional, Tuple

import bson
from bson import objectid
import pymongo

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import mail_send


_MAX_GUEST_IDLE_TIME = datetime.timedelta(7)
_MAX_SIGNED_IN_USER_IDLE_TIME = datetime.timedelta(730)
_TODAY_STRING = proto.datetime_to_json_string(datetime.datetime.now())


def _get_last_interaction_date(user_proto: user_pb2.User) -> datetime.datetime:
    """Get the date of user's last email or app interaction."""

    last_interaction_date = user_proto.registered_at.ToDatetime()
    if user_proto.registered_at:
        last_interaction_date = user_proto.requested_by_user_at_date.ToDatetime()

    email_interaction_dates = [
        email.sent_at.ToDatetime() for email in user_proto.emails_sent
        if email.campaign_id != 'account-deletion-notice' and
        email.status in mail_send.READ_EMAIL_STATUSES and email.sent_at]

    last_interaction_date = max(email_interaction_dates + [last_interaction_date])
    return last_interaction_date


def _get_latest_deletion_email_date(user_proto: user_pb2.User) -> Optional[datetime.datetime]:
    """Get the date of the latest deletion notification email."""

    deletion_email_dates = [
        email.sent_at.ToDatetime() for email in user_proto.emails_sent
        if email.campaign_id == 'account-deletion-notice']
    if deletion_email_dates:
        return max(deletion_email_dates)
    return None


def get_users(database: mongo.UsersDatabase) -> pymongo.cursor.Cursor:
    """Get users that have no check deletion date or one in the past."""

    # Users that either don't have a check date or it is close.
    users = database.user.find({
        'deletedAt': None,
        '$or': [
            {'checkForDeletionDate': {'$exists': False}},
            {'checkForDeletionDate': {'$lte': _TODAY_STRING}},
        ],
    })
    return users


def set_deletion_check_date(
        user_proto: user_pb2.User, deletion_date: datetime.datetime,
        database: mongo.UsersDatabase, dry_run: bool = True) -> None:
    """Set or update the check for deletion date tag."""

    if dry_run:
        logging.info('Setting check date "%s"', str(user_proto.user_id))

    database.user.update_one(
        {'_id': objectid.ObjectId(user_proto.user_id)},
        {'$set': {'checkForDeletionDate': deletion_date.isoformat() + 'Z'}})


def compute_deletion_date(user_proto: user_pb2.User) -> datetime.datetime:
    """Compute the date when the user's account can be deleted."""

    last_interaction_date = _get_last_interaction_date(user_proto)
    recent_interaction_delay = \
        _MAX_SIGNED_IN_USER_IDLE_TIME if user_proto.has_account else _MAX_GUEST_IDLE_TIME

    # Guests with accounts must have received the email notification.
    if user_proto.has_account:
        latest_deletion_email_date = _get_latest_deletion_email_date(user_proto)
        # If they haven't we check again 2 weeks later.
        if not latest_deletion_email_date:
            return datetime.datetime.today() + datetime.timedelta(14)
        # If the last notification is too recent, we wait a bit.
        if latest_deletion_email_date > datetime.datetime.today() - _MAX_GUEST_IDLE_TIME:
            return latest_deletion_email_date + _MAX_GUEST_IDLE_TIME
    return last_interaction_date + recent_interaction_delay


def clean_users(
        database: mongo.UsersDatabase, dry_run: bool = True,
        max_users: int = 0) -> Tuple[int, int, int]:
    """Clean inactive users and guests who registered before a given date."""

    users = get_users(database)

    num_users_cleaned = 0
    num_users_updated = 0
    num_errors = 0
    for user in users:
        user_proto = proto.create_from_mongo(user, user_pb2.User, 'user_id')

        if max_users and (num_users_cleaned + num_users_updated + num_errors) >= max_users:
            return num_users_cleaned, num_users_updated, num_errors

        if not user_proto:
            num_errors += 1
            continue

        try:
            user_id = objectid.ObjectId(user_proto.user_id)
        except bson.errors.InvalidId:
            logging.exception('Tried to modify a user with an invalid ID "%s"', user_proto.user_id)
            num_errors += 1
            continue

        deletion_date = compute_deletion_date(user_proto)
        if deletion_date >= datetime.datetime.today():
            set_deletion_check_date(user_proto, deletion_date, database, dry_run)
            num_users_updated += 1
            continue

        if dry_run:
            logging.info('Cleaning user "%s"', str(user_id))
            num_users_cleaned += 1
        elif auth.delete_user(user_proto, database):
            num_users_cleaned += 1
        else:
            num_errors += 1

    return num_users_cleaned, num_users_updated, num_errors


def main(string_args: Optional[list[str]] = None) -> None:
    """Parse command line arguments and trigger the clean_guest_users function."""

    parser = argparse.ArgumentParser(
        description='Clean guests and inactive users from the database.')

    parser.add_argument(
        '--max-users', help='Only consider a maximum of this number of users.', type=int)

    report.add_report_arguments(parser)

    args = parser.parse_args(string_args)

    if not report.setup_sentry_logging(args):
        return

    user_db = mongo.get_connections_from_env().user_db

    logging.info(
        'Cleaned %d users, set check date for %d users and got %d errors',
        *clean_users(user_db, args.dry_run, args.max_users))


if __name__ == '__main__':
    main()
