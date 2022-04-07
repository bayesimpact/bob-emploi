# Stubs for scrapy.commands.crawl (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.commands import ScrapyCommand
from typing import Any

class Command(ScrapyCommand):
    requires_project: bool = ...
    def syntax(self) -> Any: ...
    def short_desc(self) -> Any: ...
    def add_options(self, parser: Any) -> None: ...
    def process_options(self, args: Any, opts: Any) -> None: ...
    exitcode: int = ...
    def run(self, args: Any, opts: Any) -> None: ...