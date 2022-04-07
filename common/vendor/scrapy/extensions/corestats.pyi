# Stubs for scrapy.extensions.corestats (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

class CoreStats:
    stats: Any = ...
    def __init__(self, stats: Any) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any) -> Any: ...
    def spider_opened(self, spider: Any) -> None: ...
    def spider_closed(self, spider: Any, reason: Any) -> None: ...
    def item_scraped(self, item: Any, spider: Any) -> None: ...
    def response_received(self, spider: Any) -> None: ...
    def item_dropped(self, item: Any, spider: Any, exception: Any) -> None: ...