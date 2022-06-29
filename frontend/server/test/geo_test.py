"""Unit tests for the module frontend.geo."""

import os
import unittest
from unittest import mock

import mongomock

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import mongo


_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


class DepartementCase(unittest.TestCase):
    """Unit tests for departement functions."""

    def setUp(self) -> None:
        super().setUp()
        geo.i18n.cache.clear()
        self._db = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        self._db.departements.insert_many([
            {
                '_id': '13',
                'name': 'Bouches-du-Rhône',
                'prefix': 'dans les ',
            },
            {
                '_id': '19',
                'name': 'Corrèze',
                'prefix': 'en ',
            },
            {
                '_id': '31',
                'name': 'Haute-Garonne',
                'prefix': 'en ',
            },
            {
                '_id': '58',
                'name': 'Nièvre',
                'prefix': 'dans la ',
            },
            {
                '_id': '75',
                'name': 'Paris',
                'prefix': 'à ',
            },
            {
                '_id': '971',
                'name': 'Guadeloupe',
                'prefix': 'en ',
            },
            {
                '_id': '974',
                'name': 'La Réunion',
                'prefix': 'à la ',
            },
        ])

    def test_get_departement_name(self) -> None:
        """Point checks for the get_departement_name func."""

        self.assertEqual('Guadeloupe', geo.get_departement_name(self._db, '971'))
        self.assertEqual('Nièvre', geo.get_departement_name(self._db, '58'))
        self.assertEqual('La Réunion', geo.get_departement_name(self._db, '974'))

    def test_get_departement_name_unknown_id(self) -> None:
        """Check get_departement_name on an unknown département."""

        with self.assertRaises(KeyError):
            geo.get_departement_name(self._db, 'xxx')

    def test_get_departement_id(self) -> None:
        """Point checks for the get_departement_id func."""

        self.assertEqual('971', geo.get_departement_id(self._db, 'Guadeloupe'))
        self.assertEqual('58', geo.get_departement_id(self._db, 'Nièvre'))

    def test_get_departement_id_unknown_name(self) -> None:
        """Check get_in_a_departement_text on an unknown département."""

        with self.assertRaises(KeyError):
            geo.get_departement_id(self._db, 'Unknown departement name')

    def test_get_in_a_departement_text(self) -> None:
        """Point checks for the get_in_a_departement_text func."""

        self.assertEqual('en Corrèze', geo.get_in_a_departement_text(self._db, '19'))
        self.assertEqual('en Haute-Garonne', geo.get_in_a_departement_text(self._db, '31'))
        self.assertEqual('à Paris', geo.get_in_a_departement_text(self._db, '75'))
        self.assertEqual('dans les Bouches-du-Rhône', geo.get_in_a_departement_text(self._db, '13'))
        self.assertEqual('à la Réunion', geo.get_in_a_departement_text(self._db, '974'))

    @mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
    def test_get_in_a_departement_text_english(self) -> None:
        """The in_a_departement text is translated."""

        self.assertEqual('in Corrèze', geo.get_in_a_departement_text(self._db, '19', locale='en'))

    def test_get_in_a_departement_text_city_hint(self) -> None:
        """Test get_in_a_departement_text func with a city hing."""

        self.assertEqual(
            'in Illinois',
            geo.get_in_a_departement_text(self._db, '19', city_hint=geo_pb2.FrenchCity(
                departement_id='19',
                departement_name='Illinois',
                departement_prefix='in ',
            )))

    def test_get_in_a_departement_text_missing_id(self) -> None:
        """Check get_in_a_departement_text on an unknown département."""

        with self.assertRaises(KeyError):
            geo.get_in_a_departement_text(self._db, '999')


class GetCityTest(unittest.TestCase):
    """Unit tests for the get_city_proto function."""

    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(geo.__name__ + '.search_client')
        self.cities_index = patcher.start().SearchClient.create().init_index()
        self.addCleanup(patcher.stop)

        geo._get_algolia_index.cache_clear()  # pylint: disable=protected-access

    def test_no_city_id(self) -> None:
        """No city_id."""

        self.assertFalse(geo.get_city_proto(''))

    def test_unknown_city(self) -> None:
        """Unknown city."""

        self.cities_index.get_object.return_value = None
        self.assertFalse(geo.get_city_proto('69386'))

        self.cities_index.get_object.assert_called_once_with('69386')

    def test_get_city_proto(self) -> None:
        """Get a city proto from Algolia."""

        self.cities_index.get_object.return_value = {
            'name': 'Lyon 6e arrondissement',
            'departementId': '69',
            'transport': 6,
            'urban': 0,
            'zipCode': '69006',
            'otherField': 'yipe',
        }

        city = geo.get_city_proto('69386')

        assert city

        self.assertEqual('Lyon 6e arrondissement', city.name)
        self.assertEqual('69', city.departement_id)
        self.assertEqual(-1, city.urban_score)
        self.assertEqual(6, city.public_transportation_score)
        self.assertEqual('69006', city.postcodes)
        self.cities_index.get_object.assert_called_once_with('69386')

    @mock.patch('logging.warning')
    def test_format_error(self, mock_logging: mock.MagicMock) -> None:
        """The data returned by Algolia is not compatible."""

        self.cities_index.get_object.return_value = {
            'population': 'not a number',
        }

        self.assertFalse(geo.get_city_proto('69386'))
        mock_logging.assert_called_once()


if __name__ == '__main__':
    unittest.main()
