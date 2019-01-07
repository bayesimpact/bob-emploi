"""Script to update users analytics data to Elasticsearch."""

import argparse
import datetime
import functools
import json
import logging
import os
import random
import typing

import certifi as _  # Needed to handle SSL in elasticsearch connections, for production use.
import elasticsearch
from google.protobuf import json_format
import requests
import requests_aws4auth

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous import report

_DB, _USER_DB, _ = mongo.get_connections_from_env()


def age_group(year_of_birth: int) -> str:
    """Estimate age group from year of birth."""

    if year_of_birth < 1920:
        return 'Unknown'
    precise_age = now.get() - datetime.datetime(year_of_birth, 7, 1)
    age = precise_age.days / 365
    if age < 18:
        return '-18'
    if age < 25:
        return '18-24'
    if age < 35:
        return '25-34'
    if age < 45:
        return '35-44'
    if age < 55:
        return '45-54'
    if age < 65:
        return '55-64'
    return '65+'


def nps_love_score(nps_score: int) -> typing.Optional[int]:
    """Convert NPS scode to lovers/detractors values.

    Returns -1 for detractors, meaning NPS score is between 1 and 5.
    Returns 0 for passive, meaning NPS score is 6 or 7.
    Returns 1 for lovers, meaning NPS score is 8, 9, 10.
    Returns None otherwise."""

    if nps_score <= 5:
        return -1
    if nps_score <= 7:
        return 0
    if nps_score <= 10:
        return 1
    logging.warning('Cannot convert nps_score %s', nps_score)
    return None


def bob_has_helped_love_score(answer: str) -> typing.Optional[int]:
    """Convert 'Bob has helped ?' answers to lovers/detractors values.

    Return -1 if answer is 'NO'
    Return 1 if answer is 'YES' or 'YES_A_LOT'
    Return None otherwise."""

    if answer in ('NO', 'NOT_AT_ALL'):
        return -1
    if answer in ('YES', 'YES_A_LOT'):
        return 1
    logging.warning('bobHasHelped field has unknown answer "%s"', answer)
    return None


def feedback_love_score(feedback_score: int) -> typing.Optional[int]:
    """Convert online feedback score to lovers/detractors values.

    Returns -1 if score is 1 or 2.
    Returns 0 if score 3.
    Returns 1 if score is 4 or 5.
    Returns None otherwise."""

    if feedback_score in (1, 2):
        return -1
    if feedback_score == 3:
        return 0
    if feedback_score in (4, 5):
        return 1
    logging.warning('Cannot convert feedback_score %s', feedback_score)
    return None


def _get_employment_status(user: user_pb2.User) -> typing.Optional[user_pb2.EmploymentStatus]:
    """Get the last employmentStatus for which we have an answer to bobHasHelped question, or get
    the last employmentStatus."""

    last_status = None
    for status in reversed(user.employment_status):
        if status.bob_has_helped:
            return status
        if not last_status:
            last_status = status
    return last_status


def _get_last_complete_project(user: user_pb2.User) -> typing.Optional[project_pb2.Project]:
    """Get last project which is not is_incomplete."""

    return next(
        (project for project in reversed(user.projects)
         if not project.is_incomplete),
        None)


_T = typing.TypeVar('_T')
_U = typing.TypeVar('_U')


def _remove_null_fields(mydict: typing.Dict[_T, typing.Optional[_U]]) -> typing.Dict[_T, _U]:
    out: typing.Dict[_T, _U] = {}
    for key, value in mydict.items():
        clean_value: typing.Optional[_U]
        if isinstance(value, dict):
            clean_value = typing.cast(_U, _remove_null_fields(value)) or None
        else:
            clean_value = value
        if clean_value is not None:
            out[key] = clean_value
    return out


# Cache (from MongoDB) of known cities.
@functools.lru_cache(maxsize=256, typed=False)
def _get_urban_context(city_id: str) -> typing.Optional[str]:
    target_city = _DB.cities.find_one({'_id': city_id})
    if target_city:
        target_city_proto = typing.cast(
            geo_pb2.FrenchCity, proto.create_from_mongo(target_city, geo_pb2.FrenchCity))
        return geo_pb2.UrbanContext.Name(target_city_proto.urban_context)
    return None


def _user_to_analytics_data(user: user_pb2.User) -> typing.Dict[str, typing.Any]:
    """Gather analytics data to insert into elasticsearch."""

    data: typing.Dict[str, typing.Any] = {
        'registeredAt': user.registered_at.ToJsonString(),
        'randomGroup': random.randint(0, 100) / 100,
        'profile': {
            'ageGroup': age_group(user.profile.year_of_birth),
            'canTutoie': user.profile.can_tutoie,
            'coachingEmailFrequency': user_pb2.EmailFrequency.Name(
                user.profile.coaching_email_frequency),
            'frustrations': [user_pb2.Frustration.Name(f) for f in user.profile.frustrations],
            'gender': user_pb2.Gender.Name(user.profile.gender),
            'hasHandicap': user.profile.has_handicap,
            'highestDegree': job_pb2.DegreeLevel.Name(user.profile.highest_degree),
            'origin': user_pb2.UserOrigin.Name(user.profile.origin),
        },
        'featuresEnabled': json_format.MessageToDict(user.features_enabled),
        'origin': {
            'medium': user.origin.medium,
            'source': user.origin.source,
        },
    }
    if user.net_promoter_score_survey_response.HasField('responded_at'):
        data['nps_response'] = {
            'loveScore': nps_love_score(user.net_promoter_score_survey_response.score),
            'score': user.net_promoter_score_survey_response.score,
            'time': user.net_promoter_score_survey_response.responded_at.ToJsonString(),
        }
    last_project = _get_last_complete_project(user)
    if last_project:
        scoring_project = scoring.ScoringProject(
            last_project, user.profile, user.features_enabled, _DB)
        data['project'] = {
            'targetJob': {
                'name': last_project.target_job.name,
                'job_group': {
                    'name': last_project.target_job.job_group.name,
                },
            },
            'areaType': geo_pb2.AreaType.Name(last_project.area_type),
            'city': {
                'regionName': last_project.city.region_name,
                'urbanScore': last_project.city.urban_score,
            },
            'job_search_length_months': round(scoring_project.get_search_length_at_creation()),
            'advices': [a.advice_id for a in last_project.advices if a.num_stars >= 2],
            'numAdvicesRead': sum(
                1 for a in last_project.advices if a.status == project_pb2.ADVICE_READ),
            'isComplete': not last_project.is_incomplete,
        }
        if last_project.kind:
            data['project']['kind'] = project_pb2.ProjectKind.Name(last_project.kind)
        if last_project.feedback.score:
            data['project']['feedbackScore'] = last_project.feedback.score
            data['project']['feedbackLoveScore'] = feedback_love_score(last_project.feedback.score)
        if last_project.min_salary and last_project.min_salary < 1000000000:
            data['project']['minSalary'] = last_project.min_salary
        urban_context = _get_urban_context(last_project.city.city_id)
        if urban_context:
            data['project']['city']['urbanContext'] = urban_context
    last_status = _get_employment_status(user)
    if last_status:
        data['employmentStatus'] = json_format.MessageToDict(last_status)
        data['employmentStatus']['daysSinceRegistration'] = \
            (last_status.created_at.ToDatetime() - user.registered_at.ToDatetime()).days
        if last_status.bob_has_helped:
            data['employmentStatus']['bobHasHelpedScore'] = bob_has_helped_love_score(
                last_status.bob_has_helped)
        if last_status.other_coaches_used:
            data['employmentStatus']['otherCoachesUsed'] = [
                user_pb2.OtherCoach.Name(c) for c in last_status.other_coaches_used
            ]
        if last_status.bob_relative_personalization:
            data['employmentStatus']['bobRelativePersonalization'] = \
                last_status.bob_relative_personalization

    if user.emails_sent:
        data['emailsSent'] = {
            # This will keep only the last email sent for each campaign.
            email.campaign_id: user_pb2.EmailSentStatus.Name(email.status)
            for email in sorted(user.emails_sent, key=lambda email: email.sent_at.ToDatetime())
        }

    if user.client_metrics.first_session_duration_seconds:
        data['clientMetrics'] = {
            'firstSessionDurationSeconds': user.client_metrics.first_session_duration_seconds,
        }
    if user.client_metrics.is_first_session_mobile:
        data['clientMetrics'] = data.get('clientMetrics', {})
        data['clientMetrics']['isFirstSessionMobile'] = \
            user_pb2.OptionalBool.Name(user.client_metrics.is_first_session_mobile)

    return _remove_null_fields(data)


def export_user_to_elasticsearch(
        es_client: elasticsearch.Elasticsearch, index: str, registered_from: str,
        dry_run: bool = True) -> None:
    """Synchronize users to elasticsearch for analytics purpose."""

    if not dry_run:
        if es_client.indices.exists(index=index):
            logging.info('Removing old bobusers index ...')
            es_client.indices.delete(index=index)
        logging.info('Creating bobusers index ...')
        es_client.indices.create(index=index)

    nb_users = 0
    nb_docs = 0
    cursor = _USER_DB.user.find({
        'registeredAt': {'$gt': registered_from},
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    })
    for row in cursor:

        nb_users += 1
        user_id = str(row.pop('_id'))
        user = typing.cast(user_pb2.User, proto.create_from_mongo(row, user_pb2.User))
        data = _user_to_analytics_data(user)

        logging.debug(data)

        if not dry_run:
            es_client.create(index=index, doc_type='user', id=user_id, body=json.dumps(data))
            nb_docs += 1
            if nb_docs % 1000 == 0:
                logging.info('%i users processed', nb_docs)

    if not dry_run:
        es_client.indices.flush(index=index)


def main(
        es_client: elasticsearch.Elasticsearch,
        string_args: typing.Optional[typing.List[str]] = None) -> None:
    """Parse command line arguments and trigger sync_employment_status function."""

    parser = argparse.ArgumentParser(
        description='Synchronize mongodb employement status fields retrieving typeform data.')
    parser.add_argument(
        '-r', '--registered-from', default='2017-06-01',
        help='Process users registered from the given date')
    parser.add_argument(
        '--no-dry-run', dest='dry_run', action='store_false',
        help='No dry run really store in elasticsearch.')
    parser.add_argument('--index', default='bobusers', help='Elasticsearch index to write to')
    parser.add_argument('--verbose', '-v', action='store_true', help='More detailed output.')
    parser.add_argument(
        '--disable-sentry', action='store_true', help='Disable logging to Sentry.')
    args = parser.parse_args(string_args)

    logging.basicConfig(level='DEBUG' if args.verbose else 'INFO')
    if not args.dry_run and not args.disable_sentry:
        try:
            report.setup_sentry_logging(os.getenv('SENTRY_DSN'))
        except ValueError:
            logging.error(
                'Please set SENTRY_DSN to enable logging to Sentry, or use --disable-sentry option')
            return

    export_user_to_elasticsearch(es_client, args.index, args.registered_from, dry_run=args.dry_run)


def _get_auth_from_env(
        env: typing.Mapping[str, str]) -> typing.Optional[requests_aws4auth.AWS4Auth]:
    aws_in_docker = env.get('AWS_CONTAINER_CREDENTIALS_RELATIVE_URI')
    if aws_in_docker:
        # https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
        response = requests.get('http://169.254.170.2{}'.format(aws_in_docker))
        response.raise_for_status()
        credentials = response.json()
        access_key_id = credentials.get('AccessKeyId')
        secret_access_key = credentials.get('SecretAccessKey')
        session_token = credentials.get('Token')
    else:
        access_key_id = env.get('AWS_ACCESS_KEY_ID')
        secret_access_key = env.get('AWS_SECRET_ACCESS_KEY')
        session_token = None
    if not access_key_id:
        return None
    return requests_aws4auth.AWS4Auth(
        access_key_id, secret_access_key, 'eu-central-1', 'es', session_token=session_token)


def get_es_client_from_env() -> elasticsearch.Elasticsearch:
    """Get an Elasticsearch client configured from environment variables."""

    env = os.environ
    return elasticsearch.Elasticsearch(
        env.get('ELASTICSEARCH_URL', 'http://elastic:changeme@elastic-dev:9200').split(','),
        http_auth=_get_auth_from_env(env),
        connection_class=elasticsearch.RequestsHttpConnection)


if __name__ == '__main__':
    main(get_es_client_from_env())
