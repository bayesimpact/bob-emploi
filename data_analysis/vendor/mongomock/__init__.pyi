import typing
from unittest import mock

import pymongo

def patch(servers: typing.Union[str, typing.Iterable[str]] = ..., on_new: str = ...) -> mock._patch:
  ...


class MongoClient(pymongo.MongoClient):

  def __init__(self, host: typing.Optional[str] = None, port: typing.Optional[int] = None, tz_aware: bool = False, connect: bool = True):
    ...
