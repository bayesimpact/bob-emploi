# encoding: utf-8
"""Tests for the bob_emploi.importer.rome_mobility module."""

from os import path
import unittest

import pandas

from bob_emploi.lib import mongo
from bob_emploi.importer import rome_mobility
from bob_emploi.frontend.api import discovery_pb2


class RomeMobilityImporterTestCase(unittest.TestCase):
    """Unit tests for the Rome mobility importer."""

    rome_csv_pattern = path.join(
        path.dirname(__file__), 'testdata/unix_{}_v327_utf8.csv')

    def test_csv2dicts(self):
        """Test basic usage of the csv2dicts function."""
        collection = rome_mobility.csv2dicts(self.rome_csv_pattern)

        protos = dict(mongo.collection_to_proto_mapping(
            collection, discovery_pb2.JobsExploration))

        # Point checks.
        self.assertEqual(
            ['10976', '10979', '10992', '10994', '11005',
             '11010', '11036', '11037', '11044', '11046',
             '11047', '11052', '11059', '15441', 'F1402',
             'G1102', 'G1201', 'G1202'],
            sorted(protos))

        g1202_proto = protos['G1202']
        self.assertEqual(
            ['G1201', 'G1203', 'G1403', 'K1206', 'K1601', 'K2105', 'K2111'],
            sorted(g.job_group.rome_id for g in g1202_proto.job_groups))

        g1403 = [
            g.job_group for g in g1202_proto.job_groups
            if g.job_group.rome_id == 'G1403'].pop()
        self.assertEqual(
            "Gestion de structure de loisirs ou d'hébergement touristique",
            g1403.name)
        samples = [j.code_ogr for j in g1403.samples]
        self.assertEqual(3, len(samples))
        self.assertEqual(3, len(set(samples)))
        self.assertLess(
            set(samples),
            set(['14216', '14217', '14234', '14237', '14301', '14322', '14326',
                 '14356', '14418', '14969', '14970', '14357']))
        self.assertEqual(3, len(set(j.name for j in g1403.samples)))

        # Check exploration suggestion for a job group.
        k1601 = [
            g.job_group for g in g1202_proto.job_groups
            if g.job_group.rome_id == 'K1601'].pop()
        self.assertEqual(
            ['16228', '38584'],
            sorted(j.code_ogr for j in k1601.samples))
        self.assertEqual(
            [u'Ludothécaire', u'Responsable de ludothèque'],
            sorted(j.name for j in k1601.samples))

        # Check exploration suggestions for a single job.
        _10979_proto = protos['10979']
        self.assertEqual(
            ['E1101'],
            sorted(g.job_group.rome_id for g in _10979_proto.job_groups))
        self.assertEqual(
            'Animation de site multimédia',
            _10979_proto.job_groups[0].job_group.name)

    def test_dataframe2dicts(self):
        """Unit tests for dataframe2dicts."""
        res = rome_mobility.dataframe2dicts(pandas.DataFrame([
            {
                'source_job_group': 's',
                'source_job': None,
                'target_job_group': 'a',
                'target_job_group_name': 'A',
                'target_job': '12',
                'target_job_name': 'one-two',
                'target_job_masculine_name': 'one-two-masculine',
                'target_job_feminine_name': 'one-two-feminine',
            },
            {
                'source_job_group': 's',
                'source_job': None,
                'target_job_group': 'a',
                'target_job_group_name': 'A',
                'target_job': '34',
                'target_job_name': 'three-four',
                'target_job_masculine_name': 'three-four-masculine',
                'target_job_feminine_name': 'three-four-feminine',
            },
        ]))
        self.assertEqual([{
            '_id': 's',
            'jobGroups': [{
                'jobGroup': {
                    'name': 'A',
                    'romeId': 'a',
                    'samples': [
                        {
                            'codeOgr': '12',
                            'name': 'one-two',
                            'masculineName': 'one-two-masculine',
                            'feminineName': 'one-two-feminine',
                        },
                        {
                            'codeOgr': '34',
                            'name': 'three-four',
                            'masculineName': 'three-four-masculine',
                            'feminineName': 'three-four-feminine',
                        },
                    ],
                },
            }]}], res)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
