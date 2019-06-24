"""Tests for the bob_emploi.importer.recent_job_offers_count module."""

from os import path
import unittest
from unittest import mock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.importer import recent_job_offers_count
from bob_emploi.data_analysis.lib import mongo


@mock.patch(recent_job_offers_count.tqdm.__name__ + '.tqdm', new=lambda iterable, **kw: iterable)
class RecentJobOffersCountTestCase(unittest.TestCase):
    """Tests for the recent job offers download_and_count function."""

    testdata_folder = path.join(
        path.dirname(__file__), 'testdata/job_offers')

    @mock.patch(recent_job_offers_count.__name__ + '.emploi_store')
    def test_basic_usage(self, mock_emploi_store: mock.MagicMock) -> None:
        """Basic usage."""

        mock_resource = mock_emploi_store.Client().get_package().get_resource()
        mock_resource.records.return_value = [
            {'DEPARTEMENT_CODE': '69', 'ROME_PROFESSION_CARD_CODE': 'A1234'},
            {'DEPARTEMENT_CODE': '69', 'ROME_PROFESSION_CARD_CODE': 'A1234'},
            {'DEPARTEMENT_CODE': '69', 'ROME_PROFESSION_CARD_CODE': 'A1234'},
            {'DEPARTEMENT_CODE': '01', 'ROME_PROFESSION_CARD_CODE': 'A1234'},
        ]
        counts = recent_job_offers_count.download_and_count(file=mock.MagicMock())

        counts_proto = dict(mongo.collection_to_proto_mapping(
            counts, job_pb2.LocalJobStats))

        self.assertEqual(set(['69:A1234', '01:A1234']), set(counts_proto))

        self.assertEqual(3, counts_proto['69:A1234'].num_available_job_offers)
        self.assertEqual(1, counts_proto['01:A1234'].num_available_job_offers)


if __name__ == '__main__':
    unittest.main()
