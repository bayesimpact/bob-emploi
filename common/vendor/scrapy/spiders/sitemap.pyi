# Stubs for scrapy.spiders.sitemap (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.http import Request
from scrapy.spiders import Spider
from typing import Any, Iterator

logger: Any

class SitemapSpider(Spider):
    sitemap_urls: Any = ...
    sitemap_rules: Any = ...
    sitemap_follow: Any = ...
    sitemap_alternate_links: bool = ...
    def __init__(self, *a: Any, **kw: Any) -> None: ...
    def start_requests(self) -> Iterator[Request]: ...
    def sitemap_filter(self, entries: Any) -> None: ...

def regex(x: Any) -> Any: ...
def iterloc(it: Any, alt: bool = ...) -> None: ...