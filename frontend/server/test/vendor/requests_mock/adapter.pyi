# Stubs for requests_mock.adapter (Python 3.6)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from requests.adapters import BaseAdapter
from requests_mock import _RequestObjectProxy
from typing import Any, List, Optional

ANY: object = ...

class _RequestHistoryTracker:
    request_history: List[_RequestObjectProxy] = ...
    def __init__(self) -> None: ...
    @property
    def last_request(self) -> Optional[_RequestObjectProxy]: ...
    @property
    def called(self) -> bool: ...
    @property
    def called_once(self) -> bool: ...
    @property
    def call_count(self) -> int: ...

class _RunRealHTTP(Exception): ...

class _Matcher(_RequestHistoryTracker):
    def __init__(self, method: Any, url: Any, responses: Any, complete_qs: Any, request_headers: Any, additional_matcher: Any, real_http: Any, case_sensitive: Any) -> None: ...
    def __call__(self, request: Any): ...

class Adapter(BaseAdapter, _RequestHistoryTracker):
    def __init__(self, case_sensitive: bool = ...) -> None: ...
    def register_uri(self, method: Any, url: Any, response_list: Optional[Any] = ..., **kwargs: Any): ...
    def add_matcher(self, matcher: Any) -> None: ...
