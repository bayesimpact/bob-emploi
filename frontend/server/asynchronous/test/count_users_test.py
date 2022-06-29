"""Unit tests for the module assess_assessment."""

import typing
import unittest

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import count_users
from bob_emploi.frontend.server.asynchronous.test import asynchronous_test_case


class CountUsersTestCase(asynchronous_test_case.TestCase):
    """Unit tests for the module."""

    def setUp(self) -> None:
        super().setUp()

        self._db = self._stats_db

        self._user_db.user.insert_many([
            {
                'profile': {'name': 'Pascal'},
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
                    'passionateLevel': 'ALIMENTARY_JOB',
                    'jobSearchStartedAt': '2019-02-01T12:20:11Z',
                    'createdAt': '2019-09-01T12:20:11Z',
                }],
            },
            {
                'profile': {'name': 'Pascal'},
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
                    'passionateLevel': 'ALIMENTARY_JOB',
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
                    'passionateLevel': 'LIFE_GOAL_JOB',
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
                    'passionateLevel': 'ALIMENTARY_JOB',
                    'jobSearchStartedAt': '2018-08-01T12:20:11Z',
                    'createdAt': '2019-10-01T12:20:11Z',
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
        self._user_db.user.insert_many([
            {'profile': {'name': 'Pascal'}, 'projects': [{}]}
            for unused_i in range(148)
        ])
        self._user_db.user.insert_many([
            {'profile': {'name': 'Cyrille'}, 'projects': [{}]}
            for unused_i in range(70)
        ])
        self._user_db.user.insert_many([
            {'profile': {'name': 'REDACTED'}, 'projects': [{}]}
            for unused_i in range(50)
        ])
        # One user with 50 projects, only counts for once.
        self._user_db.user.insert_one({'profile': {'name': 'Sil'}, 'projects': [
            {} for unused_i in range(50)
        ]})

    def test_main(self) -> None:
        """Test main."""

        count_users.main()
        result = self._db.user_count.find_one({'_id': ''})
        self.assertTrue(result)
        result_proto = proto.create_from_mongo(result, stats_pb2.UsersCount)
        self.assertEqual(2, result_proto.departement_counts['69'])
        self.assertEqual(1, result_proto.departement_counts['64'])
        self.assertEqual(2, result_proto.job_group_counts['A1235'])
        self.assertEqual(1, result_proto.job_group_counts['B4567'])
        self.assertEqual(2, result_proto.weekly_application_counts['LESS_THAN_2'])
        self.assertEqual(2, result_proto.weekly_application_counts['SOME'])
        self.assertEqual(2, result_proto.medium_search_interview_counts['3'])
        self.assertEqual(1, result_proto.long_search_interview_counts['1'])
        self.assertEqual(
            stats_pb2.SHORT_SEARCH_LENGTH, result_proto.passion_level_counts[0].search_length)
        self.assertEqual(
            stats_pb2.MEDIUM_SEARCH_LENGTH, result_proto.passion_level_counts[1].search_length)
        self.assertEqual(2, len(result_proto.passion_level_counts[1].level_counts))
        self.assertEqual(
            [
                stats_pb2.PassionLevelCount(passionate_level=project_pb2.LIFE_GOAL_JOB, count=1),
                stats_pb2.PassionLevelCount(passionate_level=project_pb2.ALIMENTARY_JOB, count=2)
            ],
            sorted(
                result_proto.passion_level_counts[1].level_counts,
                key=lambda a: typing.cast(stats_pb2.PassionLevelCount, a).count))
        self.assertEqual({'Pascal': .75, 'Cyrille': .25}, result_proto.frequent_firstnames)

    def test_update(self) -> None:
        """Ensure updating overrides previous values."""

        count_users.main()
        # No more users in database.
        self._user_db.user.drop()
        count_users.main()
        result = self._db.user_count.find_one({'_id': ''})
        self.assertTrue(result)
        result_proto = proto.create_from_mongo(result, stats_pb2.UsersCount)
        self.assertFalse(result_proto.departement_counts)
        self.assertFalse(result_proto.job_group_counts)


if __name__ == '__main__':
    unittest.main()
