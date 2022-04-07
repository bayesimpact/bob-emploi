# Stubs for scrapy.pipelines.images (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from scrapy.exceptions import DropItem
from scrapy.pipelines.files import FileException, FilesPipeline
from typing import Any, Optional

class NoimagesDrop(DropItem): ...
class ImageException(FileException): ...

class ImagesPipeline(FilesPipeline):
    MEDIA_NAME: str = ...
    MIN_WIDTH: int = ...
    MIN_HEIGHT: int = ...
    EXPIRES: int = ...
    THUMBS: Any = ...
    DEFAULT_IMAGES_URLS_FIELD: str = ...
    DEFAULT_IMAGES_RESULT_FIELD: str = ...
    expires: Any = ...
    IMAGES_RESULT_FIELD: Any = ...
    IMAGES_URLS_FIELD: Any = ...
    images_urls_field: Any = ...
    images_result_field: Any = ...
    min_width: Any = ...
    min_height: Any = ...
    thumbs: Any = ...
    def __init__(self, store_uri: Any, download_func: Optional[Any] = ..., settings: Optional[Any] = ...) -> None: ...
    @classmethod
    def from_settings(cls, settings: Any) -> Any: ...
    def file_downloaded(self, response: Any, request: Any, info: Any) -> Any: ...
    def image_downloaded(self, response: Any, request: Any, info: Any) -> Any: ...
    def get_images(self, response: Any, request: Any, info: Any) -> None: ...
    def convert_image(self, image: Any, size: Optional[Any] = ...) -> Any: ...
    def get_media_requests(self, item: Any, info: Any) -> Any: ...
    def item_completed(self, results: Any, item: Any, info: Any) -> Any: ...
    def file_path(self, request: Any, response: Optional[Any] = ..., info: Optional[Any] = ...) -> Any: ...
    def thumb_path(self, request: Any, thumb_id: Any, response: Optional[Any] = ..., info: Optional[Any] = ...) -> Any: ...
    def file_key(self, url: Any) -> Any: ...
    def image_key(self, url: Any) -> Any: ...
    def thumb_key(self, url: Any, thumb_id: Any) -> Any: ...