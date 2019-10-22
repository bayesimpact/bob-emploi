"""Importer for general job groups info.

This script gathers information from job offers and uploads to MongoDB some
requirements per job group.

It does not use pandas as we want to be able to swallow a very large file (13
Gb) that would not fit in memory. To do that we compute data on the fly.

You can try it out on a local instance if you have a job offers file:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/job_offers_requirements.py \
        --job_offers_csv data/job_offers/sample_10perc.csv \
        --colnames_txt data/job_offers/column_names.txt \
        --to_json data/job_offers/job_offers_requirements.json
"""

import collections
import enum
import itertools
import logging
import typing
from typing import Any, Dict, Iterator, List, Optional, Tuple

import tqdm

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import job_offers
from bob_emploi.data_analysis.lib import mongo

# Total number of job offers that we have in our "standard" input.
_TOTAL_RECORDS = 11170764

# Minimum ratio of job offers for a driving license to be considered as a
# suggestion for the whole job group.
_FILTER_DRIVING_LICENSE_RATIO = .05

# Minimum ratio of job offers for a desktop tool to be considered as a
# suggestion for the whole job group.
_FILTER_DESKTOP_TOOLS_RATIO = .05

# Minimum ratio of job offers for a job to be mentionned in the requirements.
_FILTER_JOB_RATIO = .01

# Job offer fields required by this script.
_REQUIRED_FIELDS = frozenset([
    'contract_duration',
    'contract_dur_unit_code',
    'contract_type_code',
    'degree_subject_area_code_1',
    'degree_subject_area_code_2',
    'degree_subject_area_name_1',
    'degree_subject_area_name_2',
    'degree_type_code_1',
    'degree_type_code_2',
    'degree_type_name_1',
    'degree_type_name_2',
    'desktop_tools_lev_code_1',
    'desktop_tools_lev_code_2',
    'desktop_tools_lev_name_1',
    'desktop_tools_lev_name_2',
    'desktop_tools_name_1',
    'desktop_tools_name_2',
    'driving_lic_name_1',
    'driving_lic_name_2',
    'rome_profession_card_code',
    'rome_profession_code',
])

# Type of driving license types. List pulled from
# http://go/pe:notebooks/datasets/job_postings.ipynb
_DRIVING_LICENSE_TYPES = {
    'A': job_pb2.MOTORCYCLE,
    'A1': job_pb2.MOTORCYCLE,
    'A2': job_pb2.MOTORCYCLE,
    'B': job_pb2.CAR,
    'B1': job_pb2.CAR,
    'B79': job_pb2.CAR,
    'B96': job_pb2.CAR,
    'C': job_pb2.TRUCK,
    'C1': job_pb2.TRUCK,
    'C1E': job_pb2.TRUCK,
    'CE': job_pb2.TRUCK,
}


class _DiplomaRequirement(typing.NamedTuple):
    is_required: bool
    name: str
    degree: 'job_pb2.DegreeLevel'


class _ProxyFields(object):
    """A proxy class that updates field names on the fly.

    Let's say you have an object o with fields: o.foo_bar, o.foo_bla,
    o.foo_raw; then you can use _ProxyFields(o, prefix='foo_') to access things
    in a more readable manner: p.bar, p.bla, p.raw. Note that fields that are
    not prefixed by foo_ won't be accessible through the proxy.
    """

    def __init__(self, target: Any, prefix: str = '', suffix: str = '') -> None:
        self._target = target
        self._prefix = prefix
        self._suffix = suffix

    def __getattr__(self, field: str) -> Any:
        return getattr(self._target, self._prefix + field + self._suffix)


def _diploma_name(job_offer_diploma: _ProxyFields) -> Optional[str]:
    """Compute the diploma name.

    Check http://go/pe:notebooks/datasets/job_postings.ipynb for the rationale.

    type_name is the type of diploma (e.g. bachelor, master), and
    subject_area_name is the domain of the diploma (e.g. mathematics, biology).
    """

    if (not job_offer_diploma.type_code or
            job_offer_diploma.type_code == 'NULL'):
        return None
    name = typing.cast(str, job_offer_diploma.type_name)
    if name.endswith(' ou équivalent'):
        name = name[:-len(' ou équivalent')]
    return name


def _employment_type(job_offer: 'job_offers._JobOffer') -> job_pb2.EmploymentType:
    """Compute the employment type of the job offer."""

    if job_offer.contract_type_code == 'CDI':
        return job_pb2.CDI
    if job_offer.contract_type_code == 'MIS':
        return job_pb2.INTERIM
    if job_offer.contract_duration is None:
        return job_pb2.CDD_LESS_EQUAL_3_MONTHS
    duration = int(job_offer.contract_duration)
    if job_offer.contract_dur_unit_code == 'MO':
        duration *= 30
    if duration > 30 * 3:
        return job_pb2.CDD_OVER_3_MONTHS
    return job_pb2.CDD_LESS_EQUAL_3_MONTHS


_DIPLOMA_TO_DEGREE = {
    'Aucune formation scolaire': job_pb2.NO_DEGREE,
    'Primaire à 4ème': job_pb2.NO_DEGREE,
    '4ème achevée': job_pb2.NO_DEGREE,
    'BEPC ou 3ème achevée': job_pb2.CAP_BEP,
    '2nd ou 1ère achevée': job_pb2.CAP_BEP,
    'CAP, BEP': job_pb2.CAP_BEP,
    'Bac': job_pb2.BAC_BACPRO,
    'Bac+2': job_pb2.BTS_DUT_DEUG,
    'Bac+3, Bac+4': job_pb2.LICENCE_MAITRISE,
    'Bac+5 et plus': job_pb2.DEA_DESS_MASTER_PHD,
}


_DEGREE_TO_DIPLOMA = {
    job_pb2.NO_DEGREE: 'Aucune formation scolaire',
    job_pb2.CAP_BEP: 'CAP, BEP',
    job_pb2.BAC_BACPRO: 'Bac',
    job_pb2.BTS_DUT_DEUG: 'Bac+2',
    job_pb2.LICENCE_MAITRISE: 'Bac+3, Bac+4',
    job_pb2.DEA_DESS_MASTER_PHD: 'Bac+5 et plus',
}


def _get_degree_from_diploma(job_offer_diploma: _ProxyFields) -> job_pb2.DegreeLevel:
    """Get the degree of a diploma by its name in Pôle emploi job offers dataset."""

    name = _diploma_name(job_offer_diploma)
    if not name:
        return job_pb2.UNKNOWN_DEGREE

    degree = _DIPLOMA_TO_DEGREE.get(name)
    if degree:
        return degree
    logging.warning('Unknown diploma: %s', name)
    return job_pb2.UNKNOWN_DEGREE


def list_diplomas(job_offer: 'job_offers._JobOffer') -> Iterator[_DiplomaRequirement]:
    """List all diploma requirements for this job offer."""

    diploma_1 = _ProxyFields(job_offer, 'degree_', '_1')
    diploma_name_1 = _diploma_name(diploma_1)
    dip_req_1: Optional[_DiplomaRequirement] = _DiplomaRequirement(
        diploma_1.required_code == 'E',
        diploma_name_1,
        _get_degree_from_diploma(diploma_1)) if diploma_name_1 else None
    diploma_2 = _ProxyFields(job_offer, 'degree_', '_2')
    diploma_name_2 = _diploma_name(diploma_2)
    dip_req_2: Optional[_DiplomaRequirement] = _DiplomaRequirement(
        diploma_2.required_code == 'E',
        diploma_name_2,
        _get_degree_from_diploma(diploma_2)) if diploma_name_2 else None

    if not (dip_req_1 or dip_req_2):
        # No diploma requirements: we consider it's unknown.
        return

    best_suggestion: _DiplomaRequirement = typing.cast(_DiplomaRequirement, dip_req_1 or dip_req_2)
    if dip_req_2 and best_suggestion.degree < dip_req_2.degree:
        best_suggestion = dip_req_2
    best_suggestion = _DiplomaRequirement(False, best_suggestion.name, best_suggestion.degree)

    if dip_req_1 and dip_req_1.is_required:
        best_requirement = dip_req_1
    else:
        best_requirement = _DiplomaRequirement(True, 'Aucune formation scolaire', job_pb2.NO_DEGREE)

    if dip_req_2 and dip_req_2.is_required and dip_req_2.degree > best_requirement.degree:
        best_requirement = dip_req_2

    yield best_suggestion
    yield best_requirement


class _RequirementKind(enum.Enum):
    diplomas = 1
    driving_licenses = 2
    desktop_tools = 3
    contract_type = 4
    job = 5


class _RequirementsCollector(object):

    def __init__(self) -> None:
        self.num_offers = 0
        self.suggestions: Dict[_RequirementKind, Dict[Any, int]] = \
            collections.defaultdict(lambda: collections.defaultdict(int))
        self.requirements: Dict[_RequirementKind, Dict[Any, int]] = \
            collections.defaultdict(lambda: collections.defaultdict(int))

    def collect(self, job_offer: 'job_offers._JobOffer') -> None:
        """Collect requirements from a job offer."""

        self.num_offers += 1
        self._collect_diploma(job_offer)
        self._collect_driving_license(job_offer)
        self._collect_desktop_tools(job_offer)
        self._collect_employment_type(job_offer)
        self._collect_job(job_offer)
        # TODO(pascal): Also collect lang.

    def _add_suggestion(self, kind: _RequirementKind, name: Any, required: bool = False) -> None:
        """Collect a suggestion."""

        self.suggestions[kind][name] += 1
        if required:
            self.requirements[kind][name] += 1

    def _get_sorted_requirements(self, kind: _RequirementKind, threshold: float) \
            -> Iterator[Tuple[Any, int, int]]:
        """Get requirements sorted by most frequent first.

        Args:
            kind: the kind of requirements to get.
            threshold: the minimum count of suggestions to be considered a
                requirement.

        Yields:
            a tuple with: the name of the requirement, the count of suggestions
            with this name and the percentage of those suggestions that were
            required (floored to 1%).
        """

        for name, count in sorted(
                self.suggestions[kind].items(),
                key=lambda kv: (-kv[1], kv[0])):
            if count < threshold:
                # As count is sorted, all the following counts are too small as
                # well.
                return
            required_count = self.requirements[kind][name]
            yield name, count, max(1, round(100 * required_count / count))

    def _collect_diploma(self, job_offer: 'job_offers._JobOffer') -> None:
        kind = _RequirementKind.diplomas
        for is_required, name, degree in list_diplomas(job_offer):
            if is_required:
                self.requirements[kind][(name, degree)] += 1
            else:
                self.suggestions[kind][(name, degree)] += 1

    def _collect_driving_license(self, job_offer: 'job_offers._JobOffer') -> None:
        kind = _RequirementKind.driving_licenses
        if not job_offer.driving_lic_code_1 or job_offer.driving_lic_code_1 == 'NULL':
            return

        license_1 = _DRIVING_LICENSE_TYPES.get(
            job_offer.driving_lic_code_1, job_pb2.UNKNOWN_DRIVING_LICENSE)
        self._add_suggestion(
            kind, job_pb2.DrivingLicense.Name(license_1),
            required=job_offer.driving_lic_req_code_1 == 'E')

        if not job_offer.driving_lic_code_2 or job_offer.driving_lic_code_2 == 'NULL':
            return

        license_2 = _DRIVING_LICENSE_TYPES.get(
            job_offer.driving_lic_code_2, job_pb2.UNKNOWN_DRIVING_LICENSE)
        if license_1 != license_2:
            self._add_suggestion(
                kind, job_pb2.DrivingLicense.Name(license_2),
                required=job_offer.driving_lic_req_code_2 == 'E')

    def _collect_desktop_tools(self, job_offer: 'job_offers._JobOffer') -> None:
        kind = _RequirementKind.desktop_tools
        tools_1 = job_offer.desktop_tools_name_1
        tools_2 = job_offer.desktop_tools_name_2
        if (not tools_1 or not tools_1.startswith('T') or not job_offer.desktop_tools_lev_code_1 or
                job_offer.desktop_tools_lev_code_1 == 'NULL'):
            return
        best_level = job_offer.desktop_tools_lev_name_1
        if (tools_2 and tools_2.startswith('T') and tools_2 != tools_1 and
                job_offer.desktop_tools_lev_code_2 and
                job_offer.desktop_tools_lev_code_2 != 'NULL' and
                int(job_offer.desktop_tools_lev_code_1) <
                int(job_offer.desktop_tools_lev_code_2)):
            best_level = job_offer.desktop_tools_lev_name_2

        self._add_suggestion(kind, 2)
        if best_level == 'Utilisation experte':
            self._add_suggestion(kind, 3)

    def _collect_employment_type(self, job_offer: 'job_offers._JobOffer') -> None:
        kind = _RequirementKind.contract_type
        self._add_suggestion(kind, _employment_type(job_offer))

    def _collect_job(self, job_offer: 'job_offers._JobOffer') -> None:
        kind = _RequirementKind.job
        if job_offer.rome_profession_code is None:
            return
        self._add_suggestion(kind, str(int(job_offer.rome_profession_code)))

    def get_proto_dict(self) -> Dict[str, List[Any]]:
        """Gets the requirements collected as a proto compatible dict.

        Returns:
            A dict compatible with the JSON version of the JobGroup
            protobuffer.
        """

        return {
            'diplomas': list(self._get_diplomas()),
            'drivingLicenses': list(
                self._get_driving_licenses(
                    _FILTER_DRIVING_LICENSE_RATIO * self.num_offers)),
            'officeSkills': list(itertools.chain(
                self._get_desktop_tools(
                    _FILTER_DESKTOP_TOOLS_RATIO * self.num_offers),
            )),
            'contractTypes': list(self._get_contract_types()),
            'specificJobs': list(self._get_jobs(_FILTER_JOB_RATIO * self.num_offers)),
        }

    def _get_diplomas(self) -> Iterator[Dict[str, Any]]:
        kind = _RequirementKind.diplomas
        levels: Dict[job_pb2.DegreeLevel, Dict[str, int]] = \
            collections.defaultdict(lambda: collections.defaultdict(int))

        num_suggestions = sum(self.suggestions[kind].values())
        for name_and_level, count in self.suggestions[kind].items():
            percent_suggested = round(100 * count / num_suggestions)
            if percent_suggested:
                levels[name_and_level[1]]['percentSuggested'] += percent_suggested

        num_requirements = sum(self.requirements[kind].values())
        for name_and_level, count in self.requirements[kind].items():
            percent_required = round(100 * count / num_requirements)
            if percent_required:
                levels[name_and_level[1]]['percentRequired'] += percent_required

        for level, counts in sorted(levels.items()):
            if not level or level == job_pb2.NO_DEGREE:
                continue
            yield dict(
                counts,
                name=_DEGREE_TO_DIPLOMA[level],
                diploma={'level': job_pb2.DegreeLevel.Name(level)})

    def _get_driving_licenses(self, count_threshold: float) -> Iterator[Dict[str, Any]]:
        # Sort by descending count, then ascending licence name.
        licenses = self._get_sorted_requirements(
            _RequirementKind.driving_licenses, count_threshold)
        for license_name, count, percent_required in licenses:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'percentRequired': percent_required,
                'drivingLicense': license_name,
            }

    def _get_desktop_tools(self, count_threshold: float) -> Iterator[Dict[str, Any]]:
        # Sort by descending count, then ascending license name.
        tools = self._get_sorted_requirements(
            _RequirementKind.desktop_tools, count_threshold)
        for level, count, unused_percent_required in tools:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'officeSkillsLevel': level,
            }

    def _get_contract_types(self) -> Iterator[Dict[str, Any]]:
        contract_types = self._get_sorted_requirements(
            _RequirementKind.contract_type, 0)
        for contract_type, count, unused_percent_required in contract_types:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'percentRequired': 100,
                'contractType': job_pb2.EmploymentType.Name(contract_type),
            }

    def _get_jobs(self, count_threshold: float) -> Iterator[Dict[str, Any]]:
        jobs = self._get_sorted_requirements(_RequirementKind.job, count_threshold)
        for job_id, count, unused_percent_required in jobs:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'codeOgr': job_id,
            }


def csv2dicts(job_offers_csv: str, colnames_txt: str) -> List[Dict[str, Any]]:
    """Import the requirement from job offers grouped by Job Group in MongoDB.

    Args:
        job_offers_csv: Path of the csv containing the data.
        colnames_txt: Path to a file containing the name of the CSV's columns.
    Returns:
        Requirements as a JobRequirements JSON-proto compatible dict.
    """

    job_groups: Dict[str, _RequirementsCollector] = collections.defaultdict(_RequirementsCollector)
    all_job_offers = job_offers.iterate(job_offers_csv, colnames_txt, _REQUIRED_FIELDS)
    for job_offer in tqdm.tqdm(all_job_offers, total=_TOTAL_RECORDS):
        if job_offer.rome_profession_card_code:
            job_groups[job_offer.rome_profession_card_code].collect(job_offer)
    return [
        dict(job_groups[job_group_id].get_proto_dict(), _id=job_group_id)
        for job_group_id in sorted(job_groups)]


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'job_requirements')
