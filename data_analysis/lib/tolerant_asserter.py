"""An asserter that refrains itself for some time before raising errors."""

import inspect
import os
from typing import Any, Callable
import unittest


class TolerantAsserter:
    """An asserter that refrains itself for some time before raising errors.

    It works as a wrapper around another asserter and catches N AssertionError.
    Any additional error is raised normally.

    The idea of the TolerantAsserter is to allow for a temporary lower level of
    assertion. However your goal should always be to get rid of it and restore
    all the assertions. In order to help you with that we recommend calling
    assert_exact_tolerance at the end of your test: if someone fixed one of the
    assertion this function will congratulate them and ask them to reduce the
    tolerance. If you want to take the bulls by its horns, run your tests with
    NO_TOLERANCE env variable set to 1: this will uncover all the assertions
    that were hidden by tolerant asserters.
    """

    def __init__(self, asserter: unittest.TestCase, tolerance: int = 0):
        """Wraps an asserter with tolerance.

        Args:
            asserter: the actual asserter that will do all the work.
            tolerance: the number of assertions that you are expecting.
        """

        self._asserter = asserter
        self._tolerance = tolerance
        self._errors: list[Exception] = []

    def __getattr__(self, name: str) -> Any:
        attr = getattr(self._asserter, name)
        if inspect.ismethod(attr):
            return self._wrap(attr)
        return attr

    def _wrap(self, method: Callable[..., Any]) -> Callable[..., Any]:
        def _wrapped_method(*args: Any, **kwargs: Any) -> Any:
            try:
                return method(*args, **kwargs)
            except AssertionError as error:
                if self._tolerance < len(self._errors):
                    raise
                self._errors.append(error)
        return _wrapped_method

    def assert_exact_tolerance(self) -> None:
        """Assert that this object has used all its tolerance."""

        if os.getenv('ACCEPT_LAX_TOLERANCE'):
            return

        if os.getenv('NO_TOLERANCE'):
            if self._errors:
                errors_message = '\n'.join(str(e) for e in self._errors)
                raise AssertionError(
                    f'NO TOLERANCE!, we should raise all the following:\n{errors_message}')
            raise AssertionError(
                "NO TOLERANCE! you don't need this wrapper anymore")

        if self._tolerance > len(self._errors):
            raise AssertionError(
                'Thanks for cleaning up, reduce the tolerance of this object '
                f'to {len(self._errors):d}.')
