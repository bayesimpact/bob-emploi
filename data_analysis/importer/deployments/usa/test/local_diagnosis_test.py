"""Tests for the bob_emploi.importer.deployments.usa.local_diagnosis module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.usa import geonames_city_suggest
from bob_emploi.data_analysis.importer.deployments.usa import local_diagnosis
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


class LMIImporterTestCase(unittest.TestCase):
    """Unit tests for the US Labor Market Info importer."""

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = local_diagnosis.csv2dicts(
            hires_csv=path.join(_TESTDATA_FOLDER, 'emsi_hires.csv'),
            job_seekers_csv=path.join(_TESTDATA_FOLDER, 'emsi_job_seekers_counts_dec_2019.csv'),
            carreer_changers_tsv=path.join(
                _TESTDATA_FOLDER,
                f'onet_{local_diagnosis.ONET_VERSION}/Career_Changers_Matrix.txt'),
            soc_definition_xls=path.join(_TESTDATA_FOLDER, 'soc/soc_2010_definitions.xls'),
        )

        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.LocalJobStats))
        self.assertEqual(27, len(protos))

        # Point checks.
        king111011 = protos['53033:11-1011']
        self.assertEqual(4, king111011.imt.yearly_avg_offers_per_10_candidates)
        self.assertEqual(2, king111011.num_less_stressful_departements)
        self.assertEqual(1, len(king111011.less_stressful_job_groups))
        self.assertEqual({'13-1151': 20}, {
            job_group.job_group.rome_id:
            job_group.local_stats.imt.yearly_avg_offers_per_10_candidates
            for job_group in king111011.less_stressful_job_groups})
        self.assertEqual(
            'Training and Development Specialists',
            king111011.less_stressful_job_groups[0].job_group.name)

        # New York City aggregation
        ny111011 = protos[f'{geonames_city_suggest.NEW_YORK_AGG_COUNTY_ID}:11-1011']
        self.assertEqual(4, ny111011.imt.yearly_avg_offers_per_10_candidates)
        self.assertEqual(4, ny111011.num_less_stressful_departements)
        self.assertEqual(0, len(ny111011.less_stressful_job_groups))

    def test_wrong_file(self) -> None:
        """Test with the wrong input file."""

        collection = local_diagnosis.csv2dicts(
            hires_csv=path.join(_TESTDATA_FOLDER, 'emsi_openings.csv'),
            job_seekers_csv=path.join(_TESTDATA_FOLDER, 'emsi_job_seekers_counts_dec_2019.csv'),
            carreer_changers_tsv=path.join(
                _TESTDATA_FOLDER,
                f'onet_{local_diagnosis.ONET_VERSION}/Career_Changers_Matrix.txt'),
            soc_definition_xls=path.join(_TESTDATA_FOLDER, 'soc/soc_2010_definitions.xls'))

        with self.assertRaises(ValueError) as error:
            dict(mongo.collection_to_proto_mapping(collection, job_pb2.LocalJobStats))

        self.assertIn('Incorrect dataset:', str(error.exception))

    def test_bad_format_file(self) -> None:
        """Test with an input file wih a bad format."""

        collection = local_diagnosis.csv2dicts(
            hires_csv=path.join(_TESTDATA_FOLDER, 'emsi_hires_wrong.csv'),
            job_seekers_csv=path.join(_TESTDATA_FOLDER, 'emsi_job_seekers_counts_dec_2019.csv'),
            carreer_changers_tsv=path.join(
                _TESTDATA_FOLDER,
                f'onet_{local_diagnosis.ONET_VERSION}/Career_Changers_Matrix.txt'),
            soc_definition_xls=path.join(_TESTDATA_FOLDER, 'soc/soc_2010_definitions.xls'))

        with self.assertRaises(ValueError) as error:
            dict(mongo.collection_to_proto_mapping(collection, job_pb2.LocalJobStats))

        self.assertIn('Incorrect dataset format:', str(error.exception))


if __name__ == '__main__':
    unittest.main()
