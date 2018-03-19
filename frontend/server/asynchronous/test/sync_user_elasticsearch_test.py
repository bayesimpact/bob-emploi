"""Unit tests for the module sync_user_elasticsearch."""

import datetime
import json
import unittest

import mock
import mongomock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous import sync_user_elasticsearch


@mock.patch(sync_user_elasticsearch.__name__ + '._ES')
@mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2017, 11, 16))
class SyncTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self):
        super(SyncTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(sync_user_elasticsearch.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_main(self, mock_elasticsearch):
        """Test main."""

        self.maxDiff = None  # pylint: disable=invalid-name
        self._db.user.insert_one({
            'profile': {
                'email': 'pascal@corpet.net',
                'gender': 'MASCULINE',
                'yearOfBirth': 1982,
                'highestDegree': 'DEA_DESS_MASTER_PHD',
                'origin': 'FROM_A_FRIEND',
            },
            'projects': [{
                'kind': 'FIND_ANOTHER_JOB',
                'targetJob': {
                    'name': 'Boulanger',
                    'jobGroup': {'name': 'Boulangerie'},
                },
                'mobility': {
                    'areaType': 'REGION',
                    'city': {
                        'cityId': '69123',
                        'name': 'Lyon',
                        'departementName': 'Rhône',
                        'regionName': 'Auvergne-Rhône-Alpes',
                        'urbanScore': 7,
                    },
                },
                'jobSearchLengthMonths': 4,
                'advices': [{
                    'adviceId': 'network',
                    'numStars': 3,
                }],
                'feedback': {
                    'score': 5,
                },
            }],
            'employmentStatus': [{
                'bobHasHelped': 'YES',
            }],
            'clientMetrics': {
                'amplitudeId': '1234ab34f13e5',
                'firstSessionDurationSeconds': 250,
            },
            'emailsSent': [
                # Ignored because there's another one that was read later.
                {
                    'campaignId': 'focus-network',
                    'sentAt': '2017-10-15T18:06:08Z',
                    'status': 'EMAIL_SENT_SENT',
                },
                {
                    'campaignId': 'focus-spontaneous',
                    'sentAt': '2017-10-15T18:06:08Z',
                    'status': 'EMAIL_SENT_OPENED',
                },
                {
                    'campaignId': 'focus-network',
                    'sentAt': '2017-11-15T18:06:08Z',
                    'status': 'EMAIL_SENT_CLICKED',
                },
            ],
            'registeredAt': '2017-07-15T18:06:08Z',
        })
        user_id = str(self._db.user.find_one()['_id'])

        sync_user_elasticsearch.main([
            '--registered-from', '2017-07',
            '--no-dry-run'])

        mock_elasticsearch.create.assert_called_once()
        kwargs = mock_elasticsearch.create.call_args[1]
        body = kwargs.pop('body')
        self.assertEqual(
            {
                'index': 'bobusers',
                'doc_type': 'user',
                'id': user_id,
            },
            kwargs)
        self.assertEqual(
            {
                'profile': {
                    'ageGroup': '35-44',
                    'gender': 'MASCULINE',
                    'hasHandicap': False,
                    'highestDegree': 'DEA_DESS_MASTER_PHD',
                    'origin': 'FROM_A_FRIEND',
                    'frustrations': [],
                },
                'project': {
                    'advices': ['network'],
                    'job_search_length_months': 4,
                    'isComplete': True,
                    'kind': 'FIND_ANOTHER_JOB',
                    'mobility': {
                        'areaType': 'REGION',
                        'city': {
                            'regionName': 'Auvergne-Rhône-Alpes',
                            'urbanScore': 7,
                        },
                    },
                    'targetJob': {
                        'name': 'Boulanger',
                        'job_group': {
                            'name': 'Boulangerie',
                        },
                    },
                    'feedbackScore': 5,
                    'feedbackLoveScore': 1,
                },
                'registeredAt': '2017-07-15T18:06:08Z',
                'employmentStatus': {
                    'bobHasHelped': 'YES',
                    'bobHasHelpedScore': 1,
                },
                'emailsSent': {
                    'focus-network': 'EMAIL_SENT_CLICKED',
                    'focus-spontaneous': 'EMAIL_SENT_OPENED',
                },
                'clientMetrics': {
                    'firstSessionDurationSeconds': 250,
                },
            },
            json.loads(body))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
