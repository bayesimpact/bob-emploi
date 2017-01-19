"""Importer for general job groups info.

This script gathers information from job offers and uploads to MongoDB some
requirements per job group.

It does not use pandas as we want to be able to swallow a very large file (13
Gb) that would not fit in memory. To do that we compute data on the fly.

You can try it out on a local instance if you have a job offers file:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/importer/job_offers_requirements.py \
        --job_offers_csv data/job_offers/sample_10perc.csv \
        --colnames_txt data/job_offers/column_names.txt \
        --to_json data/job_offers/job_offers_requirements.json
"""
import collections
import enum
import itertools

from bob_emploi.frontend.api import job_pb2
from bob_emploi.lib import job_offers
from bob_emploi.lib import mongo

# Minimum ratio of job offers for a diploma to be considered as a
# suggestion for the whole job group.
_FILTER_DIPLOMA_RATIO = .05

# Minimum ratio of job offers for a driving license to be considered as a
# suggestion for the whole job group.
_FILTER_DRIVING_LICENSE_RATIO = .05

# Minimum ratio of job offers for a desktop tool to be considered as a
# suggestion for the whole job group.
_FILTER_DESKTOP_TOOLS_RATIO = .05

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


class _ProxyFields(object):
    """A proxy class that updates field names on the fly.

    Let's say you have an object o with fields: o.foo_bar, o.foo_bla,
    o.foo_raw; then you can use _ProxyFields(o, prefix='foo_') to access things
    in a more readable manner: p.bar, p.bla, p.raw. Note that fields that are
    not prefixed by foo_ won't be accessible through the proxy.
    """

    def __init__(self, target, prefix='', suffix=''):
        self._target = target
        self._prefix = prefix
        self._suffix = suffix

    def __getattr__(self, field):
        return getattr(self._target, self._prefix + field + self._suffix)


def _diploma_name(job_offer_diploma):
    """Compute the diploma name.

    Check http://go/pe:notebooks/datasets/job_postings.ipynb for the rationale.

    type_name is the type of diploma (e.g. bachelor, master), and
    subject_area_name is the domain of the diploma (e.g. mathematics, biology).
    """
    if (not job_offer_diploma.type_code or
            job_offer_diploma.type_code == 'NULL'):
        return None
    diploma_name = job_offer_diploma.type_name
    if diploma_name.endswith(' ou équivalent'):
        diploma_name = diploma_name[:-len(' ou équivalent')]
    if (not int(job_offer_diploma.subject_area_code) or
            job_offer_diploma.subject_area_name == 'NULL'):
        return diploma_name
    return '%s en %s' % (diploma_name, job_offer_diploma.subject_area_name)


def _employment_type(job_offer):
    """Compute the employment type of the job offer."""
    if job_offer.contract_type_code == 'CDI':
        return job_pb2.CDI
    if job_offer.contract_type_code == 'MIS':
        return job_pb2.INTERIM
    duration = int(job_offer.contract_duration)
    if job_offer.contract_dur_unit_code == 'MO':
        duration *= 30
    if duration > 30 * 3:
        return job_pb2.CDD_OVER_3_MONTHS
    return job_pb2.CDD_LESS_EQUAL_3_MONTHS


class _RequirementKind(enum.Enum):
    diplomas = 1
    driving_licenses = 2
    desktop_tools = 3
    contract_type = 4


class _RequirementsCollector(object):

    def __init__(self):
        self.num_offers = 0
        self.suggestions = collections.defaultdict(
            lambda: collections.defaultdict(int))
        self.requirements = collections.defaultdict(
            lambda: collections.defaultdict(int))

    def collect(self, job_offer):
        """Collect requirements from a job offer."""
        self.num_offers += 1
        self._collect_diploma(job_offer)
        self._collect_driving_license(job_offer)
        self._collect_desktop_tools(job_offer)
        self._collect_employment_type(job_offer)
        # TODO(pascal): Also collect lang.

    def _add_suggestion(self, kind, name, required=False):
        """Collect a suggestion."""
        self.suggestions[kind][name] += 1
        if required:
            self.requirements[kind][name] += 1

    def _get_sorted_requirements(self, kind, threshold):
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

    def _collect_diploma(self, job_offer):
        kind = _RequirementKind.diplomas
        diploma_1 = _ProxyFields(job_offer, 'degree_', '_1')
        diploma_name_1 = _diploma_name(diploma_1)
        diploma_2 = _ProxyFields(job_offer, 'degree_', '_2')
        diploma_name_2 = _diploma_name(diploma_2)
        if diploma_name_1:
            self._add_suggestion(
                kind, diploma_name_1, required=diploma_1.required_code == 'E')
        if diploma_name_2 and diploma_name_1 != diploma_name_2:
            self._add_suggestion(
                kind, diploma_name_2, required=diploma_2.required_code == 'E')

    def _collect_driving_license(self, job_offer):
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

    def _collect_desktop_tools(self, job_offer):
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

    def _collect_employment_type(self, job_offer):
        kind = _RequirementKind.contract_type
        self._add_suggestion(kind, _employment_type(job_offer))

    def get_proto_dict(self):
        """Gets the requirements collected as a proto compatible dict.

        Returns:
            A dict compatible with the JSON version of the JobGroup
            protobuffer.
        """
        return {
            'diplomas': list(
                self._get_diplomas(
                    _FILTER_DIPLOMA_RATIO * self.num_offers)),
            'drivingLicenses': list(
                self._get_driving_licenses(
                    _FILTER_DRIVING_LICENSE_RATIO * self.num_offers)),
            'officeSkills': list(itertools.chain(
                self._get_desktop_tools(
                    _FILTER_DESKTOP_TOOLS_RATIO * self.num_offers),
            )),
            'contractTypes': list(self._get_contract_types()),
        }

    def _get_diplomas(self, count_threshold):
        # Sort by descending count, then ascending diploma name.
        diplomas = self._get_sorted_requirements(
            _RequirementKind.diplomas, count_threshold)
        for diploma_name, count, percent_required in diplomas:
            # TODO: Add degree level here.
            yield {
                'name': diploma_name,
                'percentSuggested': round(100 * count / self.num_offers),
                'percentRequired': percent_required,
            }

    def _get_driving_licenses(self, count_threshold):
        # Sort by descending count, then ascending licence name.
        licenses = self._get_sorted_requirements(
            _RequirementKind.driving_licenses, count_threshold)
        for license_name, count, percent_required in licenses:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'percentRequired': percent_required,
                'drivingLicense': license_name,
            }

    def _get_desktop_tools(self, count_threshold):
        # Sort by descending count, then ascending license name.
        tools = self._get_sorted_requirements(
            _RequirementKind.desktop_tools, count_threshold)
        for level, count, unused_percent_required in tools:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'officeSkillsLevel': level,
            }

    def _get_contract_types(self):
        contract_types = self._get_sorted_requirements(
            _RequirementKind.contract_type, 0)
        for contract_type, count, unused_percent_required in contract_types:
            yield {
                'percentSuggested': round(100 * count / self.num_offers),
                'percentRequired': 100,
                'contractType': job_pb2.EmploymentType.Name(contract_type),
            }


def csv2dicts(job_offers_csv, colnames_txt):
    """Import the requirement from job offers grouped by Job Group in MongoDB.

    Args:
        job_offers_csv: Path of the csv containing the data.
        colnames_txt: Path to a file containing the name of the CSV's columns.
    Returns:
        Requirements as a JobRequirements JSON-proto compatible dict.
    """
    job_groups = collections.defaultdict(_RequirementsCollector)
    for job_offer in job_offers.iterate(
            job_offers_csv, colnames_txt, _REQUIRED_FIELDS):
        job_groups[job_offer.rome_profession_card_code].collect(job_offer)
    return [
        dict(job_groups[job_group_id].get_proto_dict(), _id=job_group_id)
        for job_group_id in sorted(job_groups)]


if __name__ == "__main__":
    mongo.importer_main(csv2dicts, 'job_requirements')  # pragma: no cover
