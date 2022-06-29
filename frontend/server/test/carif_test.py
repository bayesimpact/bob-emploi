"""Tests for the bob_emploi.frontend.carif module."""

from os import path
import unittest

import requests_mock

from bob_emploi.frontend.server import carif


@requests_mock.mock()
class CarifTestCase(unittest.TestCase):
    """Unit tests for the carif module."""

    _carif_xml_response: str

    @classmethod
    def setUpClass(cls) -> None:
        carif_file_name = path.join(path.dirname(__file__), 'testdata/carif.xml')
        with open(carif_file_name, encoding='utf-8') as carif_file:
            cls._carif_xml_response = carif_file.read()

    def test_get_trainings(self, mock_requests: 'requests_mock._RequestObjectProxy') -> None:
        """Basic usage of get_trainings."""

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            text=self._carif_xml_response)

        trainings = carif.get_trainings('G1201', '75')

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

    def test_error_code(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Error 500 on InterCarif."""

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            status_code=500,
            text=self._carif_xml_response)

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    def test_empty_response(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Missing text when calling InterCarif."""

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            text='')

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    def test_no_offers(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Missing content when calling InterCarif."""

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            text='<lheo-index xmlns="http://www.lheo.org/2.2"><resumes-offres /></lheo-index>')

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    def test_incomplete_offer(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Missing content in an offer when calling InterCarif."""

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            text='''<lheo-index xmlns="http://www.lheo.org/2.2">
<resumes-offres>
<resume-offre numero="14_AF_0000011179_SE_0000093700" file="http://www.intercariforef.org/">
<domaine-formation>
</domaine-formation>
</resume-offre>
</resumes-offres>
</lheo-index>''')

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual([], trainings)

    def test_one_training(self, mock_requests: 'requests_mock.Mocker') -> None:
        """Get Carif training when there's only one available."""

        carif_file_name = path.join(path.dirname(__file__), 'testdata/carif_single_offer.xml')
        with open(carif_file_name, encoding='utf-8') as carif_file:
            response_text = carif_file.read()

        mock_requests.get(
            'https://ws.intercariforef.org/serviceweb2/offre-info/?'
            'idsMetiers=G1201&code-departement=75',
            text=response_text)

        trainings = carif.get_trainings('G1201', '75')

        self.assertEqual(
            ['CQP plongeur - officier de cuisine'], [t.name for t in trainings])
        self.assertEqual('Boulogne-Billancourt', trainings[0].city_name)
        self.assertEqual('http://www.intercariforef.org', trainings[0].url)
        self.assertEqual(['42780'], trainings[0].formacodes)


if __name__ == '__main__':
    unittest.main()
