"""Tests for the best_jobs_in_area module in t_pro deployment."""

import os
import unittest

from bob_emploi.data_analysis.importer.deployments.t_pro import best_jobs_in_area
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BestJobsInAreaTests(unittest.TestCase):
    """Unit tests for the Best jobs in area importer."""

    test_data = os.path.join(os.path.dirname(__file__), 'testdata')

    def test_importer(self) -> None:
        """Basic usage of best jobs in area importer.

        Compare with fr importer test where F1402 appears in best salaries jobs.
        """

        collection = best_jobs_in_area.csv2dicts(
            imt_folder=os.path.join(self.test_data, 'imt'),
            pcs_rome_crosswalk=os.path.join(self.test_data, 'pcs_rome.csv'),
            metiers_xlsx=os.path.join(self.test_data, 'metiers_porteurs.xlsx'))
        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.BestJobsInArea))

        self.assertIn('09', protos)
        self.assertEqual(
            ['F1702'],
            [j.job_group.rome_id for j in protos['09'].best_local_market_score_jobs],
            protos['09'])
        self.assertEqual(
            ['F1702'],
            [j.job_group.rome_id for j in protos['09'].best_relative_score_jobs],
            protos['09'])
        self.assertEqual(
            ['F1702'],
            [j.job_group.rome_id for j in protos['09'].best_salaries_jobs],
            protos['09'])
        self.assertEqual(
            'De 2\u202f200\xa0€ à 2\u202f800\xa0€',
            protos['09'].best_salaries_jobs[0].local_stats.imt.junior_salary.short_text)

        self.assertLessEqual(
            {'btp', 'metiers-qui-se-transforment'},
            {s.sector_id for s in protos['10'].sectors})
        # All sectors should be set up, even though we don't have data for all jobs.
        self.assertEqual(
            12, len(protos['10'].sectors), msg=[s.sector_id for s in protos['10'].sectors])
        sector = next(s for s in protos['10'].sectors if s.sector_id == 'btp')
        self.assertEqual(
            'Des métiers dans le secteur du BTP',
            sector.description)
        self.assertLessEqual(
            {'F1702'}, {j.job_group.rome_id for j in sector.best_local_market_score_jobs})
        # All jobs should be set up, even though we don't have data for them.
        self.assertEqual(
            15, len(sector.best_local_market_score_jobs),
            msg=[j.job_group.rome_id for j in sector.best_local_market_score_jobs])


if __name__ == '__main__':
    unittest.main()
