"""Tests for the bob_emploi.data_analysis.importer.deployments.uk.job_group_info module."""

import os
from os import path
import unittest
from unittest import mock

import airtablemock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer.deployments.uk import job_group_info
from bob_emploi.data_analysis.lib import mongo


TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'fake-test-api-key'})
class JobGroupInfoImporterTest(airtablemock.TestCase):
    """Unit tests for the job group info importer."""

    def test_make_dicts(self) -> None:
        """Import of job group info."""

        job_group_info.translation.clear_cache()

        airtable = airtablemock.Airtable('app2xuIa0KpAWGJBV')
        airtable.create('tbl7eVORxOnsCH5mv', {
            'soc_prefix': '211',
            'covidRisk': 'COVID_SAFE',
        })
        airtable.create('tbl7eVORxOnsCH5mv', {
            'soc_prefix': '1116',
            'covidRisk': 'COVID_RISKY',
        })
        airtable.create('tbl7eVORxOnsCH5mv', {
            'soc_prefix': '543',
            'covidRisk': 'COVID_RISKY',
        })
        airtable.create('skills_for_future', {
            'name': 'Jugement et prise de décision',
            'description': 'long description',
            'soc_prefixes_uk': '111',
            'discover_url': 'https://youtu.be/judging-in-fr',
        })
        airtablemock.Airtable('appkEc8N0Bw4Uok43').create('tblQL7A5EgRJWhQFo', {
            'string': 'Jugement et prise de décision',
            'en': 'Judging & decision making',
        })
        airtablemock.Airtable('appkEc8N0Bw4Uok43').create('tblQL7A5EgRJWhQFo', {
            'string': 'long description',
            'en': 'long description in English',
        })
        airtablemock.Airtable('appkEc8N0Bw4Uok43').create('tblQL7A5EgRJWhQFo', {
            'string': 'https://youtu.be/judging-in-fr',
            'en': 'https://youtu.be/judging-in-en',
        })

        collection = job_group_info.make_dicts(
            postings_csv=path.join(TESTDATA_FOLDER, 'emsi_postings_counts_2019_area4-occ4.csv'),
            occupations_csv=path.join(
                TESTDATA_FOLDER, 'emsi_occupation_counts_2019_area4-occ4.csv'),
            jobs_xls=path.join(TESTDATA_FOLDER, 'soc/soc2010.xls'),
            soc2010_js=path.join(TESTDATA_FOLDER, 'soc/socDB.js'),
            career_jumps_csv=path.join(TESTDATA_FOLDER, 'soc/career_changers_matrix.csv'),
            automation_xls=path.join(TESTDATA_FOLDER, 'automation_probability.xls'),
            info_by_prefix_airtable='app2xuIa0KpAWGJBV:tbl7eVORxOnsCH5mv',
            occupation_requirements_json=os.path.join(TESTDATA_FOLDER, 'job_requirements.json'),
            skills_for_future_airtable='app2xuIa0KpAWGJBV:skills_for_future',
        )

        self.assertEqual(5, len(collection))
        for info in collection:
            self.assertEqual(info['_id'], info['romeId'])

        job_group_protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.JobGroup))

        chief_executives = job_group_protos['1115']
        self.assertEqual('Chief executives and senior officials', chief_executives.name)
        self.assertIn('head large enterprises and organisations', chief_executives.description)
        self.assertEqual('Managers, directors and senior officials', chief_executives.domain)
        self.assertEqual(24, chief_executives.automation_risk)
        self.assertEqual(
            [4, 2, -1],
            [
                score.local_stats.imt.yearly_avg_offers_per_10_candidates
                for score in chief_executives.departement_scores])
        self.assertEqual(
            ['2111'],
            [related.job_group.rome_id for related in chief_executives.related_job_groups])
        chief_related_scientist = chief_executives.related_job_groups[0]
        self.assertEqual(1, chief_related_scientist.job_group.automation_risk)
        self.assertEqual(job_pb2.CLOSE, chief_related_scientist.mobility_type)

        self.assertEqual(1, job_group_protos['2111'].automation_risk)
        self.assertEqual(0, job_group_protos['1116'].automation_risk)

        self.assertEqual(job_pb2.COVID_RISKY, job_group_protos['1116'].covid_risk)
        self.assertEqual(job_pb2.COVID_SAFE, job_group_protos['2111'].covid_risk)
        self.assertFalse(job_group_protos['1115'].covid_risk)

        self.assertEqual(
            ["Bachelor's degree"],
            [ce.name for ce in chief_executives.requirements.diplomas])

        self.assertEqual(
            ['Judging & decision making'],
            [s.name for s in job_group_protos['1116'].skills_for_future])
        self.assertEqual(
            'https://youtu.be/judging-in-en',
            job_group_protos['1116'].skills_for_future[0].discover_url)
        self.assertFalse([s.name for s in job_group_protos['2111'].skills_for_future])

        self.assertIn('Vice President', [job.name for job in chief_executives.samples])
        self.assertNotIn('', [job.name for job in chief_executives.samples])


if __name__ == '__main__':
    unittest.main()
