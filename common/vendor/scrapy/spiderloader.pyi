# Stubs for scrapy.spiderloader (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

class SpiderLoader:
    spider_modules: Any = ...
    warn_only: Any = ...
    def __init__(self, settings: Any) -> None: ...
    @classmethod
    def from_settings(cls, settings: Any) -> Any: ...
    def load(self, spider_name: Any) -> Any: ...
    def find_by_request(self, request: Any) -> Any: ...
    def list(self) -> Any: ...
