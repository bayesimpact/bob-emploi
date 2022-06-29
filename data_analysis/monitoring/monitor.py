"""Collect the deployments informations and upload a generated JSON file to S3.

This script is only meant to be used in a lambda function (AWS).

Usage (assuming a fully configured awscli, and boto3 is available):
    python bob_emploi/data_analysis/monitoring/monitor.py
"""

import argparse
import logging
import re
from typing import Any, Optional

from google.protobuf import json_format
import requests

from bob_emploi.common.python import proto
from bob_emploi.frontend.api import monitoring_pb2

try:
    # This module should never be called outside a lambda environment, where boto3 is by default.
    import boto3 as boto3  # pylint: disable=useless-import-alias
except ModuleNotFoundError:
    from unittest import mock
    # For testing purposes.
    boto3 = mock.MagicMock()


# TODO(cyrille): Consider getting from environement.
# TODO(cyrille): Add a test to compare this with defined deployments.
ALL_URLS = {
    'fr': 'https://www.bob-emploi.fr',
    'usa': 'https://us.hellobob.com',
    'uk': 'https://uk.hellobob.com',
    'skillup': 'https://skillup.hellobob.com',
}

_HTML_VERSION_PATTERN = re.compile(r'(?<=meta property=version content=)[a-zA-Z0-9\.\-\_]*')


def retrieve_front_version(url: str) -> str:
    """Retrieves the front version."""

    response = requests.get(url)
    response.raise_for_status()
    return str(_HTML_VERSION_PATTERN.findall(response.text).pop())


def retrieve_server_info(url: str, site: Optional[monitoring_pb2.Site] = None) \
        -> monitoring_pb2.Site:
    """Retrieves the monintoring info from server."""

    response = requests.get(url + '/api/monitoring')
    response.raise_for_status()
    site = site or monitoring_pb2.Site()

    json_format.ParseDict(response.json(), site)
    return site


def upload(monitoring_data: monitoring_pb2.Data) -> None:
    """Transforms the data into JSON and uploads it to S3."""

    json_data = json_format.MessageToJson(monitoring_data, indent=2)
    resource_s_3 = boto3.resource('s3')
    resource_s_3.Bucket('bob-monitoring').put_object(Key='data.json', Body=json_data)


def main(string_args: Optional[list[str]] = None) -> None:
    """Retrieves monitoring data and uploads the generated HTML file."""

    parser = argparse.ArgumentParser(
        description='Monitoring script for Project Managers.')
    parser.add_argument('--deployment', help='Deployment name.')
    args = parser.parse_args(string_args)

    data = monitoring_pb2.Data()
    proto.set_date_now(data.computed_at)

    monitored_urls: list[str] = []
    if args.deployment in ALL_URLS:
        logging.info('Run monitoring for "%s"', args.deployment)
        monitored_urls = [ALL_URLS[args.deployment]]
    else:
        logging.info('Run monitoring for all deployments')
        monitored_urls.extend(ALL_URLS.values())

    for url in monitored_urls:
        retrieve_server_info(url, data.sites[url])
        data.sites[url].front_version = retrieve_front_version(url)

    upload(data)


def lambda_handler(*unused_args: Any, **unused_kwargs: Any) -> None:
    """Method invoked by AWS lambda."""

    main()


if __name__ == '__main__':
    main()
