# encoding: utf-8
"""Script to check the status of links in actions that we display in Bob.

Run it with:

    docker run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
        -v /PATH/TO/check_action_urls.py:/check_action_urls.py:ro \
        bayesimpact/pandas-base python /check_action_urls.py

See README.md for how to get the AIRTABLE_API_KEY.

Running it will print out a report to stdout.
"""
from collections import namedtuple, defaultdict
import os
import random
import re
import sys

import requests

from airtable import airtable
from tqdm import tqdm

API_KEY = os.getenv('AIRTABLE_API_KEY')
BASE_ID = 'appXmyc7yYj0pOcae'
VIEW_ID = 'viweTj15LzsyrvNqu'
TABLE_BASE_URL = 'https://airtable.com/tblsScCB9ouUfiQ8q/%s/' % VIEW_ID

# Some websites return error codes when no header is set.
HTTP_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36')
}

Action = namedtuple('Action', ['id', 'url_template', 'url'])


def main():
    """Check the status of all URLs and print a report."""
    problems = check_links_in_airtable_field('action_templates', 'link', VIEW_ID)
    print_status_report(problems)


def check_links_in_airtable_field(table_name, field_name, view):
    """Check the availability of all URLs that can be found in `field_name` of `table_name`."""
    client = airtable.Airtable(BASE_ID, API_KEY)
    problems = defaultdict(list)
    action_records = list(client.iterate(table_name, view=view))
    for record in tqdm(action_records, file=sys.stderr):
        url_template = record['fields'].get(field_name)
        action = Action(record['id'], url_template, _populate_template(url_template))
        if not action.url:
            problems['Empty link field'].append(action)
            continue
        if _is_application_internal_url(action.url):
            continue
        try:
            res = requests.get(action.url, headers=HTTP_HEADERS)
            if res.status_code != 200:
                problems[str(res.status_code)].append(action)
        except requests.exceptions.SSLError:
            # When I checked, they were all false positives.
            pass
        except Exception as exception:  # pylint: disable=broad-except
            problems[type(exception).__name__].append(action)
    return problems


def _is_application_internal_url(url):
    return url.startswith('/')


def _populate_template(template):
    if '%' not in template:
        return template
    project_vars = {
        '%cityId': random.choice(['31555', '69123', '01072']),
        '%cityName': random.choice(['Toulouse', 'Lyon', 'Orléans']),
        '%latin1CityName': random.choice(['Toulouse', 'Lyon', 'Orl%E9ans']),
        '%departementId': random.choice(['31', '69', '75', '976']),
        '%postcode': random.choice(['31000', '69006', '42100']),
        '%regionId': random.choice(['84', '85']),
        '%romeId': random.choice(['A1204', 'D1301']),
        '%jobId': random.choice(['10200', '10201', '10202']),
        '%jobGroupNameUrl': random.choice([
            'protection-du-patrimoine-naturel', 'management-en-force-de-vente']),
        '%masculineJobName': random.choice(['Boulanger', 'P%C3%A2tissier']),
        '%latin1MasculineJobName': random.choice(['Boulanger', 'P%E2tissier']),
    }
    pattern = re.compile('|'.join(project_vars.keys()))
    return pattern.sub(lambda v: project_vars[v.group(0)], template)


def print_status_report(problems):
    """Print status report to stdout."""
    print('Action URL status report:\n')

    if not problems:
        print('All external links are functional ☀')

    for problem_type, problematic_actions in problems.items():
        print(problem_type + ':')
        for problematic_action in problematic_actions:
            print('\t%s%s: %s' % (TABLE_BASE_URL, problematic_action.id, problematic_action.url))


if __name__ == '__main__':
    main()
