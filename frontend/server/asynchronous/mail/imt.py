"""The imt email campaign"""

import logging
from typing import Any, Dict, Iterable, List, Optional, Sequence

import pymongo

from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.asynchronous.mail import campaign


_FRENCH_MONTHS = {
    job_pb2.JANUARY: 'Janvier',
    job_pb2.FEBRUARY: 'Février',
    job_pb2.MARCH: 'Mars',
    job_pb2.APRIL: 'Avril',
    job_pb2.MAY: 'Mai',
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


# TODO(cyrille): Use offer count instead of market stress.
def _get_best_departements_for_job_group(
        rome_id: str, database: pymongo.database.Database) -> List[str]:
    """Get departements with best market stress for a job group."""

    best_departements = (
        proto.fetch_from_mongo(database, job_pb2.JobGroup, 'job_group_info', rome_id) or
        job_pb2.JobGroup()).best_departements[:2]
    return [dep.departement_id for dep in best_departements]


def _make_section(values: Optional[Dict[str, str]]) -> Dict[str, str]:
    return dict({'showSection': campaign.as_template_boolean(bool(values))}, **(values or {}))


def _make_market_stress_section(market_score: float) -> Optional[Dict[str, str]]:
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


def _make_application_mode_section(
        best_application_mode: Optional[job_pb2.ModePercentage],
        advices: Iterable[project_pb2.Advice], user_id: str) -> Optional[Dict[str, str]]:
    if not best_application_mode or best_application_mode.mode == job_pb2.OTHER_CHANNELS:
        return None
    application_mode_advice = ''
    if best_application_mode.mode == job_pb2.SPONTANEOUS_APPLICATION:
        application_mode_advice = 'spontaneous-application'
    elif best_application_mode.mode == job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS:
        application_mode_advice = next((
            advice.advice_id for advice in advices
            if advice.advice_id.startswith('network')), '')
    application_mode_link = ''
    if application_mode_advice:
        application_mode_link = campaign.create_logged_url(
            user_id, path=f'/projet/0/methode/{application_mode_advice}')
    return {
        'link': application_mode_link,
        'title': _APPLICATION_MODES_SHORT[best_application_mode.mode],
        'name': scoring.APPLICATION_MODES[best_application_mode.mode],
        'percent': str(round(best_application_mode.percentage)),
    }


def _make_departements_section(
        user_departement_id: str, best_departements: List[str],
        area_type: 'geo_pb2.AreaType', database: pymongo.database.Database) \
        -> Optional[Dict[str, str]]:
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


def _make_employment_type_section(employment_types: Sequence[job_pb2.EmploymentTypePercentage]) \
        -> Optional[Dict[str, Any]]:
    if not employment_types:
        return None
    best_employment_type = employment_types[0]
    employment_types = employment_types[1:]
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


def _make_months_section(months: Iterable['job_pb2.Month']) -> Optional[Dict[str, str]]:
    active_months = [
        _FRENCH_MONTHS[month] for month in months if month in _FRENCH_MONTHS]
    if not active_months:
        return None
    return {
        'activeMonths': ' - '.join(active_months),
        'onlyOneMonth': campaign.as_template_boolean(len(active_months) == 1),
    }


def _get_imt_vars(
        user: user_pb2.User, database: Optional[pymongo.database.Database] = None,
        **unused_kwargs: Any) -> Optional[Dict[str, Any]]:
    """Compute vars for the "IMT" email."""

    project = user.projects[0]
    assert database
    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database)

    genderized_job_name = french.lower_first_letter(french.genderize_job(
        project.target_job, user.profile.gender))

    departement_id = project.city.departement_id
    rome_id = project.target_job.job_group.rome_id
    local_diagnosis = scoring_project.local_diagnosis()
    if not local_diagnosis.HasField('imt'):
        logging.info('User market has no IMT data')
        return None
    imt = local_diagnosis.imt

    shown_sections = []

    market_stress_section = _make_market_stress_section(imt.yearly_avg_offers_per_10_candidates)
    if market_stress_section:
        shown_sections.append('marketStress')

    application_modes_section = _make_application_mode_section(
        scoring_project.get_best_application_mode(), project.advices, user.user_id)
    if application_modes_section:
        shown_sections.append('applicationModes')

    departements_section = _make_departements_section(
        departement_id,
        _get_best_departements_for_job_group(rome_id, database),
        project.area_type,
        database)
    if departements_section:
        shown_sections.append('departements')

    employment_types_section = _make_employment_type_section(imt.employment_type_percentages)
    if employment_types_section:
        shown_sections.append('employmentTypes')

    months_section = _make_months_section(imt.active_months)
    if months_section:
        shown_sections.append('months')

    if len(shown_sections) < 3:
        logging.info(
            'Only %d section(s) to be shown for user (%s).', len(shown_sections), shown_sections)
        return None

    imt_link = 'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?' \
        f'codeMetier={project.target_job.code_ogr}&codeZoneGeographique={departement_id}&' \
        'typeZoneGeographique=DEPARTEMENT'

    in_departement = geo.get_in_a_departement_text(database, departement_id)
    job_name_in_departement = f'{genderized_job_name} {in_departement}'

    return dict(campaign.get_default_coaching_email_vars(user), **{
        'applicationModes': _make_section(application_modes_section),
        'departements': _make_section(departements_section),
        'employmentType': _make_section(employment_types_section),
        'imtLink': imt_link,
        'inCity': french.in_city(project.city.name),
        'jobNameInDepartement': job_name_in_departement,
        'loginUrl': campaign.create_logged_url(user.user_id),
        'marketStress': _make_section(market_stress_section),
        'months': _make_section(months_section),
        'ofJobNameInDepartement': french.maybe_contract_prefix(
            'de ', "d'", job_name_in_departement),
        'ofJobName': french.maybe_contract_prefix('de ', "d'", genderized_job_name),
    })


campaign.register_campaign('imt', campaign.Campaign(
    mailjet_template='318212',
    mongo_filters={
        'projects': {
            '$elemMatch': {
                'isIncomplete': {'$ne': True},
            },
        },
    },
    get_vars=_get_imt_vars,
    sender_name="Pascal et l'équipe de Bob",
    sender_email='pascal@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
