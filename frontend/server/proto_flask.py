"""Module to help the frontend manipulate protobuffers with flask."""

import base64
import datetime
import functools
import os
import typing
from typing import Any, Callable, Optional, Tuple, Type, Union

import flask
from google.protobuf import json_format
from google.protobuf import message
import werkzeug

_CACHE_DURATION = datetime.timedelta(hours=1)
_IS_TEST_ENV = bool(os.getenv('TEST_ENV'))

_Type = typing.TypeVar('_Type')
_ProtoOut = typing.TypeVar('_ProtoOut', bound=message.Message)
_ProtoIn = typing.TypeVar('_ProtoIn', bound=message.Message)
_FlaskResponse = Union[str, werkzeug.Response, Tuple[str, int]]


def make_response(
        result: Any, out_type: Type[_ProtoOut], func_name: str) -> flask.Response:
    """Creates a proto response for a flask request."""

    if not isinstance(result, out_type):
        raise TypeError(
            f'{func_name} expects a {out_type.__name__} output but got: '
            f'{type(result).__name__}')

    best_format = flask.request.accept_mimetypes.best_match(
        ['application/json', 'application/x-protobuf-base64']
    )
    if best_format == 'application/x-protobuf-base64':
        return flask.Response(
            base64.encodebytes(result.SerializeToString()).decode('ascii'),
            content_type='application/x-protobuf-base64')
    return flask.make_response(json_format.MessageToJson(result))


@typing.overload
def api(
        out_type: Type[_ProtoOut], *,
        in_type: Optional[Type[_ProtoIn]] = ...) \
        -> Callable[[Callable[..., _ProtoOut]], Callable[..., werkzeug.Response]]:
    ...


@typing.overload
def api(
        out_type: None = ..., *,
        in_type: Type[_ProtoIn] = ...) \
        -> Callable[[Callable[..., _FlaskResponse]], Callable[..., _FlaskResponse]]:
    ...


def api(
        out_type: Optional[Type[_ProtoOut]] = None, *,
        in_type: Optional[Type[_ProtoIn]] = None) \
        -> Union[
            Callable[[Callable[..., _ProtoOut]], Callable[..., _FlaskResponse]],
            Callable[[Callable[..., _FlaskResponse]], Callable[..., _FlaskResponse]]]:
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
            func: Callable[..., Union[str, flask.Response, _ProtoOut]]) \
            -> Callable[..., Union[str, flask.Response]]:
        def _decorated_fun(*args: Any, **kwargs: Any) \
                -> Union[str, flask.Response]:
            if in_type:
                args = args + (_get_flask_input_proto(in_type),)
            ret = func(*args, **kwargs)
            if not out_type:
                return typing.cast(Union[str, flask.Response], ret)
            return make_response(ret, out_type=out_type, func_name=func.__name__)
        return functools.wraps(func)(_decorated_fun)
    return _proto_api_decorator


def _get_flask_input_proto(in_type: Type[_ProtoOut]) -> _ProtoOut:
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
