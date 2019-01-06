"""Common geographic function for the frontend server."""

import logging
import os
import typing

from algoliasearch import algoliasearch
from google.protobuf import json_format
from pymongo import database as pymongo_database

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import geo_pb2

_DEPARTEMENTS: proto.MongoCachedCollection[geo_pb2.Departement] = \
    proto.MongoCachedCollection(geo_pb2.Departement, 'departements')

_ALGOLIA_INDEX: typing.List[algoliasearch.Client] = []


def list_all_departements(database: pymongo_database.Database) -> typing.KeysView[str]:
    """List all French département IDs."""

    return _DEPARTEMENTS.get_collection(database).keys()


def get_departement_name(
        database: pymongo_database.Database, departement_id: str) -> str:
    """Get a departement name."""

    return _DEPARTEMENTS.get_collection(database)[departement_id].name


def get_departement_id(database: pymongo_database.Database, name: str) -> str:
    """Get a departement ID from its name."""

    departements = _DEPARTEMENTS.get_collection(database)
    try:
        return next(
            (departement_id for departement_id, departement in departements.items()
             if departement.name == name))
    except StopIteration:
        raise KeyError(name)


def get_in_a_departement_text(database: pymongo_database.Database, departement_id: str) -> str:
    """Compute the French text for "in the Departement" for the given ID."""

    departement_name = get_departement_name(database, departement_id)
    if departement_name.startswith('La '):
        departement_name = departement_name[len('La '):]
    return _DEPARTEMENTS.get_collection(database)[departement_id].prefix + departement_name


def get_city_location(database: pymongo_database.Database, city_id: str) \
        -> typing.Optional[geo_pb2.FrenchCity]:
    """Get lat/long coordinates for a city from its ID."""

    fetched = proto.fetch_from_mongo(database, geo_pb2.FrenchCity, 'cities', city_id)
    if fetched:
        fetched.city_id = city_id
    return fetched


def get_city_proto(city_id: str) -> typing.Optional[geo_pb2.FrenchCity]:
    """Compute a full FrenchCity proto from a simple city_id."""

    if not city_id:
        return None
    if not _ALGOLIA_INDEX:
        _ALGOLIA_INDEX.append(algoliasearch.Client(
            os.getenv('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
            os.getenv('ALGOLIA_API_KEY', 'da4db0bf437e37d6d49cefcb8768c67a')).init_index('cities'))

    try:
        algolia_city = _ALGOLIA_INDEX[0].get_object(city_id)
    except algoliasearch.AlgoliaException as err:
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
