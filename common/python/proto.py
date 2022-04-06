"""Module to manipulate protobuffers."""

import datetime
import typing
from typing import Iterator, Literal, Optional

from google.protobuf import message
from google.protobuf import timestamp_pb2

from bob_emploi.frontend.api import options_pb2
from bob_emploi.common.python import now

_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def list_translatable_fields(
    proto_type: type[_ProtoType], *, name_field: Literal['name', 'json_name'] = 'name',
) -> Iterator[str]:
    """List all fields that are translatable."""

    for field in proto_type.DESCRIPTOR.fields:
        if options_pb2.NATURAL_LANGUAGE in field.GetOptions().Extensions[options_pb2.string_format]:
            yield getattr(field, name_field)


def set_date_now(
        time_proto: timestamp_pb2.Timestamp, now_value: Optional[datetime.datetime] = None) -> None:
    """Set date with the value from now, without too much precision."""

    time_proto.FromDatetime(now_value or now.get())
    time_proto.nanos = 0
