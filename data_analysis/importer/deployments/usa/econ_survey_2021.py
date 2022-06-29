"""Module to handle Bayes US survey data on unemployment from late 2021.

See go/bob:econ-survey-2021 for more context.
"""

import argparse
import base64
import csv
import datetime
import functools
import logging
import os
import typing
from typing import Any, Callable, Mapping, Optional, Type

from algoliasearch import search_client
import boto3
import elasticsearch
from elasticsearch import helpers
from google.protobuf import message
from google.protobuf import timestamp_pb2
import pandas as pd
import requests
import requests_aws4auth

from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server.asynchronous import sync_user_elasticsearch

_SURVEY_YEAR = 2021

_GENDER_MAP = {
    'Male': user_profile_pb2.MASCULINE,
    'Female': user_profile_pb2.FEMININE,
}

_DEGREE_MAP = {
    "Associate's degree or other professional certification (for example: AA, AS)":
    job_pb2.BTS_DUT_DEUG,
    "Bachelor's degree (for example: BA, BS, AB)": job_pb2.LICENCE_MAITRISE,
    "Graduate degree (for example: master's, professional, doctorate)": job_pb2.LICENCE_MAITRISE,
    'High school graduate or equivalent (for example: GED)': job_pb2.BAC_BACPRO,
    'Less than high school': job_pb2.NO_DEGREE,
    'Some college, but degree not received or is in progress': job_pb2.BAC_BACPRO,
    'Some high school': job_pb2.CAP_BEP,
}

_FAMILY_SITUATION_MAP = {
    'In a relationship, no kids': user_profile_pb2.IN_A_RELATIONSHIP,
    'In a relationship, with kids': user_profile_pb2.FAMILY_WITH_KIDS,
    'Single, no kids': user_profile_pb2.SINGLE,
    'Single, with kids': user_profile_pb2.SINGLE_PARENT_SITUATION,
}

_PASSIONATE_LEVEL_MAP = {
    '': project_pb2.UNKNOWN_PASSION_LEVEL,
    "It's my dream job": project_pb2.LIFE_GOAL_JOB,
    "It's not my dream job, but it's a step forward in my career": project_pb2.PASSIONATING_JOB,
    "It's an OK job": project_pb2.LIKEABLE_JOB,
    "It's just a way to pay the bills": project_pb2.ALIMENTARY_JOB,
}

_CHALLENGE_MAP = {
    'discrim': (user_profile_pb2.AGE_DISCRIMINATION, None),
    'identifyjob': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'undefined-project'),
    'jobinfo': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'job-info'),
    'knowsearch': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'application-method'),
    'life': (user_profile_pb2.CHILD_CARE, None),
    'motivation': (user_profile_pb2.MOTIVATION, None),
    'salary': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'salary'),
    'speed': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'bravo'),
    'startsearch': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'start-your-search'),
    'toughmkt': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'stuck-market'),
    'training': (user_profile_pb2.UNKNOWN_JOB_SEARCH_FRUSTRATION, 'get-diploma'),
}

# A map of US states. Exported to be mocked in tests.
STATE_MAP: dict[str, str] = {}

_JOB_FINDERS: list[Callable[[str], Optional[job_pb2.Job]]] = []

_JOB_MAP = {
    'Computer Systems Engineers/Architects': job_pb2.JobGroup(
        name='Software Developers, Systems Software',
        rome_id='15-1133',
    ),
    'IT Security Analyst (Information Technology Security Analyst)': job_pb2.JobGroup(
        name='Information Security Analysts',
        rome_id='15-1122',
    ),
    'White Sugar Supervisor': job_pb2.JobGroup(
        name='First-Line Supervisors of Production and Operating Workers',
        rome_id='51-1011',
    ),
    'Informatics Nurse Specialists': job_pb2.JobGroup(
        name='Health Informatics Specialists',
        rome_id='15-1211',
    ),
}


@functools.lru_cache()
def _find_job(job_title: str) -> Optional[job_pb2.Job]:
    if job_group := _JOB_MAP.get(job_title):
        return job_pb2.Job(name=job_title, job_group=job_group)
    for finder in _JOB_FINDERS:
        job = finder(job_title)
        if job:
            return job
    return job_pb2.Job(name=job_title)


@functools.lru_cache()
def _find_state(state_name: str) -> geo_pb2.FrenchCity:
    return geo_pb2.FrenchCity(
        region_id=STATE_MAP[state_name],
        region_name=state_name)


class _AlgoliaJobFinder:

    def __init__(self) -> None:
        client = search_client.SearchClient.create('K6ACI9BKKT')
        self._index = client.init_index('jobs_en')
        self._missed: set[str] = set()

    def find_job(self, job_title: str) -> Optional[job_pb2.Job]:
        """Find a job in Algolia index by its name."""

        result = self._index.search(job_title)
        hits = result['hits']
        job_group_ids = {job['jobGroupId'] for job in hits}

        # All job resuts are in the same job group.
        if len(job_group_ids) == 1:
            return job_pb2.Job(name=job_title, job_group=job_pb2.JobGroup(
                rome_id=hits[0]['jobGroupId'],
                name=hits[0]['jobGroupName']
            ))

        # The name matches exactly a job group.
        for job in hits:
            if job['jobGroupName'] == job_title:
                return job_pb2.Job(name=job_title, job_group=job_pb2.JobGroup(
                    rome_id=job['jobGroupId'],
                    name=job['jobGroupName']
                ))

        logging.error('Could not find job "%s" in Algolia', job_title)

        self._missed.add(job_title)

        return None


class _ExcelJobFinder:

    def __init__(self, filename: str) -> None:
        soc_mapping = pd.read_excel(filename, dtype={'soc': str}, engine='openpyxl')
        # Fix the wrong soc "2011-11-01 00:00:00" => "11-2021".
        soc_mapping.loc[soc_mapping.soc.str.len() > 7, 'soc'] = \
            soc_mapping.soc[soc_mapping.soc.str.len() > 7]\
            .replace(r'(\d{4})-11-01 00:00:00', r'11-\1', regex=True)
        self._mapping = soc_mapping.set_index('title').soc.to_dict()
        self._missed: set[str] = set()

    def find_job(self, job_title: str) -> Optional[job_pb2.Job]:
        """Find a job in Algolia index by its name."""

        try:
            return job_pb2.Job(
                name=job_title, job_group=job_pb2.JobGroup(rome_id=self._mapping[job_title]))
        except KeyError:
            logging.exception('Could not find job "%s" in Excel file', job_title)
            self._missed.add(job_title)

        return None


def _create_proto_timestamp(instant: datetime.datetime) -> timestamp_pb2.Timestamp:
    proto = timestamp_pb2.Timestamp()
    proto.FromDatetime(instant)
    return proto


_SURVEY_DATE = _create_proto_timestamp(datetime.datetime(2021, 12, 1))


def convert_answer_to_user(answer: dict[str, str]) -> user_pb2.User:
    """Convert one answer to Bayes survey to a user proto."""

    frustrations: set[user_profile_pb2.Frustration.ValueType] = set()
    main_challenges: set[str] = set()
    for key, value in answer.items():
        if key.startswith('challenge_') and value == 'Very challenging':
            frustration, main_challenge = _CHALLENGE_MAP[key.removeprefix('challenge_')]
            if frustration:
                frustrations.add(frustration)
            if main_challenge:
                main_challenges.add(main_challenge)

    return user_pb2.User(
        user_id=answer['id'],
        registered_at=_SURVEY_DATE,
        profile=user_profile_pb2.UserProfile(
            gender=_GENDER_MAP.get(answer['gender'], user_profile_pb2.UNKNOWN_GENDER),
            custom_gender=answer['gender'] if answer['gender'] not in _GENDER_MAP else '',
            highest_degree=_DEGREE_MAP[answer['educ']],
            year_of_birth=_SURVEY_YEAR - int(answer['age']),
            family_situation=_FAMILY_SITUATION_MAP[answer['familysituation']],
            frustrations=frustrations,
        ),
        projects=[project_pb2.Project(
            city=None if not (state_name := answer['state']) else _find_state(state_name),
            target_job=(
                _find_job(answer['specificjobtitle']) if answer['specificjob'] == 'Yes' else None),
            training_fulfillment_estimate=(
                project_pb2.CURRENTLY_IN_TRAINING
                if answer['enrolled'] == 'Yes'
                else project_pb2.UNKNOWN_TRAINING_FULFILLMENT),
            has_clear_project=boolean_pb2.TRUE,
            original_self_diagnostic=diagnostic_pb2.SelfDiagnostic(
                category_id=''.join(sorted(main_challenges)) if len(main_challenges) == 1 else '',
                category_details=(
                    ','.join(sorted(main_challenges)) if len(main_challenges) > 1 else ''),
                status=(
                    diagnostic_pb2.UNDEFINED_SELF_DIAGNOSTIC if not main_challenges
                    else diagnostic_pb2.KNOWN_SELF_DIAGNOSTIC if len(main_challenges) == 1
                    else diagnostic_pb2.OTHER_SELF_DIAGNOSTIC),
            ),
            passionate_level=_PASSIONATE_LEVEL_MAP[answer['specificjobmeaning']],
        )],
    )


_ProtoOut = typing.TypeVar('_ProtoOut', bound=message.Message)


def _post_proto(url: str, data: message.Message, out_type: Type[_ProtoOut]) -> _ProtoOut:
    response = requests.post(
        url, data=base64.encodebytes(data.SerializeToString()).decode('ascii'),
        headers={
            'Accept': 'application/x-protobuf-base64',
            'Content-type': 'application/x-protobuf-base64',
        })
    response.raise_for_status()
    output = out_type()
    output.ParseFromString(base64.decodebytes(response.content))
    return output


def _diagnose_with_bob(user: user_pb2.User, api_url: str) -> user_pb2.User:
    diag = _post_proto(f'{api_url}project/diagnose', data=user, out_type=diagnostic_pb2.Diagnostic)
    user.projects[0].diagnostic.CopyFrom(diag)
    return user


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
        if not credentials:
            return None
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
    api_key: Optional[tuple[str, ...]]
    if api_key_encoded := env.get('ELASTICSEARCH_API_KEY'):
        api_key = tuple(base64.urlsafe_b64decode(api_key_encoded).decode('ascii').split(':'))
    else:
        api_key = None
    return elasticsearch.Elasticsearch(
        env.get('ELASTICSEARCH_URL', 'http://elastic:changeme@elastic-dev:9200').split(','),
        http_auth=None if api_key else _get_auth_from_env(env),
        api_key=api_key,
        connection_class=elasticsearch.RequestsHttpConnection,
        timeout=600)


def _convert_to_bulk_format(user: user_pb2.User, index: str) -> dict[str, Any]:
    user_as_dict = sync_user_elasticsearch.user_to_analytics_data(user)
    return {
        '_id': user.user_id,
        '_index': index,
        '_op_type': 'update',
        '_type': '_doc',
        'doc': user_as_dict,
        'doc_as_upsert': True,
    }


def main(string_args: Optional[list[str]] = None) -> None:
    """Handle Bayes US survey data on unemployment from late 2021."""

    parser = argparse.ArgumentParser(description='Import data from Bayes US survey.')
    parser.add_argument('--input_csv', required=True, help='The input CSV')
    parser.add_argument('--states_txt', required=True, help='The names of USA states')
    parser.add_argument('--soc_titles_xlsx', help='The files with job titles mapping')
    parser.add_argument(
        '--bob_api_url', default='https://us.hellobob.com/api/', help='The URL of Bob API')
    parser.add_argument('--es_index', required=True, help='The Elasticsearch index to upload to')
    args = parser.parse_args(string_args)

    states = pd.read_csv(args.states_txt, delimiter='|')
    STATE_MAP.update(states.set_index('STATE_NAME').STUSAB.to_dict())

    del _JOB_FINDERS[:]
    if args.soc_titles_xlsx:
        excel_job_finder = _ExcelJobFinder(args.soc_titles_xlsx)
        _JOB_FINDERS.append(excel_job_finder.find_job)

    algolia_job_finder = _AlgoliaJobFinder()
    _JOB_FINDERS.append(algolia_job_finder.find_job)

    es_client = _get_es_client_from_env()
    has_previous_index = es_client.indices.exists(index=args.es_index)
    if not has_previous_index:
        logging.info('Creating index %s…', args.es_index)
        es_client.indices.create(index=args.es_index)

    with open(args.input_csv, 'rt', encoding='utf-8') as input_file:
        reader = csv.DictReader(input_file)
        result = helpers.bulk(
            es_client, (
                _convert_to_bulk_format(user_with_diagnostic, index=args.es_index)
                for answer in reader
                if (user := convert_answer_to_user(answer)) and
                (user_with_diagnostic := _diagnose_with_bob(user, args.bob_api_url))
            ),
            stats_only=True, chunk_size=10000, request_timeout=600)

    print(result)


if __name__ == '__main__':
    main()
