"""Tests for the bob_emploi.importer.local_diagnosis module."""

from os import path
import unittest

from bob_emploi.importer import local_diagnosis
from bob_emploi.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BmoRomeImporterTestCase(unittest.TestCase):
    """Unit tests for the BMO Rome importer."""

    bmo_csv = path.join(path.dirname(__file__), 'testdata/bmo.csv')
    fap_rome = path.join(path.dirname(__file__), 'testdata/fap_rome.txt')
    salaries_csv = path.join(
        path.dirname(__file__), 'testdata/fhs_salaries.csv')
    unemployment_duration_csv = path.join(
        path.dirname(__file__), 'testdata/fhs_durations.csv')
    job_offers_changes_json = path.join(
        path.dirname(__file__), 'testdata/job_offers_changes.json')
    job_imt_json = path.join(
        path.dirname(__file__), 'testdata/scraped_imt_local_job_stats.json')
    mobility_csv = path.join(
        path.dirname(__file__), 'testdata/unix_rubrique_mobilite_v327_utf8.csv')
    data_folder = path.join(path.dirname(__file__), 'testdata')

    def test_csv2dicts(self):
        """Test basic usage of the csv2dicts function."""
        collection = local_diagnosis.csv2dicts(
            self.bmo_csv, self.fap_rome, self.salaries_csv,
            self.unemployment_duration_csv, self.job_offers_changes_json,
            self.job_imt_json, self.mobility_csv, self.data_folder)

        self.assertEqual(17, len(collection))
        protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.LocalJobStats))
        # Point checks.
        a1301 = protos['971:A1301']
        self.assertEqual(54, a1301.bmo.percent_difficult)
        self.assertEqual(0, a1301.bmo.percent_seasonal)
        self.assertEqual(-15, a1301.job_offers_change)

        proto = protos['36:A1203']
        self.assertEqual(17935, proto.salary.min_salary)
        self.assertEqual(17965, proto.salary.max_salary)
        self.assertEqual(0, proto.job_offers_change)

        proto = protos['74:A1203']
        self.assertEqual(17800, proto.salary.max_salary)
        self.assertEqual(17700, proto.salary.min_salary)
        self.assertEqual('17 700 - 17 800', proto.salary.short_text)
        self.assertEqual(job_pb2.ANNUAL_GROSS_SALARY, proto.salary.unit)

        proto = protos['971:A1203']
        self.assertEqual(25, proto.unemployment_duration.days)

        proto = protos['09:F1402']
        self.assertEqual(2750, proto.imt.junior_salary.max_salary)

        proto = protos['10:F1402']
        self.assertEqual(1, len(proto.less_stressful_job_groups))
        less_stressful = proto.less_stressful_job_groups[0]
        self.assertEqual('F1702', less_stressful.job_group.rome_id)
        self.assertEqual(6, less_stressful.local_stats.imt.yearly_avg_offers_per_10_openings)

    def test_finalize_salary_estimation(self):
        """Basic usage of finalize_salary_estimation."""
        estimation = local_diagnosis.finalize_salary_estimation({
            'minSalary': 14660,
            'maxSalary': 35100,
            'medianSalary': 22000})
        self.assertEqual('14 660 - 35 100', estimation['shortText'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
