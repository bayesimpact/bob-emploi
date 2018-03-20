"""The imt email campaign"""

import logging

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server.asynchronous.mail import campaign


# Cache (from MongoDB) of local diagnosis.
_LOCAL_DIAGNOSIS = proto.MongoCachedCollection(job_pb2.LocalJobStats, 'local_diagnosis')

_FRENCH_MONTHS = {
    job_pb2.JANUARY: 'Janvier',
    job_pb2.FEBRUARY: 'Février',
    job_pb2.MARCH: 'Mars',
    job_pb2.APRIL: 'Avril',
    job_pb2.JUNE: 'Juin',
    job_pb2.JULY: 'Juillet',
    job_pb2.AUGUST: 'Août',
    job_pb2.SEPTEMBER: 'Septembre',
    job_pb2.OCTOBER: 'Octobre',
    job_pb2.NOVEMBER: 'Novembre',
    job_pb2.DECEMBER: 'Décembre',
}

_APPLICATION_MODES_SHORT = {
    job_pb2.SPONTANEOUS_APPLICATION: 'Les Candidatures Spontanées',
    job_pb2.PLACEMENT_AGENCY: 'Les Intermédiaires',
    job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS: 'Le Réseau',
}

_APPLICATION_MODES = {
    job_pb2.SPONTANEOUS_APPLICATION: 'une candidature spontanée',
    job_pb2.PLACEMENT_AGENCY: 'un intermédiaire du placement',
    job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS: 'leur réseau personnel ou professionnel',
}

_EMPLOYMENT_TYPES_TITLE = {
    job_pb2.INTERNSHIP: 'Stage',
    job_pb2.CDI: 'CDI',
    job_pb2.CDD_OVER_3_MONTHS: 'CDD long',
    job_pb2.CDD_LESS_EQUAL_3_MONTHS: 'CDD court',
    job_pb2.INTERIM: 'Intérim',
    job_pb2.ANY_CONTRACT_LESS_THAN_A_MONTH: 'Contrat court',
}


_EMPLOYMENT_TYPES = {
    job_pb2.INTERNSHIP: 'stage',
    job_pb2.CDI: 'CDI',
    job_pb2.CDD_OVER_3_MONTHS: 'CDD de plus de 3 mois',
    job_pb2.CDD_LESS_EQUAL_3_MONTHS: 'CDD de moins de 3 mois',
    job_pb2.INTERIM: 'intérim',
    job_pb2.ANY_CONTRACT_LESS_THAN_A_MONTH: "contrat de moins d'un mois",
}


_CACHED_BEST_DEPARTEMENTS = {}


# TODO(cyrille): Use offer count instead of market stress.
def _get_best_departements_for_job_group(rome_id, database):
    """Get departements with best market stress for a job group."""

    if rome_id in _CACHED_BEST_DEPARTEMENTS:
        return _CACHED_BEST_DEPARTEMENTS[rome_id]
    departement_market_stress = {
        key.split(':')[0]:
        diagnosis.imt.yearly_avg_offers_per_10_candidates /
        diagnosis.imt.yearly_avg_offers_denominator
        for key, diagnosis in _LOCAL_DIAGNOSIS.get_collection(database).items()
        if key.split(':')[1] == rome_id and diagnosis.imt
        and diagnosis.imt.yearly_avg_offers_per_10_candidates
        and diagnosis.imt.yearly_avg_offers_denominator
    }
    best_departements = sorted(
        departement_market_stress.keys(), key=lambda dept: departement_market_stress[dept])[:2]
    _CACHED_BEST_DEPARTEMENTS[rome_id] = best_departements
    return best_departements


def _can_go_to_arles_hotellerie_event(rome_id, mobility):
    return rome_id in ['G1502', 'G1701', 'G1703'] and (
        mobility.area_type >= geo_pb2.COUNTRY or
        mobility.city.city_id == '13004' or
        (mobility.area_type >= geo_pb2.DEPARTEMENT and mobility.city.departement_id == '13') or
        (mobility.area_type >= geo_pb2.REGION and mobility.city.region_id == '93')
    )


def _make_section(values):
    return dict({'showSection': campaign.as_template_boolean(values)}, **(values or {}))


def _make_market_stress_section(market_score):
    if not market_score:
        return None
    if market_score <= 10:
        candidates = round(10 / market_score)
        offers = 1
    else:
        offers = round(market_score / 10)
        candidates = 1
    return {
        'candidates': str(candidates),
        'offers': str(offers),
    }


def _make_application_mode_section(application_modes, advices, user_id):
    if not application_modes:
        return None
    best_application_mode = next((mode for mode in sorted(
        application_modes, key=lambda mode: -mode.percentage) if mode.mode), None)
    if not best_application_mode:
        return None
    application_mode_advice = ''
    if best_application_mode == job_pb2.SPONTANEOUS_APPLICATION:
        application_mode_advice = 'spontaneous-application'
    if best_application_mode == job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS:
        application_mode_advice = next((
            advice.advice_id for advice in advices
            if advice.advice_id.startswith('network')), '')
    application_mode_link = ''
    if application_mode_advice:
        application_mode_link = campaign.create_logged_url(
            user_id, path='/projet/0/avancer/{}'.format(application_mode_advice))
    return {
        'link': application_mode_link,
        'title': _APPLICATION_MODES_SHORT[best_application_mode.mode],
        'name': _APPLICATION_MODES[best_application_mode.mode],
        'percent': str(round(best_application_mode.percentage)),
    }


def _make_departements_section(user_departement_id, best_departements, area_type, database):
    if area_type < geo_pb2.COUNTRY or not best_departements:
        return None
    best_departements_title = '<br />'.join(
        geo.get_departement_name(database, dep) for dep in best_departements)
    try:
        best_departements.remove(user_departement_id)
        is_best_departement = True
    except ValueError:
        is_best_departement = False
    best_departements_sentence = ' et '.join(
        geo.get_in_a_departement_text(database, dep) for dep in best_departements)
    return {
        'count': str(len(best_departements)),
        'isInBest': campaign.as_template_boolean(is_best_departement),
        'title': best_departements_title,
        'sentence': best_departements_sentence,
    }


def _make_employment_type_section(employment_types):
    if not employment_types:
        return None
    best_employment_type = employment_types.pop()
    if not best_employment_type.employment_type:
        return None
    if not employment_types:
        best_employment_type_ratio = 0
    else:
        best_employment_type_ratio = round(
            best_employment_type.percentage / employment_types[-1].percentage)
    best_employment_name = _EMPLOYMENT_TYPES[best_employment_type.employment_type]
    best_employment_title = _EMPLOYMENT_TYPES_TITLE[best_employment_type.employment_type]
    return {
        'name': best_employment_name,
        'percent': str(round(best_employment_type.percentage)),
        'ratio': best_employment_type_ratio,
        'title': best_employment_title,
    }


def _make_months_section(months):
    active_months = [
        _FRENCH_MONTHS[month] for month in months if month in _FRENCH_MONTHS]
    if not active_months:
        return None
    return {
        'activeMonths': ' - '.join(active_months),
        'onlyOneMonth': campaign.as_template_boolean(len(active_months) == 1),
    }


def imt_vars(user, database):
    """Compute vars for the "IMT" email."""

    if not user.projects:
        logging.info('User has no project')
        return None
    project = user.projects[0]

    genderized_job_name = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))

    departement_id = project.mobility.city.departement_id
    rome_id = project.target_job.job_group.rome_id
    diagnosis_key = '{}:{}'.format(departement_id, rome_id)
    local_diagnosis = _LOCAL_DIAGNOSIS.get_collection(database).get(diagnosis_key)
    if not local_diagnosis:
        logging.info('User market does not exist')
        return None
    imt = local_diagnosis.imt
    if not imt:
        logging.info('User market has no IMT data')
        return None

    shown_sections = 0

    market_stress_section = _make_market_stress_section(imt.yearly_avg_offers_per_10_candidates)
    if market_stress_section:
        shown_sections += 1

    application_modes_section = _make_application_mode_section(
        campaign.get_application_modes(rome_id, database), project.advices, user.user_id)
    if application_modes_section:
        shown_sections += 1

    departements_section = _make_departements_section(
        project.mobility.city.departement_id,
        _get_best_departements_for_job_group(rome_id, database),
        project.mobility.area_type,
        database)
    if departements_section:
        shown_sections += 1

    employment_types_section = _make_employment_type_section(
        sorted(imt.employment_type_percentages, key=lambda e: e.percentage))
    if employment_types_section:
        shown_sections += 1

    months_section = _make_months_section(imt.active_months)
    if months_section:
        shown_sections += 1

    if shown_sections < 3:
        logging.info('Only %d section(s) to be shown for user.', shown_sections)
        return None

    imt_link = 'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?' + \
        'codeMetier={}&codeZoneGeographique={}&typeZoneGeographique=DEPARTEMENT'.format(
            project.target_job.code_ogr, departement_id)

    job_name_in_departement = '{} {}'.format(
        genderized_job_name,
        geo.get_in_a_departement_text(database, project.mobility.city.departement_id))

    return dict(campaign.get_default_vars(user), **{
        'applicationModes': _make_section(application_modes_section),
        'departements': _make_section(departements_section),
        'employmentType': _make_section(employment_types_section),
        'imtLink': imt_link,
        'inCity': french.in_city(project.mobility.city.name),
        'jobNameInDepartement': job_name_in_departement,
        'loginUrl': campaign.create_logged_url(user.user_id),
        'marketStress': _make_section(market_stress_section),
        'months': _make_section(months_section),
        'ofJobNameInDepartement': french.maybe_contract_prefix(
            'de ', "d'", job_name_in_departement),
        'ofJobName': french.maybe_contract_prefix('de ', "d'", genderized_job_name),
        'showPs': campaign.as_template_boolean(
            _can_go_to_arles_hotellerie_event(rome_id, project.mobility)),
        'statusUpdateUrl': campaign.get_status_update_link(user.user_id, user.profile),
    })


campaign.register_campaign('imt', campaign.Campaign(
    mailjet_template='318212',
    mongo_filters={
        'projects': {
            '$elemMatch': {
                'isIncomplete': {'$exists': False},
            },
        },
    },
    get_vars=imt_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))
