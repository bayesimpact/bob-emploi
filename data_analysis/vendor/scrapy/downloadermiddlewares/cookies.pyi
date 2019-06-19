# Stubs for scrapy.downloadermiddlewares.cookies (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

logger: Any

class CookiesMiddleware:
    jars: Any = ...
    debug: Any = ...
    def __init__(self, debug: bool = ...) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any): ...
    def process_request(self, request: Any, spider: Any) -> None: ...
    def process_response(self, request: Any, response: Any, spider: Any): ...
