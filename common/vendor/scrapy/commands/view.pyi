# Stubs for scrapy.commands.view (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.commands import fetch
from typing import Any

class Command(fetch.Command):
    def short_desc(self) -> Any: ...
    def long_desc(self) -> Any: ...
    def add_options(self, parser: Any) -> None: ...
