"""Unit tests for the module assess_assessment."""

import typing
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import count_users


class CountUsersTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()
        self._db = mongomock.MongoClient().test
        self._user_db = mongomock.MongoClient().test
        patcher = mock.patch(count_users.__name__ + '._USER_DB', new=self._user_db)
        patcher.start()
        patcher = mock.patch(count_users.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)
        self._user_db.user.insert_many([
            {
                'projects': [{
                    'city': {
                        'departementId': '69',
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1234'
                        }
                    },
                    'weeklyApplicationsEstimate': 'LESS_THAN_2',
                    'totalInterviewCount': 3,
                    'jobSearchStartedAt': '2019-02-01T12:20:11Z',
                    'createdAt': '2019-09-01T12:20:11Z',
                }],
            },
            {
                'projects': [{
                    'city': {
                        'departementId': '61',
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1235'
                        }
                    },
                    'weeklyApplicationsEstimate': 'LESS_THAN_2',
                    'totalInterviewCount': 1,
                    'jobSearchStartedAt': '2019-02-01T12:20:11Z',
                    'createdAt': '2019-10-01T12:20:11Z',
                }],
            },
            {
                'projects': [{
                    'city': {
                        'departementId': '69',
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1235'
                        }
                    },
                    'weeklyApplicationsEstimate': 'SOME',
                    'totalInterviewCount': 3,
                    'jobSearchStartedAt': '2019-02-01T12:20:11Z',
                    'createdAt': '2019-10-01T12:20:11Z',
                }],
            },
            {
                'projects': [{
                    'city': {
                        'departementId': '64',
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'B4567'
                        }
                    },
                    'weeklyApplicationsEstimate': 'SOME',
                    'totalInterviewCount': 1,
                    'jobSearchLengthMonths': 14,
                }],
            },
            {
                'featuresEnabled': {
                    'excludeFromAnalytics': True,
                },
                'projects': [{
                    'city': {
                        'departementId': '64',
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'B4567'
                        }
                    },
                    'weeklyApplicationsEstimate': 'LESS_THAN_2',
                    'totalInterviewCount': 1,
                    'jobSearchStartedAt': '2019-02-01T12:20:11Z',
                    'createdAt': '2019-09-01T12:20:11Z',
                }],
            },
            {
                'projects': [],
            },
        ])

    def test_main(self) -> None:
        """Test main."""

        count_users.main()
        result = self._db.user_count.find_one({'_id': 'values'})
        self.assertTrue(result)
        result_proto = typing.cast(
            stats_pb2.UsersCount, proto.create_from_mongo(result, stats_pb2.UsersCount))
        self.assertEqual(2, result_proto.departement_counts['69'])
        self.assertEqual(1, result_proto.departement_counts['64'])
        self.assertEqual(2, result_proto.job_group_counts['A1235'])
        self.assertEqual(1, result_proto.job_group_counts['B4567'])
        self.assertEqual(2, result_proto.weekly_application_counts['LESS_THAN_2'])
        self.assertEqual(2, result_proto.weekly_application_counts['SOME'])
        self.assertEqual(2, result_proto.medium_search_interview_counts['3'])
        self.assertEqual(1, result_proto.long_search_interview_counts['1'])

    def test_update(self) -> None:
        """Ensure updating overrides previous values."""

        count_users.main()
        # No more users in database.
        self._user_db.user.drop()
        count_users.main()
        result = self._db.user_count.find_one({'_id': 'values'})
        self.assertTrue(result)
        result_proto = typing.cast(
            stats_pb2.UsersCount, proto.create_from_mongo(result, stats_pb2.UsersCount))
        self.assertFalse(result_proto.departement_counts)
        self.assertFalse(result_proto.job_group_counts)


if __name__ == '__main__':
    unittest.main()
