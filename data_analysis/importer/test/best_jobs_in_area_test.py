"""Tests for the bob_emploi.importer.best_jobs_in_area module."""

import os
import unittest

from bob_emploi.data_analysis.importer import best_jobs_in_area
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BestJobsInAreaTests(unittest.TestCase):
    """Unit tests for the Best jobs in area importer."""

    test_data = os.path.join(os.path.dirname(__file__), 'testdata')

    def test_importer(self) -> None:
        """Basic usage of best jobs in area importer."""

        collection = best_jobs_in_area.csv2dicts(
            imt_folder=os.path.join(self.test_data, 'imt-best-jobs-in-area'),
            pcs_rome_crosswalk=os.path.join(self.test_data, 'pcs_rome.csv'),
            rome_item_arborescence=os.path.join(
                self.test_data, 'unix_item_arborescence_v327_utf8.csv'))
        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.BestJobsInArea))

        self.assertIn('09', protos)
        self.assertEqual(
            ['F1702', 'XXXXX'],
            [j.job_group.rome_id for j in protos['09'].best_local_market_score_jobs],
            protos['09'])
        self.assertEqual(
            ['F1702'],
            [j.job_group.rome_id for j in protos['09'].best_relative_score_jobs],
            protos['09'])
        self.assertEqual(
            ['F1402', 'F1702'],
            [j.job_group.rome_id for j in protos['09'].best_salaries_jobs],
            protos['09'])
        self.assertEqual(
            'De 2\u202f200\xa0€ à 2\u202f800\xa0€',
            protos['09'].best_salaries_jobs[0].local_stats.imt.junior_salary.short_text)

        self.assertEqual(['defense'], [s.sector_id for s in protos['10'].sectors])
        sector = next(iter(protos['10'].sectors))
        self.assertEqual(
            'Des métiers dans le secteur de la défense et de la sécurité publique %inDepartement',
            sector.description)
        self.assertEqual(
            ['F1702'], [j.job_group.rome_id for j in sector.best_local_market_score_jobs])


if __name__ == '__main__':
    unittest.main()
