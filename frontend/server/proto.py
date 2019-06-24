"""Module to help the frontend manipulate protobuffers."""

import base64
import collections
import datetime
import functools
import logging
import os
import typing

try:
    import flask
except ImportError:
    # Data Analysis Prepare use this module without flask (only for
    # parse_from_mongo). If flask is missing the flask_api decorator won't work
    # but the rest will.
    pass

from google.protobuf import json_format
from google.protobuf import message
from google.protobuf import timestamp_pb2
import pymongo

from bob_emploi.frontend.server import now

_CACHE_DURATION = datetime.timedelta(hours=1)
_IS_TEST_ENV = bool(os.getenv('TEST_ENV'))

_Type = typing.TypeVar('_Type')
_ProtoType1 = typing.TypeVar('_ProtoType1', bound=message.Message)
_ProtoType2 = typing.TypeVar('_ProtoType2', bound=message.Message)


# TODO(cyrille): Maybe get the id_field from proto option.
def parse_from_mongo(
        mongo_dict: typing.Optional[typing.Dict[str, typing.Any]],
        proto: message.Message, id_field: typing.Optional[str] = None) -> bool:
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


# TODO(cyrille): overload to have non Optional output when there are only two parameters.
def create_from_mongo(
        mongo_dict: typing.Optional[typing.Dict[str, typing.Any]],
        proto_type: typing.Type[_ProtoType1],
        id_field: typing.Optional[str] = None,
        always_create: bool = True) -> typing.Optional[_ProtoType1]:
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


_DATABASE: typing.List[pymongo.database.Database] = []
_MongoFindOneOutType = typing.Optional[typing.Dict[str, typing.Any]]


def _find_one(collection: str, document_id: str) -> _MongoFindOneOutType:
    return typing.cast(
        typing.Optional[typing.Dict[str, typing.Any]],
        _DATABASE[0][collection].find_one({'_id': document_id}))


_CacheKeyType = typing.Tuple[str, str]
_CacheValueType = typing.Tuple[_MongoFindOneOutType, datetime.datetime]


# Put _find_one as __init__ parameter if we ever need a LRU Cache with TTL somewhere else.
class _CacheMongoDocuments(object):
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

    def __call__(self, collection: str, document_id: str) -> _MongoFindOneOutType:
        cache = self._cache
        instant = now.get()
        args = (collection, document_id)
        if args in cache:
            result, invalidation_date = cache[args]
            if invalidation_date > instant:
                cache.move_to_end(args)
                return result
        result = _find_one(*args)
        invalidation_date = instant + self._ttl
        cache[args] = result, invalidation_date
        if len(cache) > self._max_size:
            for key in cache:
                if cache[key][1] > instant:
                    del cache[key]
                    break
            else:
                cache.popitem(last=False)
        return result

    def cache_clear(self) -> None:
        """Clear cache associated with this function."""

        self._cache.clear()


_CACHED_FIND_ONE = _CacheMongoDocuments()


def fetch_from_mongo(
        database: pymongo.database.Database,
        proto_type: typing.Type[_ProtoType1],
        collection: str,
        document_id: str,
        id_field: typing.Optional[str] = None) -> typing.Optional[_ProtoType1]:
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


def clear_mongo_fetcher_cache() -> None:
    """Clear the cache on fetch_from_mongo."""

    _CACHED_FIND_ONE.cache_clear()


def _convert_datetimes_to_string(
        values: typing.Union[typing.Dict[typing.Any, typing.Any], typing.List[typing.Any]]) -> None:
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


# TODO(cyrille): Use typing overload to enforce in_type once pylint allows it.
def flask_api(
        out_type: typing.Optional[typing.Type[_ProtoType1]] = None,
        in_type: typing.Optional[typing.Type[_ProtoType2]] = None) \
        -> typing.Callable[
            [typing.Callable[..., typing.Any]], typing.Callable[..., typing.Any]]:
    """Decorator for flask endpoints that handles input and outputs as protos.

    The decorator converts the POST body from JSON to proto.
    """

    if not flask:
        raise ImportError("No module named 'flask'")
    if out_type:
        assert issubclass(out_type, message.Message)
    if in_type:
        assert issubclass(in_type, message.Message)

    def _proto_api_decorator(
            func: typing.Callable[..., typing.Union[str, flask.Response, _ProtoType2]]) \
            -> typing.Callable[..., typing.Union[str, flask.Response]]:
        def _decorated_fun(*args: typing.Any, **kwargs: typing.Any) \
                -> typing.Union[str, flask.Response]:
            if in_type:
                args = args + (_get_flask_input_proto(in_type),)
            ret = func(*args, **kwargs)
            if not out_type:
                return typing.cast(typing.Union[str, flask.Response], ret)
            if not isinstance(ret, out_type):
                raise TypeError(
                    '{} expects a {} output but got: {}'.format(
                        func.__name__,
                        out_type.__name__,
                        type(ret).__name__))
            proto_ret = typing.cast(_ProtoType2, ret)
            best_format = flask.request.accept_mimetypes.best_match(
                ['application/json', 'application/x-protobuf-base64']
            )
            if best_format == 'application/x-protobuf-base64':
                return flask.Response(
                    base64.encodebytes(proto_ret.SerializeToString()).decode('ascii'),
                    content_type='application/x-protobuf-base64')
            return json_format.MessageToJson(proto_ret)
        return functools.wraps(func)(_decorated_fun)
    return _proto_api_decorator


def _get_flask_input_proto(in_type: typing.Type[_ProtoType1]) -> _ProtoType1:
    proto = in_type()

    data = flask.request.get_data()
    if not data:
        data = flask.request.args.get('data', '').encode('utf-8')

    if flask.request.headers.get('Content-Type') == 'application/x-protobuf-base64':
        try:
            wire_format = base64.decodebytes(data)
        except ValueError as error:
            flask.abort(422, error)
        try:
            proto.ParseFromString(wire_format)
        except message.DecodeError as error:
            flask.abort(422, error)
        return proto

    try:
        json_format.Parse(data, proto)
    except (json_format.ParseError, UnicodeDecodeError) as error:
        flask.abort(422, error)
    return proto


def _cache_mongo_collection(
        mongo_iterator: typing.Callable[[], typing.Iterator[typing.Dict[str, typing.Any]]],
        cache: typing.Dict[str, _ProtoType1], proto_type: type, id_field: typing.Optional[str],
        update_func: typing.Optional[typing.Callable[[_ProtoType1, str], None]] = None) \
        -> typing.Dict[str, _ProtoType1]:
    """Cache in memory the content of a Mongo request returning protos.

    Args:
        mongo_iterator: a function that iterates over mongo documents.
        cache: a list or a dict to populate with cached protos. If it is a dict
            then the key populated will be the "_id" values.
        proto_type: the python proto class for the expected proto type.
        id_field (optional): the field in the proto where to put the id.
        update_func: an optional function to call on each proto once imported.
    Returns:
        returns the cache value populated.
    """

    if cache:
        return cache
    for document in mongo_iterator():
        _id = str(document['_id'])
        proto = typing.cast(_ProtoType1, create_from_mongo(document, proto_type, id_field))
        if update_func:
            update_func(proto, _id)
        cache[_id] = proto
    return cache


class CachedCollection(typing.Generic[_Type]):
    """A collection of items cached for some time."""

    _global_cache_version = 0

    def __init__(
            self,
            populate: typing.Callable[[typing.Dict[str, _Type]], None],
            cache_duration: datetime.timedelta = _CACHE_DURATION):
        self._populate = populate
        self._cache: typing.Optional[typing.Dict[str, _Type]] = None
        self._cached_valid_until: typing.Optional[datetime.datetime] = None
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

    def _ensure_cache(self) -> typing.Dict[str, _Type]:
        instant = now.get()
        if self._cached_valid_until and self._cached_valid_until >= instant and \
                self._cache_version >= self._global_cache_version:
            return typing.cast(typing.Dict[str, _Type], self._cache)
        self._cache_version = self._global_cache_version
        self._cached_valid_until = instant + self._cache_duration
        self._cache = collections.OrderedDict()
        self._populate(self._cache)
        return typing.cast(typing.Dict[str, _Type], self._cache)

    def __getattr__(self, prop: str) -> typing.Any:
        return getattr(self._ensure_cache(), prop)

    def __getitem__(self, key: str) -> _Type:
        return self._ensure_cache()[key]

    def __iter__(self) -> typing.Iterator[_Type]:
        return iter(self.values())

    def __contains__(self, key: str) -> bool:
        return key in self._ensure_cache()

    def __bool__(self) -> bool:
        return bool(self._ensure_cache())

    def keys(self) -> typing.KeysView[str]:  # pylint: disable=invalid-name
        """The set of keys of the collection."""

        return self._ensure_cache().keys()

    def items(self) -> typing.ItemsView[str, _Type]:
        """All items of the collection."""

        return self._ensure_cache().items()

    def get(  # pylint: disable=invalid-name
            self, key: str, default: typing.Optional[_Type] = None) -> typing.Optional[_Type]:
        """The value at the given key, or the default value if the key is not in the collection."""

        return self._ensure_cache().get(key, default)


class MongoCachedCollection(typing.Generic[_ProtoType1]):
    """Handler for a collection of protobuffers in MongoDB."""

    def __init__(
            self, proto_type: type, collection_name: str, id_field: typing.Optional[str] = None,
            update_func: typing.Optional[typing.Callable[[_ProtoType1, str], None]] = None,
            query: typing.Optional[typing.Dict[str, typing.Any]] = None):
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

        self._cache: typing.Optional[CachedCollection[_ProtoType1]] = None
        self._database: typing.Optional[pymongo.database.Database] = None

    def get_collection(self, database: pymongo.database.Database) -> CachedCollection[_ProtoType1]:
        """Gets access to the collection for a database."""

        if self._cache and database == self._database:
            return self._cache
        self._database = database
        self._cache = CachedCollection(self._populate)
        return self._cache

    # TODO(cyrille): Remove, since we have another way to deprecate cache.
    def reset_cache(self) -> None:
        """Reset any cache that this function could hold."""

        self._cache = None
        self._database = None

    def _populate(self, cache: typing.Dict[str, _ProtoType1]) -> None:
        def _mongo_iterator() -> typing.Iterator[typing.Dict[str, typing.Any]]:
            assert self._database
            # TODO(pascal): Type pymongo find method and remove the cast.
            return typing.cast(
                typing.Iterator[typing.Dict[str, typing.Any]],
                self._database.get_collection(self._collection_name).find(self._query))
        _cache_mongo_collection(
            _mongo_iterator, cache, self._proto_type, self._id_field, self._update_func)


def datetime_to_json_string(instant: datetime.datetime) -> str:
    """Convert a python datetime to a Json string compatible with the Timestamp proto."""

    timestamp = timestamp_pb2.Timestamp()
    timestamp.FromDatetime(instant)
    return typing.cast(str, json_format.MessageToDict(timestamp))
