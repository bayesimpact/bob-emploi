"""Coaching email campaigns to promote spontaneous applications."""

import datetime
import logging
from typing import Any
from urllib import parse

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


_EXPERIENCE_AS_TEXT = {
    project_pb2.JUNIOR: 'quelques temps',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}


def _get_spontaneous_vars(
        user: user_pb2.User, *, now: datetime.datetime,
        database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:
    """Computes vars for a given user for the spontaneous email.

    Returns a dict with all vars required for the template.
    """

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]
    scoring_project = scoring.ScoringProject(project, user, database, now)

    job_search_length = scoring_project.get_search_length_now()
    if job_search_length < 0:
        raise campaign.DoNotSend('No info on user search duration')

    rome_id = project.target_job.job_group.rome_id
    if not rome_id:
        raise campaign.DoNotSend('User has no target job yet')

    job_group_info = scoring_project.job_group_info()
    if not job_group_info.rome_id:
        raise scoring.NotEnoughDataException(
            'Requires job group info to check if spontaneous application is a good channel.',
            fields={'projects.0.targetJob.jobGroup.romeId'})

    application_modes = job_group_info.application_modes
    if not application_modes:
        raise scoring.NotEnoughDataException(
            'Requires application modes to check if spontaneous application is a good channel.',
            fields={f'data.job_group_info.{rome_id}.application_modes'})

    def _should_use_spontaneous(modes: job_pb2.RecruitingModesDistribution) -> bool:
        return any(
            mode.mode == job_pb2.SPONTANEOUS_APPLICATION and mode.percentage > 20
            for mode in modes.modes)
    if not any(_should_use_spontaneous(modes) for modes in application_modes.values()):
        raise campaign.DoNotSend("Spontaneous isn't bigger than 20% of interesting channels.")

    contact_mode = job_group_info.preferred_application_medium
    if not contact_mode:
        raise scoring.NotEnoughDataException(
            'Contact mode is required to push people to apply spontaneously',
            fields={f'data.job_group_info.{rome_id}.preferred_application_medium'})

    in_a_workplace = job_group_info.in_a_workplace
    if not in_a_workplace and contact_mode != job_pb2.APPLY_BY_EMAIL:
        raise scoring.NotEnoughDataException(
            'To apply in person, the %inAWorkplace template is required',
            fields={f'data.job_group_info.{rome_id}.in_a_workplace'})

    like_your_workplace = job_group_info.like_your_workplace
    if in_a_workplace and not like_your_workplace:
        raise scoring.NotEnoughDataException(
            'The template %likeYourWorkplace is required',
            fields={f'data.job_group_info.{rome_id}.like_your_workplace'})

    to_the_workplace = job_group_info.to_the_workplace
    if not to_the_workplace:
        to_the_workplace = scoring_project.translate_static_string("à l'entreprise")

    some_companies = job_group_info.place_plural
    if not some_companies:
        some_companies = scoring_project.translate_static_string('des entreprises')

    what_i_love_about = scoring_project.translate_string(
        job_group_info.what_i_love_about, is_genderized=True)
    # TODO(cyrille): Drop this behaviour once phrases are translated with gender.
    if user.profile.gender == user_profile_pb2.FEMININE:
        what_i_love_about_feminine = job_group_info.what_i_love_about_feminine
        if what_i_love_about_feminine:
            what_i_love_about = what_i_love_about_feminine
    if not what_i_love_about and contact_mode == job_pb2.APPLY_BY_EMAIL:
        raise scoring.NotEnoughDataException(
            'An example about "What I love about" a company is required',
            fields={f'data.job_group_info.{rome_id}.what_i_love_about'})

    why_specific_company = job_group_info.why_specific_company
    if not why_specific_company:
        raise scoring.NotEnoughDataException(
            'An example about "Why this specific company" is required',
            fields={f'data.job_group_info.{rome_id}.why_specific_company'})

    at_various_companies = job_group_info.at_various_companies

    if project.weekly_applications_estimate == project_pb2.SOME:
        weekly_applications_count = '5'
    elif project.weekly_applications_estimate > project_pb2.SOME:
        weekly_applications_count = '15'
    else:
        weekly_applications_count = ''

    if project.weekly_applications_estimate:
        weekly_applications_option = project_pb2.NumberOfferEstimateOption.Name(
            project.weekly_applications_estimate)
    else:
        weekly_applications_option = ''

    return campaign.get_default_coaching_email_vars(user) | {
        'applicationComplexity':
            job_pb2.ApplicationProcessComplexity.Name(job_group_info.application_complexity),
        'atVariousCompanies': at_various_companies,
        'contactMode': job_pb2.ApplicationMedium.Name(contact_mode).replace('APPLY_', ''),
        'deepLinkLBB':
            f'https://labonneboite.pole-emploi.fr/entreprises/commune/{project.city.city_id}/rome/'
            f'{project.target_job.job_group.rome_id}?utm_medium=web&utm_source=bob&'
            'utm_campaign=bob-email',
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
        'weeklyApplicationsCount': weekly_applications_count,
        'weeklyApplicationsOption': weekly_applications_option,
        'whatILoveAbout': what_i_love_about,
        'whySpecificCompany': why_specific_company,
    }


def _get_short_spontaneous_vars(
        user: user_pb2.User, *, now: datetime.datetime, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]
    scoring_project = scoring.ScoringProject(project, user, database, now)

    job_group_info = scoring_project.job_group_info()

    why_specific_company = job_group_info.why_specific_company
    if not why_specific_company:
        why_specific_company = scoring_project.translate_static_string(
            'vous vous reconnaissez dans leurs valeurs, leur équipe, leur service client ou ce '
            "qu'elles vendent")

    some_companies = job_group_info.place_plural
    if not some_companies:
        some_companies = scoring_project.translate_static_string('des entreprises')

    if (user.profile.locale or 'fr').startswith('fr'):
        advice_page_url = 'https://labonneboite.pole-emploi.fr/comment-faire-une-candidature-spontanee'
    elif user.profile.locale.startswith('en'):
        advice_page_url = 'https://www.theguardian.com/careers/speculative-applications'
    else:
        logging.warning(
            'No advice webpage given for campaign spontaneous-short in "%s"', user.profile.locale)
        advice_page_url = ''

    # If the user receives the email less than 2 months after they registered on Bob and are
    # searching for less than 3 months, we can be happily surprised if they found a job.
    is_job_found_surprising = scoring_project.get_search_length_now() < 3 and \
        (scoring_project.details.created_at.ToDatetime() - now).days / 30 < 2

    return campaign.get_default_coaching_email_vars(user) | {
        'advicePageUrl': advice_page_url,
        'atVariousCompanies': job_group_info.at_various_companies,
        'isJobFoundSurprising': campaign.as_template_boolean(is_job_found_surprising),
        'someCompanies': some_companies,
        'whySpecificCompany': why_specific_company,
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='focus-spontaneous',
    mongo_filters={
        'projects': {'$elemMatch': {
            'jobSearchHasNotStarted': {'$ne': True},
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_spontaneous_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de {{var:productName}}"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
campaign.register_campaign(campaign.Campaign(
    campaign_id='spontaneous-short',
    mongo_filters={
        'projects': {'$elemMatch': {
            'jobSearchHasNotStarted': {'$ne': True},
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_short_spontaneous_vars,
    sender_name=i18n.make_translatable_string("Pascal et l'équipe de {{var:productName}}"),
    sender_email='pascal@bob-emploi.fr',
    is_coaching=True,
))
