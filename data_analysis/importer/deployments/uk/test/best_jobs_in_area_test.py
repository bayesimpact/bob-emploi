"""Tests for the bob_emploi.importer.deployments.uk.best_jobs_in_area module."""

import os
import unittest

from bob_emploi.data_analysis.importer.deployments.uk import best_jobs_in_area
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BestJobsInAreaTests(unittest.TestCase):
    """Unit tests for the Best jobs in area importer."""

    test_data = os.path.join(os.path.dirname(__file__), 'testdata')

    def test_importer(self) -> None:
        """Basic usage of best jobs in area importer."""

        collection = best_jobs_in_area.csv2dicts(
            salaries_by_region_2020_xlsx=os.path.join(
                self.test_data, 'salaries_by_region_2020.xlsx'),
            wards_ons_csv=os.path.join(self.test_data, 'wards.csv'),
            geonames_txt=os.path.join(self.test_data, 'geonames.txt'),
            geonames_admin_txt=os.path.join(self.test_data, 'geonames_admin.txt'))
        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.BestJobsInArea))

        self.assertIn('E06000014', protos)
        self.assertEqual(
            ['1116', '1115', '2232'],
            [j.job_group.rome_id for j in protos['E06000014'].best_salaries_jobs],
            protos['E06000014'])
        self.assertEqual(
            92684,
            protos['E06000014'].best_salaries_jobs[0].local_stats.salary.median_salary,
            protos['E06000014'])
        self.assertEqual(
            'Around £\xa092,684',
            protos['E06000014'].best_salaries_jobs[0].local_stats.salary.short_text,
            protos['E06000014'])


if __name__ == '__main__':
    unittest.main()
