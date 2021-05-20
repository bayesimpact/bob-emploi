"""Export Radar documents to ElasticSearch for Kibana.

Prepare an export with:
  docker-compose run -e ELASTICSEARCH_URL -e TYPEFORM_API_KEY --rm data-analysis-prepare \
    radar/export.py --fake 500 --dump > bulk_export.json

Then upload it with:
  awscurl --region eu-west-3 --service es -X POST "$ELASTICSEARCH_URL/_bulk" -d@bulk_export.json
If that fails because the bulk_export.json is too big, I recommend:
  split -l 20000 --additional-suffix=.json bulk_export.json bulk_export_part_
  for file in $(ls bulk_export_part_*.json); do \
    awscurl --region eu-west-3 --service es -X POST "$ELASTICSEARCH_URL/_bulk" -d@$file; \
  done

If needed, you can clean up the indices with:
  awscurl --region eu-west-3 --service es -X DELETE "$ELASTICSEARCH_URL/radar-achievements"
  awscurl --region eu-west-3 --service es -X DELETE "$ELASTICSEARCH_URL/radar-domains"
  awscurl --region eu-west-3 --service es -X DELETE "$ELASTICSEARCH_URL/radar-photos"
  awscurl --region eu-west-3 --service es -X DELETE "$ELASTICSEARCH_URL/radar-skills"
"""

import argparse
import collections
import datetime
import itertools
import json
import hashlib
import logging
import os
import sys
import typing
from typing import (
    Any, Dict, Iterator, List, Literal, Mapping, Optional, Sequence, Set, TextIO, Tuple, Union,
)

import boto3
import certifi as _  # Needed to handle SSL in elasticsearch connections, for production use.
import elasticsearch
from elasticsearch import helpers
from google.protobuf import json_format
from google.protobuf import timestamp_pb2
import requests
import requests_aws4auth

from bob_emploi.frontend.api.radar import output_pb2
from bob_emploi.frontend.api.radar import typeform_pb2
from bob_emploi.data_analysis.radar import config as radar_config
from bob_emploi.data_analysis.radar import generate_young
from bob_emploi.data_analysis.radar import typeform_radar as typeform

_NEVER = 1000


_ELASTICSERCH_INDICES = ('radar-achievements', 'radar-domains', 'radar-photos', 'radar-skills')

_CONFIG = radar_config.from_json5_file()

_SKILLS_LIMITS: Mapping[Literal[
    'mobilized_after_months',
    'knowledgeable_after_months',
    'interested_after_months',
], int] = {
    'mobilized_after_months': 3,
    'knowledgeable_after_months': 2,
    'interested_after_months': 1,
}

_ACHIEVEMENTS: Mapping[str, int] = {
    '1. Intérêt': 1,
    '2. Connaissance': 2,
    '3. Mobilisation': 3,
    '4. Autonomie': 4,
}

_HASH_SALT = 'Radar'


def _is_autonomous_skill(level: int) -> bool:
    return level >= 4


def _has_enough_levels(levels: Tuple[int, ...], threshold: int) -> bool:
    return sum(1 for level in levels if level >= threshold) >= 2


def _is_autonomous(levels: Tuple[int, ...]) -> bool:
    # At least two skills at level 4.
    return sum(1 for skill in levels if _is_autonomous_skill(skill)) >= 2


def _get_user_id(photo: typeform_pb2.Photo) -> str:
    return photo.hidden.dossier_id


def _sort_photos(all_photos: Sequence[typeform_pb2.Photo]) \
        -> Dict[str, List[typeform_pb2.Photo]]:
    sorted_photos: Dict[str, List[typeform_pb2.Photo]] = {}
    for each_user, user_photos in itertools.groupby(
            sorted(all_photos, key=_get_user_id), _get_user_id):
        sorted_photos[str(each_user)] = sorted(
            user_photos, key=lambda p: p.submitted_at.ToDatetime())
    return sorted_photos


class _StructureDetails(typing.NamedTuple):
    departement_id: str
    structure_name: str


class _Structures:

    def __init__(self) -> None:
        self._details: Dict[str, _StructureDetails] = {}

    def __getitem__(self, structure_id: str) -> _StructureDetails:
        return self._details.get(structure_id, _StructureDetails('', ''))

    def load_from_tsv(self, tsv_filename: str) -> None:
        """Load structures info from a TSV file."""

        with open(tsv_filename, 'r') as tsv_file:
            for structure in tsv_file:
                dep_and_name, unused_postcode, structure_id = structure.strip().split('\t')
                departement_id, name = dep_and_name.split('-')
                self._details[structure_id] = _StructureDetails(departement_id, name)


_STRUCTURES = _Structures()


class _AnswerId(typing.NamedTuple):
    domain_id: str
    skill_id: str


def _get_answer_id(answer: typeform_pb2.ChoiceAnswer) -> _AnswerId:
    return _AnswerId(*answer.field.ref.split('-'))


def _get_answer_level(answer: typeform_pb2.ChoiceAnswer) -> int:
    return int(answer.choice.label[len('Niveau '):])


def _make_filters(hidden: typeform_pb2.HiddenFields) -> output_pb2.FiltersExport:
    departement_id, structure_name = _STRUCTURES[hidden.structure_id]
    return output_pb2.FiltersExport(
        age=int(hidden.age) if hidden.age else 0,
        counselor_id=hidden.counselor_id,
        current_policies=hidden.current_policies.split(','),
        dossier_id=hashlib.sha1((hidden.dossier_id + _HASH_SALT).encode('utf-8')).hexdigest(),
        referent_id=hidden.referent_id,
        school_level=hidden.school_level,
        structure_id=hidden.structure_id,
        departement_id=departement_id,
        structure_name=structure_name,
    )


_Filterable = Union[
    output_pb2.DomainAchievement,
    output_pb2.DomainExport,
    output_pb2.PhotoExport,
    output_pb2.SkillExport,
]


_ExportAutonomousable = Union[output_pb2.DomainExport, output_pb2.SkillExport]


def _is_autonomous_export(export: _ExportAutonomousable) -> bool:
    return export.autonomous_after_months < _NEVER


class _Output(typing.NamedTuple):
    elasticsearch_index: str
    id: str
    proto: _Filterable


class _UserStats:

    _domain_exports: Mapping[str, output_pb2.DomainExport]
    _skill_exports: Mapping[Tuple[str, str], output_pb2.SkillExport]
    _autonomous_domains: Set[str]
    _initial_autonomous_domains: Set[str]
    _domain_achievements: Dict[Tuple[str, str], int]

    def __init__(self, base_photo: typeform_pb2.Photo) -> None:
        self._filters = _make_filters(base_photo.hidden)
        self._base_time = base_photo.submitted_at.ToDatetime()
        self._reset()

    def _reset(self) -> None:
        self._domain_exports: Mapping[str, output_pb2.DomainExport] = {
            domain: self._make_default_domain(domain) for domain in _CONFIG['domainIds']}
        self._skill_exports: Mapping[Tuple[str, str], output_pb2.SkillExport] = {
            (domain_id, skill_id): self._make_default_skill(domain_id, skill_id)
            for domain_id in _CONFIG['domainIds']
            for skill_id in _CONFIG['skillIds']
        }
        self._autonomous_domains = set()
        self._initial_autonomous_domains = set()
        self._domain_achievements = {}

    def _fill_in_filters(self, filterable: _Filterable) -> None:
        filterable.filters.CopyFrom(self._filters)
        filterable.started_at.FromDatetime(self._base_time)

    def _make_default_domain(self, domain_id: str) -> output_pb2.DomainExport:
        domain = output_pb2.DomainExport(
            domain=_CONFIG['translations'].get(domain_id, domain_id),
            autonomous_after_months=_NEVER,
            mobilized_after_months=_NEVER,
            knowledgeable_after_months=_NEVER,
            interested_after_months=_NEVER)
        self._fill_in_filters(domain)
        return domain

    def _make_default_skill(self, domain_id: str, skill_id: str) -> output_pb2.SkillExport:
        skill = output_pb2.SkillExport(
            domain=_CONFIG['translations'].get(domain_id, domain_id),
            skill=_CONFIG['translations'].get(skill_id, skill_id),
            autonomous_after_months=_NEVER)
        self._fill_in_filters(skill)
        return skill

    def prepare_all_outputs(self, photos: Sequence[typeform_pb2.Photo]) -> Iterator[_Output]:
        """Prepare outputs for ElasticSearch.

        The input is a user described by a sequence of photos:
         - the first photo is the first one taken for the user and is the reference (before they get
           coaching)
         - the other photos are snapshot taken afterwards.
        """

        self._reset()
        for index, photo in enumerate(photos):
            date_in_months = \
                self._compute_date_in_months(photo.submitted_at.ToDatetime()) if index else 0
            self._parse_photo(not index, date_in_months, photo)
            yield self._create_output_at(
                photo.submitted_at, index, date_in_months, is_latest_photo=index == len(photos) - 1)
        for domain_export in self._domain_exports.values():
            yield _Output('radar-domains', domain_export.domain, domain_export)

        for skill_export in self._skill_exports.values():
            yield _Output(
                'radar-skills', f'{skill_export.domain}-{skill_export.skill}', skill_export)

        for (domain_id, achievement_name), score in self._domain_achievements.items():
            proto = output_pb2.DomainAchievement(
                domain=_CONFIG['translations'].get(domain_id, domain_id),
                achievement=achievement_name, score=score)
            self._fill_in_filters(proto)
            yield _Output('radar-achievements', f'{domain_id}-{achievement_name}', proto)

    def _compute_date_in_months(self, instant: datetime.datetime) -> int:
        after = instant - self._base_time
        return int(after.days / 30)

    def _parse_photo(
            self, is_first_answer: bool, date_in_months: int, photo: typeform_pb2.Photo) -> None:
        autonomy_levels: Dict[str, Tuple[int, ...]] = collections.defaultdict(tuple)
        for answer in photo.answers:
            domain, skill_id = _get_answer_id(answer)
            level = _get_answer_level(answer)
            autonomy_levels[domain] += (level,)
            skill_export = self._skill_exports[(domain, skill_id)]
            if is_first_answer:
                skill_export.start_autonomy_score = level
            skill_export.autonomy_score_delta = max(
                skill_export.autonomy_score_delta,
                level - skill_export.start_autonomy_score)
            if _is_autonomous_skill(level) and not _is_autonomous_export(skill_export):
                skill_export.autonomous_after_months = date_in_months

        for domain, levels in autonomy_levels.items():
            domain_export = self._domain_exports[domain]
            autonomy_score = sum(levels)
            if is_first_answer:
                domain_export.start_autonomy_score = autonomy_score

            for achievement_name, threshold in _ACHIEVEMENTS.items():
                score = 1 if _has_enough_levels(levels, threshold) else 0
                previous_score = self._domain_achievements.get((domain, achievement_name), 1)
                if score != previous_score:
                    self._domain_achievements[(domain, achievement_name)] = score

            domain_export.autonomy_score_delta = max(
                domain_export.autonomy_score_delta,
                autonomy_score - domain_export.start_autonomy_score)
            if _is_autonomous(levels) and not _is_autonomous_export(domain_export):
                domain_export.autonomous_after_months = date_in_months
                self._autonomous_domains.add(domain)
            for field, threshold in _SKILLS_LIMITS.items():
                if getattr(domain_export, field) == _NEVER and \
                        _has_enough_levels(levels, threshold):
                    setattr(domain_export, field, date_in_months)

    def _create_output_at(
            self, instant: timestamp_pb2.Timestamp, index: int, date_in_months: int,
            is_latest_photo: bool) -> _Output:
        is_first_answer = not index
        if is_first_answer:
            self._initial_autonomous_domains = self._autonomous_domains.copy()
        count_export = output_pb2.PhotoExport(
            domains_count=len(self._autonomous_domains),
            new_domains_count=len(self._autonomous_domains - self._initial_autonomous_domains),
            autonomous_after_months=date_in_months,
            submitted_at=instant)
        if is_first_answer:
            count_export.is_first_photo = True
        if is_latest_photo:
            count_export.is_latest_photo = True
        count_export.photo_index = index + 1
        self._fill_in_filters(count_export)
        return _Output('radar-photos', str(date_in_months), count_export)


def prepare_domain_export(user: Sequence[typeform_pb2.Photo]) -> Iterator[_Output]:
    """Export ElasticSearch documents of a convenient format for by-domain graphs.

    The input is a user described by a sequence of photos:
     - the first photo actually only contains the user's information (e.g. age, school level)
     - the second photo is the first one taken for the user and is the reference (before they get
       coaching)
     - the other photos are snapshot taken afterwards.
    """

    stats = _UserStats(user[0])
    yield from stats.prepare_all_outputs(user)


def _convert_to_json(output: _Filterable) -> Dict[str, Any]:
    result = json_format.MessageToDict(output, including_default_value_fields=True)
    if 'filters' in result:
        del result['filters']
        result.update(json_format.MessageToDict(
            output.filters, including_default_value_fields=True))
    return result


def _prepare_all_outputs(all_photos: Sequence[typeform_pb2.Photo]) -> Iterator[_Output]:
    sorted_photos = _sort_photos(all_photos)
    for user_id, user in sorted_photos.items():
        for index, output_id, output in prepare_domain_export(user):
            yield _Output(index, f'{user_id}:{output_id}', output)


def _get_auth_from_env(env: Mapping[str, str]) -> Optional[requests_aws4auth.AWS4Auth]:
    aws_in_docker = env.get('AWS_CONTAINER_CREDENTIALS_RELATIVE_URI')
    if aws_in_docker:
        # https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
        response = requests.get(f'http://169.254.170.2{aws_in_docker}')
        response.raise_for_status()
        credentials = response.json()
        access_key_id = credentials.get('AccessKeyId')
        secret_access_key = credentials.get('SecretAccessKey')
        session_token = credentials.get('Token')
    else:
        session = boto3.Session()
        credentials = session.get_credentials()
        access_key_id = credentials.access_key
        secret_access_key = credentials.secret_key
        session_token = credentials.token
    if not access_key_id:
        return None
    region = env.get('AWS_REGION', 'eu-west-3')
    return requests_aws4auth.AWS4Auth(
        access_key_id, secret_access_key, region, 'es', session_token=session_token)


def _get_es_client_from_env() -> elasticsearch.Elasticsearch:
    """Get an Elasticsearch client configured from environment variables."""

    env = os.environ
    return elasticsearch.Elasticsearch(
        env.get('ELASTICSEARCH_URL', 'http://elastic:changeme@elastic-dev:9200').split(','),
        http_auth=_get_auth_from_env(env),
        connection_class=elasticsearch.RequestsHttpConnection,
        timeout=600)


def _convert_to_bulk_format(output_iterator: Iterator[_Output]) -> Iterator[Dict[str, Any]]:
    for index, output_id, output in output_iterator:
        yield {
            '_id': output_id,
            '_index': index,
            '_op_type': 'update',
            '_type': '_doc',
            'doc': _convert_to_json(output),
            'doc_as_upsert': True,
        }


def main(string_args: Optional[List[str]] = None, out: TextIO = sys.stdout) -> None:
    """Export Radar documents to ElasticSearch for Kibana.

    Right now, its stdout output can be used as a request body for creating ElasticSearch documents
    using the bulk API.
    """

    parser = argparse.ArgumentParser(
        description='Export Radar documents to ElasticSearch for Kibana.')
    parser.add_argument('--fake', type=int, help='Generate fake data.')
    parser.add_argument(
        '--force-recreate', action='store_true',
        help='If set, completely cleanup the indices, rather than updating existing documents.')
    parser.add_argument(
        '--dump', action='store_true',
        help='Instead of uploading to ElasticSearch, dumps corresponding bulk commands.')
    parser.add_argument(
        '--ignore-before', type=str,
        help='If the typeform data contains unrelated old photos, ignore the photos before this '
        'date (2021-03-01 format).')
    parser.add_argument(
        '--structures_tsv', type=str,
        help='A TSV file containing information about structures.',
        default=os.path.join(os.path.dirname(__file__), 'structures.tsv'))
    args = parser.parse_args(string_args)

    all_photos: Sequence[typeform_pb2.Photo]
    if args.fake:
        all_photos = generate_young.generate_all_photos(args.fake, config=_CONFIG)
    else:
        ignore_before = datetime.datetime.strptime(args.ignore_before, '%Y-%m-%d') \
            if args.ignore_before else None
        all_photos = [
            photo for photo in typeform.iterate_results()
            if not ignore_before or photo.submitted_at.ToDatetime() >= ignore_before
        ]

    if args.structures_tsv:
        _STRUCTURES.load_from_tsv(args.structures_tsv)

    all_outputs = _prepare_all_outputs(all_photos)

    if args.dump:
        for index, output_id, output in all_outputs:
            out.write(json.dumps({'update': {
                '_index': index,
                '_id': output_id,
            }}))
            out.write(json.dumps({
                'doc': _convert_to_json(output),
                'doc_as_upsert': True,
            }))
    else:
        es_client = _get_es_client_from_env()
        for index in _ELASTICSERCH_INDICES:
            has_previous_index = es_client.indices.exists(index=index)
            if args.force_recreate and has_previous_index:
                logging.info('Removing old index %s…', index)
                es_client.indices.delete(index=index)
            if args.force_recreate or not has_previous_index:
                logging.info('Creating index %s…', index)
                es_client.indices.create(index=index)
        out.write(str(helpers.bulk(
            es_client, _convert_to_bulk_format(all_outputs), stats_only=True,
            chunk_size=10000, request_timeout=600)))


if __name__ == '__main__':
    main()
