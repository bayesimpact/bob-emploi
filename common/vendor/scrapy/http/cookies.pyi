# Stubs for scrapy.http.cookies (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

class CookieJar:
    policy: Any = ...
    jar: Any = ...
    check_expired_frequency: Any = ...
    processed: int = ...
    def __init__(self, policy: Optional[Any] = ..., check_expired_frequency: int = ...) -> None: ...
    def extract_cookies(self, response: Any, request: Any) -> Any: ...
    def add_cookie_header(self, request: Any) -> None: ...
    def clear_session_cookies(self, *args: Any, **kwargs: Any) -> Any: ...
    def clear(self, domain: Optional[Any] = ..., path: Optional[Any] = ..., name: Optional[Any] = ...) -> Any: ...
    def __iter__(self) -> Any: ...
    def __len__(self) -> Any: ...
    def set_policy(self, pol: Any) -> Any: ...
    def make_cookies(self, response: Any, request: Any) -> Any: ...
    def set_cookie(self, cookie: Any) -> None: ...
    def set_cookie_if_ok(self, cookie: Any, request: Any) -> None: ...

def potential_domain_matches(domain: Any) -> Any: ...

class _DummyLock:
    def acquire(self) -> None: ...
    def release(self) -> None: ...

class WrappedRequest:
    request: Any = ...
    def __init__(self, request: Any) -> None: ...
    def get_full_url(self) -> Any: ...
    def get_host(self) -> Any: ...
    def get_type(self) -> Any: ...
    def is_unverifiable(self) -> Any: ...
    def get_origin_req_host(self) -> Any: ...
    @property
    def full_url(self) -> Any: ...
    @property
    def host(self) -> Any: ...
    @property
    def type(self) -> Any: ...
    @property
    def unverifiable(self) -> Any: ...
    @property
    def origin_req_host(self) -> Any: ...
    def has_header(self, name: Any) -> Any: ...
    def get_header(self, name: Any, default: Optional[Any] = ...) -> Any: ...
    def header_items(self) -> Any: ...
    def add_unredirected_header(self, name: Any, value: Any) -> None: ...

class WrappedResponse:
    response: Any = ...
    def __init__(self, response: Any) -> None: ...
    def info(self) -> Any: ...
    def get_all(self, name: Any, default: Optional[Any] = ...) -> Any: ...
    getheaders: Any = ...