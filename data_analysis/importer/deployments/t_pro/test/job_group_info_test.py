"""Tests for the bob_emploi.importer.deployments.t_pro.job_group_info module."""

from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer.deployments.t_pro import job_group_info


class JobGroupInfoImporterTestCase(unittest.TestCase):
    """Unit tests for the Job Group Info importer."""

    data_folder = path.join(path.dirname(__file__), 'testdata')
    rome_csv_pattern = path.join(data_folder, 'unix_{}_v327_utf8.csv')
    job_requirements_json = path.join(data_folder, 'job_requirements.json')
    metiers_xlsx = path.join(data_folder, 'metiers_porteurs.xlsx')

    def test_make_dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = job_group_info.make_dicts(
            job_requirements_json=self.job_requirements_json,
            rome_csv_pattern=self.rome_csv_pattern,
            metiers_xlsx=self.metiers_xlsx)

        self.assertEqual(80, len(collection))
        for info in collection:
            self.assertEqual(info['_id'], info['romeId'])

        job_group_protos = dict(mongo.collection_to_proto_mapping(collection, job_pb2.JobGroup))

        self.assertNotIn(
            'D1501', job_group_protos, msg='Unauthorized job present in the collection.')

        d1101 = job_group_protos['D1101']
        self.assertEqual(1, len(d1101.samples), msg=d1101.jobs)
        self.assertEqual('Bouchers', d1101.samples[0].name)
        self.assertEqual(
            ['Bac', 'Brevet'],
            [d.name for d in d1101.requirements.diplomas])
        self.assertEqual(
            ['Anglais courant'],
            [e.name for e in d1101.requirements.extras])
        self.assertIn('Réalise les opérations de préparation de viandes', d1101.description)
