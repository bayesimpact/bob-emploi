"""Unit tests for the module monitor.

Usage :
    docker-compose run --rm \
        -e AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id) \
        -e AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key) \
        frontend-flask-test \
        python /work/bob_emploi/frontend/server/asynchronous/test/monitor_test.py
"""

import datetime
import json
import re
import unittest
from unittest import mock

import requests_mock

from bob_emploi.data_analysis.monitoring import monitor
from bob_emploi.frontend.api import monitoring_pb2


@mock.patch(monitor.__name__ + '.boto3', new=mock.MagicMock())
class MonitoringTestCase(unittest.TestCase):
    """Unit tests for the module."""

    @requests_mock.mock()
    def test_server_version(self, mock_requests: requests_mock.Mocker) -> None:
        """The server version is correctly extracted."""

        mock_requests.get('https://www.bob-emploi.fr/api/monitoring', json={
            'serverVersion': 'server.version.fr',
            'lastSentEmail': {
                'focus-spontaneous': '2021-08-31T12:00:00Z',
            },
        })
        site = monitoring_pb2.Site(server_version='server.version.fr')
        site.last_sent_email['focus-spontaneous'].FromDatetime(
            datetime.datetime(2021, 8, 31, 12, 0, 0))
        self.assertEqual(site, monitor.retrieve_server_info('https://www.bob-emploi.fr'))

    @requests_mock.mock()
    def test_front_version(self, mock_requests: requests_mock.Mocker) -> None:
        """The front version is correctly extracted."""

        mock_requests.get('https://www.bob-emploi.fr', text='''
<html lang=fr data-reactroot="">
    <link rel=icon type=image/x-icon href=/favicon.ico>
    <meta charset=utf-8><title>Bob</title>
    <meta http-equiv=X-UA-Compatible content="IE=edge,chrome=1">
    <meta name=viewport content="width=device-width,initial-scale=1" id=viewport>
    <meta property=og:type content=website>
    <meta property=og:title content=Bob>
    <meta property=og:description name=description content="Bob fait un bilan">
    <meta property=og:image content=https://www.bob-emploi.fr/assets/bob-circle-picto.png>
    <meta property=og:url content=https://www.bob-emploi.fr>
    <meta property=fb:app_id content=1576288225722008>
    <meta property=version content=prod.fr.tag-2020-10-07_01>
    <body style=margin:0>
    </body>
</html>
''')
        self.assertEqual(
            monitor.retrieve_front_version('https://www.bob-emploi.fr'),
            'prod.fr.tag-2020-10-07_01'
        )

    def test_upload(self) -> None:
        """Test upload method."""

        data = monitoring_pb2.Data()
        data.computed_at.FromDatetime(datetime.datetime(2021, 8, 31, 12, 0, 0))
        fr_site = data.sites['http://www.bob-emploi.fr']
        fr_site.front_version = 'version 123'
        fr_site.server_version = 'version server 123'
        fr_site.last_sent_email['focus-network'].FromDatetime(
            datetime.datetime(2021, 8, 27, 11, 0, 0))
        monitor.upload(data)
        monitor.boto3.resource.assert_called_with('s3')
        monitor.boto3.resource('s3').Bucket.assert_called_with('bob-monitoring')
        monitor.boto3.resource('s3').Bucket('bob-monitoring').\
            put_object.assert_called_with(Key='data.json', Body='''{
  "computedAt": "2021-08-31T12:00:00Z",
  "sites": {
    "http://www.bob-emploi.fr": {
      "frontVersion": "version 123",
      "serverVersion": "version server 123",
      "lastSentEmail": {
        "focus-network": "2021-08-27T11:00:00Z"
      }
    }
  }
}''')

    @requests_mock.mock()
    @mock.patch('logging.info')
    def test_main_one_deployment(
        self, mock_requests: requests_mock.Mocker,
        mock_info: mock.MagicMock,
    ) -> None:
        """Test main for a specific deployment."""

        mock_requests.get('https://www.bob-emploi.fr', text='''
<meta property=version content=prod.fr.tag-2020-10-07_01>''')
        mock_requests.get('https://www.bob-emploi.fr/api/monitoring', text='''
{
  "serverVersion": "server.version.fr"
}
''')
        monitor.main(['--deployment', 'fr'])
        mock_info.assert_called_with('Run monitoring for "%s"', 'fr')
        monitor.boto3.resource.assert_called_with('s3')

    @requests_mock.mock()
    @mock.patch('logging.info')
    def test_main(
        self, mock_requests: requests_mock.Mocker,
        mock_info: mock.MagicMock,
    ) -> None:
        """Test main for all deployments."""

        mock_requests.get(re.compile(r'^https://[^/]*/?$'), text='''
<meta property=version content=prod.fr.tag-2020-10-07_01>''')
        mock_requests.get(re.compile(r'^https://[^/]*/api/monitoring$'), text='''
{
  "serverVersion": "server.version.fr"
}
''')
        monitor.main([])
        mock_info.assert_called_with('Run monitoring for all deployments')
        monitoring_data = json.loads(
            monitor.boto3.resource('s3').Bucket().put_object.call_args[1]['Body'],
        )
        self.assertGreaterEqual(len(monitoring_data['sites']), 3, monitoring_data)


if __name__ == '__main__':
    unittest.main()
