"""Script to create a pool of use cases from actual users."""

import datetime
import json
import os
import random
import re
import sys
from typing import Mapping
from urllib import parse

from google.protobuf import json_format
from pymongo import errors
import requests

from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server.mail import campaign

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks
_SLACK_CREATE_POOL_URL = os.getenv('SLACK_CREATE_POOL_URL')

_YESTERDAY = (datetime.date.today() + datetime.timedelta(days=-1)).strftime('%Y-%m-%d')
_DEFAULT_USERS_FILTER = {
    'profile.email': {'$not': re.compile('@example.com|@bayes')},
    'registeredAt': {'$gt': _YESTERDAY, '$lt': f'{_YESTERDAY}T24'},
    'projects.createdAt': {'$exists': True},
    'projects.isIncomplete': {'$ne': True},
}


def _pick_random(frequencies: Mapping[str, float]) -> str:
    val = random.random()
    for firstname, frequency in frequencies.items():
        val -= frequency
        if val <= 0:
            return firstname
    return ''


def main(pool_name: str = _YESTERDAY, users_json_filters: str = '', limit: str = '20') -> None:
    """Create a pool of use cases and store them in MongoDB."""

    stats_db, user_db, eval_db = mongo.get_connections_from_env()

    user_counts = diagnostic.get_users_counts(stats_db)

    users_filters = json.loads(users_json_filters) if users_json_filters else _DEFAULT_USERS_FILTER
    user_iterator = user_db.user.find(users_filters).limit(int(limit))
    num_cases = 0
    for user_index, user_dict in enumerate(user_iterator):
        use_case_proto = privacy.user_to_use_case(user_dict, pool_name, user_index)
        if not use_case_proto:
            continue
        if user_counts and user_counts.frequent_firstnames:
            use_case_proto.user_data.profile.name = _pick_random(user_counts.frequent_firstnames)
        use_case = json_format.MessageToDict(use_case_proto)
        use_case['_id'] = use_case.pop('useCaseId')
        try:
            eval_db.use_case.insert_one(use_case)
        except errors.DuplicateKeyError:
            eval_db.use_case.replace_one({'_id': use_case['_id']}, use_case)
        num_cases += 1

    if num_cases and _SLACK_CREATE_POOL_URL:
        pool_url = campaign.get_bob_link(f'/eval/{parse.quote(pool_name)}')
        requests.post(_SLACK_CREATE_POOL_URL, json={
            'text': f'A new use cases pool is ready for evaluation: <{pool_url}|{pool_name}>',
        })


if __name__ == '__main__':
    main(*sys.argv[1:])
