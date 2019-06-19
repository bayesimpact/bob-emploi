"""Tests for the bob_emploi.importer.reorient_jobbing module."""

from os import path
import unittest

from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.data_analysis.importer import reorient_jobbing

from bob_emploi.data_analysis.lib import mongo


class ReorientJobbingImporterTestCase(unittest.TestCase):
    """Unit tests for the ReorientJobbing importer."""

    data_folder = path.dirname(__file__)
    market_score = path.join(data_folder, 'testdata/imt/market_score.csv')
    offers_csv = path.join(data_folder, 'testdata/job_offers/offers_per_departement.csv')
    rome_job_groups = path.join(data_folder, 'testdata/unix_referentiel_code_rome_v327_utf8.csv')
    item_arborescence = path.join(data_folder, 'testdata/unix_item_arborescence_v333_utf8.csv')
    referentiel_apellation = path.join(
        data_folder, 'testdata/unix_referentiel_appellation_v327_utf8.csv')

    def test_csv2dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        offers = reorient_jobbing.csv2dicts(
            self.market_score, self.offers_csv, self.rome_job_groups, self.item_arborescence,
            self.referentiel_apellation)

        offers_proto = dict(mongo.collection_to_proto_mapping(
            offers, reorient_jobbing_pb2.LocalJobbingStats))

        self.assertEqual(['45'], list(offers_proto.keys()))

        loiret_offers = offers_proto['45']
        # The maximum number of jobs required is 5.
        self.assertEqual(5, len(loiret_offers.departement_job_stats.jobs))
        self.assertEqual(['A1401', 'N1101', 'N4104', 'N4102', 'A1413'], [
            job.rome_id for job in loiret_offers.departement_job_stats.jobs])
        self.assertEqual([69, 61, 60, 56, 55], [
            job.offers for job in loiret_offers.departement_job_stats.jobs])
        self.assertEqual(
            'Aide arboricole', loiret_offers.departement_job_stats.jobs[1].feminine_name)
        self.assertEqual(
            'Maître / Maîtresse de chai', loiret_offers.departement_job_stats.jobs[3].name)
        self.assertEqual(
            'Maître de chai', loiret_offers.departement_job_stats.jobs[3].masculine_name)


if __name__ == '__main__':
    unittest.main()
