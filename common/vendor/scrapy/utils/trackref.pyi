# Stubs for scrapy.utils.trackref (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

NoneType: Any
live_refs: Any

class object_ref:
    def __new__(cls, *args: Any, **kwargs: Any) -> Any: ...

def format_live_refs(ignore: Any = ...) -> Any: ...
def print_live_refs(*a: Any, **kw: Any) -> None: ...
def get_oldest(class_name: Any) -> Any: ...
def iter_all(class_name: Any) -> Any: ...
