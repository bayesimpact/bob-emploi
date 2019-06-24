# Stubs for scrapy.link (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

class Link:
    url: Any = ...
    text: Any = ...
    fragment: Any = ...
    nofollow: Any = ...
    def __init__(self, url: Any, text: str = ..., fragment: str = ..., nofollow: bool = ...) -> None: ...
    def __eq__(self, other: Any): ...
    def __hash__(self): ...