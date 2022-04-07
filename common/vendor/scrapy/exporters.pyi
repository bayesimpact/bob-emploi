# Stubs for scrapy.exporters (Python 3)
#
# NOTE: This dynamically typed stub was automatically generated by stubgen.

from typing import Any

class BaseItemExporter:
    def __init__(self, **kwargs: Any) -> None: ...
    def export_item(self, item: Any) -> None: ...
    def serialize_field(self, field: Any, name: Any, value: Any) -> Any: ...
    def start_exporting(self) -> None: ...
    def finish_exporting(self) -> None: ...

class JsonLinesItemExporter(BaseItemExporter):
    file: Any = ...
    encoder: Any = ...
    def __init__(self, file: Any, **kwargs: Any) -> None: ...
    def export_item(self, item: Any) -> None: ...

class JsonItemExporter(BaseItemExporter):
    file: Any = ...
    encoder: Any = ...
    first_item: bool = ...
    def __init__(self, file: Any, **kwargs: Any) -> None: ...
    def start_exporting(self) -> None: ...
    def finish_exporting(self) -> None: ...
    def export_item(self, item: Any) -> None: ...

class XmlItemExporter(BaseItemExporter):
    item_element: Any = ...
    root_element: Any = ...
    encoding: str = ...
    xg: Any = ...
    def __init__(self, file: Any, **kwargs: Any) -> None: ...
    def start_exporting(self) -> None: ...
    def export_item(self, item: Any) -> None: ...
    def finish_exporting(self) -> None: ...

class CsvItemExporter(BaseItemExporter):
    encoding: str = ...
    include_headers_line: Any = ...
    stream: Any = ...
    csv_writer: Any = ...
    def __init__(self, file: Any, include_headers_line: bool = ..., join_multivalued: str = ..., **kwargs: Any) -> None: ...
    def serialize_field(self, field: Any, name: Any, value: Any) -> Any: ...
    def export_item(self, item: Any) -> None: ...

class PickleItemExporter(BaseItemExporter):
    file: Any = ...
    protocol: Any = ...
    def __init__(self, file: Any, protocol: int = ..., **kwargs: Any) -> None: ...
    def export_item(self, item: Any) -> None: ...

class MarshalItemExporter(BaseItemExporter):
    file: Any = ...
    def __init__(self, file: Any, **kwargs: Any) -> None: ...
    def export_item(self, item: Any) -> None: ...

class PprintItemExporter(BaseItemExporter):
    file: Any = ...
    def __init__(self, file: Any, **kwargs: Any) -> None: ...
    def export_item(self, item: Any) -> None: ...

class PythonItemExporter(BaseItemExporter):
    def serialize_field(self, field: Any, name: Any, value: Any) -> Any: ...
    def export_item(self, item: Any) -> Any: ...