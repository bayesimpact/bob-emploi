"""Tests for the bob_emploi.importer.job_offers_requirements."""

from os import path
import typing
from typing import Optional
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer import job_offers_requirements
from bob_emploi.data_analysis.lib import mongo


class _JobOffer(typing.NamedTuple):
    degree_type_code_1: Optional[str] = None
    degree_type_name_1: Optional[str] = None
    degree_subject_area_code_1: str = '0'
    degree_subject_area_name_1: Optional[str] = None
    degree_required_code_1: Optional[str] = None
    degree_required_name_1: Optional[str] = None
    degree_type_code_2: Optional[str] = None
    degree_type_name_2: Optional[str] = None
    degree_subject_area_code_2: str = '0'
    degree_subject_area_name_2: Optional[str] = None
    degree_required_code_2: Optional[str] = None
    degree_required_name_2: Optional[str] = None


def _list_diplomas_from_fake_offer(job_offer: _JobOffer) \
        -> list['job_offers_requirements._DiplomaRequirement']:
    return list(job_offers_requirements.list_diplomas(
        typing.cast('job_offers_requirements.job_offers._JobOffer', job_offer)))


class JobOffersRequirementsImporterTestCase(unittest.TestCase):
    """Tests for the job offers requirement csv2dicts converter."""

    testdata_folder = path.join(
        path.dirname(__file__), 'testdata/job_offers')

    def test_basic_usage(self) -> None:
        """Basic usage."""

        requirements = job_offers_requirements.csv2dicts(
            path.join(self.testdata_folder, 'job_offers.csv'),
            path.join(self.testdata_folder, 'column_names.txt'))

        requirements_proto = dict(mongo.collection_to_proto_mapping(
            requirements, job_pb2.JobRequirements))

        f1106 = requirements_proto['F1106']
        self.assertEqual(2, len(f1106.diplomas), f1106.diplomas)
        self.assertEqual('Bac+2', f1106.diplomas[1].name)
        self.assertEqual(job_pb2.BTS_DUT_DEUG, f1106.diplomas[1].diploma.level)
        self.assertEqual(25, f1106.diplomas[1].percent_suggested)
        self.assertEqual(0, f1106.diplomas[1].percent_required)
        self.assertEqual(
            [2],
            [e.office_skills_level for e in f1106.office_skills])
        self.assertEqual(11, f1106.office_skills[0].percent_suggested)
        self.assertEqual(
            [job_pb2.CAR],
            [license.driving_license for license in f1106.driving_licenses])
        self.assertEqual(11, f1106.driving_licenses[0].percent_suggested)
        self.assertEqual(100, f1106.driving_licenses[0].percent_required)

        self.assertEqual(
            [job_pb2.CDD_OVER_3_MONTHS, job_pb2.CDI,
             job_pb2.CDD_LESS_EQUAL_3_MONTHS],
            [e.contract_type for e in f1106.contract_types])

        self.assertEqual(
            ['10686', '11753', '10688', '16733', '19658'],
            [j.code_ogr for j in f1106.specific_jobs])
        self.assertEqual(44, f1106.specific_jobs[0].percent_suggested)

    def test_list_diplomas_empty(self) -> None:
        """List Diplomas for an empty job offer."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer())
        self.assertFalse(diplomas)

    def test_list_diplomas_simple(self) -> None:
        """List Diplomas for a job offer with a simple diploma requirement."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac ou équivalent',
            degree_required_code_1='E',
        ))
        self.assertEqual(
            [(False, 'Bac', job_pb2.BAC_BACPRO), (True, 'Bac', job_pb2.BAC_BACPRO)],
            diplomas)

    def test_list_diplomas_simple_suggested(self) -> None:
        """List Diplomas for a job offer with a simple diploma suggestion."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac ou équivalent',
            degree_required_code_1='S',
        ))
        self.assertEqual(
            [(False, 'Bac', job_pb2.BAC_BACPRO),
             (True, 'Aucune formation scolaire', job_pb2.NO_DEGREE)],
            sorted(diplomas))

    def test_list_diplomas_second(self) -> None:
        """List Diplomas for a job offer with a diploma requirement in the second slot."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_2='NV1',
            degree_type_name_2='Bac ou équivalent',
            degree_required_code_2='E',
        ))
        self.assertEqual(
            [(False, 'Bac', job_pb2.BAC_BACPRO), (True, 'Bac', job_pb2.BAC_BACPRO)],
            diplomas)

    def test_list_diplomas_same(self) -> None:
        """List Diplomas for a job offer with 2 diploma requirements that are the same."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac ou équivalent',
            degree_required_code_1='E',
            degree_type_code_2='NV1',
            degree_type_name_2='Bac ou équivalent',
            degree_required_code_2='E',
        ))
        self.assertEqual(
            [(False, 'Bac', job_pb2.BAC_BACPRO), (True, 'Bac', job_pb2.BAC_BACPRO)],
            diplomas)

    def test_list_diplomas_stronger(self) -> None:
        """List Diplomas for a job offer with 2 different diploma requirements."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac+2 ou équivalent',
            degree_required_code_1='E',
            degree_type_code_2='NV1',
            degree_type_name_2='Bac ou équivalent',
            degree_required_code_2='E',
        ))
        self.assertEqual(
            [(False, 'Bac+2', job_pb2.BTS_DUT_DEUG), (True, 'Bac+2', job_pb2.BTS_DUT_DEUG)],
            diplomas)

    def test_list_diplomas_requirement_and_suggestion(self) -> None:
        """List Diplomas for a job offer with one diploma requirement and one suggestion."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac+2 ou équivalent',
            degree_required_code_1='S',
            degree_type_code_2='NV1',
            degree_type_name_2='Bac ou équivalent',
            degree_required_code_2='E',
        ))
        self.assertEqual(
            [(False, 'Bac+2', job_pb2.BTS_DUT_DEUG), (True, 'Bac', job_pb2.BAC_BACPRO)],
            sorted(diplomas))

    def test_list_diplomas_suggestion_and_requirement(self) -> None:
        """List Diplomas for a job offer with one diploma suggestion and one requirement."""

        diplomas = _list_diplomas_from_fake_offer(_JobOffer(
            degree_type_code_1='NV1',
            degree_type_name_1='Bac ou équivalent',
            degree_required_code_1='E',
            degree_type_code_2='NV1',
            degree_type_name_2='Bac+2 ou équivalent',
            degree_required_code_2='S',
        ))
        self.assertEqual(
            [(False, 'Bac+2', job_pb2.BTS_DUT_DEUG), (True, 'Bac', job_pb2.BAC_BACPRO)],
            sorted(diplomas))


if __name__ == '__main__':
    unittest.main()
