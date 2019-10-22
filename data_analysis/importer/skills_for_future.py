"""Importer for skills for the future.

Data was originally from https://80000hours.org/articles/skills-most-employable/
"""

import collections
import os
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional

from airtable import airtable

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import skill_pb2


# The airtable api key.
_AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')

# The min asset score (it's a percentage) to be considered as relevant for the skill.
_MIN_ASSET_SCORE = 50

# Maximum number of skills per job group.
_MAX_NUM_SKILLS = 5

# Maximum number of assets per skill.
_MAX_NUM_ASSETS = 2


def get_skills_per_rome_prefix(base_id: str, table: str, view: Optional[str] = None) \
        -> List[Dict[str, Any]]:
    """Download skills from Airtable and group the by ROME prefix.

    Returns:
        For various ROME prefixes, a list of useful skills.
    """

    if not _AIRTABLE_API_KEY:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, _AIRTABLE_API_KEY)
    records = list(client.iterate(table, view=view))

    skills_by_rome_prefixes = _group_by(records, _list_rome_prefixes)
    return [
        {'_id': prefix, 'skills': _create_skills_protos(skills_list)}
        for prefix, skills_list in skills_by_rome_prefixes.items()
    ]


_T = typing.TypeVar('_T')
_U = typing.TypeVar('_U')


def _group_by(records: Iterable[_T], list_keys: Callable[[_T], Iterable[_U]]) -> Dict[_U, List[_T]]:
    grouped: Dict[_U, List[_T]] = collections.defaultdict(list)
    for record in records:
        for key in list_keys(record):
            grouped[key].append(record)
    return grouped


def _list_rome_prefixes(record: Dict[str, Any]) -> Iterator[str]:
    for rome_prefix in record['fields']['rome_prefixes'].split(','):
        yield rome_prefix.strip()


def _create_skills_protos(skills_list: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        _create_skill_proto(skill['fields'])
        for skill in sorted(skills_list, key=lambda skill: -skill['fields']['value_score'])
    ][:_MAX_NUM_SKILLS]


def _create_skill_proto(skill: Dict[str, Any]) -> Dict[str, Any]:
    assets = {
        skill_pb2.SkillAsset.Value(asset_name): skill.get(asset_name, 0)
        for asset_name in skill_pb2.SkillAsset.keys()
        if skill_pb2.SkillAsset.Value(asset_name)
    }
    sorted_assets = sorted(assets.items(), key=lambda kv: -kv[1])[:_MAX_NUM_ASSETS]
    return {
        'name': skill['name'],
        'description': skill['description'],
        'discoverUrl': skill.get('discover_url', ''),
        'assets': [asset for asset, value in sorted_assets if value >= _MIN_ASSET_SCORE],
    }


if __name__ == '__main__':
    mongo.importer_main(get_skills_per_rome_prefix, 'test')
