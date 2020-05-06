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


def tick(tick_name: str) -> None:
    """Add a tick to time how long it took since the beginning of the request."""

    flask.g.ticks.append(_Tick(tick_name, time.time()))


def before_request() -> None:
    """A function to run in a flask app before every request."""

    flask.g.start = time.time()
    flask.g.ticks = []


def teardown_request(unused_exception: Optional[Exception] = None) -> None:
    """A function to run in a flask app after every request."""

    total_duration = time.time() - flask.g.start
    if total_duration <= _LONG_REQUEST_DURATION_SECONDS:
        return
    last_tick_time = flask.g.start
    for a_tick in sorted(flask.g.ticks, key=lambda t: t.time):
        logging.info(
            '%.4f: Tick %s (%.4f since last tick)',
            a_tick.time - flask.g.start, a_tick.name, a_tick.time - last_tick_time)
        last_tick_time = a_tick.time
    logging.warning('Long request: %d seconds', total_duration)
