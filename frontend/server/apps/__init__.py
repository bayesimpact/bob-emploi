"""Plugins defining Flas apps.

Each python module in this folder should have an `app` variable at top level,
with a flask.Blueprint in it.

# TODO(cyrille): DRY up with modules/__init__.py
"""

import importlib
import pkgutil
import logging
import os
import typing

import flask

# Import behind guard to enable flask auto-reload on those files.
if False:  # pylint: disable=using-constant-test
    # TODO(cyrille): Test that all dynamically imported modules are here.
    from . import ali
    from . import evaluation
    from . import jobflix

_APPS_FOLDER = os.path.dirname(os.path.realpath(__file__))
_KEPT_PLUGINS = {plugin for plugin in os.getenv('BOB_PLUGINS', '').split(',') if plugin}


class AppModule:
    """
    A plugin for the main app.

    This is the interface that each python module in this folder should expose.
    """

    app: flask.Blueprint


def register_blueprints(app: flask.Flask) -> None:
    """
    Dynamically import all modules from this folder.

    Each module should implement the AppModule interface above.
    Its endpoints will be prefixed with '/api/{app_name}'
    """

    for package in pkgutil.iter_modules([_APPS_FOLDER]):
        if _KEPT_PLUGINS and package.name not in _KEPT_PLUGINS:
            continue
        if package.name == 'test':
            continue
        # TODO(cyrille): Test that those are not statically imported elsewhere.
        module = typing.cast(AppModule, importlib.import_module(f'.{package.name}', __package__))
        if module.app.name == 'main':
            # TODO(cyrille): Export main app as blueprint.
            # TODO(cyrille): Consider not making an exception for this one.
            app.register_blueprint(module.app)
        else:
            app.register_blueprint(module.app, url_prefix=f'/api/{module.app.name}')
