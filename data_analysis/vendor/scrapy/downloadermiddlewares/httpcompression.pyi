# Stubs for scrapy.downloadermiddlewares.httpcompression (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

ACCEPTED_ENCODINGS: Any

class HttpCompressionMiddleware:
    @classmethod
    def from_crawler(cls, crawler: Any): ...
    def process_request(self, request: Any, spider: Any) -> None: ...
    def process_response(self, request: Any, response: Any, spider: Any): ...
