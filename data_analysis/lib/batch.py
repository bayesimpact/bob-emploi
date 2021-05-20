"""Function to iterate on iterables using batches."""

import itertools
import typing
from typing import Iterable, Iterator, List

_T = typing.TypeVar('_T')


def batch_iterator(iterable: Iterable[_T], batch_size: int) -> Iterator[List[_T]]:
    """Yield elements from the input iterable by batches of the given size."""

    batchable = iter(iterable)
    batch = list(itertools.islice(batchable, batch_size))
    while batch:
        yield batch
        batch = list(itertools.islice(batchable, batch_size))
