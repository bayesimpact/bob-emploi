# Stubs for scrapy.commands.list (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.commands import ScrapyCommand
from typing import Any

class Command(ScrapyCommand):
    requires_project: bool = ...
    default_settings: Any = ...
    def short_desc(self) -> Any: ...
    def run(self, args: Any, opts: Any) -> None: ...
