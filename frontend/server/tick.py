"""Module for easily timing requests."""

import logging
import time
import typing
from typing import Optional

import flask

# Log timing of requests that take too long to be treated.
_LONG_REQUEST_DURATION_SECONDS = 5


class _Tick(typing.NamedTuple):
    name: str
    time: float


if typing.TYPE_CHECKING:
    class _AppContext:
        start: float
        ticks: list[_Tick]


def _get_context() -> '_AppContext':
    return typing.cast('_AppContext', flask.g)


def tick(tick_name: str) -> None:
    """Add a tick to time how long it took since the beginning of the request."""

    _get_context().ticks.append(_Tick(tick_name, time.time()))


def before_request() -> None:
    """A function to run in a flask app before every request."""

    _get_context().start = time.time()  # pylint: disable=assigning-non-slot
    _get_context().ticks = []  # pylint: disable=assigning-non-slot


def teardown_request(unused_exception: Optional[BaseException] = None) -> None:
    """A function to run in a flask app after every request."""

    total_duration = time.time() - _get_context().start
    if total_duration <= _LONG_REQUEST_DURATION_SECONDS:
        return
    last_tick_time = _get_context().start
    for a_tick in sorted(_get_context().ticks, key=lambda t: t.time):
        logging.info(
            '%.4f: Tick %s (%.4f since last tick)',
            a_tick.time - _get_context().start, a_tick.name, a_tick.time - last_tick_time)
        last_tick_time = a_tick.time
    logging.warning('Long request: %d seconds', total_duration)
