# Stubs for scrapy.spidermiddlewares.offsite (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

logger: Any

class OffsiteMiddleware:
    stats: Any = ...
    def __init__(self, stats: Any) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any) -> Any: ...
    def process_spider_output(self, response: Any, result: Any, spider: Any) -> None: ...
    def should_follow(self, request: Any, spider: Any) -> Any: ...
    def get_host_regex(self, spider: Any) -> Any: ...
    host_regex: Any = ...
    domains_seen: Any = ...
    def spider_opened(self, spider: Any) -> None: ...

class URLWarning(Warning): ...