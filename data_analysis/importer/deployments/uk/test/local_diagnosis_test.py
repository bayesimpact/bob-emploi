"""Tests for the bob_emploi.importer.deployments.uk.local_diagnosis module."""

import os
import unittest
from unittest import mock

import airtablemock

from bob_emploi.data_analysis.importer.deployments.uk import local_diagnosis
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


TESTDATA_FOLDER = os.path.join(os.path.dirname(__file__), 'testdata')


@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'fake-test-api-key'})
class LMIImporterTestCase(airtablemock.TestCase):
    """Unit tests for the UK Labor Market Info importer."""

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        airtable = airtablemock.Airtable('app-mybase')
        airtable.create('tbl-my-job-group-info', {
            'soc_prefix': '543',
            'covidRisk': 'COVID_RISKY',
        })

        collection = local_diagnosis.csv2dicts(
            postings_csv=os.path.join(TESTDATA_FOLDER, 'emsi_postings_counts_2019_area4-occ4.csv'),
            occupations_csv=os.path.join(
                TESTDATA_FOLDER, 'emsi_occupation_counts_2019_area4-occ4.csv'),
            jobs_xls=os.path.join(TESTDATA_FOLDER, 'soc/soc2010.xls'),
            career_jumps_csv=os.path.join(TESTDATA_FOLDER, 'soc/career_changers_matrix.csv'),
            info_by_prefix_airtable='app-mybase:tbl-my-job-group-info',
        )

        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.LocalJobStats))
        self.assertEqual(6, len(protos), msg=protos.keys())

        # Point checks.
        wolverhampton111 = protos['E08000031:1115']
        self.assertEqual(2, wolverhampton111.imt.yearly_avg_offers_per_10_candidates)
        self.assertEqual(1, wolverhampton111.num_less_stressful_departements)
        self.assertEqual(
            ['2111'], [jg.job_group.rome_id for jg in wolverhampton111.less_stressful_job_groups])
        self.assertEqual(
            ['Chemical scientists'],
            [jg.job_group.name for jg in wolverhampton111.less_stressful_job_groups])

        # Check empty valued.
        self.assertEqual(0, protos['E07000121:1115'].imt.yearly_avg_offers_per_10_candidates)
        # Check zero-valued.
        self.assertEqual(-1, protos['E07000120:1116'].imt.yearly_avg_offers_per_10_candidates)


if __name__ == '__main__':
    unittest.main()
