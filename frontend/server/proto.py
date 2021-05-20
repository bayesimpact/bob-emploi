"""Module to help the frontend manipulate protobuffers."""

import collections
import datetime
import logging
import os
import typing
from typing import Any, Callable, Dict, Iterator, ItemsView, KeysView, List, Literal, Optional, \
    Tuple, Type, Union

from google.protobuf import json_format
from google.protobuf import message
from google.protobuf import timestamp_pb2

from bob_emploi.common.python import now
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.server import cache
from bob_emploi.frontend.server import mongo

_CACHE_DURATION = datetime.timedelta(hours=1)
_IS_TEST_ENV = bool(os.getenv('TEST_ENV'))

_Type = typing.TypeVar('_Type')
_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


# TODO(cyrille): Maybe get the id_field from proto option.
def parse_from_mongo(
        mongo_dict: Optional[Dict[str, Any]],
        proto: message.Message, id_field: Optional[str] = None) -> bool:
    """Parse a Protobuf from a dict coming from MongoDB.

    Args:
        mongo_dict: a dict coming from MongoDB, or None. This dict will be
            modified by the function: it removes all the keys prefixed by "_"
            and convert datetime objects to iso strings.
        proto: a protobuffer to merge data into.
        id_field (optional): a field in the proto where we wish to put the mongo ID. It must be a
            string field.
    Returns: a boolean indicating whether the input had actual data.
    """

    if mongo_dict is None:
        return False
    message_id = str(mongo_dict.pop('_id', ''))
    to_delete = [k for k in mongo_dict if k.startswith('_')]
    for key in to_delete:
        del mongo_dict[key]
    _convert_datetimes_to_string(mongo_dict)
    try:
        json_format.ParseDict(mongo_dict, proto, ignore_unknown_fields=not _IS_TEST_ENV)
    except json_format.ParseError as error:
        if _IS_TEST_ENV:
            raise error
        logging.warning(
            'Error %s while parsing a JSON dict for proto type %s:\n%s',
            error, proto.__class__.__name__, mongo_dict)
        return False
    if message_id and id_field:
        setattr(proto, id_field, message_id)
    return True


@typing.overload
def create_from_mongo(
        mongo_dict: Optional[Dict[str, Any]],
        proto_type: Type[_ProtoType],
        id_field: Optional[str] = None,
        always_create: Literal[True] = True) -> _ProtoType:
    ...


@typing.overload
def create_from_mongo(
        mongo_dict: Optional[Dict[str, Any]],
        proto_type: Type[_ProtoType],
        id_field: Optional[str] = None,
        always_create: Literal[False] = ...) -> Optional[_ProtoType]:
    ...


def create_from_mongo(
        mongo_dict: Optional[Dict[str, Any]],
        proto_type: Type[_ProtoType],
        id_field: Optional[str] = None,
        always_create: bool = True) -> Optional[_ProtoType]:
    """Create a Protobuf from a dict coming from MongoDB.

    Args:
        mongo_dict: a dict coming from MongoDB, or None. This dict will be
            modified by the function: it removes all the keys prefixed by "_"
            and convert datetime objects to iso strings.
        proto_type: a protobuffer type to create the data from.
        id_field (optional): a field in the proto where we wish to put the mongo ID. It must be a
            string field.
        always_create: when True, this function creates an empty proto if the
            entry is empty or if the parsing fails.
    Returns: a populated instance of the proto or None if there was an error.
    """

    assert issubclass(proto_type, message.Message)
    proto = proto_type()
    if not parse_from_mongo(mongo_dict, proto, id_field) and not always_create:
        return None
    return proto


_DATABASE: List[mongo.NoPiiMongoDatabase] = []
_MongoFindOneOutType = Optional[Dict[str, Any]]


def _find_one(collection: str, document_id: str) -> _MongoFindOneOutType:
    return typing.cast(
        Optional[Dict[str, Any]],
        _DATABASE[0][collection].find_one({'_id': document_id}))


_CacheKeyType = Tuple[str, str]
_CacheValueType = Tuple[_MongoFindOneOutType, datetime.datetime]


# Put _find_one as __init__ parameter if we ever need a LRU Cache with TTL somewhere else.
class _CacheMongoDocuments:
    """A LRU cache for fetching documents in mongo by ID, with a TTL on each document.

    Instances can be considered as functions with the same signature as _find_one.

    Initialization args:
    - max_size: the size of the LRU cache, i.e. the maximum number of documents we want to keep at
        any given time. If more non-cached documents are required, the least recent used document
        will be thrown out from the cache.
    - ttl: the time to live for each document in the cache. After this time, documents will be
        fetched from Mongo again. Note that documents are not deleted at invalidation time, but only
        if space is needed in the cache.
    """

    def __init__(self, max_size: int = 256, ttl: datetime.timedelta = _CACHE_DURATION) -> None:
        self._cache: 'collections.OrderedDict[_CacheKeyType, _CacheValueType]' = \
            collections.OrderedDict()
        self._max_size = max_size
        self._ttl = ttl
        cache.register_clear_func(self.cache_clear)

    def __call__(self, collection: str, document_id: str) -> _MongoFindOneOutType:
        cached_documents = self._cache
        instant = now.get()
        args = (collection, document_id)
        if args in cached_documents:
            result, invalidation_date = cached_documents[args]
            if invalidation_date > instant:
                cached_documents.move_to_end(args)
                return result
        result = _find_one(*args)
        invalidation_date = instant + self._ttl
        cached_documents[args] = result, invalidation_date
        if len(cached_documents) > self._max_size:
            for key in cached_documents:
                if cached_documents[key][1] > instant:
                    del cached_documents[key]
                    break
            else:
                cached_documents.popitem(last=False)
        return result

    def cache_clear(self) -> None:
        """Clear cache associated with this function."""

        self._cache.clear()


_CACHED_FIND_ONE = _CacheMongoDocuments()


def fetch_from_mongo(
        database: mongo.NoPiiMongoDatabase,
        proto_type: Type[_ProtoType],
        collection: str,
        document_id: str,
        id_field: Optional[str] = None) -> Optional[_ProtoType]:
    """Fetch a (possibly cached) document from MongoDB and parse it to a Protobuf message.

    Args:
        database: A pymongo database in which to look for the given document.
        proto_type: a protobuffer type to create the data from.
        collection: the name of the collection where the document is in the database.
        document_id: the ID of the desired document.
        id_field (optional): a field in the proto where we wish to put the mongo ID. It must be a
            string field.
    """

    if _DATABASE:
        _DATABASE[0] = database
    else:
        _DATABASE.append(database)
    mongo_dict = _CACHED_FIND_ONE(collection, document_id)
    return create_from_mongo(mongo_dict, proto_type, id_field, always_create=False)


def _convert_datetimes_to_string(
        values: Union[Dict[Any, Any], List[Any]]) -> None:
    if isinstance(values, dict):
        for key, value in values.items():
            if isinstance(value, datetime.datetime):
                values[key] = value.isoformat() + 'Z'
                continue
            _convert_datetimes_to_string(value)
        return
    if isinstance(values, list):
        for i, value in enumerate(values):
            if isinstance(value, datetime.datetime):
                values[i] = value.isoformat() + 'Z'
                continue
            _convert_datetimes_to_string(value)


def _cache_mongo_collection(
        mongo_iterator: Callable[[], Iterator[Dict[str, Any]]],
        proto_type: type, id_field: Optional[str],
        update_func: Optional[Callable[[_ProtoType, str], None]] = None) \
        -> Dict[str, _ProtoType]:
    """Cache in memory the content of a Mongo request returning protos.

    Args:
        mongo_iterator: a function that iterates over mongo documents.
        proto_type: the python proto class for the expected proto type.
        id_field (optional): the field in the proto where to put the id.
        update_func: an optional function to call on each proto once imported.
    Returns:
        dict with all protos. The keys are the "_id" values.
    """

    documents: Dict[str, _ProtoType] = {}

    for document in mongo_iterator():
        _id = str(document['_id'])
        proto = typing.cast(_ProtoType, create_from_mongo(document, proto_type, id_field))
        if update_func:
            update_func(proto, _id)
        documents[_id] = proto

    return documents


class CachedCollection(typing.Generic[_Type]):
    """A collection of items cached for some time."""

    _global_cache_version = 0

    def __init__(
            self,
            get_values: Callable[[], Dict[str, _Type]],
            cache_duration: datetime.timedelta = _CACHE_DURATION):
        self._get_values = get_values
        self._cache: Optional[Dict[str, _Type]] = None
        self._cached_valid_until: Optional[datetime.datetime] = None
        self._cache_duration = cache_duration
        self._cache_version = self._global_cache_version

    @classmethod
    def update_cache_version(cls) -> None:
        """Forces all cached collection to deprecate their cache."""

        cls._global_cache_version += 1

    @property
    def is_cached(self) -> bool:
        """Returns whether this object holds some cached data."""

        return bool(self._cache)

    def _ensure_cache(self) -> Dict[str, _Type]:
        instant = now.get()
        if self._cached_valid_until and self._cached_valid_until >= instant and \
                self._cache_version >= self._global_cache_version and self._cache is not None:
            return self._cache
        values = self._get_values()
        self._cache = values
        self._cache_version = self._global_cache_version
        self._cached_valid_until = instant + self._cache_duration
        return values

    def __getattr__(self, prop: str) -> Any:
        return getattr(self._ensure_cache(), prop)

    def __getitem__(self, key: str) -> _Type:
        return self._ensure_cache()[key]

    def __iter__(self) -> Iterator[_Type]:
        return iter(self.values())

    def __contains__(self, key: str) -> bool:
        return key in self._ensure_cache()

    def __bool__(self) -> bool:
        return bool(self._ensure_cache())

    def keys(self) -> KeysView[str]:  # pylint: disable=invalid-name
        """The set of keys of the collection."""

        return self._ensure_cache().keys()

    def items(self) -> ItemsView[str, _Type]:
        """All items of the collection."""

        return self._ensure_cache().items()

    def get(  # pylint: disable=invalid-name
            self, key: str, default: Optional[_Type] = None) -> Optional[_Type]:
        """The value at the given key, or the default value if the key is not in the collection."""

        return self._ensure_cache().get(key, default)


cache.register_clear_func(CachedCollection.update_cache_version)


class MongoCachedCollection(typing.Generic[_ProtoType]):
    """Handler for a collection of protobuffers in MongoDB."""

    def __init__(
            self, proto_type: type, collection_name: str, id_field: Optional[str] = None,
            update_func: Optional[Callable[[_ProtoType, str], None]] = None,
            query: Optional[Dict[str, Any]] = None,
            sort_key: Optional[str] = None):
        """Creates a new collection.

        Args:
            proto_type: the python proto class for the expected proto type.
            collection_name: a MongoDB collection_name that holds he original protobuffers.
            id_field (optional): the field in the proto where to put the _id field from mongo.
            update_func: an optional function to call on each proto once imported.
        """

        self._collection_name = collection_name
        self._proto_type = proto_type
        self._id_field = id_field
        self._update_func = update_func
        self._query = query
        self._sort_key = sort_key

        self._cache: Optional[CachedCollection[_ProtoType]] = None
        self._database: Optional[mongo.NoPiiMongoDatabase] = None

    def get_collection(self, database: mongo.NoPiiMongoDatabase) -> CachedCollection[_ProtoType]:
        """Gets access to the collection for a database."""

        if self._cache and database is self._database:
            return self._cache
        self._database = database
        self._cache = CachedCollection(self._get_values)
        return self._cache

    # TODO(cyrille): Remove, since we have another way to deprecate cache.
    def reset_cache(self) -> None:
        """Reset any cache that this function could hold."""

        self._cache = None
        self._database = None

    def _get_values(self) -> Dict[str, _ProtoType]:
        def _mongo_iterator() -> Iterator[Dict[str, Any]]:
            assert self._database
            # TODO(pascal): Type pymongo find method and remove the cast.
            return typing.cast(
                Iterator[Dict[str, Any]],
                self._database.get_collection(self._collection_name).find(
                    self._query, sort=((self._sort_key, 1),) if self._sort_key else None))
        return _cache_mongo_collection(
            _mongo_iterator, self._proto_type, self._id_field, self._update_func)


def datetime_to_json_string(instant: datetime.datetime) -> str:
    """Convert a python datetime to a Json string compatible with the Timestamp proto."""

    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(instant)
    return typing.cast(str, json_format.MessageToDict(timestamp))


def list_translatable_fields(proto_type: Type[_ProtoType]) -> Iterator[str]:
    """List all fields that are translatable."""

    for field in proto_type.DESCRIPTOR.fields:
        if options_pb2.NATURAL_LANGUAGE in field.GetOptions().Extensions[options_pb2.string_format]:
            yield field.name
