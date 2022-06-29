"""Tests for the bob_emploi.data_analysis.importer.deployments.usa.job_group_info module."""

import os
import unittest
from unittest import mock

import airtablemock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer.deployments.usa import job_group_info
from bob_emploi.data_analysis.lib import mongo

_TESTDATA_FOLDER = os.path.join(os.path.dirname(__file__), 'testdata')


@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'my-test-api-key'})
class JobGroupInfoImporterTest(airtablemock.TestCase):
    """Unit tests for the job group info importer."""

    def setUp(self) -> None:
        super().setUp()
        job_group_info.translation.clear_cache()
        client = airtablemock.Airtable('appmy-test-base', 'my-test-api-key')
        client.create('soc2fap', {
            'O*NET-SOC Code': '11-1011',
            'FAP prefixes': ['L6Z', 'L4Z'],
        })
        client.create('skills_for_future', {
            'name': 'Jugement et prise de décision',
            'description': 'long description',
            'soc_prefixes_us': '11-,11-10',
        })
        airtablemock.Airtable('appkEc8N0Bw4Uok43').create('tblQL7A5EgRJWhQFo', {
            'string': 'Jugement et prise de décision',
            'en': 'Judging & decision making',
        })
        airtablemock.Airtable('appkEc8N0Bw4Uok43').create('tblQL7A5EgRJWhQFo', {
            'string': 'long description',
            'en': 'long description in English',
        })

    def test_make_dicts(self) -> None:
        """Import of job group info."""

        collection = job_group_info.make_dicts(
            soc_definitions_xls=os.path.join(_TESTDATA_FOLDER, 'soc/soc_2010_definitions.xls'),
            hires_csv=os.path.join(_TESTDATA_FOLDER, 'emsi_hires.csv'),
            job_seekers_csv=os.path.join(_TESTDATA_FOLDER, 'emsi_job_seekers_counts_dec_2019.csv'),
            states_txt=os.path.join(_TESTDATA_FOLDER, 'usa/states.txt'),
            application_mode_csv=os.path.join(_TESTDATA_FOLDER, 'application_modes.csv'),
            soc_structure_xls=os.path.join(_TESTDATA_FOLDER, 'soc/soc_structure_2010.xls'),
            soc_fap_crosswalk_airtable='appmy-test-base:soc2fap',
            brookings_automation_risk_json=os.path.join(_TESTDATA_FOLDER, 'automation_risk.json'),
            occupation_requirements_json=os.path.join(_TESTDATA_FOLDER, 'job_requirements.json'),
            skills_for_future_airtable='appmy-test-base:skills_for_future',
        )

        self.assertGreater(len(collection), 10)
        for info in collection:
            self.assertEqual(info['_id'], info['romeId'])

        job_group_protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.JobGroup))

        chief_executives = job_group_protos['11-1011']
        self.assertEqual('Chief Executives', chief_executives.name)
        self.assertEqual('Management Occupations', chief_executives.domain)
        self.assertIn('formulate policies', chief_executives.description)
        self.assertEqual(
            [5, 5, 4, 4, 4],
            [
                score.local_stats.imt.yearly_avg_offers_per_10_candidates
                for score in chief_executives.departement_scores])
        self.assertEqual(
            ['NY', 'WA'],
            [score.area_id for score in chief_executives.admin1_area_scores])
        self.assertEqual(
            [4, 4],
            [
                score.local_stats.imt.yearly_avg_offers_per_10_candidates
                for score in chief_executives.admin1_area_scores])
        self.assertEqual({'L6Z83'}, chief_executives.application_modes.keys())
        self.assertEqual(
            job_pb2.SPONTANEOUS_APPLICATION,
            chief_executives.application_modes['L6Z83'].modes[0].mode)
        self.assertNotIn('nan', chief_executives.application_modes)
        self.assertEqual(32, chief_executives.automation_risk)
        self.assertEqual('in your industry', chief_executives.in_domain)

        self.assertEqual(
            ["Master's degree, PhD, or higher", "Bachelor's degree"],
            [ce.name for ce in chief_executives.requirements.diplomas])

        self.assertEqual(
            ['Judging & decision making'],
            [s.name for s in chief_executives.skills_for_future])

        self.assertEqual(1, job_group_protos['41-9012'].automation_risk, msg='Fashion models')
        self.assertFalse(job_group_protos['41-9012'].skills_for_future)


if __name__ == '__main__':
    unittest.main()
