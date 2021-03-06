"""Script to update users analytics data to Elasticsearch."""

import argparse
import datetime
import logging
import os
import random
import typing
from typing import Any, Dict, List, Optional, Mapping

import certifi as _  # Needed to handle SSL in elasticsearch connections, for production use.
import elasticsearch
from google.protobuf import json_format
import requests
import requests_aws4auth

from bob_emploi.common.python import now
from bob_emploi.frontend.api import boolean_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous import report
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail import all_campaigns

_DB, _USER_DB, _UNUSED_EVAL_DB = mongo.get_connections_from_env()

_ALL_COACHING_EMAILS = all_campaigns.campaign.get_coaching_campaigns().keys()


def age_group(year_of_birth: int) -> str:
    """Estimate age group from year of birth."""

    if year_of_birth < 1920:
        return 'Unknown'
    precise_age = now.get() - datetime.datetime(year_of_birth, 7, 1)
    age = precise_age.days / 365
    if age < 18:
        return 'A. -18'
    if age < 25:
        return 'B. 18-24'
    if age < 35:
        return 'C. 25-34'
    if age < 45:
        return 'D. 35-44'
    if age < 55:
        return 'E. 45-54'
    if age < 65:
        return 'F. 55-64'
    return 'G. 65+'


def nps_love_score(nps_score: int) -> Optional[int]:
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


def bob_has_helped_love_score(answer: str) -> Optional[int]:
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


def feedback_love_score(feedback_score: int) -> Optional[int]:
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


def _get_employment_status(user: user_pb2.User) -> Optional[user_pb2.EmploymentStatus]:
    """Get the last employmentStatus for which we have an answer to bobHasHelped question, or get
    the last employmentStatus."""

    last_status = None
    for status in reversed(user.employment_status):
        if status.bob_has_helped:
            return status
        if not last_status:
            last_status = status
    return last_status


def _get_degree_level(degree: 'job_pb2.DegreeLevel.V') -> str:
    return f'{degree:d} - {job_pb2.DegreeLevel.Name(degree)}'


def _get_self_diagnostic_status(status: 'diagnostic_pb2.SelfDiagnosticStatus.V') -> str:
    return f'{diagnostic_pb2.SelfDiagnosticStatus.Name(status)}'


def _get_last_complete_project(user: user_pb2.User) -> Optional[project_pb2.Project]:
    """Get last project which is not is_incomplete."""

    return next(
        (project for project in reversed(user.projects)
         if not project.is_incomplete),
        None)


class _TocScore(typing.NamedTuple):
    undefined_project: int
    stuck_market: int
    find_what_you_like: int
    missing_diploma: int
    start_your_search: int
    enhance_methods_to_interview: int
    bravo: int


# See https://docs.google.com/spreadsheets/d/1bmmDku67rWIpjfDU5kg9dUpPEGQNowX8bYZaTLq_13Y/edit#gid=0
_TOC_SCORES: Dict[str, _TocScore] = {
    'undefined-project': _TocScore(0, 0, 0, 0, 0, 0, 0),
    'stuck-market': _TocScore(4, 0, 1, 1, 1, 1, 0),
    'find-what-you-like': _TocScore(2, 5, 0, 0, 0, 0, 0),
    'missing-diploma': _TocScore(5, 5, 4, 0, 0, 0, 0),
    'start-your-search': _TocScore(5, 4, 3, 3, 0, 0, 0),
    'enhance-methods-to-interview': _TocScore(5, 4, 3, 3, 1, 0, 0),
    'bravo': _TocScore(2, 4, 3, 4, 2, 2, 0)
}


def _toc_score(user_category: str, bob_category: str) -> int:
    if not bob_category:
        return 0
    try:
        relevant_row = _TOC_SCORES[user_category]
    except KeyError:
        # We don't recognize the category the user selected. We assume it doesn't exists.
        relevant_row = _TOC_SCORES['bravo']
    return typing.cast(int, getattr(relevant_row, bob_category.replace('-', '_')))


# TODO(cyrille): Drop once general domains are in job_group_info for ROME.
_ROME_DOMAINS = {
    'A': 'Agriculture et pêche, espaces naturels et espaces verts, soins aux animaux',
    'B': "Arts et façonnage d'ouvrages d'art",
    'C': 'Banque, assurance, immobilier',
    'D': 'Commerce, vente et grande distribution',
    'E': 'Communication, media et multimedia',
    'F': 'Construction, bâtiment et travaux publics',
    'G': 'Hôtellerie, restauration, tourisme, loisirs et animation',
    'H': 'Industrie',
    'I': 'Installation et maintenance',
    'J': 'Santé',
    'K': 'Services à la personne et à la collectivité',
    'L': 'Spectacle',
    'M': "Support à l'entreprise",
    'N': 'Transport et logistique',
}


def _get_job_domain(job: job_pb2.Job) -> str:
    target_job = proto.fetch_from_mongo(
        _DB, job_pb2.JobGroup, 'job_group_info', job.job_group.rome_id)
    if target_job and target_job.domain:
        return target_job.domain
    rome_first_letter = job.job_group.rome_id[:1]
    return _ROME_DOMAINS.get(rome_first_letter, 'Unknown')


_T = typing.TypeVar('_T')
_U = typing.TypeVar('_U')


def _remove_null_fields(mydict: Dict[_T, Optional[_U]]) -> Dict[_T, _U]:
    out: Dict[_T, _U] = {}
    for key, value in mydict.items():
        clean_value: Optional[_U]
        if isinstance(value, dict):
            clean_value = typing.cast(_U, _remove_null_fields(value)) or None
        else:
            clean_value = value
        if clean_value is not None:
            out[key] = clean_value
    return out


def _get_urban_context(city_id: str) -> Optional[str]:
    target_city = proto.fetch_from_mongo(_DB, geo_pb2.FrenchCity, 'cities', city_id)
    if target_city:
        urban_context = target_city.urban_context
        return f'{urban_context:d} - {geo_pb2.UrbanContext.Name(urban_context)}'
    return None


def _self_diagnostic_change(
        onboarding_category: str, nps_category: str, computed_category: str) -> str:
    if onboarding_category == nps_category:
        return 'unchanged'
    if nps_category == computed_category:
        return 'now_agree'
    return 'changed_to_other'


def _bob_relative_personalization_value(bob_relative_personalization: int) -> str:
    if bob_relative_personalization == 12:
        return 'More'
    if bob_relative_personalization == 10:
        return 'Equally'
    if bob_relative_personalization == 8:
        return 'Less'
    if bob_relative_personalization == 0:
        return 'No other coaching received'
    return 'Unknown'


def _user_informed_about_career_options_value(user_informed_about_career_options: int) -> str:
    if user_informed_about_career_options == 1:
        return 'No change'
    if user_informed_about_career_options == 2:
        return 'More'
    if user_informed_about_career_options == 3:
        return 'Less'
    return 'Unknown'


def _product_usability_score_value(product_usability_score: int) -> str:
    if product_usability_score == 1:
        return 'Very poor'
    if product_usability_score == 2:
        return 'Poor'
    if product_usability_score == 3:
        return 'OK'
    if product_usability_score == 4:
        return 'Good'
    if product_usability_score == 5:
        return 'Very good'
    return 'unknown'


def _user_to_analytics_data(user: user_pb2.User) -> Dict[str, Any]:
    """Gather analytics data to insert into elasticsearch."""

    has_opened_strategy = False
    data: Dict[str, Any] = {
        'registeredAt': user.registered_at.ToJsonString(),
        'randomGroup': random.randint(0, 100) / 100,
        'profile': {
            'ageGroup': age_group(user.profile.year_of_birth),
            'coachingEmailFrequency': user_pb2.EmailFrequency.Name(
                user.profile.coaching_email_frequency),
            'frustrations': [user_pb2.Frustration.Name(f) for f in user.profile.frustrations],
            'gender': user_pb2.Gender.Name(user.profile.gender),
            'hasHandicap': user.profile.has_handicap,
            'highestDegree': _get_degree_level(user.profile.highest_degree),
            'locale': scoring.get_user_locale(user.profile),
            'origin': user_pb2.UserOrigin.Name(user.profile.origin),
        },
        'featuresEnabled': json_format.MessageToDict(user.features_enabled),
        'origin': {
            'medium': user.origin.medium,
            'source': user.origin.source,
        },
        'hasAccount': user.has_account,
    }

    last_project = _get_last_complete_project(user)
    if last_project:
        scoring_project = scoring.ScoringProject(last_project, user, _DB)
        data['project'] = {
            'targetJob': {
                'name': last_project.target_job.name,
                'job_group': {
                    'name': last_project.target_job.job_group.name,
                },
                'domain': _get_job_domain(last_project.target_job),
            },
            'areaType': geo_pb2.AreaType.Name(last_project.area_type),
            'city': {
                'regionName': last_project.city.region_name,
                'urbanScore': last_project.city.urban_score,
            },
            'job_search_length_months': round(scoring_project.get_search_length_at_creation()),
            'advices': [a.advice_id for a in last_project.advices if a.num_stars >= 2],
            'exploredAdvices': [
                a.advice_id for a in last_project.advices if a.num_explorations],
            'readAdvices': [
                a.advice_id for a in last_project.advices if a.status == project_pb2.ADVICE_READ],
            'numAdvicesRead': sum(
                1 for a in last_project.advices if a.status == project_pb2.ADVICE_READ),
            'isComplete': not last_project.is_incomplete,
            'openedStrategies': [
                strat.strategy_id for strat in last_project.opened_strategies if strat.started_at],
        }
        if last_project.strategies:
            data['project']['ratioOpenedStrategies'] = sum(
                1 for strat in last_project.opened_strategies if strat.started_at) / len(
                    last_project.strategies)
            data['project']['numStrategiesShown'] = len(last_project.strategies)
            data['project']['hasReachedAStrategyGoal'] = any(
                strat.reached_goals.values() for strat in last_project.opened_strategies)
        try:
            data['project']['tocScore'] = _toc_score(
                last_project.original_self_diagnostic.category_id,
                last_project.diagnostic.category_id)
        except AttributeError:
            logging.warning(
                'Unable to compute ToC score for categories "%s" and "%s"',
                last_project.original_self_diagnostic.category_id,
                last_project.diagnostic.category_id)
        if last_project.original_self_diagnostic:
            data['project']['originalSelfDiagnostic'] = {
                'status': _get_self_diagnostic_status(last_project.original_self_diagnostic.status)}
            if last_project.original_self_diagnostic.category_id:
                data['project']['originalSelfDiagnostic']['categoryId'] = \
                    last_project.original_self_diagnostic.category_id
                data['project']['originalSelfDiagnostic']['isSameAsSelf'] = \
                    last_project.original_self_diagnostic.category_id == \
                    last_project.diagnostic.category_id
        if last_project.kind:
            data['project']['kind'] = project_pb2.ProjectKind.Name(last_project.kind)
        if last_project.feedback.score:
            data['project']['feedbackScore'] = last_project.feedback.score
            data['project']['feedbackLoveScore'] = feedback_love_score(last_project.feedback.score)
        if last_project.feedback.challenge_agreement_score:
            data['project']['challengeAgreementScore'] = \
                last_project.feedback.challenge_agreement_score - 1
        if last_project.min_salary and last_project.min_salary < 1000000000:
            data['project']['minSalary'] = last_project.min_salary
        urban_context = _get_urban_context(last_project.city.city_id)
        if urban_context:
            data['project']['city']['urbanContext'] = urban_context
        if last_project.diagnostic.category_id:
            data['project']['diagnostic'] = {'categoryId': last_project.diagnostic.category_id}
        has_opened_strategy = any(strat.started_at for strat in last_project.opened_strategies)

    data['finishedOnboardingPercent'] = 100 if data.get('project', {}).get('isComplete') else 0
    nps_email = next(
        (email for email in user.emails_sent if email.campaign_id == 'nps'),
        None)
    if nps_email:
        data['nps_request'] = {
            'hasResponded': user.net_promoter_score_survey_response.HasField('responded_at'),
            'sentAfterDays':
            (nps_email.sent_at.ToDatetime() - user.registered_at.ToDatetime()).days,
        }
    if user.net_promoter_score_survey_response.HasField('responded_at'):
        data['nps_response'] = {
            'hasActionsIdea': boolean_pb2.OptionalBool.Name(
                user.net_promoter_score_survey_response.has_actions_idea),
            'loveScore': nps_love_score(user.net_promoter_score_survey_response.score),
            'selfDiagnostic': {
                'status': _get_self_diagnostic_status(
                    user.net_promoter_score_survey_response.nps_self_diagnostic.status)
            },
            'score': user.net_promoter_score_survey_response.score,
            'time': user.net_promoter_score_survey_response.responded_at.ToJsonString(),
        }
        if user.net_promoter_score_survey_response.nps_self_diagnostic.category_id:
            data['nps_response']['selfDiagnostic']['categoryId'] = \
                user.net_promoter_score_survey_response.nps_self_diagnostic.category_id
            if last_project and last_project.original_self_diagnostic and \
                    last_project.original_self_diagnostic.category_id and \
                    last_project.diagnostic.category_id:
                data['nps_response']['selfDiagnostic']['hasChanged'] = _self_diagnostic_change(
                    last_project.original_self_diagnostic.category_id,
                    user.net_promoter_score_survey_response.nps_self_diagnostic.category_id,
                    last_project.diagnostic.category_id)
        if user.net_promoter_score_survey_response.local_market_estimate:
            data['nps_response']['localMarketEstimate'] = user_pb2.LocalMarketUserEstimate.Name(
                user.net_promoter_score_survey_response.local_market_estimate)
        if user.net_promoter_score_survey_response.bob_relative_personalization:
            data['nps_response']['bobRelativePersonalization'] = \
                _bob_relative_personalization_value(
                    user.net_promoter_score_survey_response.bob_relative_personalization)
        if user.net_promoter_score_survey_response.user_informed_about_career_options:
            data['nps_response']['userInformedAboutCareerOptions'] = \
                _user_informed_about_career_options_value(
                    user.net_promoter_score_survey_response.user_informed_about_career_options)
        if user.net_promoter_score_survey_response.product_usability_score:
            data['nps_response']['productUsabilityScore'] = _product_usability_score_value(
                user.net_promoter_score_survey_response.product_usability_score)

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
        if last_status.has_salary_increased:
            data['employmentStatus']['hasSalaryIncreased'] = boolean_pb2.OptionalBool.Name(
                last_status.has_salary_increased)
        if last_status.has_greater_role:
            data['employmentStatus']['hasGreaterRole'] = boolean_pb2.OptionalBool.Name(
                last_status.has_greater_role)
        if last_status.has_been_promoted:
            data['employmentStatus']['hasBeenPromoted'] = boolean_pb2.OptionalBool.Name(
                last_status.has_been_promoted)

    if user.emails_sent:
        data['emailsSent'] = {
            # This will keep only the last email sent for each campaign.
            email.campaign_id: user_pb2.EmailSentStatus.Name(email.status)
            for email in sorted(user.emails_sent, key=lambda email: email.sent_at.ToDatetime())
        }
        data['coachingEmailsSent'] = sum(
            1 for campaign in data['emailsSent']
            if campaign in _ALL_COACHING_EMAILS)
        data['coachingEmailsClicked'] = sum(
            1 for campaign, status in data['emailsSent'].items()
            if campaign in _ALL_COACHING_EMAILS and
            status == 'EMAIL_SENT_CLICKED')
        data['coachingEmailsOpened'] = sum(
            1 for campaign, status in data['emailsSent'].items()
            if campaign in _ALL_COACHING_EMAILS and
            status in mail_send.READ_EMAIL_STATUS_STRINGS)

    data['isHooked'] = bool(
        has_opened_strategy or
        data.get('coachingEmailsClicked') or
        data.get('coachingEmailsOpened'))

    if user.client_metrics.first_session_duration_seconds:
        data['clientMetrics'] = {
            'firstSessionDurationSeconds': user.client_metrics.first_session_duration_seconds,
        }
    if user.client_metrics.is_first_session_mobile:
        data['clientMetrics'] = data.get('clientMetrics', {})
        data['clientMetrics']['isFirstSessionMobile'] = \
            boolean_pb2.OptionalBool.Name(user.client_metrics.is_first_session_mobile)

    return _remove_null_fields(data)


def export_user_to_elasticsearch(
        es_client: elasticsearch.Elasticsearch, index: str, registered_from: str,
        force_recreate: bool, dry_run: bool = True) -> None:
    """Synchronize users to elasticsearch for analytics purpose."""

    if not dry_run:
        has_previous_index = es_client.indices.exists(index=index)
        if force_recreate and has_previous_index:
            logging.info('Removing old bobusers index ...')
            es_client.indices.delete(index=index)
        if force_recreate or not has_previous_index:
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
        user = proto.create_from_mongo(row, user_pb2.User, 'user_id')
        data = _user_to_analytics_data(user)

        logging.debug(data)

        if not dry_run:
            # TODO(cyrille): Consider using the noop feature to avoid re-computing inactive users
            # endlessly.
            es_client.update(index=index, doc_type='_doc', id=user.user_id, body={
                'doc': data,
                'doc_as_upsert': True,
            })
            nb_docs += 1
            if nb_docs % 1000 == 0:
                logging.info('%i users processed', nb_docs)

    if not dry_run:
        es_client.indices.flush(index=index)


def main(
        es_client: elasticsearch.Elasticsearch,
        string_args: Optional[List[str]] = None) -> None:
    """Parse command line arguments and trigger sync_employment_status function."""

    parser = argparse.ArgumentParser(
        description='Synchronize mongodb employement status fields retrieving typeform data.')
    parser.add_argument(
        '-r', '--registered-from', default='2017-06-01',
        help='Process users registered from the given date')
    parser.add_argument(
        '--force-recreate', action='store_true',
        help='If set, completely cleanup the index, rather than updating existing documents.')
    parser.add_argument('--index', default='bobusers', help='Elasticsearch index to write to')
    report.add_report_arguments(parser)
    args = parser.parse_args(string_args)

    if not report.setup_sentry_logging(args):
        return

    export_user_to_elasticsearch(
        es_client, args.index, args.registered_from,
        force_recreate=args.force_recreate, dry_run=args.dry_run)


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
