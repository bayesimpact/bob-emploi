# Stubs for scrapy.utils.signal (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from pydispatch.dispatcher import Any

logger: Any

class _IgnoredException(Exception): ...

def send_catch_log(signal: Any = ..., sender: Any = ..., *arguments: Any, **named: Any) -> Any: ...
def send_catch_log_deferred(signal: Any = ..., sender: Any = ..., *arguments: Any, **named: Any) -> Any: ...
def disconnect_all(signal: Any = ..., sender: Any = ...) -> None: ...
