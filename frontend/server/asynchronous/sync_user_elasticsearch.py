"""Script to update users analytics data to Elasticsearch."""

import argparse
import datetime
import json
import logging
import os

import certifi as _  # Needed to handle SSL in elasticsearch connections, for production use.
import elasticsearch
from google.protobuf import json_format

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto

_, _DB = mongo.get_connections_from_env()

_ES = elasticsearch.Elasticsearch(os.getenv(
    'ELASTICSEARCH_URL', 'http://elastic:changeme@elastic-dev:9200').split(','))


def age_group(year_of_birth):
    """Estimate age group from year of birth."""

    if year_of_birth < 1920:
        return 'Unknown'
    age = now.get() - datetime.datetime(year_of_birth, 7, 1)
    age = age.days / 365
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


def nps_love_score(nps_score):
    """Convert NPS scode to lovers/detractors values.

    Returns -1 for detractors, meaning NPS score is between 1 and 5.
    Returns 0 for passive, meaning NPS score is 6 or 7.
    Returns 1 for lovers, meaning NPS score is 8, 9, 10.
    Returns None otherwise."""

    if nps_score is None:
        return None
    if nps_score <= 5:
        return -1
    if nps_score <= 7:
        return 0
    if nps_score <= 10:
        return 1
    logging.warning('Cannot convert nps_score %s', nps_score)
    return None


def bob_has_helped_love_score(answer):
    """Convert 'Bob has helped ?' answers to lovers/detractors values.

    Return -1 if answer is 'NO'
    Return 1 if answer is 'YES' or 'YES_A_LOT'
    Return None otherwise."""

    if answer is None:
        return None
    if answer in ('NO', 'NOT_AT_ALL'):
        return -1
    if answer in ('YES', 'YES_A_LOT'):
        return 1
    logging.warning('bobHasHelped field has unknown answer %s', answer)
    return None


def feedback_love_score(feedback_score):
    """Convert online feedback score to lovers/detractors values.

    Returns -1 if score is 1 or 2.
    Returns 0 if score 3.
    Returns 1 if score is 4 or 5.
    Returns None otherwise."""

    if feedback_score is None:
        return None
    if feedback_score in (1, 2):
        return -1
    if feedback_score == 3:
        return 0
    if feedback_score in (4, 5):
        return 1
    logging.warning('Cannot convert feedback_score %s', feedback_score)
    return None


def _get_employment_status(user):
    """Get the last employmentStatus for which we have an answer to bobHasHelped question, or get
    the last employmentStatus."""

    last_status = None
    for status in reversed(user.employment_status):
        if status.bob_has_helped:
            return status
        if not last_status:
            last_status = status
    return last_status


def _get_last_complete_project(user):
    """Get last project which is not is_incomplete."""

    return next(
        (project for project in reversed(user.projects)
         if not project.is_incomplete),
        None)


def _remove_null_fields(mydict):
    out = {}
    for key, value in mydict.items():
        if isinstance(value, dict):
            value = _remove_null_fields(value) or None
        if value is None:
            continue
        out[key] = value
    return out


def _user_to_analytics_data(user):
    """Gather analytics data to insert into elasticsearch."""

    data = {
        'registeredAt': user.registered_at.ToJsonString(),
        'profile': {
            'gender': user_pb2.Gender.Name(user.profile.gender),
            'ageGroup': age_group(user.profile.year_of_birth),
            'hasHandicap': user.profile.has_handicap,
            'highestDegree': job_pb2.DegreeLevel.Name(user.profile.highest_degree),
            'frustrations': [user_pb2.Frustration.Name(f) for f in user.profile.frustrations],
            'origin': user_pb2.UserOrigin.Name(user.profile.origin),
        },
        'featuresEnabled': json_format.MessageToDict(user.features_enabled),
    }
    if user.net_promoter_score_survey_response.HasField('responded_at'):
        data['nps_response'] = {
            'loveScore': nps_love_score(user.net_promoter_score_survey_response.score),
            'score': user.net_promoter_score_survey_response.score,
            'time': user.net_promoter_score_survey_response.responded_at.ToJsonString(),
        }
    last_project = _get_last_complete_project(user)
    if last_project:
        data['project'] = {
            'targetJob': {
                'name': last_project.target_job.name,
                'job_group': {
                    'name': last_project.target_job.job_group.name,
                },
            },
            'mobility': {
                'areaType': geo_pb2.AreaType.Name(last_project.mobility.area_type),
                'city': {
                    'regionName': last_project.mobility.city.region_name,
                    'urbanScore': last_project.mobility.city.urban_score,
                },
            },
            # TODO(pascal): clean up and use new fields, jobSearchLengthMonths field is deprecated.
            'job_search_length_months': last_project.job_search_length_months,
            'advices': [a.advice_id for a in last_project.advices if a.num_stars >= 2],
            'isComplete': not last_project.is_incomplete,
        }
        if last_project.kind:
            data['project']['kind'] = project_pb2.ProjectKind.Name(last_project.kind)
        if last_project.feedback.score:
            data['project']['feedbackScore'] = last_project.feedback.score
            data['project']['feedbackLoveScore'] = feedback_love_score(last_project.feedback.score)
    last_status = _get_employment_status(user)
    if last_status:
        data['employmentStatus'] = json_format.MessageToDict(last_status)
        if last_status.bob_has_helped:
            data['employmentStatus']['bobHasHelpedScore'] = bob_has_helped_love_score(
                last_status.bob_has_helped)

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

    return _remove_null_fields(data)


def export_user_to_elasticsearch(index, registered_from, dry_run=True):
    """Synchronize users to elasticsearch for analytics purpose."""

    if not dry_run:
        if _ES.indices.exists(index=index):
            logging.info('Removing old bobusers index ...')
            _ES.indices.delete(index=index)
        logging.info('Creating bobusers index ...')
        _ES.indices.create(index=index)

    nb_users = 0
    nb_docs = 0
    cursor = _DB.user.find({
        'registeredAt': {'$gt': registered_from},
        'featuresEnabled.excludeFromAnalytics': {'$ne': True},
    })
    for row in cursor:

        nb_users += 1
        user_id = str(row.pop('_id'))
        user = proto.create_from_mongo(row, user_pb2.User)
        data = _user_to_analytics_data(user)

        logging.debug(data)

        if not dry_run:
            _ES.create(index=index, doc_type='user', id=user_id, body=json.dumps(data))
            nb_docs += 1
            if nb_docs % 1000 == 0:
                logging.info('%i users processed', nb_docs)

    if not dry_run:
        _ES.indices.flush(index=index)


def main(string_args=None):
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
    args = parser.parse_args(string_args)

    logging.basicConfig(level='DEBUG' if args.verbose else 'INFO')

    export_user_to_elasticsearch(args.index, args.registered_from, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
