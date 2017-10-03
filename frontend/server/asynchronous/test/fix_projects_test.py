"""Unit tests for the module fix_projects."""
import unittest

import mock
import mongomock

from bob_emploi.frontend.asynchronous import fix_projects


class FixProjectsTestCase(unittest.TestCase):
    """Unit tests for the main function."""

    def setUp(self):
        super(FixProjectsTestCase, self).setUp()
        self.user_db = mongomock.MongoClient().test.user

    def test_projects_already_updated(self):
        """User already has a new field in all their projects."""
        user_dict = {
            'profile': {
                'email': 'pascal@corpet.net',
                'lastName': 'Corpet',
                'name': 'Pascal',
                'situation': 'LOST_QUIT',
            },
            'projects': [
                {
                    'projectId': '0',
                    'trainingFulfillmentEstimate': 'ENOUGH_DIPLOMAS',
                    'kind': 'FIND_A_NEW_JOB',
                    'jobSearchHasNotStarted': True,
                },
                {
                    'projectId': '1',
                    'trainingFulfillmentEstimate': 'ENOUGH_DIPLOMAS',
                    'kind': 'FIND_A_NEW_JOB',
                    'jobSearchHasNotStarted': True,
                },
            ],
        }
        self.user_db.insert_one(dict(user_dict))

        fix_projects.main(self.user_db, dry_run=False)

        updated_user = self.user_db.find_one({})
        del updated_user['_id']
        self.assertEqual(user_dict, updated_user)

    def test_one_project_to_update(self):
        """User has only one project, and it should be fixed."""
        user_dict = {
            'profile': {
                'email': 'pascal@corpet.net',
                'name': 'Pascal',
                'situation': 'LOST_QUIT',
            },
            'projects': [{
                'projectId': 'abcdef',
                'diplomaFulfillmentEstimate': 'FULFILLED',
                'kind': 'FIND_JOB',
                'jobSearchLengthMonths': -1,
            }],
        }
        self.user_db.insert_one(dict(user_dict))

        fix_projects.main(self.user_db, dry_run=False)

        updated_user = self.user_db.find_one({})
        del updated_user['_id']
        self.assertNotEqual(user_dict, updated_user)

        self.assertEqual([{
            'projectId': 'abcdef',
            'trainingFulfillmentEstimate': 'ENOUGH_DIPLOMAS',
            'kind': 'FIND_A_NEW_JOB',
            'jobSearchLengthMonths': -1,
            'jobSearchHasNotStarted': True,
        }], updated_user['projects'])

        del updated_user['projects']
        del user_dict['projects']

        self.assertEqual(user_dict, updated_user)

    @mock.patch(fix_projects.proto.__name__ + '._IS_TEST_ENV', new=False)
    def test_update_only_second_project(self):
        """User has two projects, but only the second one should be fixed."""
        user_dict = {
            'profile': {
                'email': 'pascal@corpet.net',
                'name': 'Pascal',
                'situation': 'LOST_QUIT',
            },
            'projects': [
                {
                    'projectId': '01234',
                    # This field should be untouched, even though it's not
                    # understood by the proto.
                    'oldUntouchedField': 3,
                },
                {
                    'projectId': 'abcdef',
                    'diplomaFulfillmentEstimate': 'FULFILLED',
                    'kind': 'FIND_JOB',
                    'jobSearchLengthMonths': -1,
                },
            ],
        }
        self.user_db.insert_one(dict(user_dict))

        fix_projects.main(self.user_db, dry_run=False)

        updated_user = self.user_db.find_one({})
        del updated_user['_id']
        self.assertNotEqual(user_dict, updated_user)

        self.assertEqual([
            {
                'projectId': '01234',
                'oldUntouchedField': 3,
            },
            {
                'projectId': 'abcdef',
                'trainingFulfillmentEstimate': 'ENOUGH_DIPLOMAS',
                'kind': 'FIND_A_NEW_JOB',
                'jobSearchLengthMonths': -1,
                'jobSearchHasNotStarted': True,
            },
        ], updated_user['projects'])

        del updated_user['projects']
        del user_dict['projects']

        self.assertEqual(user_dict, updated_user)

    def test_update_all_projects(self):
        """User has two projects to update."""
        user_dict = {
            'profile': {
                'email': 'pascal@corpet.net',
                'name': 'Pascal',
                'situation': 'LOST_QUIT',
            },
            'projects': [
                {
                    'projectId': '01234',
                    'diplomaFulfillmentEstimate': 'NOTHING_REQUIRED',
                    'kind': 'CREATE_OR_TAKE_OVER_COMPANY',
                    'jobSearchLengthMonths': -1,
                },
                {
                    'projectId': 'abcdef',
                    'diplomaFulfillmentEstimate': 'FULFILLED',
                    'kind': 'FIND_JOB',
                    'jobSearchLengthMonths': -1,
                },
            ],
        }
        self.user_db.insert_one(dict(user_dict))

        fix_projects.main(self.user_db, dry_run=False)

        updated_user = self.user_db.find_one({})
        del updated_user['_id']
        self.assertNotEqual(user_dict, updated_user)

        self.assertEqual([
            {
                'projectId': '01234',
                'trainingFulfillmentEstimate': 'NO_TRAINING_REQUIRED',
                'kind': 'CREATE_OR_TAKE_OVER_COMPANY',
                'jobSearchLengthMonths': -1,
                'jobSearchHasNotStarted': True,
            },
            {
                'projectId': 'abcdef',
                'trainingFulfillmentEstimate': 'ENOUGH_DIPLOMAS',
                'kind': 'FIND_A_NEW_JOB',
                'jobSearchLengthMonths': -1,
                'jobSearchHasNotStarted': True,
            },
        ], updated_user['projects'])

        del updated_user['projects']
        del user_dict['projects']

        self.assertEqual(user_dict, updated_user)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
