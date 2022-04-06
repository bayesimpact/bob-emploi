"""Tests for the bob_emploi.importer.local_diagnosis module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.t_pro import local_diagnosis
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BmoRomeImporterTestCase(unittest.TestCase):
    """Unit tests for the BMO Rome importer."""

    data_folder = path.join(path.dirname(__file__), 'testdata')
    imt_salaries_csv = path.join(data_folder, 'imt/salaries.csv')
    pcs_rome_crosswalk = path.join(data_folder, 'pcs_rome.csv')
    metiers_xlsx = path.join(data_folder, 'metiers_porteurs.xlsx')

    def test_make_dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = list(local_diagnosis.make_dicts(
            pcs_rome_crosswalk=self.pcs_rome_crosswalk, imt_salaries_csv=self.imt_salaries_csv,
            metiers_xlsx=self.metiers_xlsx))

        self.assertEqual(1, len(collection))
        protos = dict(mongo.collection_to_proto_mapping(collection, job_pb2.LocalJobStats))

        proto = protos['07:F1702'].imt
        self.assertEqual(3900, proto.junior_salary.max_salary)
        self.assertEqual(1850, proto.senior_salary.min_salary)
        self.assertEqual('De 1\u202f850\u00a0€ à 3\u202f850\u00a0€', proto.senior_salary.short_text)
        self.assertEqual(job_pb2.MONTHLY_GROSS_SALARY, proto.senior_salary.unit)


if __name__ == '__main__':
    unittest.main()
