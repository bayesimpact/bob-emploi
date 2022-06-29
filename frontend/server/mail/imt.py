"""The imt email campaign"""

import os

from typing import Any, Iterable, Mapping, Optional, Sequence

from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


_FRENCH_MONTHS = i18n.make_translatable_string(
    'janvier/février/mars/avril/mai/juin/juillet/août/septembre/octobre/novembre/décembre')
_BOB_DEPLOYMENT = os.getenv('BOB_DEPLOYMENT', 'fr')

_APPLICATION_MODES_SHORT = {
    job_pb2.SPONTANEOUS_APPLICATION: i18n.make_translatable_string('Les Candidatures Spontanées'),
    job_pb2.PLACEMENT_AGENCY: i18n.make_translatable_string('Les Intermédiaires'),
    job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS: i18n.make_translatable_string('Le Réseau'),
}

_EMPLOYMENT_TYPES_TITLE = {
    job_pb2.INTERNSHIP: i18n.make_translatable_string('Stage'),
    job_pb2.CDI: i18n.make_translatable_string('CDI'),
    job_pb2.CDD_OVER_3_MONTHS: i18n.make_translatable_string('CDD long'),
    job_pb2.CDD_LESS_EQUAL_3_MONTHS: i18n.make_translatable_string('CDD court'),
    job_pb2.INTERIM: i18n.make_translatable_string('Intérim'),
    job_pb2.ANY_CONTRACT_LESS_THAN_A_MONTH: i18n.make_translatable_string('Contrat court'),
}


def _get_months_map(months_as_string: str) -> Mapping['job_pb2.Month.V', str]:
    month_names = [
        month.title()
        for month in months_as_string.split('/')
    ]
    return {
        month: month_names[int(month) - 1]
        for month in job_pb2.Month.values()
        if month
    }


# TODO(cyrille): Use offer count instead of market stress.
def _get_best_departements_for_job_group(
        rome_id: str, database: mongo.NoPiiMongoDatabase) -> list[str]:
    """Get departements with best market stress for a job group."""

    best_departements = (
        proto.fetch_from_mongo(database, job_pb2.JobGroup, 'job_group_info', rome_id) or
        job_pb2.JobGroup()).best_departements[:2]
    return [dep.departement_id for dep in best_departements]


def _make_section(values: Optional[dict[str, str]]) -> dict[str, str]:
    return {'showSection': campaign.as_template_boolean(bool(values))} | (values or {})


def _make_market_stress_section(market_score: float) -> Optional[dict[str, str]]:
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
        project: project_pb2.Project, user_id: str,
        scoring_project: scoring.ScoringProject) -> Optional[dict[str, str]]:
    if not best_application_mode or best_application_mode.mode == job_pb2.OTHER_CHANNELS:
        return None
    application_mode_advice = ''
    if best_application_mode.mode == job_pb2.SPONTANEOUS_APPLICATION:
        application_mode_advice = 'spontaneous-application'
    elif best_application_mode.mode == job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS:
        application_mode_advice = next((
            advice.advice_id for advice in project.advices
            if advice.advice_id.startswith('network')), '')
    application_mode_link = ''
    if application_mode_advice:
        application_mode_link = campaign.get_deep_link_advice(
            user_id, project, application_mode_advice)
    return {
        'link': application_mode_link,
        'title': scoring_project.translate_static_string(
            _APPLICATION_MODES_SHORT[best_application_mode.mode]),
        'name': scoring_project.translate_static_string(
            scoring.APPLICATION_MODES[best_application_mode.mode]),
        'percent': str(round(best_application_mode.percentage)),
    }


def _make_departements_section(
        user_departement_id: str, best_departements: list[str],
        area_type: 'geo_pb2.AreaType.V', database: mongo.NoPiiMongoDatabase,
        scoring_project: scoring.ScoringProject) -> Optional[dict[str, str]]:
    if area_type < geo_pb2.COUNTRY or not best_departements:
        return None
    best_departements_title = '<br />'.join(
        geo.get_departement_name(database, dep) for dep in best_departements)
    try:
        best_departements.remove(user_departement_id)
        is_best_departement = True
    except ValueError:
        is_best_departement = False
    best_departements_sentence = scoring_project.translate_static_string(' et ').join(
        geo.get_in_a_departement_text(database, dep) for dep in best_departements)
    return {
        'count': str(len(best_departements)),
        'isInBest': campaign.as_template_boolean(is_best_departement),
        'title': best_departements_title,
        'sentence': best_departements_sentence,
    }


def _make_employment_type_section(
        employment_types: Sequence[job_pb2.EmploymentTypePercentage],
        scoring_project: scoring.ScoringProject) \
        -> Optional[dict[str, Any]]:
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
    best_employment_name = scoring_project.translate_static_string(
        jobs.EMPLOYMENT_TYPES[best_employment_type.employment_type])
    best_employment_title = scoring_project.translate_static_string(
        _EMPLOYMENT_TYPES_TITLE[best_employment_type.employment_type])
    return {
        'name': best_employment_name,
        'percent': str(round(best_employment_type.percentage)),
        'ratio': best_employment_type_ratio,
        'title': best_employment_title,
    }


def _make_months_section(
        months: Iterable['job_pb2.Month.V'],
        month_names_as_string: str) -> Optional[dict[str, str]]:
    month_names_map = _get_months_map(month_names_as_string)
    active_months = [
        month_names_map[month] for month in months if month in month_names_map]
    if not active_months:
        return None
    return {
        'activeMonths': ' - '.join(active_months),
        'onlyOneMonth': campaign.as_template_boolean(len(active_months) == 1),
    }


def _get_imt_vars(
        user: user_pb2.User, *, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, Any]:
    """Compute vars for the "IMT" email."""

    if not user.projects:
        raise scoring.NotEnoughDataException('No project yet', {'projects.0'})

    project = user.projects[0]
    scoring_project = scoring.ScoringProject(project, user, database)

    departement_id = project.city.departement_id
    rome_id = project.target_job.job_group.rome_id
    local_diagnosis = scoring_project.local_diagnosis()
    if not local_diagnosis.HasField('imt'):
        raise scoring.NotEnoughDataException(
            'User market has no IMT data',
            {f'data.local_diagnosis.{departement_id}:{rome_id}.imt'})
    imt = local_diagnosis.imt

    shown_sections = []

    if market_stress_section := _make_market_stress_section(
            imt.yearly_avg_offers_per_10_candidates):
        shown_sections.append('marketStress')

    if application_modes_section := _make_application_mode_section(
            scoring_project.get_best_application_mode(), project, user.user_id, scoring_project):
        shown_sections.append('applicationModes')

    if departements_section := _make_departements_section(
            departement_id,
            _get_best_departements_for_job_group(rome_id, database),
            project.area_type,
            database,
            scoring_project):
        shown_sections.append('departements')

    if employment_types_section := _make_employment_type_section(
            imt.employment_type_percentages, scoring_project):
        shown_sections.append('employmentTypes')

    if months_section := _make_months_section(
            imt.active_months, scoring_project.translate_static_string(_FRENCH_MONTHS)):
        shown_sections.append('months')

    if len(shown_sections) < 3:
        raise scoring.NotEnoughDataException(
            f'Not enough IMT data for this user, only {len(shown_sections)}')

    if _BOB_DEPLOYMENT == 'fr':
        imt_link = 'https://candidat.pole-emploi.fr/marche-du-travail/statistiques?' \
            f'codeMetier={project.target_job.code_ogr}&codeZoneGeographique={departement_id}&' \
            'typeZoneGeographique=DEPARTEMENT'
    elif _BOB_DEPLOYMENT == 'usa':
        imt_link = 'https://www.bls.gov/oes/current/' \
            f'oes{project.target_job.job_group.rome_id.replace("-", "")}.htm'
    else:
        imt_link = ''

    if departement_id:
        in_departement = geo.get_in_a_departement_text(
            database, departement_id,
            locale=scoring_project.user_profile.locale, city_hint=project.city)
    else:
        in_departement = scoring_project.translate_static_string('dans votre département')

    if project.target_job.name:
        of_job_name = scoring_project.populate_template('%ofJobName')
        genderized_job_name = scoring_project.populate_template('%jobName')
    else:
        of_job_name = scoring_project.translate_static_string('dans votre domaine')

        # This variable should be included in the following sentence:
        # "des personnes qui travaillent comme {{var:jobNameInDepartement}} ont décroché leur poste"
        # That'd make a weird but ok sentence and should not happened anyway as this block relies
        # on job info.
        genderized_job_name = scoring_project.translate_static_string('vous')

    job_name_in_departement = f'{genderized_job_name} {in_departement}'
    of_job_name_in_departement = f'{of_job_name} {in_departement}'

    return campaign.get_default_coaching_email_vars(user) | {
        'applicationModes': _make_section(application_modes_section),
        'departements': _make_section(departements_section),
        'employmentType': _make_section(employment_types_section),
        'imtLink': imt_link,
        'inCity': scoring_project.populate_template('%inCity'),
        'jobNameInDepartement': job_name_in_departement,
        'loginUrl': campaign.create_logged_url(user.user_id),
        'marketStress': _make_section(market_stress_section),
        'months': _make_section(months_section),
        'ofJobNameInDepartement': of_job_name_in_departement,
        'ofJobName': of_job_name,
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='imt',
    mongo_filters={
        'projects': {
            '$elemMatch': {
                'isIncomplete': {'$ne': True},
            },
        },
    },
    get_vars=_get_imt_vars,
    sender_name=i18n.make_translatable_string("Pascal et l'équipe de {{var:productName}}"),
    sender_email='pascal@bob-emploi.fr',
    is_coaching=True,
    is_big_focus=True,
))
