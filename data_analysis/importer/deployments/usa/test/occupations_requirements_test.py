"""Tests for the bob_emploi.importer.deployments.usa.occupations_requirements."""

from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer.deployments.usa import occupations_requirements
from bob_emploi.data_analysis.lib import mongo


class OccupationRequirementsImporterTestCase(unittest.TestCase):
    """Tests for the occupation requirements csv2dicts converter."""

    testdata_folder = path.join(path.dirname(__file__), 'testdata')

    def test_basic_usage(self) -> None:
        """Basic usage."""

        requirements = occupations_requirements.csv2dicts(
            path.join(
                self.testdata_folder,
                f'onet_{occupations_requirements.ONET_VERSION}/' +
                'Education_Training_and_Experience.txt'),
            path.join(self.testdata_folder, 'soc/2010_to_2018_SOC_Crosswalk.csv'))

        requirements_proto = dict(mongo.collection_to_proto_mapping(
            requirements, job_pb2.JobRequirements))

        soc_11_1011 = requirements_proto['11-1011']
        self.assertEqual(4, len(soc_11_1011.diplomas), soc_11_1011.diplomas)
        self.assertEqual("Bachelor's degree", soc_11_1011.diplomas[1].name)
        self.assertEqual(job_pb2.LICENCE_MAITRISE, soc_11_1011.diplomas[1].diploma.level)
        self.assertEqual(35, soc_11_1011.diplomas[1].percent_required)


if __name__ == '__main__':
    unittest.main()
