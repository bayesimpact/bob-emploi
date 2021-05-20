"""Collect the deployments informations and upload a generated JSON file to S3.

This script is only meant to be used in a lambda function (AWS).

Usage (assuming a fully configured awscli, and boto3 is available):
    python bob_emploi/data_analysis/monitoring/monitor.py
"""

import argparse
import json
import logging
import re
import typing
from typing import Any, Dict, List, Optional, TypedDict

import requests
try:
    # This module should never be called outside a lambda environment, where boto3 is by default.
    import boto3
except ModuleNotFoundError:
    from unittest import mock
    # For testing purposes.
    boto3 = mock.MagicMock()


class MonitoredSite(TypedDict):
    """Monitored Site class definition."""

    frontVersion: str  # Front version of the monitored site.
    serverVersion: str  # Server version of the monitored site.


# TODO(cyrille): Consider getting from environement.
ALL_URLS = {
    'fr': 'https://www.bob-emploi.fr',
    'usa': 'https://us.hellobob.com',
    'uk': 'https://uk.hellobob.com',
}

_HTML_VERSION_PATTERN = re.compile(r'(?<=meta property=version content=)[a-zA-Z0-9\.\-\_]*')


def retrieve_front_version(url: str) -> str:
    """Retrieves the front version."""

    response = requests.get(url)
    response.raise_for_status()
    return str(_HTML_VERSION_PATTERN.findall(response.text).pop())


def retrieve_server_version(url: str) -> str:
    """Retrieves the server version."""

    response = requests.get(url + '/api/monitoring')
    response.raise_for_status()
    json_response = response.json()

    try:
        return typing.cast(str, json_response['serverVersion'])
    except KeyError:
        return '-'


def upload(monitoring_data: Dict[str, MonitoredSite]) -> None:
    """Transforms the data into JSON and uploads it to S3."""

    json_data = json.dumps(monitoring_data, indent=2)
    resource_s_3 = boto3.resource('s3')
    resource_s_3.Bucket('bob-monitoring').put_object(Key='data.json', Body=json_data)


def main(string_args: Optional[List[str]] = None) -> None:
    """Retrieves monitoring data and uploads the generated HTML file."""

    parser = argparse.ArgumentParser(
        description='Monitoring script for Project Managers.')
    parser.add_argument('--deployment', help='Deployment name.')
    args = parser.parse_args(string_args)

    monitoring_data: Dict[str, MonitoredSite] = {}
    monitored_urls = []
    if args.deployment in ALL_URLS.keys():
        logging.info('Run monitoring for "%s"', args.deployment)
        monitored_urls = [ALL_URLS[args.deployment]]
    else:
        logging.info('Run monitoring for all deployments')
        for deployment in ALL_URLS:
            monitored_urls.append(ALL_URLS[deployment])

    for url in monitored_urls:
        current_url_monitoring_data: MonitoredSite = {
            'frontVersion': retrieve_front_version(url),
            'serverVersion': retrieve_server_version(url),
        }
        monitoring_data[url] = current_url_monitoring_data

    upload(monitoring_data)


def lambda_handler(*unused_args: Any, **unused_kwargs: Any) -> None:
    """Method invoked by AWS lambda."""

    main()


if __name__ == '__main__':
    main()
