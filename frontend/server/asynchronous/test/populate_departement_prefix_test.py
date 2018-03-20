"""Tests for the poulate_departement_prefix module."""

import datetime
import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous import populate_departement_prefix


class PopulateDepartementPrefixTestCase(unittest.TestCase):
    """Unit tests for the poulate_departement_prefix module."""

    @mock.patch(
        populate_departement_prefix.__name__ + '.DRY_RUN',
        new=False)
    @mock.patch(populate_departement_prefix.logging.__name__ + '.warning')
    @mock.patch(
        populate_departement_prefix.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        populate_departement_prefix.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_single_project(self, mock_user_db, mock_db, mock_logging):
        """Basic test with an user without departement prefix."""

        mock_user_db.user.insert_many([
            {
                '_id': 'my-own-user-id',
                'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
                'projects': [{
                    'title': 'Project Title',
                    'mobility': {
                        'city': {
                            'departementId': '69'
                        }
                    }
                }],
            },
            {
                '_id': 'other-user-id',
                'registeredAt': datetime.datetime(2017, 1, 22, 10, 0, 0).isoformat() + 'Z',
                'projects': [{
                    'title': 'Project Other Title',
                    'mobility': {
                        'city': {
                            'departementId': '69',
                            'departementPrefix': 'dans le '
                        }
                    }
                }],
            },
        ])
        mock_db.departements.insert_one({
            '_id': '69',
            'prefix': 'dans le ',
            })

        populate_departement_prefix.main()
        user = mock_user_db.user.find_one({'_id': 'my-own-user-id'})
        self.assertEqual(
            'dans le ',
            user.get('projects')[0].get('mobility').get('city').get('departementPrefix'))
        mock_logging.assert_any_call('User modified:\n%s', 1)

    @mock.patch(populate_departement_prefix.logging.__name__ + '.warning')
    @mock.patch(
        populate_departement_prefix.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        populate_departement_prefix.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_dry_run(self, mock_user_db, mock_db, mock_logging):
        """Dry run should not modify the database."""

        mock_user_db.user.insert_one({
            '_id': 'my-own-user-id',
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
                'mobility': {
                    'city': {
                        'departementId': '69'
                    }
                }
            }],
        })
        mock_db.departements.insert_one({
            '_id': '69',
            'prefix': 'dans le ',
        })

        populate_departement_prefix.main()
        user = mock_user_db.user.find_one({'_id': 'my-own-user-id'})
        self.assertEqual(
            '69',
            user.get('projects')[0].get('mobility').get('city').get('departementId'))
        self.assertFalse(
            user.get('projects')[0].get('mobility').get('city').get('departementPrefix'))
        mock_logging.assert_any_call('User modified:\n%s', 1)

    @mock.patch(
        populate_departement_prefix.__name__ + '.DRY_RUN',
        new=False)
    @mock.patch(populate_departement_prefix.logging.__name__ + '.warning')
    @mock.patch(
        populate_departement_prefix.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        populate_departement_prefix.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_multiple_project(self, mock_user_db, mock_db, mock_logging):
        """Test with an user that has multiple projects."""

        mock_user_db.user.insert_one({
            '_id': 'this-user-id',
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [
                {
                    'title': 'Project one',
                    'mobility': {
                        'city': {
                            'departementId': '69'
                        }
                    }
                },
                {
                    'title': 'Project two',
                    'mobility': {
                        'city': {
                            'departementId': '33'
                        }
                    }
                },
            ],
        })

        mock_db.departements.insert_many([
            {
                '_id': '69',
                'prefix': 'dans le ',
            },
            {
                '_id': '33',
                'prefix': 'en ',
            }
        ])

        populate_departement_prefix.main()

        user = mock_user_db.user.find_one({'_id': 'this-user-id'})
        self.assertEqual(
            ['69', '33'],
            [
                project.get('mobility').get('city').get('departementId')
                for project in user.get('projects')
            ]
        )
        self.assertEqual(
            ['dans le ', 'en '],
            [
                project.get('mobility').get('city').get('departementPrefix')
                for project in user.get('projects')
            ]
        )
        mock_logging.assert_any_call('User modified:\n%s', 1)

    @mock.patch(
        populate_departement_prefix.__name__ + '.DRY_RUN',
        new=False)
    @mock.patch(populate_departement_prefix.logging.__name__ + '.warning')
    @mock.patch(
        populate_departement_prefix.__name__ + '._DB',
        new_callable=lambda: mongomock.MongoClient().test)
    @mock.patch(
        populate_departement_prefix.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_invalid_departement_id(self, mock_user_db, mock_db, mock_logging):
        """Test with an user that has an invalid departement ID."""

        mock_user_db.user.insert_one({
            '_id': 'my-own-user-id',
            'registeredAt': datetime.datetime(2018, 1, 22, 10, 0, 0).isoformat() + 'Z',
            'projects': [{
                'title': 'Project Title',
                'mobility': {
                    'city': {
                        'departementId': 'X9'
                    }
                }
            }],
        })
        mock_db.departements.insert_one({
            '_id': '69',
            'prefix': 'dans le ',
            })

        populate_departement_prefix.main()
        user = mock_user_db.user.find_one({'_id': 'my-own-user-id'})
        self.assertFalse(
            user.get('projects')[0].get('mobility').get('city').get('departementPrefix'))
        mock_logging.assert_any_call(
            'User %s has at least one invalid departement ID %s.',
            'my-own-user-id',
            'X9')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
