"""Tests for the bob_emploi.importer.deployments.uk.occupations_requirements."""

from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer.deployments.uk import occupations_requirements
from bob_emploi.data_analysis.lib import mongo


class OccupationRequirementsImporterTestCase(unittest.TestCase):
    """Tests for the occupation requirements csv2dicts converter."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_basic_usage(self) -> None:
        """Basic usage."""

        requirements = occupations_requirements.csv2dicts(
            path.join(self.testdata_folder, 'diplomas.txt'),
            path.join(self.testdata_folder, 'soc/socDB.js'))

        requirements_proto = dict(mongo.collection_to_proto_mapping(
            requirements, job_pb2.JobRequirements))

        soc_8126 = requirements_proto['8126']
        self.assertEqual(1, len(soc_8126.diplomas), soc_8126.diplomas)
        self.assertEqual('GCSE or equivalent', soc_8126.diplomas[0].name, msg=soc_8126.diplomas[0])
        self.assertEqual(job_pb2.BAC_BACPRO, soc_8126.diplomas[0].diploma.level)
        self.assertGreaterEqual(soc_8126.diplomas[0].percent_required, 50)

        soc_1223 = requirements_proto['1223']
        self.assertEqual(1, len(soc_1223.diplomas), soc_1223.diplomas)
        self.assertEqual('No high school diploma', soc_1223.diplomas[0].name)

        soc_9273 = requirements_proto['9273']
        self.assertEqual(1, len(soc_9273.diplomas), soc_9273.diplomas)
        self.assertEqual('No high school diploma', soc_9273.diplomas[0].name)


if __name__ == '__main__':
    unittest.main()
