# Stubs for scrapy.utils.conf (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any, Optional

def build_component_list(compdict: Any, custom: Optional[Any] = ..., convert: Any = ...) -> Any: ...
def arglist_to_dict(arglist: Any) -> Any: ...
def closest_scrapy_cfg(path: str = ..., prevpath: Optional[Any] = ...) -> Any: ...
def init_env(project: str = ..., set_syspath: bool = ...) -> None: ...
def get_config(use_closest: bool = ...) -> Any: ...
def get_sources(use_closest: bool = ...) -> Any: ...
