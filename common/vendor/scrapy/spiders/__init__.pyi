# Stubs for scrapy.spiders (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.utils.trackref import object_ref
from scrapy.http import Request
from scrapy.http.response import Response
from typing import Any, Iterator, Mapping, Optional, Union

class Spider(object_ref):
    name: Any = ...
    custom_settings: Any = ...
    start_urls: Any = ...
    def __init__(self, name: Optional[Any] = ..., **kwargs: Any) -> None: ...
    @property
    def logger(self) -> Any: ...
    def log(self, message: Any, level: Any = ..., **kw: Any) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any, *args: Any, **kwargs: Any) -> Any: ...
    def set_crawler(self, crawler: Any) -> None: ...
    def start_requests(self) -> Iterator[Request]: ...
    def make_requests_from_url(self, url: Any) -> Any: ...
    def parse(self, response: Response, **kwargs: Any) -> Iterator[Union[Request, Mapping[str, Any]]]: ...
    @classmethod
    def update_settings(cls, settings: Any) -> None: ...
    @classmethod
    def handles_request(cls, request: Any) -> Any: ...
    @staticmethod
    def close(spider: Any, reason: Any) -> Any: ...

BaseSpider: Any

class ObsoleteClass:
    message: Any = ...
    def __init__(self, message: Any) -> None: ...
    def __getattr__(self, name: Any) -> None: ...

spiders: Any