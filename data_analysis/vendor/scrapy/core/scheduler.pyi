# Stubs for scrapy.core.scheduler (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

logger: Any

class Scheduler:
    df: Any = ...
    dqdir: Any = ...
    pqclass: Any = ...
    dqclass: Any = ...
    mqclass: Any = ...
    logunser: Any = ...
    stats: Any = ...
    def __init__(self, dupefilter: Any, jobdir: Optional[Any] = ..., dqclass: Optional[Any] = ..., mqclass: Optional[Any] = ..., logunser: bool = ..., stats: Optional[Any] = ..., pqclass: Optional[Any] = ...) -> None: ...
    @classmethod
    def from_crawler(cls, crawler: Any): ...
    def has_pending_requests(self): ...
    spider: Any = ...
    mqs: Any = ...
    dqs: Any = ...
    def open(self, spider: Any): ...
    def close(self, reason: Any): ...
    def enqueue_request(self, request: Any): ...
    def next_request(self): ...
    def __len__(self): ...