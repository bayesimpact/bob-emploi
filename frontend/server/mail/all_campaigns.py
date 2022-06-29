"""Module to access all emailing campagins."""

import datetime
import itertools
import logging
from typing import Any, Optional, Union
from urllib import parse

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import auth_token
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign
# pylint: disable=unused-import
# Import all plugins: they register themselves when imported.
from bob_emploi.frontend.server.mail import activation
from bob_emploi.frontend.server.mail import deletion
from bob_emploi.frontend.server.mail import first_followup_survey
from bob_emploi.frontend.server.mail import holiday
from bob_emploi.frontend.server.mail import imt
from bob_emploi.frontend.server.mail import improve_cv
from bob_emploi.frontend.server.mail import jobbing
from bob_emploi.frontend.server.mail import jobflix
from bob_emploi.frontend.server.mail import prepare_your_application
from bob_emploi.frontend.server.mail import network
from bob_emploi.frontend.server.mail import nps
from bob_emploi.frontend.server.mail import research
from bob_emploi.frontend.server.mail import spontaneous
from bob_emploi.frontend.server.mail import switch
from bob_emploi.frontend.server.mail import training
# pylint: enable=unused-import
from bob_emploi.frontend.server.mail.templates import mailjet_templates


_ONE_YEAR_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(365)
_SIX_MONTHS_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(180)
_THREE_MONTHS_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(90)
_ONE_MONTH_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(30)
_THREE_WEEKS_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(21)
_ACTIONS_SECTIONS = ['unscheduled', 'today', 'tomorrow', 'week', 'done']


def _get_self_development_vars(
        user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any) \
        -> dict[str, str]:
    """Computes vars for a given user for the self-development email.

    Returns a dict with all vars required for the template.
    """

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    has_video = (user.profile.locale or 'fr').startswith('fr')

    project = user.projects[0]

    job_search_length = campaign.job_search_started_months_ago(project, now)
    if job_search_length < 0:
        raise campaign.DoNotSend('No info on user search duration.')

    if job_search_length > 12:
        raise campaign.DoNotSend(f'User has been searching for too long ({job_search_length:.2f}).')

    genderized_job_name = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))
    age = datetime.date.today().year - user.profile.year_of_birth

    max_young = 30
    min_old = 50

    return campaign.get_default_coaching_email_vars(user) | {
        'hasEnoughExperience': campaign.as_template_boolean(
            project.seniority > project_pb2.JUNIOR),
        'hasVideo': campaign.as_template_boolean(has_video),
        'isAdministrativeAssistant': campaign.as_template_boolean(
            project.target_job.job_group.name == 'Secrétariat'),
        'isOld': campaign.as_template_boolean(age >= min_old),
        'isOldNotWoman': campaign.as_template_boolean(
            age >= min_old and user.profile.gender != user_profile_pb2.FEMININE),
        'isYoung': campaign.as_template_boolean(age <= max_young),
        'isYoungNotWoman': campaign.as_template_boolean(
            age <= max_young and user.profile.gender != user_profile_pb2.FEMININE),
        'jobName': genderized_job_name,
    }


def _body_language_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    """Computes vars for a given user for the body language email.

    Returns a dict with all vars required for the template.
    """

    worst_frustration = next(
        (user_profile_pb2.Frustration.Name(frustration)
         for frustration in (
            user_profile_pb2.SELF_CONFIDENCE,
            user_profile_pb2.INTERVIEW,
            user_profile_pb2.ATYPIC_PROFILE)
         if frustration in user.profile.frustrations),
        '')
    if not worst_frustration:
        raise campaign.DoNotSend('User has no frustration related to body language.')

    return campaign.get_default_coaching_email_vars(user) | {
        'worstFrustration': worst_frustration,
    }


def _employment_vars(
    user: user_pb2.User, *, now: datetime.datetime, database: mongo.NoPiiMongoDatabase,
    **unused_kwargs: Any,
) -> dict[str, str]:
    """Computes vars for a given user for the employment survey.

    Returns a dict with all vars required for the template.
    """

    num_months_ago = round((now - user.registered_at.ToDatetime()).days / 30.5)
    if num_months_ago <= 0 and not user.features_enabled.alpha:
        raise campaign.DoNotSend(f'User registered only recently ({user.registered_at})')

    scoring_project = scoring.ScoringProject(project_pb2.Project(), user, database)
    registered_since = scoring_project.get_several_months_text(num_months_ago)

    for status in user.employment_status:
        if status.created_at.ToDatetime() > _ONE_MONTH_AGO:
            raise campaign.DoNotSend(
                'User has already updated their employment status less than one month ago.')
    base_params = {
        'user': user.user_id,
        'token': parse.quote(auth_token.create_token(user.user_id, role='employment-status')),
    }
    return campaign.get_default_vars(user) | {
        'registeredSince': registered_since,
        'seekingUrl': campaign.get_bob_link('/api/employment-status', base_params | {
            'seeking': user_pb2.SeekingStatus.Name(user_pb2.STILL_SEEKING),
            'redirect': campaign.get_bob_link('/statut/en-recherche'),
        }),
        'stopSeekingUrl': campaign.get_bob_link('/api/employment-status', base_params | {
            'seeking': user_pb2.SeekingStatus.Name(user_pb2.STOP_SEEKING),
            'redirect': campaign.get_bob_link('/statut/ne-recherche-plus'),
        }),
    }


def _get_galita1_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    if user_profile_pb2.MOTIVATION not in user.profile.frustrations:
        raise campaign.DoNotSend('User is motivated enough.')
    if user.projects and user.projects[0].job_search_has_not_started:
        raise campaign.DoNotSend('User is not searching for a job yet.')
    return campaign.get_default_coaching_email_vars(user)


def _get_galita2_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    if not user.projects:
        raise scoring.NotEnoughDataException(
            'Project is required for galita-2.', fields={'user.projects.0.kind'})
    project = user.projects[0]
    if project.kind not in {project_pb2.FIND_A_FIRST_JOB, project_pb2.REORIENTATION} and \
            project.previous_job_similarity != project_pb2.NEVER_DONE:
        raise campaign.DoNotSend('User is not searching a job in a profession new to them.')
    return campaign.get_default_coaching_email_vars(user) | {
        'isReorienting': campaign.as_template_boolean(project.kind == project_pb2.REORIENTATION)
    }


def _get_galita2_short_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    if not user.projects:
        raise scoring.NotEnoughDataException(
            'Project is required for galita-2-short.', fields={'user.projects.0.kind'})
    project = user.projects[0]
    if project.kind not in {project_pb2.FIND_A_FIRST_JOB, project_pb2.REORIENTATION} and \
            project.previous_job_similarity != project_pb2.NEVER_DONE:
        raise campaign.DoNotSend('User is not searching a job in a profession new to them.')
    return campaign.get_default_coaching_email_vars(user)


def _get_galita3_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, str]:
    if user_profile_pb2.NO_OFFER_ANSWERS not in user.profile.frustrations:
        raise campaign.DoNotSend('User is getting enough answers from recruiters.')
    # We set a string with a blank as this is the only way to exclude a section
    # on Passport except to check equality or inequality with a non-empty
    # string.
    deep_link_to_follow_up_advice = ' '
    if user.projects:
        for project in user.projects:
            link = campaign.get_deep_link_advice(user.user_id, project, 'follow-up')
            if link:
                deep_link_to_follow_up_advice = link
    return campaign.get_default_coaching_email_vars(user) | {
        'deepLinkToAdvice': deep_link_to_follow_up_advice,
    }


def _get_galita3_short_vars(user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    if user_profile_pb2.NO_OFFER_ANSWERS not in user.profile.frustrations:
        raise campaign.DoNotSend('User is getting enough answers from recruiters.')
    project = user.projects[0]
    if (user.profile.locale or 'fr').startswith('fr'):
        advice_page_url = 'https://www.ionos.fr/startupguide/productivite/mail-de-relance-candidature'
        has_image_url = False
    elif user.profile.locale.startswith('en'):
        advice_page_url = 'https://zety.com/blog/how-to-follow-up-on-a-job-application'
        has_image_url = True
    else:
        logging.warning(
            'No advice webpage given for campaign galita-3-short in "%s"', user.profile.locale)
        advice_page_url = ''
        has_image_url = False
    return campaign.get_default_coaching_email_vars(user) | {
        'advicePageUrl': advice_page_url,
        'hasImageUrl': has_image_url,
        'weeklyApplicationsEstimate': project_pb2.NumberOfferEstimateOption.Name(
            project.weekly_applications_estimate)
    }


def _get_post_covid_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:
    if not user.projects:
        raise scoring.NotEnoughDataException(
            'Project is required.', fields={'user.projects.0.advices'})
    project = user.projects[0]
    scoring_project = scoring.ScoringProject(project, user, database)
    if scoring_project.job_group_info().covid_risk != job_pb2.COVID_RISKY:
        raise campaign.DoNotSend("The user's project job is not covid risky.")
    try:
        network_advice_link = next(
            campaign.get_deep_link_advice(user.user_id, project, a.advice_id)
            for a in project.advices
            if a.advice_id.startswith('network-application'))
    except StopIteration:
        raise campaign.DoNotSend('No network-application advice found for the user.')\
            from None
    return campaign.get_default_coaching_email_vars(user) | {
        'deepLinkAdviceUrl': network_advice_link,
        'ofJobName': scoring_project.populate_template('%ofJobName'),
    }


def _open_classrooms_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:
    """Template variables for open classrooms email."""

    if user.registered_at.ToDatetime() < _SIX_MONTHS_AGO:
        raise campaign.DoNotSend('User registered less than 6 months ago.')

    age = datetime.date.today().year - user.profile.year_of_birth
    if age < 18:
        raise campaign.DoNotSend('User too young to subscribe to OpenClassrooms.')
    if age > 54:
        raise campaign.DoNotSend('User too old to subscribe to OpenClassrooms.')
    if user.profile.highest_degree > job_pb2.BAC_BACPRO:
        raise campaign.DoNotSend('User might have higher education.')

    if user.employment_status and user.employment_status[-1].seeking != user_pb2.STILL_SEEKING:
        raise campaign.DoNotSend('User is no more seeking for a job.')
    if not (user.projects and user.projects[0]):
        raise scoring.NotEnoughDataException(
            'Project is required.', fields={'user.projects.0.kind'})

    project = user.projects[0]
    if project.kind != project_pb2.REORIENTATION and not (
            project.kind == project_pb2.FIND_A_NEW_JOB and
            project.passionate_level == project_pb2.ALIMENTARY_JOB):
        raise campaign.DoNotSend(
            'User is happy with their job (no reorientation and enthusiastic about their job).')

    has_children = user.profile.family_situation in {
        user_profile_pb2.FAMILY_WITH_KIDS,
        user_profile_pb2.SINGLE_PARENT_SITUATION,
    }

    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    if not job_group_info:
        raise scoring.NotEnoughDataException(
            'Requires job group info for the difficulty of applying to this kind of job.')

    return campaign.get_default_coaching_email_vars(user) | {
        'hasAtypicProfile': campaign.as_template_boolean(
            user_profile_pb2.ATYPIC_PROFILE in user.profile.frustrations),
        'hasFamilyAndManagementIssue': campaign.as_template_boolean(
            has_children and user_profile_pb2.TIME_MANAGEMENT in user.profile.frustrations),
        'hasSeniority': campaign.as_template_boolean(
            project.seniority > project_pb2.INTERMEDIARY),
        'hasSimpleApplication': campaign.as_template_boolean(
            job_group_info.application_complexity == job_pb2.SIMPLE_APPLICATION_PROCESS),
        'isReorienting': campaign.as_template_boolean(
            project.kind == project_pb2.REORIENTATION),
        'isFrustratedOld': campaign.as_template_boolean(
            age >= 40 and user_profile_pb2.AGE_DISCRIMINATION in user.profile.frustrations),
        'ofFirstName': french.maybe_contract_prefix('de ', "d'", user.profile.name)
    }


def _format_action(action: action_pb2.Action, user_id: str, project_id: str) -> dict[str, Any]:
    return {
        'title': action.title,
        'url': campaign.create_logged_url(
            user_id, f'/projet/{project_id}/action/{action.action_id}')
    }


# Keep it sync with frontend/client/src/store/action_plan.ts
def _get_section(action: action_pb2.Action, now: datetime.datetime) -> str:
    if action.status == action_pb2.ACTION_DONE:
        return 'done'
    if action.HasField('expected_completion_at'):
        days_to_completion = action.expected_completion_at.ToDatetime().date() - now.date()
        if days_to_completion >= datetime.timedelta(days=2):
            return 'week'
        if days_to_completion >= datetime.timedelta(days=1):
            return 'tomorrow'
        return 'today'
    return 'unscheduled'


def _make_action_lists(
        actions: list[action_pb2.Action], user_id: str, project_id: str,
        now: datetime.datetime) -> dict[str, list[Any]]:
    grouped_actions = itertools.groupby(actions, lambda action: _get_section(action, now))
    return {
        time: [_format_action(action, user_id, project_id) for action in list(actions)]
        for (time, actions) in grouped_actions}


def _get_action_plan_vars(
        user: user_pb2.User, now: datetime.datetime, **unused_kwargs: Any) -> dict[str, Any]:
    if not user.projects:
        raise campaign.DoNotSend('User does not have any projects.')
    project = user.projects[0]
    plan_actions = sorted(
        [action for action in project.actions if (
            action.status == action_pb2.ACTION_CURRENT or action.status == action_pb2.ACTION_DONE)],
        key=lambda action: action.expected_completion_at.ToDatetime())
    if not plan_actions or not project.HasField('action_plan_started_at'):
        raise campaign.DoNotSend('User does not have a ready action plan.')

    actions_by_sections = _make_action_lists(plan_actions, user.user_id, project.project_id, now)
    creation_date = i18n.translate_date(
        project.action_plan_started_at.ToDatetime(), user.profile.locale)
    # TODO(Sil): Put actions and sections visibility in the same object.
    # TODO(cyrille) Make the variables so that we can loop on sections directly.
    return campaign.get_default_coaching_email_vars(user) | {
        'actionPlanUrl': campaign.create_logged_url(
            user.user_id, f'/projet/{project.project_id}/plan-action'),
        'actions': actions_by_sections,
        'creationDate': creation_date,
        'numActionsBySections': {
            section: len(actions_by_sections.get(section, [])) for section in _ACTIONS_SECTIONS}
    }


def _get_jobflix_invite_vars(
        user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    jobflix_default_vars = jobflix.get_default_vars(user)
    product_url = jobflix_default_vars['productUrl']
    # Keep the source sync with advisor/jobflix.tsx.
    source = 'dwp' if user.origin.source == 'dwp' else 'bob'
    return campaign.get_default_coaching_email_vars(user) | {
        'senderName': jobflix_default_vars['senderFirstName'],
        'sideProductName': jobflix_default_vars['productName'],
        'sideProductUrl': f'{product_url}?utm_source={source}&utm_medium=email',
        'statusUpdateUrl': campaign.get_status_update_link(user)
    }


def _get_dwp_interview_vars(
        user: user_pb2.User, now: datetime.datetime, **unused_kwargs: Any) -> dict[str, Any]:
    if user.origin.source != 'dwp':
        raise campaign.DoNotSend('User does not come from DWP.')
    three_weeks_ago = now.replace(microsecond=0) - datetime.timedelta(21)
    if user.registered_at.ToDatetime() > three_weeks_ago and not user.features_enabled.alpha:
        raise campaign.DoNotSend('User registered less than 3 weeks ago.')
    return campaign.get_default_coaching_email_vars(user)


def _get_confidence_boost_vars(
        user: user_pb2.User, **unused_kwargs: Any) -> dict[str, Any]:
    return campaign.get_default_coaching_email_vars(user)


# TODO(cyrille): Modularize.
_CAMPAIGNS = [
    campaign.Campaign(
        campaign_id='focus-self-develop',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchHasNotStarted': {'$ne': True},
                'isIncomplete': {'$ne': True},
            }}
        },
        get_vars=_get_self_development_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='focus-body-language',
        mongo_filters={
            'projects': {'$elemMatch': {
                'isIncomplete': {'$ne': True},
            }},
            'profile.frustrations': {'$in': ['SELF_CONFIDENCE', 'INTERVIEW', 'ATYPIC_PROFILE']},
        },
        get_vars=_body_language_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
    ),
    campaign.Campaign(
        campaign_id='employment-status',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchHasNotStarted': {'$ne': True},
                'isIncomplete': {'$ne': True},
            }}
        },
        get_vars=_employment_vars,
        sender_name=i18n.make_translatable_string('Florian de {{var:productName}}'),
        sender_email='florian@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='galita-1',
        mongo_filters={
            'profile.frustrations': 'MOTIVATION',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita1_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
    ),
    campaign.Campaign(
        campaign_id='galita-2',
        mongo_filters={'projects': {'$elemMatch': {'$or': [
            {'previousJobSimilarity': 'NEVER_DONE'},
            {'kind': {'$in': ['FIND_A_FIRST_JOB', 'REORIENTATION']}},
        ]}}},
        get_vars=_get_galita2_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
    ),
    campaign.Campaign(
        campaign_id='galita-2-short',
        mongo_filters={'projects': {'$elemMatch': {'$or': [
            {'previousJobSimilarity': 'NEVER_DONE'},
            {'kind': {'$in': ['FIND_A_FIRST_JOB', 'REORIENTATION']}},
        ]}}},
        get_vars=_get_galita2_short_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
    ),
    campaign.Campaign(
        campaign_id='galita-3',
        mongo_filters={
            'profile.frustrations': 'NO_OFFER_ANSWERS',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita3_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='galita-3-short',
        mongo_filters={
            'profile.frustrations': 'NO_OFFER_ANSWERS',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita3_short_vars,
        sender_name=i18n.make_translatable_string("Pascal et l'équipe de {{var:productName}}"),
        sender_email='pascal@bob-emploi.fr',
        is_coaching=True,
    ),

    # TODO(sil): Make it a coaching email when the partnership is on again.
    campaign.Campaign(
        campaign_id='open-classrooms',
        mongo_filters={
            '$or': [
                {'employmentStatus': {'$exists': False}},
                {'employmentStatus.seeking': 'STILL_SEEKING'}
            ],
            'profile.highestDegree': {
                '$in': ['UNKNOWN_DEGREE', 'NO_DEGREE', 'CAP_BEP', 'BAC_BACPRO']
            },
            'profile.yearOfBirth': {
                '$gt': datetime.datetime.now().year - 54,
                '$lt': datetime.datetime.now().year - 18,
            },
            'registeredAt': {'$gt': _SIX_MONTHS_AGO.isoformat() + 'Z'},
        },
        get_vars=_open_classrooms_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='post-covid',
        mongo_filters={},
        get_vars=_get_post_covid_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='action-plan',
        mongo_filters={},
        get_vars=_get_action_plan_vars,
        sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
        sender_email='tabitha@bob-emploi.fr'
    ),
    campaign.Campaign(
        campaign_id='jobflix-invite',
        mongo_filters={},
        get_vars=_get_jobflix_invite_vars,
        sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
        sender_email='tabitha@bob-emploi.fr',
        is_coaching=True
    ),
    campaign.Campaign(
        campaign_id='dwp-interview',
        mongo_filters={
            'origin.source': 'dwp',
            'registeredAt': {'$lt': _THREE_WEEKS_AGO.isoformat() + 'Z'},
        },
        get_vars=_get_dwp_interview_vars,
        sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
        sender_email='tabitha@bob-emploi.fr'
    ),
    campaign.Campaign(
        campaign_id='dwp-interview-apologies',
        mongo_filters={
            'emailsSent.campaignId': 'dwp-interview',
            'origin.source': 'dwp',
            'registeredAt': {'$lt': _THREE_WEEKS_AGO.isoformat() + 'Z'},
        },
        get_vars=_get_dwp_interview_vars,
        sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
        sender_email='tabitha@bob-emploi.fr'
    ),
    campaign.Campaign(
        campaign_id='confidence-boost',
        mongo_filters={
            'registeredAt': {'$gt': _THREE_MONTHS_AGO.isoformat() + 'Z'},
        },
        get_vars=_get_confidence_boost_vars,
        sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
        sender_email='tabitha@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True
    )
]

for the_campaign in _CAMPAIGNS:
    campaign.register_campaign(the_campaign)


def send_campaign(
        campaign_id: mailjet_templates.Id, user: user_pb2.User, *,
        database: mongo.NoPiiMongoDatabase,
        users_database: mongo.UsersDatabase,
        eval_database: mongo.NoPiiMongoDatabase, now: datetime.datetime,
        action: 'campaign.Action' = 'dry-run',
        dry_run_email: Optional[str] = None,
        mongo_user_update: Optional[dict[str, Any]] = None) -> Union[bool, email_pb2.EmailSent]:
    """Populate vars, and send template."""

    return campaign.get_campaign(campaign_id).send_mail(
        user, database=database, users_database=users_database, eval_database=eval_database,
        now=now, action=action, mongo_user_update=mongo_user_update, dry_run_email=dry_run_email)
