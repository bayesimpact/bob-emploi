"""Unit tests for the module sync_user_elasticsearch."""

import datetime
import json
import unittest

import mock
import mongomock
import requests_mock

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous import sync_user_elasticsearch


@mock.patch(now.__name__ + '.get', new=lambda: datetime.datetime(2017, 11, 16))
class SyncTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def setUp(self):
        super(SyncTestCase, self).setUp()
        self._db = mongomock.MongoClient().test
        patcher = mock.patch(sync_user_elasticsearch.__name__ + '._DB', new=self._db)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.mock_elasticsearch = mock.MagicMock()

    def test_main(self):
        """Test main."""

        self.maxDiff = None  # pylint: disable=invalid-name
        self._db.user.insert_one({
            'profile': {
                'coachingEmailFrequency': 'EMAIL_MAXIMUM',
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
                'minSalary': 45000,
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
            'origin': {
                'source': 'facebook',
                'medium': 'ad',
            },
            'registeredAt': '2017-07-15T18:06:08Z',
        })
        user_id = str(self._db.user.find_one()['_id'])

        sync_user_elasticsearch.main(self.mock_elasticsearch, [
            '--registered-from', '2017-07',
            '--no-dry-run'])

        self.mock_elasticsearch.create.assert_called_once()
        kwargs = self.mock_elasticsearch.create.call_args[1]
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
                    'coachingEmailFrequency': 'EMAIL_MAXIMUM',
                    'frustrations': [],
                    'gender': 'MASCULINE',
                    'hasHandicap': False,
                    'highestDegree': 'DEA_DESS_MASTER_PHD',
                    'origin': 'FROM_A_FRIEND',
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
                    'minSalary': 45000,
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
                'origin': {
                    'medium': 'ad',
                    'source': 'facebook',
                },
            },
            json.loads(body))

    @requests_mock.mock()
    def test_es_client_from_env_aws_in_docker(self, mock_requests):
        """Get an Elasticsearch client for a task running in AWS ECS Docker."""

        mock_requests.get(
            'http://169.254.170.2/get-my-credentials',
            json={'AccessKeyId': 'my-access-key', 'SecretAccessKey': 'super-secret'})
        client = sync_user_elasticsearch.get_es_client_from_env({
            'ELASTICSEARCH_URL': 'http://elastic-dev:9200',
            'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI': '/get-my-credentials',
        })
        http_auth = client.transport.kwargs['http_auth']
        self.assertEqual('my-access-key', http_auth.access_id)
        self.assertEqual('super-secret', http_auth.signing_key.secret_key)
        self.assertEqual('es', http_auth.service)

    def test_es_client_for_aws_access(self):
        """Get an Elasticsearch client that can access a server on AWS."""

        client = sync_user_elasticsearch.get_es_client_from_env({
            'ELASTICSEARCH_URL': 'http://elastic-dev:9200',
            'AWS_ACCESS_KEY_ID': 'my-access-key',
            'AWS_SECRET_ACCESS_KEY': 'mega-secret',
        })
        http_auth = client.transport.kwargs['http_auth']
        self.assertEqual('my-access-key', http_auth.access_id)
        self.assertEqual('mega-secret', http_auth.signing_key.secret_key)
        self.assertEqual('es', http_auth.service)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
