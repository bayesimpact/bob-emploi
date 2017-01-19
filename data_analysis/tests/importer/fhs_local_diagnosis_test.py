# encoding: utf-8
"""Tests for the bob_emploi.importer.fhs_local_diagnosis module."""
from os import path
import unittest

from bob_emploi.lib import mongo
from bob_emploi.importer import fhs_local_diagnosis
from bob_emploi.frontend.api import job_pb2


class FHSLocalDiagnosisTestCase(unittest.TestCase):
    """Unit tests for the tested module functions."""

    durations_csv = path.join(
        path.dirname(__file__), 'testdata/fhs_durations_city.csv')

    def test_fhs2dicts(self):
        """Basic usage of fhs2dicts."""
        local_diagnosis = fhs_local_diagnosis.fhs2dicts(self.durations_csv)
        diagnosed_plan_protos = dict(mongo.collection_to_proto_mapping(
            local_diagnosis, job_pb2.LocalJobStats))

        self.assertEqual(
            ['74002:A1203', 'A1203', 'd74:A1203', 'ghost-r84:A1203',
             'r84:A1203'],
            sorted(diagnosed_plan_protos.keys()))

        proto = diagnosed_plan_protos['74002:A1203']
        self.assertEqual(62, proto.unemployment_duration.days)

        proto = diagnosed_plan_protos['ghost-r84:A1203']
        self.assertEqual(25, proto.unemployment_duration.days)

        proto = diagnosed_plan_protos['r84:A1203']
        self.assertEqual(25, proto.unemployment_duration.days)
        self.assertEqual('ghost-r84', proto.best_city.city_id)
        self.assertFalse(proto.best_city.name)

        proto = diagnosed_plan_protos['d74:A1203']
        self.assertEqual('74002', proto.best_city.city_id)
        self.assertEqual('Alby-sur-Chéran', proto.best_city.name)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
