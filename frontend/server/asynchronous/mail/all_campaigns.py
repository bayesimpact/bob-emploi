"""Module to access all emailing campagins."""

import datetime
import hashlib
import logging
from urllib import parse

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server.asynchronous.mail import campaign
# pylint: disable=unused-import
# Import all plugins: they register themselves when imported.
from bob_emploi.frontend.server.asynchronous.mail import bob_actions_help
from bob_emploi.frontend.server.asynchronous.mail import holiday
from bob_emploi.frontend.server.asynchronous.mail import imt
from bob_emploi.frontend.server.asynchronous.mail import network
from bob_emploi.frontend.server.asynchronous.mail import salon_arles
# pylint: enable=unused-import


# TODO(pascal): Factorize with _READ_EMAIL_STATUSES in mail_blast.py
_READ_EMAIL_STATUSES = frozenset([
    user_pb2.EMAIL_SENT_OPENED, user_pb2.EMAIL_SENT_CLICKED])


_ONE_YEAR_AGO = now.get() - datetime.timedelta(365)
_ONE_MONTH_AGO = now.get() - datetime.timedelta(30)
_EXPERIENCE_AS_TEXT = {
    project_pb2.JUNIOR: 'quelques temps',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}


def _get_spontaneous_vars(user, database=None, **unused_kwargs):
    """Compute vars for a given user for the spontaneous email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects or user.projects[0].is_incomplete:
        logging.info('User has no complete project')
        return None
    project = user.projects[0]

    job_search_length = campaign.job_search_started_months_ago(project)
    if job_search_length < 0:
        logging.info('No info on user search duration')
        return None

    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    if not job_group_info:
        logging.warning(
            'Could not find job group info for "%s"', project.target_job.job_group.rome_id)
        return None

    def _should_use_spontaneous(modes):
        return any(
            mode.mode == job_pb2.SPONTANEOUS_APPLICATION and mode.percentage > 20
            for mode in modes.modes)
    application_modes = job_group_info.application_modes
    if not any(_should_use_spontaneous(modes) for modes in application_modes.values()):
        return None

    contact_mode = job_group_info.preferred_application_medium
    if not contact_mode:
        logging.error(
            'There is no contact mode for the job group "%s"',
            project.target_job.job_group.rome_id)
        return None
    contact_mode = job_pb2.ApplicationMedium.Name(contact_mode).replace('APPLY_', '')

    in_a_workplace = job_group_info.in_a_workplace
    if not in_a_workplace and contact_mode != 'BY_EMAIL':
        logging.error(
            'There is no "in_a_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    like_your_workplace = job_group_info.like_your_workplace
    if in_a_workplace and not like_your_workplace:
        logging.error(
            'There is no "like_your_workplace" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    to_the_workplace = job_group_info.to_the_workplace
    if not to_the_workplace:
        to_the_workplace = "à l'entreprise"

    some_companies = job_group_info.place_plural
    if not some_companies:
        some_companies = 'des entreprises'

    what_i_love_about = job_group_info.what_i_love_about
    if user.profile.gender == user_pb2.FEMININE:
        what_i_love_about_feminine = job_group_info.what_i_love_about_feminine
        if what_i_love_about_feminine:
            what_i_love_about = what_i_love_about_feminine
    if not what_i_love_about and contact_mode == 'BY_EMAIL':
        logging.error(
            'There is no "What I love about" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    why_specific_company = job_group_info.why_specific_company
    if not why_specific_company:
        logging.error(
            'There is no "Why this specific company" field for the job group "%s".',
            project.target_job.job_group.rome_id)
        return None

    at_various_companies = job_group_info.at_various_companies

    if project.weekly_applications_estimate == project_pb2.SOME:
        weekly_application_count = '5'
    elif project.weekly_applications_estimate > project_pb2.SOME:
        weekly_application_count = '15'
    else:
        weekly_application_count = ''

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'applicationComplexity':
            job_pb2.ApplicationProcessComplexity.Name(job_group_info.application_complexity),
        'atVariousCompanies': at_various_companies,
        'contactMode': contact_mode,
        'deepLinkLBB':
            'https://labonneboite.pole-emploi.fr/entreprises/commune/{}/rome/'
            '{}?utm_medium=web&utm_source=bob&utm_campaign=bob-email'
            .format(
                project.city.city_id or project.mobility.city.city_id,
                project.target_job.job_group.rome_id),
        'emailInUrl': parse.quote(user.profile.email),
        'experienceAsText': _EXPERIENCE_AS_TEXT.get(project.seniority, 'peu'),
        'inWorkPlace': in_a_workplace,
        'jobName':
            french.lower_first_letter(french.genderize_job(
                project.target_job, user.profile.gender)),
        'lastName': user.profile.last_name,
        'likeYourWorkplace': like_your_workplace,
        'someCompanies': some_companies,
        'toTheWorkplace': to_the_workplace,
        'weeklyApplicationOptions': weekly_application_count,
        'whatILoveAbout': what_i_love_about,
        'whySpecificCompany': why_specific_company,
    })


def _get_self_development_vars(user, **unused_kwargs):
    """Compute vars for a given user for the self-development email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects or user.projects[0].is_incomplete:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    job_search_length = campaign.job_search_started_months_ago(project)
    if job_search_length < 0:
        logging.info('No info on user search duration')
        return None

    if job_search_length > 12:
        logging.info('User has been searching for too long (%s)', job_search_length)
        return None

    genderized_job_name = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))
    age = datetime.date.today().year - user.profile.year_of_birth

    max_young = 30
    min_old = 50

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'hasEnoughExperience': campaign.as_template_boolean(
            project.seniority > project_pb2.JUNIOR),
        'isAdministrativeAssistant': campaign.as_template_boolean(
            project.target_job.job_group.name == 'Secrétariat'),
        'isOld': campaign.as_template_boolean(age >= min_old),
        'isOldNotWoman': campaign.as_template_boolean(
            age >= min_old and user.profile.gender != user_pb2.FEMININE),
        'isYoung': campaign.as_template_boolean(age <= max_young),
        'isYoungNotWoman': campaign.as_template_boolean(
            age <= max_young and user.profile.gender != user_pb2.FEMININE),
        'jobName': genderized_job_name,
        'ofJobName': french.maybe_contract_prefix('de ', "d'", genderized_job_name),
    })


def _body_language_vars(user, **unused_kwargs):
    """Compute vars for a given user for the body language email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects or user.projects[0].is_incomplete:
        logging.info('User has no complete project')
        return None

    worst_frustration = next(
        (user_pb2.Frustration.Name(frustration)
         for frustration in (user_pb2.SELF_CONFIDENCE, user_pb2.INTERVIEW, user_pb2.ATYPIC_PROFILE)
         if frustration in user.profile.frustrations),
        '')
    if not worst_frustration:
        return None

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'worstFrustration': worst_frustration,
    })


def _employment_vars(user, **unused_kwargs):
    """Compute vars for a given user for the employment survey.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime())
    if not registered_months_ago:
        logging.warning('User registered only recently (%s)', user.registered_at)
        return None
    # If the users have already updated their employment status less than one month ago,
    # ignore them.
    for status in user.employment_status:
        if status.created_at.ToDatetime() > _ONE_MONTH_AGO:
            return None
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    return dict(campaign.get_default_vars(user), **{
        'registeredMonthsAgo': registered_months_ago,
        'seekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STILL_SEEKING',
            parse.quote('{}/statut/en-recherche'.format(campaign.BASE_URL)),
        ),
        'stopSeekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STOP_SEEKING',
            parse.quote('{}/statut/ne-recherche-plus'.format(campaign.BASE_URL)),
        ),
    })


def new_diagnostic_vars(user, **unused_kwargs):
    """Compute vars for the "New Diagnostic"."""

    frustrations_vars = {
        'frustration_{}'.format(user_pb2.Frustration.Name(f)): 'True'
        for f in user.profile.frustrations
    }
    age = datetime.date.today().year - user.profile.year_of_birth
    has_children = user.profile.family_situation in {
        user_pb2.FAMILY_WITH_KIDS,
        user_pb2.SINGLE_PARENT_SITUATION,
    }
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    auth_token = parse.quote(auth.create_token(user.user_id, is_using_timestamp=True))
    return dict(dict(frustrations_vars, **campaign.get_default_vars(user)), **{
        'mayHaveSeekingChildren': campaign.as_template_boolean(has_children and age >= 45),
        'loginUrl': '{}?userId={}&authToken={}'.format(campaign.BASE_URL, user.user_id, auth_token),
        'stopSeekingUrl': '{}/api/employment-status?user={}&token={}&seeking={}&redirect={}'.format(
            campaign.BASE_URL, user.user_id, survey_token, 'STOP_SEEKING',
            parse.quote('{}/statut/ne-recherche-plus'.format(campaign.BASE_URL)),
        ),
    })


def _get_galita1_vars(user, **unused_kwargs):
    if user_pb2.MOTIVATION not in user.profile.frustrations:
        logging.info('User is motivated enough')
        return None
    if user.projects and user.projects[0].job_search_has_not_started:
        logging.info('User is not searching for a job yet')
        return None
    return campaign.get_default_coaching_email_vars(user)


def _get_galita3_vars(user, **unused_kwargs):
    if user_pb2.NO_OFFER_ANSWERS not in user.profile.frustrations:
        logging.info('User is having enough answers.')
        return None
    # We set a string with a blank as this is the only way to exclude a section
    # on Passport except to check equality or inequality with a non-empty
    # string.
    deep_link_to_follow_up_advice = ' '
    if user.projects:
        for project in user.projects:
            if any(a.advice_id == 'follow-up' for a in project.advices):
                # TODO(pascal): Add an auth token.
                deep_link_to_follow_up_advice = '{}/projet/{}/follow-up'.format(
                    campaign.BASE_URL, project.project_id)
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepLinkToAdvice': deep_link_to_follow_up_advice,
    })


def _viral_sharing_vars(user, hash_start=''):
    """Template variables for viral sharing emails."""

    if user.registered_at.ToDatetime() > _ONE_YEAR_AGO:
        return None
    # TODO(cyrille): Move this in the --user-hash flag, to be usable by all campaigns.
    if hash_start:
        uniform_hash = hashlib.sha1()
        uniform_hash.update(user.user_id.encode('ascii'))
        if not uniform_hash.hexdigest().startswith(hash_start):
            return None
    return campaign.get_default_vars(user)


# TODO(cyrille): Modularize.
_CAMPAIGNS = {
    'focus-spontaneous': campaign.Campaign(
        mailjet_template='212606',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0},
                'isIncomplete': {'$ne': True},
            }},
        },
        get_vars=_get_spontaneous_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    'focus-self-develop': campaign.Campaign(
        mailjet_template='255279',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0, '$lte': 12},
                'isIncomplete': {'$ne': True},
            }}
        },
        get_vars=_get_self_development_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    'focus-body-language': campaign.Campaign(
        mailjet_template='277304',
        mongo_filters={
            'projects': {'$elemMatch': {
                'isIncomplete': {'$ne': True},
            }},
            'profile.frustrations': {'$in': ['SELF_CONFIDENCE', 'INTERVIEW', 'ATYPIC_PROFILE']},
        },
        get_vars=_body_language_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
        is_coaching=True,
    ),
    'employment-status': campaign.Campaign(
        mailjet_template='225287',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchLengthMonths': {'$gte': 0},
                'isIncomplete': {'$ne': True},
            }}
        },
        get_vars=_employment_vars,
        sender_name='Benoit de Bob',
        sender_email='benoit@bob-emploi.fr',
    ),
    'new-diagnostic': campaign.Campaign(
        mailjet_template='310559',
        mongo_filters={
            'registeredAt': {'$lt': '2017-11'},
            'requestedByUserAtDate': {'$not': {'$gt': '2017-11'}},
        },
        get_vars=new_diagnostic_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
    'galita-1': campaign.Campaign(
        mailjet_template='315773',
        mongo_filters={
            'profile.frustrations': 'MOTIVATION',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita1_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
        is_coaching=True,
    ),
    'galita-3': campaign.Campaign(
        mailjet_template='481320',
        mongo_filters={
            'profile.frustrations': 'NO_OFFER_ANSWERS',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita3_vars,
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    'viral-sharing-1': campaign.Campaign(
        mailjet_template='334851',
        mongo_filters={},
        get_vars=lambda user, **unused_kwargs: _viral_sharing_vars(user, hash_start='1'),
        sender_name='Margaux de Bob',
        sender_email='margaux@bob-emploi.fr',
    ),
}

for the_id, the_campaign in _CAMPAIGNS.items():
    campaign.register_campaign(the_id, the_campaign)
