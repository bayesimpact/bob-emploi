# Stubs for scrapy.downloadermiddlewares.stats (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

class DownloaderStats:
    stats: Any = ...
    def __init__(self, stats: Any) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any): ...
    def process_request(self, request: Any, spider: Any) -> None: ...
    def process_response(self, request: Any, response: Any, spider: Any): ...
    def process_exception(self, request: Any, exception: Any, spider: Any) -> None: ...
