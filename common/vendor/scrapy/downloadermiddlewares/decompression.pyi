# Stubs for scrapy.downloadermiddlewares.decompression (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

logger: Any

class DecompressionMiddleware:
    def __init__(self) -> None: ...
    def process_response(self, request: Any, response: Any, spider: Any) -> Any: ...
