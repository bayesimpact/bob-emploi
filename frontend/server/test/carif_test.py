"""Tests for the bob_emploi.frontend.carif module."""

from os import path
import unittest
from unittest import mock

from bob_emploi.frontend.server import carif


class CarifTestCase(unittest.TestCase):
    """Unit tests for the carif module."""

    _carif_xml_response: str

    @classmethod
    def setUpClass(cls) -> None:
        with open(path.join(path.dirname(__file__), 'testdata/carif.xml')) as carif_file:
            cls._carif_xml_response = carif_file.read()

    @mock.patch('requests.get')
    def test_get_trainings(self, mock_get: mock.MagicMock) -> None:
        """Basic usage of get_trainings."""

        mock_get().text = self._carif_xml_response
        mock_get().status_code = 200
        mock_get.reset_mock()

        trainings = carif.get_trainings('G1201', '75')

        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        self.assertEqual(1, len(args))
        self.assertRegex(args[0], r'^http://www.intercariforef.org/')
        self.assertEqual({'params'}, set(kwargs))
        self.assertEqual(
            {'idsMetiers': 'G1201', 'code-departement': '75'},
            kwargs['params'])

        self.assertEqual(
            [
                "Titre professionnel d'accompagnateur(trice) de tourisme",
                'Licence arts, lettres, langues mention langues, littérature et '
                'civilisations étrangères et régionales',
                'Licence arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours allemand',
                'Licence arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours arabe',
                'Licence arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours espagnol',
                'Licence arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours études nordiques',
                'Licence arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours italien',
                'Licences arts, lettres, langues mention langues, littératures '
                'et civilisations étrangères et régionales parcours néerlandais',
                'Licence arts, lettres, langues mention langues étrangères appliquées',
            ],
            [t.name for t in trainings])
        self.assertEqual('Paris 17e Arrondissement', trainings[7].city_name)
        self.assertEqual('http://www.intercariforef.org/', trainings[7].url)
        self.assertEqual(['14201', '14270', '15254'], trainings[7].formacodes)

    @mock.patch('requests.get')
    def test_error_code(self, mock_get: mock.MagicMock) -> None:
        """Error 500 on InterCarif."""

        mock_get().text = self._carif_xml_response
        mock_get().status_code = 500
        mock_get.reset_mock()

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    @mock.patch('requests.get')
    def test_empty_response(self, mock_get: mock.MagicMock) -> None:
        """Missing text when calling InterCarif."""

        mock_get().text = ''
        mock_get().status_code = 200
        mock_get.reset_mock()

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    @mock.patch('requests.get')
    def test_one_training(self, mock_get: mock.MagicMock) -> None:
        """Get Carif training when there's only one available."""

        with open(
                path.join(path.dirname(__file__), 'testdata/carif_single_offer.xml')) as carif_file:
            mock_get().text = carif_file.read()
        mock_get().status_code = 200
        mock_get.reset_mock()

        trainings = carif.get_trainings('G1201', '75')

        mock_get.assert_called_once()

        self.assertEqual(
            ['CQP plongeur - officier de cuisine'], [t.name for t in trainings])
        self.assertEqual('Boulogne-Billancourt', trainings[0].city_name)
        self.assertEqual('http://www.intercariforef.org', trainings[0].url)
        self.assertEqual(['42780'], trainings[0].formacodes)


if __name__ == '__main__':
    unittest.main()
