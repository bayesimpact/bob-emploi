"""Tests for the bob_emploi.importer.job_offers_requirements."""
from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.importer import job_offers_requirements
from bob_emploi.lib import mongo


class JobOffersRequirementsImporterTestCase(unittest.TestCase):
    """Tests for the job offers requirement csv2dicts converter."""

    testdata_folder = path.join(
        path.dirname(__file__), 'testdata/job_offers')

    def test_basic_usage(self):
        """Basic usage."""
        requirements = job_offers_requirements.csv2dicts(
            path.join(self.testdata_folder, 'job_offers.csv'),
            path.join(self.testdata_folder, 'column_names.txt'))

        requirements_proto = dict(mongo.collection_to_proto_mapping(
            requirements, job_pb2.JobRequirements))

        f1106 = requirements_proto['F1106']
        self.assertEqual(2, len(f1106.diplomas), f1106.diplomas)
        self.assertEqual(
            'Bac+2 en Informatique',
            f1106.diplomas[1].name)
        self.assertEqual(12, f1106.diplomas[1].percent_suggested)
        self.assertEqual(1, f1106.diplomas[1].percent_required)
        self.assertEqual(
            [2],
            [e.office_skills_level for e in f1106.office_skills])
        self.assertEqual(12, f1106.office_skills[0].percent_suggested)
        self.assertEqual(
            [job_pb2.CAR],
            [l.driving_license for l in f1106.driving_licenses])
        self.assertEqual(12, f1106.driving_licenses[0].percent_suggested)
        self.assertEqual(100, f1106.driving_licenses[0].percent_required)

        self.assertEqual(
            [job_pb2.CDD_OVER_3_MONTHS, job_pb2.CDI,
             job_pb2.CDD_LESS_EQUAL_3_MONTHS],
            [e.contract_type for e in f1106.contract_types])

        self.assertEqual(
            ['10686', '10688', '11753', '16733', '19658'],
            [j.code_ogr for j in f1106.specific_jobs])
        self.assertEqual(50, f1106.specific_jobs[0].percent_suggested)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
