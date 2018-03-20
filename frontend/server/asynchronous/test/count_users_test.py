"""Unit tests for the module assess_assessment."""

import unittest

import mock
import mongomock

from bob_emploi.frontend.server.asynchronous import count_users


class _CountUsersTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self):
        super(_CountUsersTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(count_users.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_main(self):
        """Test main."""

        self._db.user.insert_many([
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
            {
                'projects': [],
            },
        ])

        count_users.main()
        result = self._db.user_count.find_one({})
        self.assertTrue(result)
        self.assertEqual(2, result.get('depCounts', {}).get('69'))
        self.assertEqual(1, result.get('depCounts', {}).get('64'))
        self.assertEqual(2, result.get('jobGroupCounts', {}).get('A1235'))
        self.assertEqual(1, result.get('jobGroupCounts', {}).get('B4567'))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
