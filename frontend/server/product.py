"""Configuration for the client-side main product. Names and appearances."""

import json
import os
import typing
from typing import Callable, Literal, TypedDict

try:
    import flask
    _HAS_FLASK = True
except ModuleNotFoundError:
    _HAS_FLASK = False

# TODO(pascal): Drop once flask is properly typed.
_flask_has_request = _HAS_FLASK and typing.cast(Callable[[], bool], flask.has_request_context)


class _ServerConfig(TypedDict, total=False):
    # The base URL to use as the prefix of all links to the website. E.g. in dev,
    # you should use http://localhost:3000.
    baseUrl: str

    # URL of an image presenting the product's logo.
    productLogoUrl: str

    # Name of the main client-side product, e.g. Bob.
    productName: str

    # An HTML code for the color used to highlight.
    highlightColor: str

    # Config for plugins.
    plugins: dict[str, dict[str, str]]


class _Product:
    """Names and appearances for the client-side main product."""

    _config: _ServerConfig

    def __init__(self) -> None:
        self.load_from_env()
        self._name = self._config.get('productName', 'Bob')

    def load_from_env(self) -> None:
        """Load or reload the product value from the environment variable."""

        self._config = json.loads(os.getenv('SERVER_CONFIG', r'{}'))

    @property
    def base_url(self) -> str:
        """The base URL to use as the prefix of all links to the website."""

        if _flask_has_request and _flask_has_request():
            return flask.request.url_root
        return self._config.get('baseUrl', os.getenv('BASE_URL', 'https://www.bob-emploi.fr'))

    @property
    def name(self) -> str:
        """Name of the main client-side product, e.g. Bob."""

        return self._name

    def get_config(self, key: Literal['productLogoUrl', 'highlightColor'], default: str) -> str:
        """Get a config value."""

        return self._config.get(key, default)

    def get_plugin_config(self, plugin: str, key: str, default: str) -> str:
        """Get a plugin config value."""

        return self._config.get('plugins', {}).get(plugin, {}).get(key, default)


bob = _Product()
