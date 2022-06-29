"""Campaigns for Jobflix emails."""

import datetime
from typing import Any
from urllib import parse

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import product
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign

_COACH_FIRST_NAME = 'Tabitha'
_PRODUCT = 'Jobflix'
_SENDER_NAME = i18n.make_translatable_string("{0} et l'équipe de {1}").\
    format(_COACH_FIRST_NAME, _PRODUCT)


def get_default_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    """Default template variables for a Jobflix campaign."""

    return {
        'productName': product.bob.get_plugin_config('jobflix', 'productName', _PRODUCT),
        'productUrl': parse.urljoin(
            product.bob.base_url,
            product.bob.get_plugin_config('jobflix', 'productUrl', 'https://www.jobflix.app')),
        'senderFirstName': _COACH_FIRST_NAME,
        'unsubscribeLink': campaign.get_bob_link(f'/api/upskilling/user/delete/{user.user_id}', {
            'hl': user.profile.locale,
            'token': parse.quote(auth_token.create_token(user.user_id, role='unsubscribe')),
        }),
    }


def _get_first_actions_vars(
        user: user_pb2.User, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, Any]:
    job_list = list(filter(None, (
        jobs.get_job_proto(database, p.target_job.code_ogr, p.target_job.job_group.rome_id)
        for p in user.projects)))
    if not job_list:
        raise campaign.DoNotSend('Need to have at least one job.')
    job_names = [job.name for job in job_list]
    quoted_jobs = parse.quote(' '.join(job_names))
    scoring_project = scoring.ScoringProject(user.projects[0], user, database)
    return get_default_vars(user) | {
        'departements': ','.join({p.city.departement_id for p in user.projects}),
        'hasSeveralJobs': campaign.as_template_boolean(len(job_list) > 1),
        'jobIds': ','.join({job.job_group.rome_id for job in job_list}),
        'jobs': job_names,
        'ofJobName': scoring_project.populate_template('%ofJobName'),
        'optLink': 'https://www.orientation-pour-tous.fr/spip.php?'
                   f'page=recherche&rubrique=metiers&recherche={quoted_jobs}',
    }


def _is_bob_jobflix_user(user: user_pb2.User) -> bool:
    return any(
        s.strategy_id == 'upskilling'
        for p in user.projects
        for s in p.opened_strategies
    ) or any(
        a.num_explorations and a.advice_id == 'jobflix'
        for p in user.projects for a in p.advices
    ) or any(
        a.num_explorations and a.action_id == 'jobflix'
        for p in user.projects for a in p.actions)


def _get_first_eval_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    if not _is_bob_jobflix_user(user):
        raise campaign.DoNotSend('Only interesting for Bob-Jobflix users.')
    return campaign.get_default_vars(user)


def _get_first_eval_reminder_vars(
        user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any,
) -> dict[str, Any]:
    if not any(email.campaign_id == 'jobflix-first-eval' for email in user.emails_sent):
        raise campaign.DoNotSend('Only useful for user that have received the first campaign')
    next_week = now + datetime.timedelta(days=7)
    return campaign.get_default_vars(user) | {
        'closingDate': next_week.strftime('%A %d %B'),
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='jobflix-first-eval',
    mongo_filters={'projects.isIncomplete': {'$ne': True}},
    get_vars=_get_first_eval_vars,
    sender_name=i18n.make_translatable_string("{0} et l'équipe de {1}").format('Tabitha', 'Bob'),
    sender_email='tabitha@bob-emploi.fr'))

campaign.register_campaign(campaign.Campaign(
    campaign_id='jobflix-first-eval-reminder',
    mongo_filters={'emailsSent.campaignId': 'jobflix-first-eval'},
    get_vars=_get_first_eval_reminder_vars,
    sender_name=i18n.make_translatable_string("{0} et l'équipe de {1}").format('Tabitha', 'Bob'),
    sender_email='tabitha@bob-emploi.fr'))

campaign.register_campaign(campaign.Campaign(
    campaign_id='jobflix-welcome',
    mongo_filters={},
    get_vars=get_default_vars,
    sender_name=_SENDER_NAME,
    sender_email='tabitha@jobflix.app'))
# TODO(cyrille): Set as coaching once the coaching engine can work on Jobflix.
campaign.register_campaign(campaign.Campaign(
    campaign_id='jobflix-first-actions',
    mongo_filters={},
    get_vars=_get_first_actions_vars,
    sender_name=_SENDER_NAME,
    sender_email='tabitha@jobflix.app'))

campaign.register_campaign(campaign.Campaign(
    campaign_id='jobflix-survey',
    mongo_filters={},
    get_vars=_get_first_actions_vars,
    sender_name=_SENDER_NAME,
    sender_email='tabitha@jobflix.app'))
