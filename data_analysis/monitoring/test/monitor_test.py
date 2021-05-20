"""Unit tests for the module monitor.

Usage :
    docker-compose run --rm \
        -e AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id) \
        -e AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key) \
        frontend-flask-test \
        python /work/bob_emploi/frontend/server/asynchronous/test/monitor_test.py
"""

from typing import Dict
import unittest
from unittest import mock

import requests_mock

from bob_emploi.data_analysis.monitoring import monitor


@mock.patch(monitor.__name__ + '.boto3', new=mock.MagicMock())
class MonitoringTestCase(unittest.TestCase):
    """Unit tests for the module."""

    @requests_mock.mock()
    def test_server_version(self, mock_requests: requests_mock.Mocker) -> None:
        """The server version is correctly extracted."""

        mock_requests.get('https://www.bob-emploi.fr/api/monitoring', text='''
{
  "serverVersion": "server.version.fr"
}
''')
        self.assertEqual(
            monitor.retrieve_server_version('https://www.bob-emploi.fr'),
            'server.version.fr'
        )

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

        monitor_mock_data: Dict[str, monitor.MonitoredSite] = {
            'http://www.bob-emploi.fr': {
                'frontVersion': 'version 123',
                'serverVersion': 'version server 123',
            }
        }
        monitor.upload(monitor_mock_data)
        monitor.boto3.resource.assert_called_with('s3')
        monitor.boto3.resource('s3').Bucket.assert_called_with('bob-monitoring')
        monitor.boto3.resource('s3').Bucket('bob-monitoring').\
            put_object.assert_called_with(Key='data.json', Body='''{
  "http://www.bob-emploi.fr": {
    "frontVersion": "version 123",
    "serverVersion": "version server 123"
  }
}''')

    @requests_mock.mock()
    @mock.patch(monitor.logging.__name__ + '.info')
    def test_main(
        self, mock_requests: requests_mock.Mocker,
        mock_info: mock.MagicMock,
    ) -> None:
        """Test main."""

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


if __name__ == '__main__':
    unittest.main()
