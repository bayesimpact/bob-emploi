"""Common function to handle jobs."""

import logging
import os
import typing
from typing import KeysView, Mapping, Iterable, Optional, Set

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto


EMPLOYMENT_TYPES = {
    job_pb2.INTERNSHIP: i18n.make_translatable_string('stage'),
    job_pb2.CDI: i18n.make_translatable_string('CDI'),
    job_pb2.CDD_OVER_3_MONTHS: i18n.make_translatable_string('CDD de plus de 3 mois'),
    job_pb2.CDD_LESS_EQUAL_3_MONTHS: i18n.make_translatable_string('CDD de moins de 3 mois'),
    job_pb2.INTERIM: i18n.make_translatable_string('intérim'),
    job_pb2.ANY_CONTRACT_LESS_THAN_A_MONTH: i18n.make_translatable_string(
        "contrat de moins d'un mois"),
}


# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO: proto.MongoCachedCollection[job_pb2.JobGroup] = \
    proto.MongoCachedCollection(job_pb2.JobGroup, 'job_group_info')


# TODO(cyrille): Find a way to properly merge translations depending on locale.
def get_group_proto(database: mongo.NoPiiMongoDatabase, rome_id: str, locale: str = 'fr') \
        -> Optional[job_pb2.JobGroup]:
    """Get a JobGroup proto corresponding to the ROME job group ID."""

    locale_prefix = ''
    if locale:
        locale_prefix = '' if locale.startswith('fr') else f'{locale[:2]}:'
    all_job_groups = _JOB_GROUPS_INFO.get_collection(database)
    translated = all_job_groups.get(f'{locale_prefix}{rome_id}')
    if translated:
        return translated
    if locale_prefix:
        logging.warning('Missing a localized job group in %s: %s', locale, rome_id)
    return all_job_groups.get(rome_id)


def get_all_job_group_ids(database: mongo.NoPiiMongoDatabase) -> KeysView[str]:
    """Get the ID of all job groups."""

    return _JOB_GROUPS_INFO.get_collection(database).keys()


_TEMP_JOB_CONTRACTS = {
    job_pb2.CDD_LESS_EQUAL_3_MONTHS,
    job_pb2.INTERIM,
}


def _is_mostly_temp_job(job_group: job_pb2.JobGroup) -> bool:
    total_temp = sum(
        contract.percent_suggested
        for contract in job_group.requirements.contract_types
        if contract.contract_type in _TEMP_JOB_CONTRACTS
    )
    return total_temp > 55


def get_all_good_job_group_ids(
        database: mongo.NoPiiMongoDatabase, *, automation_risk_threshold: int = 85,
        unknown_risk_value: int = 0) -> Set[str]:
    """Get the ID of all "good" job groups.

    Good jobs are the ones that we (Bayes) think can make a good career or at least a good first
    step. The conditions are:
     - job automation risk unknown or less than 85%
     - more than 50% of jobs are in less than 3-months CDD
    """

    # TODO(pascal): Improve this heuristic.
    are_all_jobs_good = os.getenv('BOB_DEPLOYMENT', 'fr') == 't_pro'
    has_any_covid_risk_info = has_covid_risk_info(database)
    return {
        rome_id
        for rome_id, job_group in _JOB_GROUPS_INFO.get_collection(database).items()
        if are_all_jobs_good or (
            (job_group.automation_risk or unknown_risk_value) < automation_risk_threshold and
            not _is_mostly_temp_job(job_group) and
            (job_group.covid_risk != job_pb2.COVID_RISKY or not has_any_covid_risk_info))
    }


# TODO(cyrille): Localize for sector descriptions.
@cache.lru(maxsize=10)
def get_best_jobs_in_area(
        database: mongo.NoPiiMongoDatabase, area_id: str) -> job_pb2.BestJobsInArea:
    """Get the best jobs in an area."""

    return proto.create_from_mongo(
        database.best_jobs_in_area.find_one({'_id': area_id}),
        job_pb2.BestJobsInArea)


@cache.lru()
def has_covid_risk_info(database: mongo.NoPiiMongoDatabase) -> bool:
    """Check whether any job group has Covid-risk information."""

    return any(
        bool(job_group.covid_risk)
        for job_group in _JOB_GROUPS_INFO.get_collection(database).values()
    )


@cache.lru()
def has_automation_risk_info(database: mongo.NoPiiMongoDatabase) -> bool:
    """Check whether any job group has automation-risk information."""

    return any(
        job_group.automation_risk > 0
        for job_group in _JOB_GROUPS_INFO.get_collection(database).values()
    )


def get_job_proto(database: mongo.NoPiiMongoDatabase, job_id: str, rome_id: str) \
        -> Optional[job_pb2.Job]:
    """Get a Job proto corresponding to the job ID if it is found in the ROME job group."""

    job_group = get_group_proto(database, rome_id)
    if not job_group or not job_id:
        return None

    for job_proto in job_group.jobs:
        if job_proto.code_ogr == job_id:
            job = job_pb2.Job()
            job.CopyFrom(job_proto)
            job.job_group.rome_id = job_group.rome_id
            job.job_group.name = job_group.name
            return job

    return None


def get_local_stats(database: mongo.NoPiiMongoDatabase, departement_id: str, rome_id: str) \
        -> job_pb2.LocalJobStats:
    """Get a LocalJobStats proto corresponding to the local ID (departement + ROME)."""

    if not departement_id or not rome_id:
        return job_pb2.LocalJobStats()
    local_id = f'{departement_id}:{rome_id}'
    local_stats = proto.fetch_from_mongo(
        database, job_pb2.LocalJobStats, 'local_diagnosis', local_id) or job_pb2.LocalJobStats()
    recent_job_offers = proto.fetch_from_mongo(
        database, job_pb2.LocalJobStats, 'recent_job_offers', local_id) or job_pb2.LocalJobStats()
    local_stats.MergeFrom(recent_job_offers)
    return local_stats


class _SuperGroup(typing.NamedTuple):
    name: str
    prefixes: Set[str]


# TODO(pascal): Import from Airtable.
_SUPER_GROUPS = [
    _SuperGroup(
        i18n.make_translatable_string('Secrétariat'),
        {'M1602', 'M1606', 'M1607', 'M1608'}),
    _SuperGroup(
        i18n.make_translatable_string('Nettoyage'),
        {'K2204', 'K2303', 'G1501'}),
    _SuperGroup(
        i18n.make_translatable_string('Relations internationales'),
        {'K140101', 'K140401'}),
    _SuperGroup(
        i18n.make_translatable_string('Enseignement et recherche'),
        {'K21', 'K24'}),
    _SuperGroup(
        i18n.make_translatable_string('Hôtellerie, restauration et cafés'),
        {'G1502', 'G1702'}),
    _SuperGroup(
        i18n.make_translatable_string('Art et spectacle'),
        {'B', 'L'}),
    _SuperGroup(
        i18n.make_translatable_string('Manutention'),
        {'N1103', 'N1104', 'N1105'}),
    _SuperGroup(
        i18n.make_translatable_string('Communication et médias'),
        {'E1103', 'E1106'}),
    _SuperGroup(
        i18n.make_translatable_string('Vente'),
        {'D1106', 'D1211', 'D1212', 'D1213', 'D1214', 'D1507', 'D1505'}),
]


def _group_by_prefix(super_groups: Iterable[_SuperGroup]) -> Mapping[str, str]:
    super_groups_by_prefix: dict[str, str] = {}
    for group in super_groups:
        for prefix in group.prefixes:
            for i in range(len(prefix)):
                if prefix[:-i] in super_groups_by_prefix:
                    raise ValueError(f'Conflict in super groups for {prefix} and {prefix[:-i]}')
            for existing_prefix in super_groups_by_prefix:
                if existing_prefix.startswith(prefix):
                    raise ValueError(f'Conflict in super groups for {prefix} and {existing_prefix}')
            super_groups_by_prefix[prefix] = group.name
    return super_groups_by_prefix


_SUPER_GROUPS_BY_PREFIX = _group_by_prefix(_SUPER_GROUPS)


def upgrade_to_super_group(
        rome_id: str,
        super_groups: Optional[Mapping[str, str]] = None,
) -> Optional[str]:
    """Get a super_group name for a given job group ID if it exists."""

    if super_groups is None:
        super_groups = _SUPER_GROUPS_BY_PREFIX

    for i in range(len(rome_id)):
        try:
            return super_groups[rome_id[:-i] if i else rome_id]
        except KeyError:
            pass
    return None
