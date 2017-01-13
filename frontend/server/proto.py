"""Module to help the frontend manipulate protobuffers."""
import datetime
import functools
import json

try:
    import flask
except ImportError:
    # Data Analysis Prepare use this module without flask (only for
    # parse_from_mongo). If flask is missing the flask_api decorator won't work
    # but the rest will.
    pass

from google.protobuf import json_format
from google.protobuf import message


class _TimestampJSONEncoder(json.JSONEncoder):

    # TODO(pascal): Drop the pylint disabler when
    # https://github.com/PyCQA/pylint/issues/414 is solved.

    def default(self, obj):  # pylint: disable=method-hidden
        if isinstance(obj, datetime.datetime):
            return obj.isoformat() + 'Z'
        return super(_TimestampJSONEncoder, self).default(obj)


def parse_from_mongo(mongo_dict, proto):
    """Parse a Protobuf from a dict coming from MongoDB.

    Args:
        mongo_dict: a dict coming from MongoDB, or None. This dict will be
            modified by the function: it removes all the keys prefixed by "_".
        proto: a protobuffer to merge data into.
    Returns: a boolean indicating whether the input had actual data.
    """
    if mongo_dict is None:
        return False
    to_delete = [k for k in mongo_dict if k.startswith('_')]
    for key in to_delete:
        del mongo_dict[key]
    try:
        json_format.Parse(
            json.dumps(mongo_dict, cls=_TimestampJSONEncoder), proto, ignore_unknown_fields=True)
    except json_format.ParseError as error:
        print("Error %s while parsing a json blob for proto type %s:\n%s" % (
            error, proto, json.dumps(mongo_dict)))
        return False
    return True


def flask_api(out_type=None, in_type=None):
    """Decorator for flask endpoints that handles input and outputs as protos.

    The decorator converts the POST body from JSON to proto.
    """
    if not flask:
        raise ImportError("No module named 'flask'")
    if out_type:
        assert issubclass(out_type, message.Message)
    if in_type:
        assert issubclass(in_type, message.Message)

    def _proto_api_decorator(func):
        def _decorated_fun(*args, **kwargs):
            if in_type:
                proto = in_type()
                try:
                    data = flask.request.get_data()
                    if not data:
                        data = flask.request.args.get('data', '')
                    json_format.Parse(data, proto)
                except json_format.ParseError as error:
                    flask.abort(422, error)
                args = args + (proto,)
            ret = func(*args, **kwargs)
            if not out_type:
                return ret
            if not isinstance(ret, out_type):
                raise TypeError(
                    '%s expects a %s output but got: %s' % (
                        func.__name__,
                        out_type.__name__,
                        type(ret).__name__))
            return json_format.MessageToJson(ret)
        return functools.wraps(func)(_decorated_fun)
    return _proto_api_decorator


def cache_mongo_collection(mongo_iterator, cache, proto_type, update_func=None):
    """Cache in memory the content of a Mongo request returning protos.

    Args:
        mongo_iterator: a function that iterates over mongo documents.
        cache: a list or a dict to populate with cached protos. If it is a dict
            then the key populated will be the "_id" values.
        proto_type: the python proto class for the expected proto type.
        update_func: an optional function to call on each proto once imported.
    Returns:
        returns the cache value populated.
    """
    if cache:
        return cache
    as_dict = isinstance(cache, dict)
    for document in mongo_iterator():
        proto = proto_type()
        _id = str(document['_id'])
        parse_from_mongo(document, proto)
        if update_func:
            update_func(proto, _id)
        if as_dict:
            cache[_id] = proto
        else:
            cache.append(proto)
    return cache
