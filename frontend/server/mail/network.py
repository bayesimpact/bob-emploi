"""Module for network email campaigns"""

import datetime
import re
from typing import Any, Dict
from urllib import parse

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


# There is 2 spaces between the rank (2e, 3e) and the Arrondissement,
# except for the first one where there is only 1 space (i.e 1er Arrondissement).
_DISTRICT_MATCHER = re.compile(r'(\w+)\s(\d+e)r?(\s{1,2}Arrondissement)')


def strip_district(city: str) -> str:
    """Strip district from a city name, ie keep 'Lyon' from 'Lyon 5e Arrondissement'.

    Returns:
        a string with city stripped for district or the original city name.
    """

    district_match = re.match(_DISTRICT_MATCHER, city)
    if district_match:
        return district_match.group(1)
    return city


def _get_in_target_domain(rome_id: str, database: mongo.NoPiiMongoDatabase) -> str:
    if not rome_id:
        raise scoring.NotEnoughDataException(
            "Need a job group to express user's target domain",
            {'projects.0.targetJob.jobGroup.romeId'})
    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
        raise scoring.NotEnoughDataException(
            "Need job group into to express user's target domain",
            {f'data.job_group_info.{rome_id}'})
    in_target_domain = job_group_info.in_domain
    if not in_target_domain:
        raise scoring.NotEnoughDataException(
            "No information about this job group's domain",
            {f'data.job_group_info.{rome_id}.in_target_domain'})
    return in_target_domain


def _get_network_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, str]:
    """Compute vars for a given user for the network email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    project = user.projects[0]

    if project.network_estimate != 1:
        raise campaign.DoNotSend('User has a good enough network')

    in_target_domain = _get_in_target_domain(project.target_job.job_group.rome_id, database)
    worst_frustration = next(
        (f for f in (user_pb2.NO_OFFER_ANSWERS, user_pb2.MOTIVATION)
         if f in user.profile.frustrations),
        None)

    is_hairdresser_or_in_marseille = \
        project.target_job.job_group.rome_id.startswith('D') or \
        project.city.departement_id == '13'
    other_job_in_city = 'coiffeur à Marseille'
    if is_hairdresser_or_in_marseille:
        other_job_in_city = 'secrétaire à Lyon'
    job = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))
    in_city = french.in_city(strip_district(project.city.name))
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'inTargetDomain': in_target_domain,
        'frustration': user_pb2.Frustration.Name(worst_frustration) if worst_frustration else '',
        'otherJobInCity': other_job_in_city,
        'jobInCity': f'{job} {in_city}',
        'emailInUrl': parse.quote(user.profile.email),
    })


def network_plus_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> Dict[str, str]:
    """Compute vars for a given user for the network email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    project = user.projects[0]

    if project.network_estimate < 2:
        raise campaign.DoNotSend('User does not have a strong network')

    rome_id = project.target_job.job_group.rome_id
    in_target_domain = _get_in_target_domain(rome_id, database)
    job_group_info = jobs.get_group_proto(database, rome_id)
    assert job_group_info
    application_modes = job_group_info.application_modes.values()

    fap_modes = [fap_modes.modes for fap_modes in application_modes if len(fap_modes.modes)]
    if not fap_modes:
        raise scoring.NotEnoughDataException(
            'No information about application modes for the target job',
            {f'data.job_group_info.{rome_id}.application_modes'})
    flat_fap_modes = [mode for modes in fap_modes for mode in modes]
    network_percentages = [mode.percentage for mode in flat_fap_modes if (
        mode.mode == job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS)]
    # We want to focus on the users for which network,
    # as an application mode, has a substantial importance.
    if not network_percentages:
        raise campaign.DoNotSend(
            'User is not targeting a job where networking is a main application mode')
    scoring_project = scoring.ScoringProject(project, user, database=database)
    average_network_percentage = sum(network_percentages) / len(network_percentages)
    if average_network_percentage > 55:
        network_application_importance = scoring_project.translate_static_string('que la majorité')
    elif average_network_percentage >= 45:
        network_application_importance = scoring_project.translate_static_string('que la moitié')
    elif average_network_percentage >= 25:
        network_application_importance = scoring_project.translate_static_string("qu'un tiers")
    else:
        raise campaign.DoNotSend(
            'User is not targeting a job where networking is a main application mode')

    worst_frustration = next(
        (f for f in (user_pb2.SELF_CONFIDENCE, user_pb2.MOTIVATION)
         if f in user.profile.frustrations),
        None)
    has_children = user.profile.family_situation in {
        user_pb2.FAMILY_WITH_KIDS, user_pb2.SINGLE_PARENT_SITUATION}

    age = datetime.date.today().year - user.profile.year_of_birth
    max_young = 35

    try:
        in_departement = geo.get_in_a_departement_text(
            database, project.city.departement_id, project.city)
    except KeyError:
        raise scoring.NotEnoughDataException(
            'Need departement info for phrasing',
            {f'data.departements.{project.city.departement_id}'}) from None

    job_group_name = french.lower_first_letter(project.target_job.job_group.name)

    if (user.profile.locale or 'fr').startswith('fr'):
        in_city = french.in_city(project.city.name)
    else:
        # TODO(pascal): Update the English template so that it follows the logic of "in city" and
        # not "city". For now it's phrased as "near {{inCity}}".
        in_city = project.city.name

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'frustration': user_pb2.Frustration.Name(worst_frustration) if worst_frustration else '',
        'hasChildren': campaign.as_template_boolean(has_children),
        'hasHighSchoolDegree': campaign.as_template_boolean(
            user.profile.highest_degree >= job_pb2.BAC_BACPRO),
        'hasLargeNetwork': campaign.as_template_boolean(project.network_estimate >= 2),
        'hasWorkedBefore': campaign.as_template_boolean(
            project.kind != project_pb2.FIND_A_FIRST_JOB),
        'inCity': in_city,
        'inTargetDomain': in_target_domain,
        'isAbleBodied': campaign.as_template_boolean(not user.profile.has_handicap),
        'isYoung': campaign.as_template_boolean(age <= max_young),
        'jobGroupInDepartement': f'{job_group_name} {in_departement}',
        'networkApplicationPercentage': network_application_importance,
    })


campaign.register_campaign(campaign.Campaign(
    campaign_id='focus-network',
    mongo_filters={
        'projects': {'$elemMatch': {
            'networkEstimate': 1,
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=_get_network_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))

campaign.register_campaign(campaign.Campaign(
    campaign_id='network-plus',
    mongo_filters={
        'projects': {'$elemMatch': {
            'networkEstimate': {'$gte': 2},
            'isIncomplete': {'$ne': True},
        }},
    },
    get_vars=network_plus_vars,
    sender_name=i18n.make_translatable_string("Joanna et l'équipe de Bob"),
    sender_email='joanna@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
