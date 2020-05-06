"""Common function to handle jobs."""

import typing
from typing import Mapping, Optional, Set

import pymongo

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import proto


# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO: proto.MongoCachedCollection[job_pb2.JobGroup] = \
    proto.MongoCachedCollection(job_pb2.JobGroup, 'job_group_info')


def get_group_proto(database: pymongo.database.Database, rome_id: str, locale: str = 'fr') \
        -> Optional[job_pb2.JobGroup]:
    """Get a JobGroup proto corresponding to the ROME job group ID."""

    locale_prefix = ''
    if locale:
        locale_prefix = '' if locale.startswith('fr') else f'{locale[:2]}:'
    return _JOB_GROUPS_INFO.get_collection(database).get(f'{locale_prefix}{rome_id}')


def get_job_proto(database: pymongo.database.Database, job_id: str, rome_id: str) \
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


def get_local_stats(database: pymongo.database.Database, departement_id: str, rome_id: str) \
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
        {'K140101', 'K140401', 'K240101'}),
    _SuperGroup(
        i18n.make_translatable_string('Enseignement et recherche'),
        {'K21', 'K24'}),
    _SuperGroup(
        i18n.make_translatable_string('Hôtellerie, restauraration et cafés'),
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


# TODO(pascal): Make sure that there are no conflicts (a job in several super groups).
_SUPER_GROUPS_BY_PREFIX = {
    prefix: group.name
    for group in _SUPER_GROUPS
    for prefix in group.prefixes
}


def upgrade_to_super_group(
        rome_id: str,
        super_groups: Mapping[str, str] = _SUPER_GROUPS_BY_PREFIX,
) -> Optional[str]:
    """Get a super_group name for a given job group ID if it exists."""

    for i in range(len(rome_id)):
        try:
            return super_groups[rome_id[:-i] if i else rome_id]
        except KeyError:
            pass
    return None
