# Stubs for scrapy.http.response.text (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.http.request import Request
from scrapy.http.response import Response
from typing import Any

class TextResponse(Response):
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
    def replace(self, *args: Any, **kwargs: Any): ...
    @property
    def encoding(self): ...
    def body_as_unicode(self) -> str: ...
    @property
    def text(self) -> str: ...
    def urljoin(self, url: str) -> str: ...
    @property
    def selector(self): ...
    def xpath(self, query: Any, **kwargs: Any): ...
    def css(self, query: Any): ...
    def follow(self, url: Any, callback: Any=..., method: Any=..., headers: Any=..., body: Any=..., cookies: Any=..., meta: Any=..., encoding: Any=..., priority: Any=..., dont_filter: Any=..., errback: Any=...) -> Request: ...
