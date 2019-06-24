# Stubs for scrapy.spidermiddlewares.httperror (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.exceptions import IgnoreRequest
from typing import Any

logger: Any

class HttpError(IgnoreRequest):
    response: Any = ...
    def __init__(self, response: Any, *args: Any, **kwargs: Any) -> None: ...

class HttpErrorMiddleware:
    @classmethod
    def from_crawler(cls, crawler: Any): ...
    handle_httpstatus_all: Any = ...
    handle_httpstatus_list: Any = ...
    def __init__(self, settings: Any) -> None: ...
    def process_spider_input(self, response: Any, spider: Any) -> None: ...
    def process_spider_exception(self, response: Any, exception: Any, spider: Any): ...
