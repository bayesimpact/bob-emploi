"""Template vars definitions."""

import logging
from typing import Callable
from urllib import parse

import unidecode

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import scoring_base


# This is to be put in a sentence related to several people:
# "Les gens trouvent surtout un emploi grâce à ..."
APPLICATION_MODES = {
    job_pb2.SPONTANEOUS_APPLICATION: i18n.make_translatable_string(
        'une candidature spontanée'),
    job_pb2.PLACEMENT_AGENCY: i18n.make_translatable_string(
        'un intermédiaire du placement'),
    job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS: i18n.make_translatable_string(
        'leur réseau personnel ou professionnel'),
}

_EXPERIENCE_DURATION_AGO = {
    project_pb2.INTERN: i18n.make_translatable_string('il y a peu de temps'),
    project_pb2.JUNIOR: i18n.make_translatable_string('il y a peu de temps'),
    project_pb2.INTERMEDIARY: i18n.make_translatable_string('il y a plus de 2 ans'),
    project_pb2.SENIOR: i18n.make_translatable_string('il y a plus de 6 ans'),
    project_pb2.EXPERT: i18n.make_translatable_string('il y a plus de 10 ans'),
}

_EXPERIENCE_DURATION = {
    project_pb2.INTERN: 'peu',
    project_pb2.JUNIOR: 'peu',
    project_pb2.INTERMEDIARY: 'plus de 2 ans',
    project_pb2.SENIOR: 'plus de 6 ans',
    project_pb2.EXPERT: 'plus de 10 ans',
}


def _a_job_name(scoring_project: scoring_base.ScoringProject) -> str:
    return scoring_project.translate_static_string(
        'un·e {job_name}', is_genderized=True,
    ).format(job_name=_job_name(scoring_project))


def _an_application_mode(scoring_project: scoring_base.ScoringProject) -> str:
    best_mode = scoring_project.get_best_application_mode()
    best_mode_enum = best_mode.mode if best_mode else job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS
    try:
        application_mode_in_french = APPLICATION_MODES[best_mode_enum]
    except KeyError:
        application_mode_in_french = APPLICATION_MODES[job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS]
    return scoring_project.translate_static_string(application_mode_in_french)


def _in_city(scoring_project: scoring_base.ScoringProject) -> str:
    translated = scoring_project.translate_static_string(
        'à {city_name}', is_genderized=False,
    ).format(city_name=scoring_project.details.city.name)
    if translated.startswith('à '):
        # This is probably French, let's use a specific rule.
        return french.in_city(scoring_project.details.city.name)
    return translated


def _of_city(scoring_project: scoring_base.ScoringProject) -> str:
    translated = scoring_project.translate_static_string(
        'de {city_name}', is_genderized=False,
    ).format(city_name=scoring_project.details.city.name)
    if translated.startswith('de '):
        # This is probably French, let's use a specific rule.
        return french.of_city(scoring_project.details.city.name)
    return translated


def _in_region(scoring_project: scoring_base.ScoringProject) -> str:
    region = scoring_project.get_region()
    if not region or not region.name:
        return scoring_project.translate_static_string('dans la région')
    if not region.prefix:
        return scoring_project.translate_static_string('en {region_name}')\
            .format(region_name=region.name)
    return region.prefix + region.name


def _in_departement(scoring_project: scoring_base.ScoringProject) -> str:
    try:
        return geo.get_in_a_departement_text(
            scoring_project.database,
            scoring_project.details.city.departement_id,
            scoring_project.details.city)
    except KeyError:
        return scoring_project.translate_static_string('dans le département')


def _in_area_type(scoring_project: scoring_base.ScoringProject) -> str:
    area_type = scoring_project.details.area_type
    if area_type == geo_pb2.CITY:
        return _in_city(scoring_project)
    if area_type == geo_pb2.DEPARTEMENT:
        return _in_departement(scoring_project)
    if area_type == geo_pb2.REGION:
        return _in_region(scoring_project)
    return scoring_project.translate_static_string('dans le pays')


def _job_name(scoring_project: scoring_base.ScoringProject) -> str:
    return french.genderize_job(
        scoring_project.details.target_job, scoring_project.user_profile.gender, is_lowercased=True)


# Dynamic strings that are never used but here to help pybabel to extract those keys as strings to
# translate.
_DYNAMIC_STRINGS = (
    i18n.make_translatable_string_with_context('1', 'AS_TEXT'),
    i18n.make_translatable_string_with_context('2', 'AS_TEXT'),
    i18n.make_translatable_string_with_context('3', 'AS_TEXT'),
    i18n.make_translatable_string_with_context('4', 'AS_TEXT'),
    i18n.make_translatable_string_with_context('5', 'AS_TEXT'),
)


def _job_search_length_months_at_creation(scoring_project: scoring_base.ScoringProject) -> str:
    count = round(scoring_project.get_search_length_at_creation())
    if count < 0:
        logging.warning(
            'Trying to show negative job search length at creation:\n%s', str(scoring_project))
        return scoring_project.translate_static_string('quelques')
    count_as_str = scoring_project.translate_static_string(
        str(count), context='AS_TEXT', can_log_exception=False)
    if count_as_str == str(count):
        return scoring_project.translate_static_string('quelques')
    return count_as_str


def _a_required_diploma(scoring_project: scoring_base.ScoringProject) -> str:
    diplomas = ', '.join(
        sorted(diploma.name for diploma in scoring_project.requirements().diplomas))
    if not diplomas:
        logging.warning(
            'Trying to show required diplomas when there are none.\n%s', str(scoring_project))
        return 'un diplôme'
    return f'un {diplomas} ou équivalent'


def _postcode(scoring_project: scoring_base.ScoringProject) -> str:
    city = scoring_project.details.city
    return city.postcodes.split('-')[0] or (
        city.departement_id + '0' * (5 - len(city.departement_id)))


def _what_i_love_about(project: scoring_base.ScoringProject) -> str:
    return project.user_profile.gender == user_pb2.FEMININE and \
        project.job_group_info().what_i_love_about_feminine or \
        project.job_group_info().what_i_love_about


def _url_encode(name: str) -> Callable[[scoring_base.ScoringProject], str]:
    def _wrapped(project: scoring_base.ScoringProject) -> str:
        return parse.quote(project._get_template_variable(name))  # pylint: disable=protected-access
    return _wrapped


def _of_job_name(project: scoring_base.ScoringProject) -> str:
    translated = project.translate_static_string('de {job_name}')\
        .format(job_name=_job_name(project))
    if translated.startswith('de '):
        return french.maybe_contract_prefix('de ', "d'", _job_name(project))
    return translated


scoring_base.register_template_variable(
    '%aJobName', _a_job_name)
# This is a comma separated list of diplomas. Make sure before-hand that there's at least one.
# Can be used as "nécessite %aRequiredDiploma".
# TODO(cyrille): Make it smarter, especially when it's a list of Bac+N levels.
scoring_base.register_template_variable(
    '%aRequiredDiploma', _a_required_diploma)
scoring_base.register_template_variable(
    '%anApplicationMode', _an_application_mode)
scoring_base.register_template_variable(
    '%cityId',
    lambda scoring_project: scoring_project.details.city.city_id)
# TODO(pascal): Investigate who's using that template and rename it to someting with URL in it.
scoring_base.register_template_variable(
    '%cityName', lambda scoring_project: parse.quote(scoring_project.details.city.name))
scoring_base.register_template_variable(
    '%departementId',
    lambda scoring_project: scoring_project.details.city.departement_id)
scoring_base.register_template_variable(
    '%eFeminine',
    lambda scoring_project: (
        'e' if scoring_project.user_profile.gender == user_pb2.FEMININE else ''))
scoring_base.register_template_variable(
    '%expDurationAgo',
    lambda scoring_project: scoring_project.translate_static_string(
        _EXPERIENCE_DURATION_AGO.get(scoring_project.details.seniority, '')))
# TODO(cyrille): Drop in favor of %expDurationAgo.
scoring_base.register_template_variable(
    '%experienceDuration',
    lambda scoring_project: _EXPERIENCE_DURATION.get(
        scoring_project.details.seniority, ''))
scoring_base.register_template_variable(
    '%feminineJobName',
    lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.feminine_name))
scoring_base.register_template_variable(
    '%gender',
    lambda scoring_project: user_pb2.Gender.Name(scoring_project.user_profile.gender))
scoring_base.register_template_variable(
    '%inAreaType', _in_area_type)
scoring_base.register_template_variable(
    '%inAWorkplace', lambda scoring_project: scoring_project.job_group_info().in_a_workplace)
scoring_base.register_template_variable(
    '%inCity', _in_city)
scoring_base.register_template_variable(
    '%inDepartement', _in_departement)
scoring_base.register_template_variable(
    '%inDomain', lambda scoring_project: scoring_project.job_group_info().in_domain)
scoring_base.register_template_variable(
    '%inRegion', _in_region)
# TODO(pascal): Don't use Url as a prefix, as this makes %jobGroupName forbidden (no variable
# can be the prefix of another variable).
scoring_base.register_template_variable(
    '%jobGroupNameUrl',
    lambda scoring_project: parse.quote(unidecode.unidecode(
        scoring_project.details.target_job.job_group.name.lower().replace(' ', '-').replace(
            "'", '-'))))
scoring_base.register_template_variable(
    '%jobId', lambda scoring_project: scoring_project.details.target_job.code_ogr)
scoring_base.register_template_variable(
    '%jobName', _job_name)
# This in only the **number** of months, use as '%jobSearchLengthMonthsAtCreation mois'.
scoring_base.register_template_variable(
    '%jobSearchLengthMonthsAtCreation', _job_search_length_months_at_creation)
scoring_base.register_template_variable(
    '%language', lambda scoring_project: scoring_project.user_profile.locale[:2] or 'fr')
scoring_base.register_template_variable(
    '%latin1CityName',
    lambda scoring_project: parse.quote(
        scoring_project.details.city.name.encode('latin-1', 'replace')))
scoring_base.register_template_variable(
    '%latin1MasculineJobName',
    lambda scoring_project: parse.quote(
        scoring_project.details.target_job.masculine_name.encode('latin-1', 'replace')))
scoring_base.register_template_variable(
    '%lastName', lambda scoring_project: scoring_project.user_profile.last_name)
scoring_base.register_template_variable(
    '%likeYourWorkplace',
    lambda scoring_project: scoring_project.job_group_info().like_your_workplace)
scoring_base.register_template_variable(
    '%masculineJobName',
    lambda scoring_project: french.lower_first_letter(
        scoring_project.details.target_job.masculine_name))
scoring_base.register_template_variable(
    '%name', lambda scoring_project: scoring_project.user_profile.name)
scoring_base.register_template_variable(
    '%ofCity', _of_city)
scoring_base.register_template_variable(
    '%ofJobName', _of_job_name)
scoring_base.register_template_variable(
    '%placePlural', lambda scoring_project: scoring_project.job_group_info().place_plural)
scoring_base.register_template_variable(
    '%postcode', _postcode)
scoring_base.register_template_variable(
    '%regionId', lambda scoring_project: scoring_project.details.city.region_id)
scoring_base.register_template_variable(
    '%romeId', lambda scoring_project: scoring_project.details.target_job.job_group.rome_id)
scoring_base.register_template_variable(
    '%totalInterviewCount',
    lambda scoring_project: scoring_project.translate_static_string(
        str(scoring_project.details.total_interview_count), context='AS_TEXT'))
scoring_base.register_template_variable(
    '%urlEncodeJobName', _url_encode('%jobName'))
scoring_base.register_template_variable(
    '%whatILoveAbout', _what_i_love_about)
