"""Tests for the bob_emploi.importer.job_group_info module."""
from os import path
import unittest

from bob_emploi.frontend.api import job_pb2
from bob_emploi.lib import mongo
from bob_emploi.importer import job_group_info


class JobGroupInfoImporterTestCase(unittest.TestCase):
    """Unit tests for the Job Group Info importer."""

    rome_csv_pattern = path.join(
        path.dirname(__file__), 'testdata/unix_%s_v327_utf8.csv')
    job_images_urls_pattern = 'https://storage.gra1.cloud.ovh.net/v1/AUTH_abc%%20def/%s.jpg'
    job_requirements_json = path.join(
        path.dirname(__file__), 'testdata/job_offers/job_requirements.json')
    job_application_complexity_json = path.join(
        path.dirname(__file__), 'testdata/job_application_complexity.json')

    def test_make_dicts(self):
        """Test basic usage of the csv2dicts function."""
        collection = job_group_info.make_dicts(
            self.rome_csv_pattern, self.job_images_urls_pattern,
            self.job_requirements_json, self.job_application_complexity_json)

        self.assertEqual(531, len(collection))
        for info in collection:
            self.assertEqual(info['_id'], info['romeId'])

        job_group_protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.JobGroup))

        # Point check.
        d1501 = job_group_protos['D1501']
        self.assertEqual('Animateur de vente', d1501.samples[0].masculine_name)
        self.assertEqual(1, len(d1501.jobs), d1501.jobs)
        self.assertEqual(
            'Argumentation commerciale', d1501.requirements.skills[0].name)
        self.assertEqual(
            ['Bac', 'Brevet'],
            [d.name for d in d1501.requirements.diplomas])
        self.assertEqual(
            ['Anglais courant'],
            [e.name for e in d1501.requirements.extras])
        self.assertEqual('E', d1501.holland_code_major)
        self.assertEqual('R', d1501.holland_code_minor)
        self.assertTrue(d1501.description.startswith(
            'Effectue la promotion et la vente de vêtements'))
        self.assertTrue(d1501.working_environment.startswith(
            "L'activité de cet emploi/métier s'exerce au sein de grandes"))
        self.assertIn('Le permis B peut être requis', d1501.requirements_text)
        self.assertEqual(
            ['Boutique, commerce de détail'],
            d1501.work_environment_keywords.structures)
        self.assertEqual(
            'https://storage.gra1.cloud.ovh.net/v1/AUTH_abc%20def/F1204.jpg',
            job_group_protos['F1204'].image_link,
            msg='Image via job group ID')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
