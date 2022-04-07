# Stubs for scrapy.pipelines.media (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

logger: Any

class MediaPipeline:
    LOG_FAILED_RESULTS: bool = ...
    class SpiderInfo:
        spider: Any = ...
        downloading: Any = ...
        downloaded: Any = ...
        waiting: Any = ...
        def __init__(self, spider: Any) -> None: ...
    download_func: Any = ...
    allow_redirects: Any = ...
    def __init__(self, download_func: Optional[Any] = ..., settings: Optional[Any] = ...) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any) -> Any: ...
    spiderinfo: Any = ...
    def open_spider(self, spider: Any) -> None: ...
    def process_item(self, item: Any, spider: Any) -> Any: ...
    def media_to_download(self, request: Any, info: Any) -> None: ...
    def get_media_requests(self, item: Any, info: Any) -> None: ...
    def media_downloaded(self, response: Any, request: Any, info: Any) -> Any: ...
    def media_failed(self, failure: Any, request: Any, info: Any) -> Any: ...
    def item_completed(self, results: Any, item: Any, info: Any) -> Any: ...