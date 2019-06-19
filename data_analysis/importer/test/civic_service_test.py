"""Tests for the bob_emploi.importer.civic_service module."""

from os import path
import unittest
from unittest import mock

from bob_emploi.frontend.api import association_pb2
from bob_emploi.data_analysis.importer import civic_service

from bob_emploi.data_analysis.lib import mongo


class CivicServiceImporterTestCase(unittest.TestCase):
    """Unit tests for the civic service importer."""

    data_folder = path.dirname(__file__)
    civic_service_missions_csv = path.join(
        data_folder, 'testdata/civic_service_offers_2018-01-02.csv')
    today = '2018-01-02'

    @mock.patch(civic_service.__name__ + '.check_coverage')
    def test_csv2dicts(self, mock_check_coverage: mock.MagicMock) -> None:
        """Test basic usage of the csv2dicts function."""

        # Coverage check is skipped for this test.
        mock_check_coverage.return_value = True

        missions = civic_service.csv2dicts(self.civic_service_missions_csv, self.today)

        missions_proto = dict(mongo.collection_to_proto_mapping(
            missions, association_pb2.VolunteeringMissions))

        self.assertEqual(['45', '59', '63'], sorted(list(missions_proto.keys())))

        loiret_missions = missions_proto['45']
        # The maximum number of missions required is 5.
        self.assertEqual(5, len(loiret_missions.missions))
        self.assertEqual(
            [
                'Solidarité',
                'Éducation pour tous',
                'Solidarité',
                'Solidarité',
                'Environnement'
            ],
            [mission.domain for mission in loiret_missions.missions])
        self.assertEqual(
            [
                'Direction départementale des finances publiques de la charente',
                'Association brin de ficelle',
                'Ufcv auvergne/rhône-alpes',
                'Pole emploi midi pyrenees',
                'Mairie de paris'
            ],
            [mission.association_name for mission in loiret_missions.missions])
        self.assertEqual('1ᵉʳ mars 2018', loiret_missions.missions[1].start_date)
        self.assertEqual(
            'Contribuer à la qualité des relations des services ' +
            'des finances publiques avec leurs usagers', loiret_missions.missions[0].title)

    @mock.patch(civic_service.__name__ + '.check_coverage')
    def test_csv2dicts_with_outdated_file(self, mock_check_coverage: mock.MagicMock) -> None:
        """Test the csv2dicts function with outdated file."""

        self.today = '2018-01-03'
        # Coverage check is skipped for this test.
        mock_check_coverage.return_value = True

        with self.assertRaises(ValueError):
            civic_service.csv2dicts(self.civic_service_missions_csv, self.today)

    def test_csv2dicts_with_low_coverage(self) -> None:
        """Test the csv2dicts function with low coverage data."""

        with self.assertRaises(ValueError):
            civic_service.csv2dicts(self.civic_service_missions_csv, self.today)


if __name__ == '__main__':
    unittest.main()
