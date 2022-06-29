"""Common geographic function for the frontend server."""

import functools
import logging
import os
from typing import KeysView, Optional

from algoliasearch import exceptions
from algoliasearch import search_client
from algoliasearch import search_index
from google.protobuf import json_format

from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2

_DEPARTEMENTS: proto.MongoCachedCollection[geo_pb2.Departement] = \
    proto.MongoCachedCollection(geo_pb2.Departement, 'departements')
_IN_DEPARTEMENT = i18n.make_translatable_string('en {departement_name}')


@functools.lru_cache()
def _get_algolia_index() -> search_index.SearchIndex:
    return search_client.SearchClient.create(
        os.getenv('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
        os.getenv('ALGOLIA_API_KEY', 'da4db0bf437e37d6d49cefcb8768c67a')).init_index('cities')


def list_all_departements(database: mongo.NoPiiMongoDatabase) -> KeysView[str]:
    """List all French département IDs."""

    return _DEPARTEMENTS.get_collection(database).keys()


def get_departement_name(
        database: mongo.NoPiiMongoDatabase, departement_id: str) -> str:
    """Get a departement name."""

    return _DEPARTEMENTS.get_collection(database)[departement_id].name


def get_departement_id(database: mongo.NoPiiMongoDatabase, name: str) -> str:
    """Get a departement ID from its name."""

    departements = _DEPARTEMENTS.get_collection(database)
    try:
        return next(
            departement_id for departement_id, departement in departements.items()
            if departement.name == name)
    except StopIteration:
        # pylint: disable=raise-missing-from
        raise KeyError(name)


def get_in_a_departement_text(
        database: mongo.NoPiiMongoDatabase,
        departement_id: str, *,
        locale: str = 'fr',
        city_hint: Optional[geo_pb2.FrenchCity] = None) -> str:
    """Compute the French text for "in the Departement" for the given ID."""

    if city_hint and city_hint.departement_name:
        departement_name = city_hint.departement_name
    else:
        departement_name = get_departement_name(database, departement_id)
    if departement_name.startswith('La '):
        departement_name = departement_name[len('La '):]

    try:
        return i18n.translate_string(_IN_DEPARTEMENT, locale)\
            .format(departement_name=departement_name)
    except i18n.TranslationMissingException:
        pass

    if city_hint and city_hint.departement_prefix:
        prefix = city_hint.departement_prefix
    else:
        prefix = _DEPARTEMENTS.get_collection(database)[departement_id].prefix
    return prefix + departement_name


def get_city_location(database: mongo.NoPiiMongoDatabase, city_id: str) \
        -> Optional[geo_pb2.FrenchCity]:
    """Get lat/long coordinates for a city from its ID."""

    fetched = proto.fetch_from_mongo(database, geo_pb2.FrenchCity, 'cities', city_id)
    if fetched:
        fetched.city_id = city_id
    return fetched


def get_city_proto(city_id: str) -> Optional[geo_pb2.FrenchCity]:
    """Compute a full FrenchCity proto from a simple city_id."""

    if not city_id:
        return None

    try:
        algolia_city = _get_algolia_index().get_object(city_id)
    except exceptions.AlgoliaException as err:
        logging.warning('Error in algolia: %s for city ID %s', err, city_id)
        return None
    if not algolia_city:
        return None

    # Keep in sync with frontend/src/components/suggestions.jsx
    if 'urban' in algolia_city:
        urban = algolia_city.pop('urban')
        algolia_city['urbanScore'] = urban if urban else -1
    if 'transport' in algolia_city:
        algolia_city['publicTransportationScore'] = algolia_city.pop('transport')
    if 'zipCode' in algolia_city:
        algolia_city['postcodes'] = algolia_city.pop('zipCode')

    city = geo_pb2.FrenchCity(city_id=city_id)
    try:
        json_format.ParseDict(algolia_city, city, ignore_unknown_fields=True)
    except json_format.ParseError as error:
        logging.warning(
            'Error %s while parsing a city proto from Algolia:\n%s',
            error, algolia_city)
        return None

    return city
