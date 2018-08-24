"""Unit tests for the module assess_assessment."""

import unittest

import mock
import mongomock

from bob_emploi.frontend.api import stats_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous import count_users


class _CountUsersTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self):
        super(_CountUsersTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        self._user_db = mongomock.MongoClient().test
        patcher = mock.patch(count_users.__name__ + '._USER_DB', new=self._user_db)
        patcher.start()
        patcher = mock.patch(count_users.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_main(self):
        """Test main."""

        self._user_db.user.insert_many([
            {
                'projects': [{
                    'mobility': {
                        'city': {
                            'departementId': '69',
                        }
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1234'
                        }
                    }
                }],
            },
            {
                'projects': [{
                    'mobility': {
                        'city': {
                            'departementId': '61',
                        }
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1235'
                        }
                    }
                }],
            },
            {
                'projects': [{
                    'mobility': {
                        'city': {
                            'departementId': '69',
                        }
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'A1235'
                        }
                    }
                }],
            },
            {
                'projects': [{
                    'mobility': {
                        'city': {
                            'departementId': '64',
                        }
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'B4567'
                        }
                    }
                }],
            },
            {
                'featuresEnabled': {
                    'excludeFromAnalytics': True,
                },
                'projects': [{
                    'mobility': {
                        'city': {
                            'departementId': '64',
                        }
                    },
                    'targetJob': {
                        'jobGroup': {
                            'romeId': 'B4567'
                        }
                    }
                }],
            },
            # TODO(pascal): Add that one back, when
            # https://github.com/mongomock/mongomock/issues/404 is fixed.
            # {
            #    'projects': [],
            # },
        ])

        count_users.main()
        result = self._db.user_count.find_one({})
        self.assertTrue(result)
        result_proto = proto.create_from_mongo(result, stats_pb2.UsersCount)
        self.assertEqual(2, result_proto.departement_counts['69'])
        self.assertEqual(1, result_proto.departement_counts['64'])
        self.assertEqual(2, result_proto.job_group_counts['A1235'])
        self.assertEqual(1, result_proto.job_group_counts['B4567'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
