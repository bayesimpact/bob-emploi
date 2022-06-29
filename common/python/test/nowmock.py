"""Module to mock current time."""

import datetime
from typing import Callable, Optional
from unittest import mock

from bob_emploi.common.python import now


# TODO(cyrille): Use wherever relevant.
def patch(*, new: Optional[Callable[[], datetime.datetime]] = None) \
        -> 'mock._patch[mock.MagicMock]':
    """Match the date getter."""

    patched = now.__name__ + '.get'
    if new is None:
        return mock.patch(patched)
    return mock.patch(patched, new=new)
