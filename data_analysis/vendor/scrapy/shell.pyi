# Stubs for scrapy.shell (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

class Shell:
    relevant_classes: Any = ...
    crawler: Any = ...
    update_vars: Any = ...
    item_class: Any = ...
    spider: Any = ...
    inthread: Any = ...
    code: Any = ...
    vars: Any = ...
    def __init__(self, crawler: Any, update_vars: Optional[Any] = ..., code: Optional[Any] = ...) -> None: ...
    def start(self, url: Optional[Any] = ..., request: Optional[Any] = ..., response: Optional[Any] = ..., spider: Optional[Any] = ..., redirect: bool = ...) -> None: ...
    def fetch(self, request_or_url: Any, spider: Optional[Any] = ..., redirect: bool = ..., **kwargs: Any) -> None: ...
    def populate_vars(self, response: Optional[Any] = ..., request: Optional[Any] = ..., spider: Optional[Any] = ...) -> None: ...
    def print_help(self) -> None: ...
    def get_help(self): ...

def inspect_response(response: Any, spider: Any) -> None: ...

class _SelectorProxy:
    def __init__(self, response: Any) -> None: ...
    def __getattr__(self, name: Any): ...
