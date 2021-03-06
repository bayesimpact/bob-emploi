# Stubs for scrapy.extensions.spiderstate (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

class SpiderState:
    jobdir: Any = ...
    def __init__(self, jobdir: Optional[Any] = ...) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any) -> Any: ...
    def spider_closed(self, spider: Any) -> None: ...
    def spider_opened(self, spider: Any) -> None: ...
    @property
    def statefn(self) -> Any: ...
