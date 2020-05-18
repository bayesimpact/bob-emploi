"""Plugins defining importers.

Each python module in this folder should have a `register` method at top level.

# TODO(cyrille): DRY up with frontend/server/apps/__init__.py
"""

import importlib
import pkgutil
import os
import typing
from typing import Dict

from bob_emploi.data_analysis.importer import importers

_PLUGINS_FOLDER = os.path.dirname(os.path.realpath(__file__))
_KEPT_PLUGINS = {plugin for plugin in os.getenv('BOB_PLUGINS', '').split(',') if plugin}


class PluginModule(object):
    """The interface the plugins should expose."""

    IMPORTERS: Dict[str, importers.Importer]


# TODO(cyrille): Test this.
def register_plugins() -> Dict[str, Dict[str, importers.Importer]]:
    """
    Dynamically import all modules from this folder.

    Each module should implement the PluginModule interface above.
    """

    plugins = {'core': importers.IMPORTERS}
    for package in pkgutil.iter_modules([_PLUGINS_FOLDER]):
        if _KEPT_PLUGINS and package.name not in _KEPT_PLUGINS:
            continue
        # TODO(cyrille): Test that those are not statically imported elsewhere.
        module = typing.cast(PluginModule, importlib.import_module(f'.{package.name}', __package__))
        plugins[package.name] = module.IMPORTERS
    return plugins
