"""Tests for the bob_emploi.importer.local_diagnosis module."""

from os import path
import unittest

from bob_emploi.data_analysis.importer import local_diagnosis
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import job_pb2


class BmoRomeImporterTestCase(unittest.TestCase):
    """Unit tests for the BMO Rome importer."""

    bmo_csv = path.join(path.dirname(__file__), 'testdata/bmo.csv')
    fap_rome = path.join(path.dirname(__file__), 'testdata/fap_rome.txt')
    pcs_rome = path.join(path.dirname(__file__), 'testdata/pcs_rome.csv')
    salaries_csv = path.join(
        path.dirname(__file__), 'testdata/fhs_salaries.csv')
    unemployment_duration_csv = path.join(
        path.dirname(__file__), 'testdata/fhs_durations.csv')
    job_offers_changes_json = path.join(
        path.dirname(__file__), 'testdata/job_offers_changes.json')
    imt_folder = path.join(path.dirname(__file__), 'testdata/imt')
    mobility_csv = path.join(
        path.dirname(__file__), 'testdata/unix_rubrique_mobilite_v327_utf8.csv')
    data_folder = path.join(path.dirname(__file__), 'testdata')

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = local_diagnosis.csv2dicts(
            self.bmo_csv, self.fap_rome, self.pcs_rome, self.salaries_csv,
            self.unemployment_duration_csv, self.job_offers_changes_json,
            self.imt_folder, self.mobility_csv,
            trainings_csv=path.join(self.data_folder, 'cpf_trainings.csv'),
            data_folder=self.data_folder)

        self.assertEqual(55, len(collection))
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
        self.assertEqual('17\u202f700 - 17\u202f800', proto.salary.short_text)
        self.assertEqual(job_pb2.ANNUAL_GROSS_SALARY, proto.salary.unit)

        proto = protos['971:A1203']
        self.assertEqual(25, proto.unemployment_duration.days)

        proto = protos['09:F1402']
        self.assertEqual(2900, proto.imt.junior_salary.max_salary)
        self.assertEqual(1550, proto.imt.junior_salary.min_salary)
        self.assertEqual(
            'De 1\u202f550\xa0€ à 2\u202f900\xa0€', proto.imt.junior_salary.short_text)
        employment_type_percentages = [
            employment_type.percentage for employment_type in proto.imt.employment_type_percentages]
        employment_type_codes = [
            employment_type.employment_type for employment_type in
            proto.imt.employment_type_percentages]
        self.assertEqual([51., 49.0], employment_type_percentages)
        self.assertEqual([job_pb2.INTERIM, job_pb2.CDD_OVER_3_MONTHS], employment_type_codes)

        proto = protos['55:K2103']
        self.assertFalse(proto.imt.junior_salary.short_text)
        self.assertEqual('De 3\u202f500\xa0€ à 5\u202f550\xa0€', proto.imt.senior_salary.short_text)

        proto = protos['10:F1402']
        self.assertEqual(4, len(proto.less_stressful_job_groups))
        less_stressful = proto.less_stressful_job_groups[0]
        self.assertEqual('F1702', less_stressful.job_group.rome_id)
        self.assertEqual(18, less_stressful.local_stats.imt.yearly_avg_offers_per_10_candidates)
        self.assertEqual(0, proto.more_stressed_jobseekers_percentage)

        proto = protos['09:F1702']
        self.assertEqual(24, proto.imt.last_week_demand)
        self.assertEqual(2, proto.imt.last_week_offers)
        self.assertEqual(True, proto.imt.seasonal)
        self.assertCountEqual([job_pb2.OCTOBER], proto.imt.active_months)
        self.assertEqual(1, proto.num_less_stressful_departements)
        self.assertEqual(50, proto.more_stressed_jobseekers_percentage)

        proto = protos['12:F1402']
        self.assertFalse(proto.imt.active_months)
        self.assertEqual(2, proto.num_less_stressful_departements)

        proto = protos['10:F1401']
        self.assertEqual(-1, proto.imt.yearly_avg_offers_per_10_candidates)

        proto = protos['10:F1704']
        self.assertEqual(0, proto.imt.yearly_avg_offers_per_10_candidates)

        proto = protos['02:A1101']
        self.assertEqual(19, proto.bmo.percent_difficult)

        proto = protos['65:A1201']
        self.assertEqual(2, proto.training_count)

    def test_finalize_salary_estimation(self) -> None:
        """Basic usage of finalize_salary_estimation."""

        estimation = local_diagnosis.finalize_salary_estimation({
            'minSalary': 14660,
            'maxSalary': 35100,
            'medianSalary': 22000})
        self.assertEqual('14\u202f660 - 35\u202f100', estimation['shortText'])


if __name__ == '__main__':
    unittest.main()
