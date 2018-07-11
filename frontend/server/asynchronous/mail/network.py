"""Module for network email campaigns"""

import datetime
import logging
import re
from urllib import parse

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server.asynchronous.mail import campaign


# There is 2 spaces between the rank (2e, 3e) and the Arrondissement,
# except for the first one where there is only 1 space (i.e 1er Arrondissement).
_DISTRICT_MATCHER = re.compile(r'(\w+)\s(\d+e)r?(\s{1,2}Arrondissement)')


def strip_district(city):
    """Strip district from a city name, ie keep 'Lyon' from 'Lyon 5e Arrondissement'.

    Returns:
        a string with city stripped for district or the original city name.
    """

    district_match = re.match(_DISTRICT_MATCHER, city)
    if district_match:
        return district_match.group(1)
    return city


def _get_network_vars(user, database=None, **unused_kwargs):
    """Compute vars for a given user for the network email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects or user.projects[0].is_incomplete:
        logging.info('User has no complete project')
        return None
    project = user.projects[0]

    if project.network_estimate != 1:
        logging.info('User has a good enough network')
        return None

    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    if not job_group_info:
        logging.warning(
            'Could not find job group info for "%s"', project.target_job.job_group.rome_id)
        return None

    in_target_domain = job_group_info.in_domain
    if not in_target_domain:
        logging.warning('Could not find a target domain (%s)', project.target_job.job_group)
        return None

    worst_frustration = next(
        (f for f in (user_pb2.NO_OFFER_ANSWERS, user_pb2.MOTIVATION)
         if f in user.profile.frustrations),
        None)

    is_hairdresser_or_in_marseille = \
        project.target_job.job_group.rome_id.startswith('D') or \
        project.city.departement_id == '13' or \
        project.mobility.city.departement_id == '13'
    other_job_in_city = 'coiffeur à Marseille'
    if is_hairdresser_or_in_marseille:
        other_job_in_city = 'secrétaire à Lyon'
    return dict(campaign.get_default_coaching_email_vars(user), **{
        'inTargetDomain': in_target_domain,
        'frustration': user_pb2.Frustration.Name(worst_frustration) if worst_frustration else '',
        'otherJobInCity': other_job_in_city,
        'jobInCity': '{} {}'.format(
            french.lower_first_letter(french.genderize_job(
                project.target_job, user.profile.gender)),
            french.in_city(strip_district(project.city.name or project.mobility.city.name))),
        'emailInUrl': parse.quote(user.profile.email),
    })


def network_plus_vars(user, database=None, **unused_kwargs):
    """Compute vars for a given user for the network email.

    Returns:
        a dict with all vars required for the template, or None if no email
        should be sent.
    """

    if not user.projects:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    if project.network_estimate < 2:
        logging.info('User does not have a strong network')
        return None

    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    if not job_group_info:
        logging.warning(
            'Could not find job group info for "%s"', project.target_job.job_group.rome_id)
        return None
    in_target_domain = job_group_info.in_domain
    application_modes = job_group_info.application_modes.values()
    if not in_target_domain:
        logging.warning('Could not find a target domain (%s)', project.target_job.job_group)
        return None

    fap_modes = [fap_modes.modes for fap_modes in application_modes if len(fap_modes.modes)]
    if not fap_modes:
        return None
    flat_fap_modes = [mode for modes in fap_modes for mode in modes]
    network_percentages = [mode.percentage for mode in flat_fap_modes if (
        mode.mode == job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS)]
    # We want to focus on the user for which network,
    # as an application mode, has a substantial importance.
    if not network_percentages:
        return None
    average_network_percentage = sum(network_percentages) / len(network_percentages)
    if average_network_percentage < 55:
        network_application_importance = 'que la majorité'
    if average_network_percentage >= 45 and average_network_percentage <= 55:
        network_application_importance = 'que la moitié'
    if average_network_percentage >= 25 and average_network_percentage < 45:
        network_application_importance = "qu'un tiers"
    else:
        return None

    worst_frustration = next(
        (f for f in (user_pb2.SELF_CONFIDENCE, user_pb2.MOTIVATION)
         if f in user.profile.frustrations),
        None)
    has_children = user.profile.family_situation in {
        user_pb2.FAMILY_WITH_KIDS, user_pb2.SINGLE_PARENT_SITUATION}

    age = datetime.date.today().year - user.profile.year_of_birth
    max_young = 35

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'frustration': user_pb2.Frustration.Name(worst_frustration) if worst_frustration else '',
        'hasChildren': campaign.as_template_boolean(has_children),
        'hasHandicap': campaign.as_template_boolean(user.profile.has_handicap),
        'hasHighSchoolDegree': campaign.as_template_boolean(
            user.profile.highest_degree >= job_pb2.BAC_BACPRO),
        'hasLargeNetwork': campaign.as_template_boolean(project.network_estimate >= 2),
        'hasWorkedBefore': campaign.as_template_boolean(
            project.kind != project_pb2.FIND_A_FIRST_JOB),
        'inCity': french.in_city(project.city.name or project.mobility.city.name),
        'inTargetDomain': in_target_domain,
        'isYoung': campaign.as_template_boolean(age <= max_young),
        'jobGroupInDepartement': '{} {}'.format(
            french.lower_first_letter(project.target_job.job_group.name),
            geo.get_in_a_departement_text(
                database, project.city.departement_id or project.mobility.city.departement_id)),
        'networkApplicationPercentage': network_application_importance,
    })


campaign.register_campaign('focus-network', campaign.Campaign(
    mailjet_template='205970',
    mongo_filters={
        'projects.networkEstimate': 1,
    },
    get_vars=_get_network_vars,
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))

campaign.register_campaign('network-plus', campaign.Campaign(
    mailjet_template='300528',
    mongo_filters={
        'projects': {'$exists': True},
        'projects.networkEstimate': {'$gte': 2},
    },
    get_vars=network_plus_vars,
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
