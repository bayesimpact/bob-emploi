"""Unit tests for the module delete_duplicated_users."""

import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous import delete_duplicated_users

USER_1 = {
    '_id': mongomock.ObjectId('1bb900dbfbebdee97f9e2332'),
    'registeredAt': '2017-11-17T10:57:12Z',
    'profile': {
        'email': 'user.1@gmail.com'
    },
    'revision': 10,
}
DUPLICATED_USER_1 = {**USER_1, **{
    '_id': mongomock.ObjectId('1aa97f9e2900dbfbebdee227'),
    'revision': 1,
}}
DUPLICATED_USER_1_WITH_REV_GREATER_THAN_ONE = {**DUPLICATED_USER_1, **{
    'revision': 2,
}}
USER_2 = {
    '_id': mongomock.ObjectId('2cd345cde34c2d23ec546794'),
    'registeredAt': '2017-11-17T10:57:02Z',
    'profile': {
        'email': 'user.2@gmail.com'
    },
    'revision': 1,
}
USER_3 = {
    '_id': mongomock.ObjectId('3ef34c2d23e345cdec546429'),
    'registeredAt': '2017-11-17T10:59:21Z',
    'profile': {
        'email': 'user.3@gmail.com'
    },
    'revision': 8,
}


@mock.patch(delete_duplicated_users.logging.__name__ + '.info', mock.Mock())
@mock.patch(
    delete_duplicated_users.now.__name__ + '.get',
    new=mock.MagicMock(return_value=datetime.datetime(2017, 11, 19)))
class DeleteDuplicatedUsersTestCase(unittest.TestCase):
    """Unit tests for the module."""

    # pylint: disable=missing-docstring
    def test_non_duplicated_users_are_not_deleted(self):
        self._assert_users_get_deleted([
            USER_1,
            USER_2,
            USER_3,
        ], [])

    def test_duplicated_user_is_deleted(self):
        self._assert_users_get_deleted([
            DUPLICATED_USER_1,
            USER_1,
            USER_2,
            USER_3,
        ], [DUPLICATED_USER_1])

    def test_duplicated_user_is_not_deleted_in_dry_run(self):
        self._assert_users_get_deleted([
            DUPLICATED_USER_1,
            USER_1,
            USER_2,
            USER_3,
        ], [], dry_run=True)

    def test_duplicated_user_with_rev_greater_than_1_is_not_deleted(self):
        self._assert_users_get_deleted([
            DUPLICATED_USER_1_WITH_REV_GREATER_THAN_ONE,
            USER_1,
            USER_2,
            USER_3,
        ], [])

    def _assert_users_get_deleted(self, initial_users, expected_deleted_users, dry_run=False):
        expected_remaining_users = [
            user for user in initial_users
            if user not in expected_deleted_users
        ]
        mock_db = mongomock.MongoClient().test
        mock_db.user.insert_many(initial_users)
        patcher = mock.patch(delete_duplicated_users.__name__ + '._DB', new=mock_db)
        patcher.start()
        self.addCleanup(patcher.stop)

        # Run the deletion script.
        delete_duplicated_users.main(
            ['--registered-from', '2017-11-14', '--backup-collection', 'deleted_users'] +
            (['--no-dry-run'] if not dry_run else []))
        # And check that the right users got deleted.
        self._assert_db_has_users(mock_db, expected_remaining_users)
        self.assertEqual(mock_db.deleted_users.find({}).count(), len(expected_deleted_users))

    def _assert_db_has_users(self, mock_db, expected_users):
        users = mock_db.user.find({}, {'_id': 1})
        user_ids = {str(user['_id']) for user in users}
        expected_users_ids = {str(user['_id']) for user in expected_users}
        self.assertEqual(expected_users_ids, user_ids, 'The db has not the expected ids.')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
