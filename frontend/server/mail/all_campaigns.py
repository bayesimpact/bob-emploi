"""Module to access all emailing campagins."""

import datetime
from typing import Any, Dict
from urllib import parse

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign
# pylint: disable=unused-import
# Import all plugins: they register themselves when imported.
from bob_emploi.frontend.server.mail import deletion
from bob_emploi.frontend.server.mail import holiday
from bob_emploi.frontend.server.mail import imt
from bob_emploi.frontend.server.mail import improve_cv
from bob_emploi.frontend.server.mail import jobbing
from bob_emploi.frontend.server.mail import prepare_your_application
from bob_emploi.frontend.server.mail import network
from bob_emploi.frontend.server.mail import nps
from bob_emploi.frontend.server.mail import switch
from bob_emploi.frontend.server.mail import training
# pylint: enable=unused-import


_ONE_YEAR_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(365)
_SIX_MONTHS_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(180)
_ONE_MONTH_AGO = datetime.datetime.now().replace(microsecond=0) - datetime.timedelta(30)
_EXPERIENCE_AS_TEXT = {
    project_pb2.JUNIOR: 'quelques temps',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}


def _get_spontaneous_vars(
        user: user_pb2.User, *, now: datetime.datetime,
        database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, str]:
    """Computes vars for a given user for the spontaneous email.

    Returns a dict with all vars required for the template.
    """

    project = user.projects[0]

    job_search_length = campaign.job_search_started_months_ago(project, now)
    if job_search_length < 0:
        raise campaign.DoNotSend('No info on user search duration')

    rome_id = project.target_job.job_group.rome_id
    if not rome_id:
        raise campaign.DoNotSend('User has no target job yet')

    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
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
        to_the_workplace = "à l'entreprise"

    some_companies = job_group_info.place_plural
    if not some_companies:
        some_companies = 'des entreprises'

    what_i_love_about = job_group_info.what_i_love_about
    if user.profile.gender == user_pb2.FEMININE:
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

    return dict(campaign.get_default_coaching_email_vars(user), **{
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
    })


def _get_self_development_vars(
        user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any) \
        -> Dict[str, str]:
    """Computes vars for a given user for the self-development email.

    Returns a dict with all vars required for the template.
    """

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
    })


def _body_language_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    """Computes vars for a given user for the body language email.

    Returns a dict with all vars required for the template.
    """

    worst_frustration = next(
        (user_pb2.Frustration.Name(frustration)
         for frustration in (user_pb2.SELF_CONFIDENCE, user_pb2.INTERVIEW, user_pb2.ATYPIC_PROFILE)
         if frustration in user.profile.frustrations),
        '')
    if not worst_frustration:
        raise campaign.DoNotSend('User has no frustration related to body language.')

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'worstFrustration': worst_frustration,
    })


def _employment_vars(
        user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any) \
        -> Dict[str, str]:
    """Computes vars for a given user for the employment survey.

    Returns a dict with all vars required for the template.
    """

    registered_months_ago = campaign.get_french_months_ago(user.registered_at.ToDatetime(), now=now)
    if not registered_months_ago:
        if user.features_enabled.alpha:
            # Hack to be able to send the RER campaign to alpha users early.
            registered_months_ago = '0'
        else:
            raise campaign.DoNotSend(
                f'User registered only recently ({user.registered_at})')
    for status in user.employment_status:
        if status.created_at.ToDatetime() > _ONE_MONTH_AGO:
            raise campaign.DoNotSend(
                'User has already updated their employment status less than one month ago.')
    survey_token = parse.quote(auth.create_token(user.user_id, role='employment-status'))
    redirect_url = parse.quote(f'{campaign.BASE_URL}/statut/')
    return dict(campaign.get_default_vars(user), **{
        'registeredMonthsAgo': registered_months_ago,
        'seekingUrl':
        f'{campaign.BASE_URL}/api/employment-status?user={user.user_id}&token={survey_token}&'
        f'seeking=STILL_SEEKING&redirect={redirect_url}en-recherche',
        'stopSeekingUrl':
        f'{campaign.BASE_URL}/api/employment-status?user={user.user_id}&token={survey_token}&'
        f'seeking=STOP_SEEKING&redirect={redirect_url}ne-recherche-plus',
    })


def _get_galita1_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    if user_pb2.MOTIVATION not in user.profile.frustrations:
        raise campaign.DoNotSend('User is motivated enough.')
    if user.projects and user.projects[0].job_search_has_not_started:
        raise campaign.DoNotSend('User is not searching for a job yet.')
    return campaign.get_default_coaching_email_vars(user)


def _get_galita2_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    if not user.projects:
        raise scoring.NotEnoughDataException(
            'Project is required for galita-2.', fields={'user.projects.0.kind'})
    project = user.projects[0]
    if project.kind not in {project_pb2.FIND_A_FIRST_JOB, project_pb2.REORIENTATION} and \
            project.previous_job_similarity != project_pb2.NEVER_DONE:
        raise campaign.DoNotSend('User is not searching a job in a profession new to them.')
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'isReorienting': campaign.as_template_boolean(project.kind == project_pb2.REORIENTATION)})


def _get_galita3_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    if user_pb2.NO_OFFER_ANSWERS not in user.profile.frustrations:
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
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepLinkToAdvice': deep_link_to_follow_up_advice,
    })


def _get_post_covid_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, str]:
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
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'deepLinkAdviceUrl': network_advice_link,
        'ofJobName': scoring_project.populate_template('%ofJobName'),
    })


def _get_upskilling_user_research_vars(
        user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    if not user.profile.highest_degree or user.profile.highest_degree > job_pb2.BAC_BACPRO:
        raise campaign.DoNotSend('User might have higher education.')
    if user.profile.coaching_email_frequency <= user_pb2.EMAIL_NONE:
        raise campaign.DoNotSend("User doesn't want any email.")
    return campaign.get_default_coaching_email_vars(user)


def _get_upskilling_undefined_project_vars(
        user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    if user.profile.coaching_email_frequency <= user_pb2.EMAIL_NONE:
        raise campaign.DoNotSend("User doesn't want any email.")
    if not user.projects:
        raise scoring.NotEnoughDataException(
            'Project is required.', fields={'user.projects.0.diagnostic'})
    project = user.projects[0]
    if project.diagnostic.category_id != 'undefined-project':
        raise campaign.DoNotSend("Bob didn't give undefined-project main challenge to the user.")
    upskilling_params = parse.urlencode({
        'departement': project.city.departement_id,
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'hl': user.profile.locale,
        'utm_medium': 'email',
        'utm_campaign': 'upskilling-beta',
    })
    return dict(
        campaign.get_default_coaching_email_vars(user),
        upskillingUrl=f'{campaign.BASE_URL}/orientation/accueil?{upskilling_params}',
        userId=user.user_id)


def _viral_sharing_vars(user: user_pb2.User, **unused_kwargs: Any) -> Dict[str, str]:
    """Template variables for viral sharing emails."""

    if user.registered_at.ToDatetime() > _ONE_YEAR_AGO:
        raise campaign.DoNotSend('User registered more than one year ago.')
    return campaign.get_default_vars(user)


def _open_classrooms_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, str]:
    """Template variables for viral sharing emails."""

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
        user_pb2.FAMILY_WITH_KIDS,
        user_pb2.SINGLE_PARENT_SITUATION,
    }

    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    if not job_group_info:
        raise scoring.NotEnoughDataException(
            'Requires job group info for the difficulty of applying to this kind of job.')

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'hasAtypicProfile': campaign.as_template_boolean(
            user_pb2.ATYPIC_PROFILE in user.profile.frustrations),
        'hasFamilyAndManagementIssue': campaign.as_template_boolean(
            has_children and user_pb2.TIME_MANAGEMENT in user.profile.frustrations),
        'hasSeniority': campaign.as_template_boolean(
            project.seniority > project_pb2.INTERMEDIARY),
        'hasSimpleApplication': campaign.as_template_boolean(
            job_group_info.application_complexity == job_pb2.SIMPLE_APPLICATION_PROCESS),
        'isReorienting': campaign.as_template_boolean(
            project.kind == project_pb2.REORIENTATION),
        'isFrustratedOld': campaign.as_template_boolean(
            age >= 40 and user_pb2.AGE_DISCRIMINATION in user.profile.frustrations),
        'ofFirstName': french.maybe_contract_prefix('de ', "d'", user.profile.name)
    })


# TODO(cyrille): Modularize.
_CAMPAIGNS = [
    campaign.Campaign(
        campaign_id='focus-spontaneous',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchHasNotStarted': {'$ne': True},
                'isIncomplete': {'$ne': True},
            }},
        },
        get_vars=_get_spontaneous_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='focus-self-develop',
        mongo_filters={
            'projects': {'$elemMatch': {
                'jobSearchHasNotStarted': {'$ne': True},
                'isIncomplete': {'$ne': True},
            }}
        },
        get_vars=_get_self_development_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
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
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
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
        sender_name=i18n.make_translatable_string('Florian de Bob'),
        sender_email='florian@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='handicap-week',
        mongo_filters={
            'profile.isNewsletterEnabled': True,
        },
        get_vars=lambda u, **kw: {'firstName': u.profile.name},
        sender_name='Bob',
        sender_email='bob@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='galita-1',
        mongo_filters={
            'profile.frustrations': 'MOTIVATION',
            'projects.jobSearchHasNotStarted': {'$ne': True},
        },
        get_vars=_get_galita1_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
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
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
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
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='viral-sharing-1',
        mongo_filters={},
        get_vars=_viral_sharing_vars,
        sender_name=i18n.make_translatable_string('Joanna de Bob'),
        sender_email='joanna@bob-emploi.fr',
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
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
        sender_email='joanna@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='post-covid',
        mongo_filters={},
        get_vars=_get_post_covid_vars,
        sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
        sender_email='joanna@bob-emploi.fr',
        is_coaching=True,
        is_big_focus=True,
    ),
    campaign.Campaign(
        campaign_id='upskilling-user-research',
        mongo_filters={
            'profile.coachingEmailFrequency': {'$in': ['EMAIL_ONCE_A_MONTH', 'EMAIL_MAXIMUM']},
            'profile.highestDegree': {'$in': ['NO_DEGREE', 'CAP_BEP', 'BAC_BACPRO']},
        },
        get_vars=_get_upskilling_user_research_vars,
        sender_name=i18n.make_translatable_string("L'équipe de Bob"),
        sender_email='bob@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='upskilling-undefined-project',
        mongo_filters={
            'profile.coachingEmailFrequency': {'$in': ['EMAIL_ONCE_A_MONTH', 'EMAIL_MAXIMUM']},
            'projects.0.diagnostic.categoryId': 'undefined-project',
        },
        get_vars=_get_upskilling_undefined_project_vars,
        sender_name=i18n.make_translatable_string("L'équipe de Bob"),
        sender_email='bob@bob-emploi.fr',
    ),
    campaign.Campaign(
        campaign_id='upskilling-undefined-project-beta',
        mongo_filters={
            'profile.coachingEmailFrequency': {'$in': ['EMAIL_ONCE_A_MONTH', 'EMAIL_MAXIMUM']},
            'projects.0.diagnostic.categoryId': 'undefined-project',
        },
        get_vars=_get_upskilling_undefined_project_vars,
        sender_name=i18n.make_translatable_string("L'équipe de Bob"),
        sender_email='bob@bob-emploi.fr',
    ),
]

for the_campaign in _CAMPAIGNS:
    campaign.register_campaign(the_campaign)
