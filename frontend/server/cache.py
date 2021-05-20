"""Provides a central cache that can be easily cleared on demand."""

import functools
import typing
from typing import Callable


# List of functions to clear caches.
_CLEAR_CACHE_FUNCS = []


def register_clear_func(clear_cache_func: Callable[[], None]) -> None:
    """Register a new cache by giving a callback function to clear it."""

    _CLEAR_CACHE_FUNCS.append(clear_cache_func)


_Type = typing.TypeVar('_Type')


def lru(maxsize: int = 0) -> Callable[[Callable[..., _Type]], Callable[..., _Type]]:
    """A decorator to cache a function's result, works like functools.lru_cache.

    A side effect of decoration is that it registers the clear function in this module.
    """

    def _wrapped(func: Callable[..., _Type]) -> Callable[..., _Type]:
        cached_func = functools.lru_cache(maxsize=maxsize)(func)
        register_clear_func(cached_func.cache_clear)
        return functools.wraps(func)(cached_func)

    return _wrapped


def clear() -> None:
    """Clear the whole cache."""

    for clear_func in _CLEAR_CACHE_FUNCS:
        clear_func()
